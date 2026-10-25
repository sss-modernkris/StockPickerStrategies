"""
Pending Execution Plan Manager for LIVE_APPROVAL Mode.

When running under LIVE_APPROVAL:
1. Broker Agent generates an execution plan without dispatching orders.
2. The plan is stored in ``_data/live_trading/pending_plan.json``.
3. The plan expires after 15 minutes or at 3:55 PM ET (whichever comes first).
4. When approved by the user, actions are re-validated through the LiveExecutionGateway
   with fresh quotes and submitted to Robinhood.
"""

from __future__ import annotations

import datetime as _dt
import json
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from trading import config
from trading import ledger
from trading import market_calendar

logger = logging.getLogger("ApprovalManager")
MARKET_TZ = ZoneInfo("America/New_York")
_lock = threading.Lock()


def _now_et() -> _dt.datetime:
    return _dt.datetime.now(MARKET_TZ)


def is_plan_expired(plan: Dict[str, Any]) -> tuple[bool, str]:
    """Validates if a pending plan is still within its valid time window."""
    created_at_str = plan.get("created_at")
    if not created_at_str:
        return True, "Missing creation timestamp"

    try:
        created_at = _dt.datetime.fromisoformat(created_at_str)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=MARKET_TZ)
    except Exception:
        return True, "Invalid creation timestamp format"

    now = _now_et()
    settings = config.get_settings()

    # Check 1: 15-minute TTL
    elapsed_minutes = (now - created_at).total_seconds() / 60.0
    if elapsed_minutes > settings.approval_ttl_min:
        return True, f"Plan expired: elapsed {elapsed_minutes:.1f} min exceeds {settings.approval_ttl_min} min TTL"

    # Check 2: 3:55 PM ET Cutoff
    cutoff_time = now.replace(
        hour=settings.approval_cutoff[0],
        minute=settings.approval_cutoff[1],
        second=0,
        microsecond=0
    )
    if now > cutoff_time:
        return True, f"Plan expired: passed daily market close cutoff ({settings.approval_cutoff[0]}:{settings.approval_cutoff[1]:02d} ET)"

    # Check 3: Market open
    if not market_calendar.is_market_open(now):
        return True, "Plan expired: market session is closed"

    return False, "Valid"


def save_pending_plan(
    pipeline_report: Dict[str, Any],
    source: str = "PIPELINE"
) -> Dict[str, Any]:
    """Stores a generated plan awaiting manual approval."""
    now = _now_et()
    settings = config.get_settings()
    plan_id = f"PLAN-{now.strftime('%Y%m%d-%H%M%S')}"

    broker_stage = pipeline_report.get("stage_2_broker", {})
    actions = broker_stage.get("actions", {})

    plan = {
        "plan_id": plan_id,
        "created_at": now.isoformat(timespec="seconds"),
        "status": "PENDING_APPROVAL",
        "ttl_minutes": settings.approval_ttl_min,
        "cutoff_et": f"{settings.approval_cutoff[0]}:{settings.approval_cutoff[1]:02d}",
        "source": source,
        "summary": broker_stage.get("execution_summary", "Rebalance plan pending approval"),
        "initial_cash": broker_stage.get("initial_cash", 0.0),
        "total_equity": broker_stage.get("total_portfolio_equity", 0.0),
        "planned_actions": actions,
        "pipeline_report": pipeline_report
    }

    config.ensure_data_dir()
    with _lock:
        with open(config.PENDING_PLAN_FILE, "w", encoding="utf-8") as f:
            json.dump(plan, f, indent=2)

    ledger.get_ledger().append(
        ledger.EV_PLAN,
        plan_id=plan_id,
        status="PENDING_APPROVAL",
        sells_count=len(actions.get("sells", [])),
        buys_count=len(actions.get("buys_stock", []))
    )

    logger.info(f"Saved pending execution plan {plan_id} waiting for manual user approval.")
    return plan


