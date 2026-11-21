"""
NYSE market calendar helpers (holidays, early closes, regular session, Broker rest window).

Uses ``exchange_calendars`` (XNYS) when installed. Falls back to a weekday-only
check with fixed 09:30-16:00 hours if the library is unavailable, and logs a warning.
"""

from __future__ import annotations

import datetime as _dt
import logging
from functools import lru_cache
from typing import Optional, Tuple

from trading import config
from trading.ledger import MARKET_TZ, now_et

logger = logging.getLogger("MarketCalendar")

try:  # pragma: no cover - import guard
    import exchange_calendars as _xcals  # type: ignore
    import pandas as _pd  # type: ignore
except Exception:  # pragma: no cover
    _xcals = None
    _pd = None


@lru_cache(maxsize=1)
def _cal():
    if _xcals is None:
        logger.warning("exchange_calendars not installed: holiday checks fall back to weekdays only.")
        return None
    return _xcals.get_calendar("XNYS")


def is_trading_day(day: Optional[_dt.date] = None) -> bool:
    day = day or now_et().date()
    cal = _cal()
    if cal is None:
        return day.weekday() < 5
    try:
        return bool(cal.is_session(_pd.Timestamp(day)))
    except Exception:
        # Outside the calendar's bounds: fall back to weekday rule
        return day.weekday() < 5


def session_bounds(day: Optional[_dt.date] = None) -> Optional[Tuple[_dt.datetime, _dt.datetime]]:
    """Regular-session open/close in ET for `day`, or None when the market is closed."""
    day = day or now_et().date()
    if not is_trading_day(day):
        return None
    cal = _cal()
    if cal is not None:
        try:
            ts = _pd.Timestamp(day)
            o = cal.session_open(ts).tz_convert(MARKET_TZ).to_pydatetime()
            c = cal.session_close(ts).tz_convert(MARKET_TZ).to_pydatetime()
            return o, c
        except Exception:
            pass
    o = _dt.datetime.combine(day, _dt.time(9, 30), tzinfo=MARKET_TZ)
    c = _dt.datetime.combine(day, _dt.time(16, 0), tzinfo=MARKET_TZ)
    return o, c


def is_market_open(at: Optional[_dt.datetime] = None) -> bool:
    at = at or now_et()
    b = session_bounds(at.date())
    return bool(b and b[0] <= at < b[1])


def in_broker_rest_window(at: Optional[_dt.datetime] = None) -> bool:
    at = at or now_et()
    s = config.get_settings()
    start = at.replace(hour=s.rest_start[0], minute=s.rest_start[1], second=0, microsecond=0)
    end = at.replace(hour=s.rest_end[0], minute=s.rest_end[1], second=0, microsecond=0)
    return start <= at < end


def next_trading_day(after: _dt.date) -> _dt.date:
    d = after + _dt.timedelta(days=1)
    for _ in range(14):
        if is_trading_day(d):
            return d
        d += _dt.timedelta(days=1)
    return d


def describe(at: Optional[_dt.datetime] = None) -> dict:
    at = at or now_et()
    b = session_bounds(at.date())
    return {
        "now_et": at.isoformat(timespec="seconds"),
        "is_trading_day": b is not None,
        "session_open": b[0].isoformat(timespec="minutes") if b else None,
        "session_close": b[1].isoformat(timespec="minutes") if b else None,
        "market_open": is_market_open(at),
        "broker_rest_window": in_broker_rest_window(at),
        "calendar_source": "exchange_calendars:XNYS" if _cal() is not None else "weekday-fallback",
    }
