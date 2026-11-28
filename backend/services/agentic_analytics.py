"""
Agentic Activity Dashboard Analytics Engine.

Computes portfolio summary metrics, FIFO realized P/L, winning percentage,
cumulative realized P/L over time, and realized P/L by symbol from the
Agentic Activity Ledger (live Robinhood MCP filled orders or Sandbox orders).
"""

from __future__ import annotations

import datetime
import logging
from collections import deque
from typing import Any, Dict, List, Optional

logger = logging.getLogger("AgenticAnalytics")


def _parse_order_dt(ord_item: Dict[str, Any]) -> datetime.datetime:
    raw = str(ord_item.get("created_at") or ord_item.get("timestamp") or "").strip()
    if not raw:
        return datetime.datetime.min
    cleaned = raw.replace("Z", "+00:00")
    for fmt in (None, "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            if fmt is None:
                dt = datetime.datetime.fromisoformat(cleaned)
                return dt.replace(tzinfo=None)
            return datetime.datetime.strptime(cleaned[:19], fmt)
        except Exception:
            continue
    return datetime.datetime.min


def _format_short_date(dt: datetime.datetime, fallback: str = "") -> str:
    if dt == datetime.datetime.min:
        return fallback[:10] if fallback else ""
    return dt.strftime("%b %d").replace(" 0", " ")


def fetch_all_live_filled_orders(live_client: Any, account_id: str, max_pages: int = 10) -> List[Dict[str, Any]]:
    """
    Paginates Robinhood MCP get_equity_orders(state='filled') so historical buy/sell lots
    beyond page 1 are included in FIFO realized P/L analytics.
    """
    from trading.rh_tool_map import OP_GET_ORDER

    tool_orders = live_client.tool_map.get_tool_name(OP_GET_ORDER)
    if not tool_orders:
        return []

    collected: List[Dict[str, Any]] = []
    seen_ids = set()
    cursor: Optional[str] = None

    for _ in range(max_pages):
        args: Dict[str, Any] = {"account_number": account_id, "state": "filled"}
        if cursor:
            args["cursor"] = cursor

        res = live_client.call_tool(tool_orders, args, is_read=True)
        if not res.get("success"):
            break

        raw_data = live_client._unwrap_payload(res.get("data", {}))
        if isinstance(raw_data, dict):
            raw_orders = raw_data.get("orders", []) or []
            next_cursor = raw_data.get("next") or raw_data.get("next_cursor")
        elif isinstance(raw_data, list):
            raw_orders = raw_data
            next_cursor = None
        else:
            break

        for ord_item in raw_orders:
            ord_id = ord_item.get("id") or ord_item.get("order_id", "")
            if ord_id and ord_id in seen_ids:
                continue
            if ord_id:
                seen_ids.add(ord_id)

            symbol = (ord_item.get("symbol") or "").strip().upper()
            side = (ord_item.get("side") or "").strip().upper()
            state_val = (ord_item.get("state") or "").strip().upper()
            qty = float(ord_item.get("quantity") or 0.0)
            cum_qty = float(ord_item.get("cumulative_quantity") or qty)
            avg_price = float(ord_item.get("average_price") or ord_item.get("price") or 0.0)
            created_at = ord_item.get("last_transaction_at") or ord_item.get("created_at") or ""
            ts_clean = created_at.replace("T", " ").split(".")[0] if "T" in created_at else created_at

            collected.append({
                "order_id": ord_id,
                "symbol": symbol,
                "action": side,
                "side": side,
                "asset_type": "stock",
                "quantity": qty,
                "filled_quantity": cum_qty,
                "price": avg_price,
                "avg_fill_price": avg_price,
                "status": state_val or "FILLED",
                "timestamp": ts_clean,
                "created_at": created_at,
            })

        if not next_cursor or next_cursor == cursor:
            break
        cursor = str(next_cursor)

    return collected


def compute_agentic_dashboard(
    portfolio: Dict[str, Any],
    orders: Optional[List[Dict[str, Any]]] = None,
    starting_cash: float = 500.0,
) -> Dict[str, Any]:
    """
    Computes Agentic Activity Dashboard analytics from portfolio snapshot and filled orders.
    Uses FIFO lot matching for realized P/L, win rate, cumulative P/L curve, and per-symbol P/L.
    """
    raw_orders = orders if orders is not None else (portfolio.get("orders") or [])

    # Filter to filled equity orders with positive quantity and fill price
    filled_orders: List[Dict[str, Any]] = []
    for o in raw_orders:
        asset_type = str(o.get("asset_type", "stock")).lower()
        if asset_type != "stock":
            continue
        status = str(o.get("status", "")).strip().upper()
        if status not in ("FILLED", "PARTIALLY_FILLED"):
            continue
        qty = float(o.get("filled_quantity") or o.get("filled") or o.get("quantity") or 0.0)
        price = float(o.get("avg_fill_price") or o.get("price") or 0.0)
        symbol = str(o.get("symbol") or o.get("ticker") or "").strip().upper()
        side = str(o.get("action") or o.get("side") or "").strip().upper()
        if qty > 0 and price > 0 and symbol and side in ("BUY", "SELL"):
            filled_orders.append({
                "order_id": o.get("order_id", ""),
                "symbol": symbol,
                "side": side,
                "qty": qty,
                "price": price,
                "dt": _parse_order_dt(o),
                "timestamp": str(o.get("timestamp") or o.get("created_at") or ""),
            })

    # Sort chronologically ascending (oldest fill first; BUY before SELL on identical timestamp)
    filled_orders.sort(key=lambda x: (x["dt"], 0 if x["side"] == "BUY" else 1))

    # FIFO lot queues per symbol: deque of [remaining_qty, unit_cost]
    fifo_lots: Dict[str, deque] = {}
    buys_count = 0
    sells_count = 0
    winning_sells = 0
    losing_sells = 0
    breakeven_sells = 0
    volume_traded = 0.0
    total_realized_pnl = 0.0
    total_closed_cost = 0.0

    pnl_over_time: List[Dict[str, Any]] = []
    by_symbol_acc: Dict[str, Dict[str, Any]] = {}

    for o in filled_orders:
        sym = o["symbol"]
        qty = o["qty"]
        price = o["price"]
        notional = qty * price
        volume_traded += notional

        if o["side"] == "BUY":
            buys_count += 1
            fifo_lots.setdefault(sym, deque()).append([qty, price])
        else:
            sells_count += 1
            lots = fifo_lots.setdefault(sym, deque())
            rem_to_match = qty
            matched_cost = 0.0
            matched_qty = 0.0

            while rem_to_match > 1e-9 and lots:
                lot_qty, lot_price = lots[0]
                take = min(rem_to_match, lot_qty)
                matched_cost += take * lot_price
                matched_qty += take
                rem_to_match -= take
                if lot_qty - take <= 1e-9:
                    lots.popleft()
                else:
                    lots[0][0] = lot_qty - take

            # If a sell exceeds recorded buy history (e.g., pre-window holding), estimate unmatched cost at sell price (0 P/L)
            if rem_to_match > 1e-9:
                matched_cost += rem_to_match * price

            proceeds = notional
            trade_pnl = proceeds - matched_cost
            total_realized_pnl += trade_pnl
            total_closed_cost += matched_cost

            if trade_pnl > 0.0001:
                winning_sells += 1
            elif trade_pnl < -0.0001:
                losing_sells += 1
            else:
                breakeven_sells += 1

            trade_pnl_pct = (trade_pnl / matched_cost * 100.0) if matched_cost > 0 else 0.0

            pnl_over_time.append({
                "step": sells_count,
                "date_label": _format_short_date(o["dt"], o["timestamp"]),
                "timestamp": o["timestamp"],
                "symbol": sym,
                "qty": round(qty, 6),
                "sell_price": round(price, 4),
                "cost_basis": round(matched_cost, 2),
                "proceeds": round(proceeds, 2),
                "trade_pnl": round(trade_pnl, 2),
                "trade_pnl_pct": round(trade_pnl_pct, 2),
                "cumulative_pnl": round(total_realized_pnl, 2),
            })

            sym_entry = by_symbol_acc.setdefault(sym, {
                "symbol": sym,
                "realized_pnl": 0.0,
                "cost_basis": 0.0,
                "proceeds": 0.0,
                "sell_count": 0,
                "win_count": 0,
            })
            sym_entry["realized_pnl"] += trade_pnl
            sym_entry["cost_basis"] += matched_cost
            sym_entry["proceeds"] += proceeds
            sym_entry["sell_count"] += 1
            if trade_pnl > 0.0001:
                sym_entry["win_count"] += 1

    # Format per-symbol realized P/L sorted from worst loss (top) to best gain (bottom)
    realized_pnl_by_symbol: List[Dict[str, Any]] = []
    for sym, entry in by_symbol_acc.items():
        cost_b = entry["cost_basis"]
        pnl_val = entry["realized_pnl"]
        pnl_pct = (pnl_val / cost_b * 100.0) if cost_b > 0 else 0.0
        win_pct = (entry["win_count"] / entry["sell_count"] * 100.0) if entry["sell_count"] > 0 else 0.0
        realized_pnl_by_symbol.append({
            "symbol": sym,
            "realized_pnl": round(pnl_val, 2),
            "pnl_pct": round(pnl_pct, 2),
            "cost_basis": round(cost_b, 2),
            "proceeds": round(entry["proceeds"], 2),
            "sell_count": entry["sell_count"],
            "win_count": entry["win_count"],
            "win_rate_pct": round(win_pct, 1),
        })
    realized_pnl_by_symbol.sort(key=lambda x: x["realized_pnl"])

    # Account balance metrics from live/sandbox portfolio
    cash_available = round(float(portfolio.get("cash_available", 0.0)), 2)
    holdings = portfolio.get("holdings") or []
    holdings_count = len(holdings)
    invested_capital = round(float(portfolio.get("invested_capital", 0.0)), 2)
    total_equity = round(float(portfolio.get("total_equity", cash_available + invested_capital)), 2)
    unrealized_pnl = round(float(portfolio.get("unrealized_pnl", 0.0)), 2)

    # Open cost basis from current holdings (fallback to remaining FIFO lots if not provided)
    open_at_cost = round(sum(float(h.get("cost_basis") or (float(h.get("quantity", 0)) * float(h.get("avg_buy_price", h.get("avg_price", 0))))) for h in holdings), 2)
    if open_at_cost <= 0 and fifo_lots:
        open_at_cost = round(sum(q * p for lots in fifo_lots.values() for q, p in lots), 2)

    cash_pct = round((cash_available / total_equity * 100.0), 1) if total_equity > 0 else 0.0
    invested_pct = round((invested_capital / total_equity * 100.0), 1) if total_equity > 0 else 0.0

    start_cash = round(float(starting_cash), 2) if starting_cash > 0 else 500.0
    since_start_pnl = round(total_equity - start_cash, 2)
    since_start_pct = round((since_start_pnl / start_cash * 100.0), 2) if start_cash > 0 else 0.0

    win_rate_pct = round((winning_sells / sells_count * 100.0), 1) if sells_count > 0 else 0.0
    realized_pnl_pct_on_cost = round((total_realized_pnl / total_closed_cost * 100.0), 2) if total_closed_cost > 0 else 0.0

    return {
        "success": True,
        "environment": portfolio.get("environment", "UNKNOWN"),
        "account_id": portfolio.get("account_id", ""),
        "starting_cash": start_cash,
        "account_summary": {
            "total_net_equity": total_equity,
            "cash_available": cash_available,
            "cash_pct": cash_pct,
            "invested_capital": invested_capital,
            "invested_pct": invested_pct,
            "holdings_count": holdings_count,
            "open_at_cost": open_at_cost,
            "unrealized_pnl": unrealized_pnl,
            "since_start_pnl": since_start_pnl,
            "since_start_pct": since_start_pct,
        },
        "performance": {
            "realized_pnl": round(total_realized_pnl, 2),
            "realized_pnl_pct": realized_pnl_pct_on_cost,
            "closed_cost_basis": round(total_closed_cost, 2),
            "win_rate_pct": win_rate_pct,
            "winning_sells": winning_sells,
            "losing_sells": losing_sells,
            "breakeven_sells": breakeven_sells,
            "orders_filled": buys_count + sells_count,
            "buys_count": buys_count,
            "sells_count": sells_count,
            "volume_traded": round(volume_traded, 2),
        },
        "realized_pnl_over_time": pnl_over_time,
        "realized_pnl_by_symbol": realized_pnl_by_symbol,
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