def get_pending_plan() -> Dict[str, Any]:
    """Fetches the active pending plan with real-time expiration telemetry."""
    if not os.path.exists(config.PENDING_PLAN_FILE):
        return {"has_plan": False, "plan": None}

    with _lock:
        try:
            with open(config.PENDING_PLAN_FILE, "r", encoding="utf-8") as f:
                plan = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read pending plan: {e}")
            return {"has_plan": False, "error": str(e)}

    if not plan or plan.get("status") != "PENDING_APPROVAL":
        return {"has_plan": False, "plan": plan}

    expired, reason = is_plan_expired(plan)
    if expired:
        plan["status"] = "EXPIRED"
        plan["expiration_reason"] = reason

    now = _now_et()
    try:
        created_at = _dt.datetime.fromisoformat(plan["created_at"])
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=MARKET_TZ)
        remaining_seconds = max(0, int((config.get_settings().approval_ttl_min * 60) - (now - created_at).total_seconds()))
    except Exception:
        remaining_seconds = 0

    return {
        "has_plan": True,
        "is_expired": expired,
        "seconds_remaining": remaining_seconds,
        "plan": plan
    }


def execute_approved_plan(actor: str = "user") -> Dict[str, Any]:
    """
    Submits planned orders through the LiveExecutionGateway with fresh quote checks.
    """
    from trading.live_gateway import LiveExecutionGateway

    plan_info = get_pending_plan()
    if not plan_info.get("has_plan"):
        return {"success": False, "error": "No pending plan found to approve."}

    plan = plan_info["plan"]
    if plan_info.get("is_expired"):
        return {"success": False, "error": f"Cannot execute expired plan: {plan.get('expiration_reason')}"}

    gateway = LiveExecutionGateway(mode="LIVE_APPROVAL")
    actions = plan.get("planned_actions", {})
    executed_sells = []
    executed_buys = []

    logger.info(f"[PLAN APPROVAL] Executing approved plan {plan.get('plan_id')} by actor '{actor}'")

    # 1. Execute Sells first to free up buying power
    for s in actions.get("sells", []):
        sym = s["symbol"]
        qty = float(s["quantity"])
        price = float(s["price"])
        res = gateway.place_stock_order(symbol=sym, action="SELL", quantity=qty, price=price)
        executed_sells.append({
            "symbol": sym,
            "action": "SELL",
            "quantity": qty,
            "result": res
        })

    # 2. Execute Stock Buys
    for b in actions.get("buys_stock", []):
        sym = b["symbol"]
        qty = float(b["quantity"])
        price = float(b["price"])
        if qty > 0:
            res = gateway.place_stock_order(symbol=sym, action="BUY", quantity=qty, price=price)
            executed_buys.append({
                "symbol": sym,
                "action": "BUY",
                "quantity": qty,
                "result": res
            })

    # Mark plan completed
    plan["status"] = "APPROVED_EXECUTED"
    plan["executed_at"] = _now_et().isoformat(timespec="seconds")
    plan["executed_by"] = actor
    plan["execution_results"] = {
        "sells": executed_sells,
        "buys": executed_buys
    }

    with _lock:
        with open(config.PENDING_PLAN_FILE, "w", encoding="utf-8") as f:
            json.dump(plan, f, indent=2)

    ledger.get_ledger().append(
        ledger.EV_PLAN,
        plan_id=plan.get("plan_id"),
        status="APPROVED_EXECUTED",
        actor=actor
    )

    return {
        "success": True,
        "message": f"Successfully approved and executed plan {plan.get('plan_id')}",
        "execution_results": plan["execution_results"]
    }


def reject_pending_plan(reason: str = "User rejected", actor: str = "user") -> Dict[str, Any]:
    """Rejects the active plan."""
    plan_info = get_pending_plan()
    if not plan_info.get("has_plan"):
        return {"success": False, "error": "No pending plan to reject."}

    plan = plan_info["plan"]
    plan["status"] = "REJECTED"
    plan["rejected_at"] = _now_et().isoformat(timespec="seconds")
    plan["rejected_by"] = actor
    plan["rejection_reason"] = reason

    with _lock:
        with open(config.PENDING_PLAN_FILE, "w", encoding="utf-8") as f:
            json.dump(plan, f, indent=2)

    ledger.get_ledger().append(
        ledger.EV_PLAN,
        plan_id=plan.get("plan_id"),
        status="REJECTED",
        reason=reason,
        actor=actor
    )

    logger.info(f"Rejected plan {plan.get('plan_id')} by actor '{actor}': {reason}")
    return {"success": True, "message": f"Plan {plan.get('plan_id')} rejected."}
