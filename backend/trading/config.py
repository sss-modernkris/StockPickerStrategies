"""
Trading configuration helpers.

All live-trading settings are read from environment variables (populated from the
project-root ``.env`` file). Values are re-read on every call so that edits to
``.env`` or runtime overrides take effect without restarting the backend.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("TradingConfig")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
ENV_FILE = os.path.join(PROJECT_ROOT, ".env")

# Runtime data (gitignored via `_data/`)
LIVE_DATA_DIR = os.path.join(PROJECT_ROOT, "_data", "live_trading")
LEDGER_FILE = os.path.join(LIVE_DATA_DIR, "ledger.jsonl")
STATE_FILE = os.path.join(LIVE_DATA_DIR, "mode_state.json")
PENDING_PLAN_FILE = os.path.join(LIVE_DATA_DIR, "pending_plan.json")

# Tool discovery output (tool names are not secret, so they live in docs/)
DOCS_DIR = os.path.join(PROJECT_ROOT, "docs")
TOOLS_LIST_FILE = os.path.join(DOCS_DIR, "robinhood_mcp_tools.json")
TOOL_MAP_FILE = os.path.join(DOCS_DIR, "robinhood_mcp_tool_map.json")

VALID_MODES = ("SANDBOX", "LIVE_SHADOW", "LIVE_APPROVAL", "LIVE_AUTONOMOUS")
LIVE_MODES = ("LIVE_SHADOW", "LIVE_APPROVAL", "LIVE_AUTONOMOUS")
AUTONOMOUS_CONFIRMATION_PHRASE = "I UNDERSTAND THIS TRADES REAL MONEY"

_env_loaded = False


def _candidate_env_paths() -> list[str]:
    return [
        os.path.join(PROJECT_ROOT, ".env"),
        os.path.join(BACKEND_DIR, ".env"),
        "/.env",
        "/app/.env",
    ]


def load_env(force: bool = False) -> None:
    """Loads KEY=VALUE pairs from the project-root .env into os.environ (no override)."""
    global _env_loaded
    if _env_loaded and not force:
        return
    _env_loaded = True

    for candidate in _candidate_env_paths():
        if not os.path.exists(candidate):
            continue
        try:
            with open(candidate, "r", encoding="utf-8") as f:
                for raw in f:
                    line = raw.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    # Strip inline comments (" # ...") and quotes
                    val = val.split(" #", 1)[0].strip().strip("\"'")
                    if key and key not in os.environ:
                        os.environ[key] = val
            break
        except Exception as e:  # pragma: no cover - defensive
            logger.warning(f"Could not load .env from {candidate}: {e}")


def _f(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        logger.warning(f"Invalid float for {name}; using default {default}")
        return default


def _b(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _hhmm(name: str, default: str) -> tuple[int, int]:
    raw = os.getenv(name, default).strip()
    try:
        h, m = raw.split(":")
        return int(h), int(m)
    except Exception:
        h, m = default.split(":")
        return int(h), int(m)


def default_token_path() -> str:
    raw = os.getenv("ROBINHOOD_OAUTH_TOKEN_PATH", "").strip()
    if raw:
        return os.path.expanduser(os.path.expandvars(raw))
    return os.path.join(os.path.expanduser("~"), ".strategicalpha", "robinhood_oauth.json")


@dataclass(frozen=True)
class LiveSettings:
    env_mode: str
    mcp_url: str
    agentic_account_number: str
    token_path: str
    max_spread_pct: float
    max_signal_deviation_pct: float
    limit_buffer_pct: float
    fill_timeout_sec: float
    fill_poll_interval_sec: float
    max_daily_drawdown_pct: float
    daily_spend_limit: float
    position_cap_pct: float
    env_kill_switch: bool
    rest_start: tuple[int, int]
    rest_end: tuple[int, int]
    approval_ttl_min: float
    approval_cutoff: tuple[int, int]
    circuit_breaker_threshold: int
    oauth_callback_port: int
    alert_email: Optional[str]


def get_settings() -> LiveSettings:
    load_env()
    mode = os.getenv("TRADING_MODE", "SANDBOX").strip().upper()
    if mode not in VALID_MODES:
        logger.warning(f"Unknown TRADING_MODE={mode!r}; falling back to SANDBOX")
        mode = "SANDBOX"
    return LiveSettings(
        env_mode=mode,
        mcp_url=os.getenv("ROBINHOOD_MCP_URL", "https://agent.robinhood.com/mcp/trading").strip(),
        agentic_account_number=os.getenv("ROBINHOOD_AGENTIC_ACCOUNT_NUMBER", "").strip(),
        token_path=default_token_path(),
        max_spread_pct=_f("LIVE_MAX_SPREAD_PCT", 0.50),
        max_signal_deviation_pct=_f("LIVE_MAX_SIGNAL_DEVIATION_PCT", 1.0),
        limit_buffer_pct=_f("LIVE_LIMIT_BUFFER_PCT", 0.25),
        fill_timeout_sec=_f("LIVE_FILL_TIMEOUT_SEC", 60.0),
        fill_poll_interval_sec=_f("LIVE_FILL_POLL_INTERVAL_SEC", 2.0),
        max_daily_drawdown_pct=_f("LIVE_MAX_DAILY_DRAWDOWN_PCT", 2.0),
        daily_spend_limit=_f("ROBINHOOD_DAILY_SPEND_LIMIT", 5000.0),
        position_cap_pct=_f("ROBINHOOD_POSITION_CAP_PCT", 15.0),
        env_kill_switch=_b("ROBINHOOD_EMERGENCY_KILL_SWITCH", False),
        rest_start=_hhmm("BROKER_REST_START_ET", "11:30"),
        rest_end=_hhmm("BROKER_REST_END_ET", "13:55"),
        approval_ttl_min=_f("LIVE_APPROVAL_TTL_MIN", 15.0),
        approval_cutoff=_hhmm("LIVE_APPROVAL_CUTOFF_ET", "15:55"),
        circuit_breaker_threshold=int(_f("LIVE_CIRCUIT_BREAKER_THRESHOLD", 3)),
        oauth_callback_port=int(_f("ROBINHOOD_OAUTH_CALLBACK_PORT", 33418)),
        alert_email=os.getenv("LIVE_ALERT_EMAIL") or os.getenv("SENDER_EMAIL") or None,
    )


def mask_account(acct: Optional[str]) -> str:
    if not acct:
        return "(not set)"
    acct = str(acct)
    return f"****{acct[-4:]}" if len(acct) > 4 else "****"


def ensure_data_dir() -> None:
    os.makedirs(LIVE_DATA_DIR, exist_ok=True)
