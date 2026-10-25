"""
Append-only live trading audit ledger (``_data/live_trading/ledger.jsonl``).

Every gateway decision, shadow intent, order submission, status poll, cancel and
mode change is written here. The ledger is also the local source of truth for the
daily spend total, positions opened today, and the intraday equity baseline.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import threading
from typing import Any, Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

from trading import config

MARKET_TZ = ZoneInfo("America/New_York")
_lock = threading.Lock()

# Event types
EV_DECISION = "GATEWAY_DECISION"
EV_SHADOW = "SHADOW_INTENT"
EV_SUBMIT = "ORDER_SUBMITTED"
EV_STATUS = "ORDER_STATUS"
EV_CANCEL = "ORDER_CANCEL"
EV_FINAL = "ORDER_FINAL"
EV_ERROR = "ERROR"
EV_MODE = "MODE_CHANGE"
EV_KILL = "KILL_SWITCH"
EV_BREAKER = "CIRCUIT_BREAKER"
EV_BASELINE = "EQUITY_BASELINE"
EV_PLAN = "APPROVAL_PLAN"
EV_RUN = "PIPELINE_RUN"


def now_et() -> _dt.datetime:
    return _dt.datetime.now(MARKET_TZ)


def today_et() -> str:
    return now_et().strftime("%Y-%m-%d")


class Ledger:
    def __init__(self, path: Optional[str] = None):
        self.path = path or config.LEDGER_FILE

    # ------------------------------------------------------------------ write
    def append(self, event: str, **fields: Any) -> Dict[str, Any]:
        ts = now_et()
        record = {
            "ts": ts.isoformat(timespec="seconds"),
            "date_et": ts.strftime("%Y-%m-%d"),
            "event": event,
            **fields,
        }
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        line = json.dumps(record, default=str)
        with _lock:
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        return record

    # ------------------------------------------------------------------- read
    def iter_records(self) -> Iterable[Dict[str, Any]]:
        if not os.path.exists(self.path):
            return []
        out: List[Dict[str, Any]] = []
        with _lock:
            with open(self.path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        out.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return out

    def page(self, offset: int = 0, limit: int = 100, event: Optional[str] = None,
             date_et: Optional[str] = None) -> Dict[str, Any]:
        """Newest-first paging."""
        recs = list(self.iter_records())
        if event:
            recs = [r for r in recs if r.get("event") == event]
        if date_et:
            recs = [r for r in recs if r.get("date_et") == date_et]
        recs.reverse()
        total = len(recs)
        return {"total": total, "offset": offset, "limit": limit, "records": recs[offset: offset + limit]}

    # ------------------------------------------------------------ aggregates
    def today_final_orders(self, date_et: Optional[str] = None) -> List[Dict[str, Any]]:
        d = date_et or today_et()
        return [r for r in self.iter_records() if r.get("event") == EV_FINAL and r.get("date_et") == d]

    def today_spend_total(self, date_et: Optional[str] = None) -> float:
        """Sum of filled BUY notional today (live orders only)."""
        total = 0.0
        for r in self.today_final_orders(date_et):
            if str(r.get("side", "")).upper() == "BUY":
                total += float(r.get("filled_quantity") or 0.0) * float(r.get("avg_fill_price") or 0.0)
        return round(total, 2)

    def symbols_bought_today(self, date_et: Optional[str] = None) -> set:
        return {
            str(r.get("symbol", "")).upper()
            for r in self.today_final_orders(date_et)
            if str(r.get("side", "")).upper() == "BUY" and float(r.get("filled_quantity") or 0) > 0
        }

    def find_client_order(self, client_order_id: str) -> Optional[Dict[str, Any]]:
        """Latest record (submit/final) for an idempotency key."""
        latest = None
        for r in self.iter_records():
            if r.get("client_order_id") == client_order_id and r.get("event") in (EV_SUBMIT, EV_FINAL, EV_STATUS):
                latest = r
        return latest

    def equity_baseline(self, date_et: Optional[str] = None) -> Optional[float]:
        d = date_et or today_et()
        for r in self.iter_records():
            if r.get("event") == EV_BASELINE and r.get("date_et") == d:
                try:
                    return float(r.get("total_equity"))
                except (TypeError, ValueError):
                    return None
        return None

    def record_baseline_if_missing(self, total_equity: float) -> float:
        base = self.equity_baseline()
        if base is None and total_equity > 0:
            self.append(EV_BASELINE, total_equity=round(total_equity, 2))
            return total_equity
        return base if base is not None else total_equity


_default: Optional[Ledger] = None


def get_ledger() -> Ledger:
    global _default
    if _default is None:
        _default = Ledger()
    return _default
