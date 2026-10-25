"""
Persistent runtime trading state: active mode, kill switch, circuit breaker.

Stored in ``_data/live_trading/mode_state.json``. ``TRADING_MODE`` in ``.env`` is the
starting default; runtime changes made via the API are persisted here and win until
cleared. Switching to ``LIVE_AUTONOMOUS`` at runtime requires the confirmation phrase.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any, Dict, Optional

from trading import config
from trading.ledger import EV_BREAKER, EV_KILL, EV_MODE, get_ledger, now_et

logger = logging.getLogger("TradingState")
_lock = threading.RLock()


class ModeChangeError(ValueError):
    pass


def _read() -> Dict[str, Any]:
    if not os.path.exists(config.STATE_FILE):
        return {}
    try:
        with open(config.STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except Exception as e:
        logger.error(f"Failed to read {config.STATE_FILE}: {e}")
        return {}


def _write(state: Dict[str, Any]) -> None:
    config.ensure_data_dir()
    tmp = config.STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, config.STATE_FILE)


# ---------------------------------------------------------------------- mode
def get_mode() -> str:
    with _lock:
        st = _read()
        mode = st.get("mode")
        if mode in config.VALID_MODES:
            return mode
        return config.get_settings().env_mode


def set_mode(mode: str, confirmation: Optional[str] = None, actor: str = "api") -> Dict[str, Any]:
    mode = (mode or "").strip().upper()
    if mode not in config.VALID_MODES:
        raise ModeChangeError(f"Invalid mode {mode!r}. Valid: {', '.join(config.VALID_MODES)}")
    if mode == "LIVE_AUTONOMOUS" and (confirmation or "").strip() != config.AUTONOMOUS_CONFIRMATION_PHRASE:
        raise ModeChangeError(
            f"Switching to LIVE_AUTONOMOUS requires the confirmation phrase: "
            f"'{config.AUTONOMOUS_CONFIRMATION_PHRASE}'"
        )
    with _lock:
        st = _read()
        previous = st.get("mode") or config.get_settings().env_mode
        st["mode"] = mode
        st["mode_changed_at"] = now_et().isoformat(timespec="seconds")
        st["mode_changed_by"] = actor
        _write(st)
    get_ledger().append(EV_MODE, previous=previous, mode=mode, actor=actor)
    logger.warning(f"TRADING MODE CHANGED: {previous} -> {mode} (by {actor})")
    return {"previous": previous, "mode": mode}


# --------------------------------------------------------------- kill switch
def kill_switch_active() -> bool:
    if config.get_settings().env_kill_switch:
        return True
    with _lock:
        return bool(_read().get("kill_switch", False))


def set_kill_switch(active: bool, actor: str = "api", reason: str = "") -> Dict[str, Any]:
    with _lock:
        st = _read()
        st["kill_switch"] = bool(active)
        st["kill_switch_changed_at"] = now_et().isoformat(timespec="seconds")
        _write(st)
    get_ledger().append(EV_KILL, active=bool(active), actor=actor, reason=reason)
    logger.warning(f"KILL SWITCH {'ENGAGED' if active else 'RELEASED'} by {actor} {reason}")
    return {"kill_switch": bool(active), "env_kill_switch": config.get_settings().env_kill_switch}


# ----------------------------------------------------------- circuit breaker
def breaker_state() -> Dict[str, Any]:
    with _lock:
        st = _read()
        return {
            "open": bool(st.get("breaker_open", False)),
            "consecutive_failures": int(st.get("breaker_failures", 0)),
            "reason": st.get("breaker_reason"),
            "opened_at": st.get("breaker_opened_at"),
            "threshold": config.get_settings().circuit_breaker_threshold,
        }


def record_failure(reason: str) -> Dict[str, Any]:
    threshold = config.get_settings().circuit_breaker_threshold
    tripped = False
    with _lock:
        st = _read()
        n = int(st.get("breaker_failures", 0)) + 1
        st["breaker_failures"] = n
        if n >= threshold and not st.get("breaker_open"):
            st["breaker_open"] = True
            st["breaker_reason"] = reason
            st["breaker_opened_at"] = now_et().isoformat(timespec="seconds")
            tripped = True
        _write(st)
    if tripped:
        trip_breaker(reason, already_written=True)
    return breaker_state()


def record_success() -> None:
    with _lock:
        st = _read()
        if st.get("breaker_failures"):
            st["breaker_failures"] = 0
            _write(st)


def trip_breaker(reason: str, already_written: bool = False) -> None:
    if not already_written:
        with _lock:
            st = _read()
            st["breaker_open"] = True
            st["breaker_reason"] = reason
            st["breaker_opened_at"] = now_et().isoformat(timespec="seconds")
            _write(st)
    get_ledger().append(EV_BREAKER, open=True, reason=reason)
    logger.error(f"CIRCUIT BREAKER OPEN: {reason}")
    _send_alert("Robinhood live trading circuit breaker OPEN", reason)


def reset_breaker(actor: str = "api") -> Dict[str, Any]:
    with _lock:
        st = _read()
        st["breaker_open"] = False
        st["breaker_failures"] = 0
        st["breaker_reason"] = None
        st["breaker_opened_at"] = None
        _write(st)
    get_ledger().append(EV_BREAKER, open=False, actor=actor)
    return breaker_state()


def _send_alert(subject: str, body: str) -> None:
    """Best-effort email alert reusing the existing SMTP settings."""
    try:
        to = config.get_settings().alert_email
        if not to:
            return
        from services.email_service import send_email_with_attachment  # type: ignore
        send_email_with_attachment(to_email=to, subject=subject, body=body, file_path=None)
    except Exception as e:  # pragma: no cover - alerting must never break trading flow
        logger.warning(f"Alert email failed: {e}")


def snapshot() -> Dict[str, Any]:
    s = config.get_settings()
    with _lock:
        st = _read()
    return {
        "mode": get_mode(),
        "env_default_mode": s.env_mode,
        "mode_changed_at": st.get("mode_changed_at"),
        "mode_changed_by": st.get("mode_changed_by"),
        "kill_switch": kill_switch_active(),
        "env_kill_switch": s.env_kill_switch,
        "circuit_breaker": breaker_state(),
    }
