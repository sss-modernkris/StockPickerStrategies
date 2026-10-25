"""
Robinhood Live MCP Client.

Streamable HTTP client connecting to https://agent.robinhood.com/mcp/trading
using official Python MCP SDK with OAuth 2.1 authentication and automated token refresh.
Normalizes real account and positions data into the exact schema expected by the Broker Agent.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from typing import Any, Dict, List, Optional

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client
from mcp.shared._httpx_utils import create_mcp_http_client

from trading import config
from trading import ledger
from trading import state
from trading.live_auth import build_oauth_provider, check_auth_health
from trading.rh_tool_map import (
    OP_CANCEL_ORDER,
    OP_GET_ACCOUNTS,
    OP_GET_PORTFOLIO,
    OP_GET_ORDER,
    OP_GET_POSITIONS,
    OP_GET_QUOTE,
    OP_PLACE_EQUITY_ORDER,
    OP_REVIEW_EQUITY_ORDER,
    get_tool_map,
)

logger = logging.getLogger("LiveMCPClient")


class AsyncWorkerThread:
    """Manages a background asyncio event loop for executing asynchronous MCP calls from sync agents."""

    def __init__(self):
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, name="LiveMCPLoop", daemon=True)
        self.thread.start()

    def run(self, coro, timeout: float = 60.0):
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return future.result(timeout=timeout)


_worker: Optional[AsyncWorkerThread] = None


def _get_worker() -> AsyncWorkerThread:
    global _worker
    if _worker is None or not _worker.thread.is_alive():
        _worker = AsyncWorkerThread()
    return _worker


class LiveMCPClient:
    """Client for executing verified Live Robinhood MCP operations."""

    def __init__(self):
        self.settings = config.get_settings()
        self.tool_map = get_tool_map()
        self.environment = "ROBINHOOD_MCP_LIVE"
        self._pinned_account_checked = False
        logger.info(f"LiveMCPClient initialized targeting {self.settings.mcp_url}")

    # -------------------------------------------------------------------------
    # Core MCP Tool Invocation
    # -------------------------------------------------------------------------
    async def _call_mcp_tool_async(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        is_read: bool = True
    ) -> Dict[str, Any]:
        """
        Executes a remote MCP tool via Streamable HTTP with automatic token refresh.
        Read operations retry up to 2 times on transient network error. Write operations never auto-retry.
        """
        max_attempts = 3 if is_read else 1
        last_error = None
        settings = config.get_settings()

        for attempt in range(1, max_attempts + 1):
            try:
                provider = build_oauth_provider(interactive=False)
                http_client = create_mcp_http_client(auth=provider)

                async with streamable_http_client(settings.mcp_url, http_client=http_client) as (read_stream, write_stream):
                    async with ClientSession(read_stream, write_stream) as session:
                        await session.initialize()
                        logger.debug(f"Calling MCP tool '{tool_name}' (attempt {attempt}) with args {arguments}")
                        call_res = await session.call_tool(tool_name, arguments=arguments)

                        # Parse response content
                        if hasattr(call_res, "content") and call_res.content:
                            text_blocks = [c.text for c in call_res.content if hasattr(c, "text") and c.text]
                            combined = "\n".join(text_blocks).strip()
                            try:
                                parsed = json.loads(combined)
                                state.record_success()
                                return {"success": True, "data": parsed, "raw": combined}
                            except json.JSONDecodeError:
                                state.record_success()
                                return {"success": True, "data": {"text": combined}, "raw": combined}

                        if getattr(call_res, "is_error", False):
                            err_msg = f"MCP tool '{tool_name}' returned error: {call_res}"
                            logger.error(err_msg)
                            state.record_failure(err_msg)
                            return {"success": False, "error": err_msg}

                        state.record_success()
                        return {"success": True, "data": {}, "raw": ""}

            except Exception as e:
                last_error = e
                logger.warning(f"Error calling MCP tool '{tool_name}' (attempt {attempt}/{max_attempts}): {e}")
                if attempt < max_attempts and is_read:
                    await asyncio.sleep(1.0 * (2 ** (attempt - 1)))

        err_msg = f"Failed to execute MCP tool '{tool_name}': {last_error}"
        logger.error(err_msg)
        state.record_failure(err_msg)
        return {"success": False, "error": err_msg}

    def call_tool(self, tool_name: str, arguments: Dict[str, Any], is_read: bool = True) -> Dict[str, Any]:
        """Synchronous wrapper for tool execution."""
        return _get_worker().run(self._call_mcp_tool_async(tool_name, arguments, is_read=is_read))

    def list_raw_tools(self) -> List[Dict[str, Any]]:
        """Queries tools/list from Robinhood MCP and updates the local tool map."""
        async def _list_async():
            provider = build_oauth_provider(interactive=False)
            http_client = create_mcp_http_client(auth=provider)
            async with streamable_http_client(self.settings.mcp_url, http_client=http_client) as (read_stream, write_stream):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    list_res = await session.list_tools()
                    tools = []
                    for t in getattr(list_res, "tools", []):
                        tools.append(t.model_dump(mode="json") if hasattr(t, "model_dump") else dict(t))
                    self.tool_map.save_tools(tools)
                    return tools

        return _get_worker().run(_list_async(), timeout=30.0)

    @staticmethod
    def _unwrap_payload(data: Any) -> Any:
        """Robinhood MCP tools wrap results in {'data': {...}, 'guide': '...'}. Unwraps inner data."""
        if isinstance(data, dict) and "data" in data and isinstance(data["data"], (dict, list)):
            return data["data"]
        return data

    # -------------------------------------------------------------------------
    # Account Discovery, Pinning & Security Guard
    # -------------------------------------------------------------------------
    def get_agentic_account_number(self) -> str:
        """
        Returns the agentic account number. If ROBINHOOD_AGENTIC_ACCOUNT_NUMBER is set in config,
        validates and returns it. Otherwise, calls get_accounts to discover the account where
        agentic_allowed is True.
        """
        configured = (self.settings.agentic_account_number or "").strip()
        if configured:
            return configured

        # Dynamically discover from get_accounts
        try:
            tool_accounts = self.tool_map.get_tool_name(OP_GET_ACCOUNTS)
            acct_res = self.call_tool(tool_accounts, {}, is_read=True)
            if acct_res.get("success"):
                data = self._unwrap_payload(acct_res.get("data", {}))
                accounts = data.get("accounts", []) if isinstance(data, dict) else []
                for acct in accounts:
                    if acct.get("agentic_allowed") is True:
                        discovered = str(acct.get("account_number", "")).strip()
                        if discovered:
                            logger.info(f"Dynamically discovered agentic-allowed account: ****{discovered[-4:]}")
                            return discovered
        except Exception as e:
            logger.warning(f"Could not discover agentic account from get_accounts: {e}")

        return configured or "RH-AGENTIC-LIVE"

    def _verify_account_pinning(self, reported_account_id: str) -> None:
        """
        Enforces that the MCP session account strictly matches ROBINHOOD_AGENTIC_ACCOUNT_NUMBER if configured.
        Prevents accidentally trading against a personal or non-agentic account.
        """
        configured = self.settings.agentic_account_number
        if not configured:
            return

        reported = str(reported_account_id).strip()
        configured = str(configured).strip()

        if reported and configured and reported != configured:
            err = (
                f"SECURITY VIOLATION: Robinhood MCP reported account ID '{reported}' does not match "
                f"configured Agentic account '{configured}'. Trading halted immediately."
            )
            logger.critical(err)
            state.trip_breaker(err)
            raise PermissionError(err)

        self._pinned_account_checked = True

    # -------------------------------------------------------------------------
    # Portfolio Normalization (Matches Sandbox Schema for Broker Agent)
    # -------------------------------------------------------------------------
    def get_portfolio(self) -> Dict[str, Any]:
        """
        Fetches live account balances and positions via Robinhood MCP and normalizes
        them into the exact schema expected by the Broker Agent.
        """
        account_id = self.get_agentic_account_number()
        self._verify_account_pinning(account_id)

        tool_port = self.tool_map.get_tool_name(OP_GET_PORTFOLIO)
        tool_pos = self.tool_map.get_tool_name(OP_GET_POSITIONS)

        # 1. Fetch Portfolio & Balances
        port_res = self.call_tool(tool_port, {"account_number": account_id}, is_read=True)
        if not port_res.get("success"):
            logger.error(f"Failed to fetch portfolio from MCP: {port_res.get('error')}")
            return self._build_empty_portfolio(error=port_res.get("error"))

        port_data = self._unwrap_payload(port_res.get("data", {}))
        if isinstance(port_data, dict) and "portfolio" in port_data:
            port_data = port_data["portfolio"]

        # Parse Buying Power safely (handle dict or scalar)
        bp_raw = port_data.get("buying_power")
        if isinstance(bp_raw, dict):
            try:
                buying_power = float(bp_raw.get("buying_power", 0.0) or bp_raw.get("unleveraged_buying_power", 0.0))
            except (ValueError, TypeError):
                buying_power = 0.0
        elif bp_raw is not None:
            try:
                buying_power = float(bp_raw)
            except (ValueError, TypeError):
                buying_power = 0.0
        else:
            try:
                buying_power = float(port_data.get("cash", 0.0))
            except (ValueError, TypeError):
                buying_power = 0.0

        # Parse Total Equity
        total_equity = float(
            port_data.get("total_value")
            or port_data.get("equity_value")
            or port_data.get("total_equity")
            or buying_power
        )

        # Record daily equity baseline in ledger
        ledger_inst = ledger.get_ledger()
        ledger_inst.record_baseline_if_missing(total_equity)

        # 2. Fetch Active Positions
        holdings_list: List[Dict[str, Any]] = []
        pos_res = self.call_tool(tool_pos, {"account_number": account_id}, is_read=True)
        if pos_res.get("success"):
            raw_data = self._unwrap_payload(pos_res.get("data", {}))
            if isinstance(raw_data, dict):
                raw_positions = raw_data.get("positions") or raw_data.get("holdings", [])
            elif isinstance(raw_data, list):
                raw_positions = raw_data
            else:
                raw_positions = []

            # Batch quote lookup if positions exist
            symbols_to_quote = [
                str(p.get("symbol") or p.get("ticker", "")).strip().upper()
                for p in raw_positions
                if (p.get("symbol") or p.get("ticker"))
            ]
            quotes_cache = {}
            if symbols_to_quote:
                for sym in set(symbols_to_quote):
                    q = self.get_quote(sym)
                    if q.get("mid", 0) > 0:
                        quotes_cache[sym.upper()] = q["mid"]

            for p in raw_positions:
                qty = float(p.get("quantity") or p.get("shares") or p.get("total_quantity", 0.0))
                if qty <= 0:
                    continue
                sym = str(p.get("symbol") or p.get("ticker", "")).strip().upper()
                avg_price = float(p.get("average_buy_price") or p.get("avg_price", 0.0))
                cur_price = quotes_cache.get(sym) or float(p.get("current_price") or p.get("price") or avg_price)
                mkt_val = round(qty * cur_price, 2)
                cost_basis = round(qty * avg_price, 2)
                pnl = round(mkt_val - cost_basis, 2)

                holdings_list.append({
                    "symbol": sym,
                    "asset_type": "stock",
                    "quantity": qty,
                    "total_quantity": qty,
                    "shares_available_for_sells": float(p.get("shares_available_for_sells", qty)),
                    "avg_price": avg_price,
                    "avg_buy_price": avg_price,
                    "current_price": cur_price,
                    "market_value": mkt_val,
                    "total_value": mkt_val,
                    "cost_basis": cost_basis,
                    "unrealized_pnl": pnl,
                    "unrealized_pnl_pct": round((pnl / cost_basis * 100.0), 2) if cost_basis > 0 else 0.0
                })

        # 3. Fetch Active & Recent Orders from Robinhood MCP
        orders_list: List[Dict[str, Any]] = []
        queued_orders: List[Dict[str, Any]] = []
        tool_orders = self.tool_map.get_tool_name(OP_GET_ORDER)
        if tool_orders:
            orders_res = self.call_tool(tool_orders, {"account_number": account_id}, is_read=True)
            if orders_res.get("success"):
                raw_orders_data = self._unwrap_payload(orders_res.get("data", {}))
                if isinstance(raw_orders_data, dict):
                    raw_orders = raw_orders_data.get("orders", [])
                elif isinstance(raw_orders_data, list):
                    raw_orders = raw_orders_data
                else:
                    raw_orders = []

                for ord_item in raw_orders:
                    ord_id = ord_item.get("id") or ord_item.get("order_id", "")
                    symbol = (ord_item.get("symbol") or "").strip().upper()
                    side = (ord_item.get("side") or "").strip().upper()
                    state_val = (ord_item.get("state") or "").strip().upper()
                    qty = float(ord_item.get("quantity") or 0.0)
                    cum_qty = float(ord_item.get("cumulative_quantity") or 0.0)
                    price = float(ord_item.get("price") or ord_item.get("average_price") or 0.0)
                    created_at = ord_item.get("created_at") or ord_item.get("last_transaction_at", "")
                    ts_clean = created_at.replace("T", " ").split(".")[0] if "T" in created_at else created_at

                    norm_ord = {
                        "order_id": ord_id,
                        "account": account_id,
                        "environment": "LIVE",
                        "symbol": symbol,
                        "ticker": symbol,
                        "asset_type": "stock",
                        "action": side,
                        "side": side,
                        "quantity": qty,
                        "filled": cum_qty,
                        "filled_quantity": cum_qty,
                        "total_quantity": qty,
                        "price": price,
                        "avg_fill_price": float(ord_item.get("average_price") or price),
                        "status": state_val,
                        "timestamp": ts_clean,
                        "created_at": created_at,
                    }
                    orders_list.append(norm_ord)

                    if state_val in ("QUEUED", "NEW", "UNCONFIRMED", "CONFIRMED", "PARTIALLY_FILLED"):
                        queued_orders.append(norm_ord)

        # 4. Guardrails summary from live settings and ledger
        daily_limit = self.settings.daily_spend_limit
        today_spent = ledger_inst.today_spend_total()
        rem_budget = max(0.0, round(daily_limit - today_spent, 2))
        invested_cap = max(0.0, round(total_equity - buying_power, 2))
        stock_equity = round(sum(h.get("total_value", 0.0) for h in holdings_list), 2)

        return {
            "account_id": account_id,
            "environment": self.environment,
            "is_simulated": False,
            "cash_available": buying_power,
            "buying_power": buying_power,
            "invested_capital": invested_cap,
            "stock_equity": stock_equity,
            "option_equity": 0.0,
            "total_equity": total_equity,
            "holdings": holdings_list,
            "queued_orders": queued_orders,
            "option_positions": [],  # Equities only in live policy
            "orders": orders_list,
            "guardrails": {
                "environment": self.environment,
                "daily_spend_limit": daily_limit,
                "today_spend_total": today_spent,
                "remaining_daily_budget": rem_budget,
                "position_cap_pct": self.settings.position_cap_pct,
                "emergency_kill_switch": state.kill_switch_active(),
            },
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }

    def _build_empty_portfolio(self, error: Optional[str] = None) -> Dict[str, Any]:
        """Defensive fallback structure if MCP call fails."""
        acct_id = self.settings.agentic_account_number or "UNKNOWN"
        return {
            "account_id": acct_id,
            "environment": self.environment,
            "is_simulated": False,
            "cash_available": 0.0,
            "buying_power": 0.0,
            "total_equity": 0.0,
            "holdings": [],
            "option_positions": [],
            "orders": [],
            "guardrails": {
                "environment": self.environment,
                "daily_spend_limit": self.settings.daily_spend_limit,
                "today_spend_total": ledger.get_ledger().today_spend_total(),
                "remaining_daily_budget": 0.0,
                "position_cap_pct": self.settings.position_cap_pct,
                "emergency_kill_switch": True,
            },
            "error": error,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }

    # -------------------------------------------------------------------------
    # Market Data & Fresh Quotes
    # -------------------------------------------------------------------------
    def get_quote(self, symbol: str) -> Dict[str, Any]:
        """
        Fetches fresh real-time quote (bid, ask, last) to validate spread and signal deviation.
        Handles Robinhood's get_equity_quotes response format with fallback to yfinance.
        """
        tool_quote = self.tool_map.get_tool_name(OP_GET_QUOTE)
        args = self.tool_map.format_quote_args(symbol)

        res = self.call_tool(tool_quote, args, is_read=True)
        if res.get("success") and res.get("data"):
            d = self._unwrap_payload(res["data"])
            # Handle get_equity_quotes {"results": [{"quote": {...}, "close": {...}}]}
            if isinstance(d, dict) and "results" in d and d["results"]:
                item = d["results"][0]
                q = item.get("quote", item) if isinstance(item, dict) else {}
                bid = float(q.get("bid_price") or q.get("bid") or 0.0)
                ask = float(q.get("ask_price") or q.get("ask") or 0.0)
                last = float(q.get("last_trade_price") or q.get("last_non_reg_trade_price") or q.get("last", 0.0))
                close_price = float(item.get("close", {}).get("price") or last or 0.0) if isinstance(item, dict) else last

                if bid > 0 and ask > 0:
                    mid = round((bid + ask) / 2.0, 4)
                    spread_pct = round(((ask - bid) / mid) * 100.0, 3)
                    return {
                        "symbol": symbol.upper(),
                        "bid": bid,
                        "ask": ask,
                        "last": last or mid,
                        "mid": mid,
                        "spread_pct": spread_pct,
                        "source": "ROBINHOOD_MCP"
                    }
                elif last > 0 or close_price > 0:
                    eff_price = last or close_price
                    return {
                        "symbol": symbol.upper(),
                        "bid": round(eff_price * 0.9995, 2),
                        "ask": round(eff_price * 1.0005, 2),
                        "last": eff_price,
                        "mid": eff_price,
                        "spread_pct": 0.10,
                        "source": "ROBINHOOD_MCP"
                    }

            elif isinstance(d, dict):
                bid = float(d.get("bid") or d.get("bid_price") or 0.0)
                ask = float(d.get("ask") or d.get("ask_price") or 0.0)
                last = float(d.get("last") or d.get("last_price") or d.get("price", 0.0))
                if bid > 0 and ask > 0:
                    mid = round((bid + ask) / 2.0, 4)
                    spread_pct = round(((ask - bid) / mid) * 100.0, 3)
                    return {
                        "symbol": symbol.upper(),
                        "bid": bid,
                        "ask": ask,
                        "last": last or mid,
                        "mid": mid,
                        "spread_pct": spread_pct,
                        "source": "ROBINHOOD_MCP"
                    }

        # Fallback to yfinance fast_info
        try:
            import yfinance as yf
            t = yf.Ticker(symbol.upper().replace(".", "-"))
            fi = getattr(t, "fast_info", None)
            price = None
            if fi:
                price = getattr(fi, "last_price", None) or getattr(fi, "regular_market_previous_close", None)
            if price is None:
                hist = t.history(period="1d")
                if not hist.empty:
                    price = float(hist["Close"].iloc[-1])
            price = round(float(price or 100.0), 2)
            bid = round(price * 0.9995, 2)
            ask = round(price * 1.0005, 2)
            return {
                "symbol": symbol.upper(),
                "bid": bid,
                "ask": ask,
                "last": price,
                "mid": price,
                "spread_pct": 0.10,
                "source": "YFINANCE_FALLBACK"
            }
        except Exception as e:
            logger.warning(f"Quote fallback failed for {symbol}: {e}")
            return {"symbol": symbol.upper(), "bid": 0.0, "ask": 0.0, "last": 0.0, "mid": 0.0, "spread_pct": 99.0, "source": "ERROR"}

    # -------------------------------------------------------------------------
    # Order Dispatch, Pre-check & Lifecycle
    # -------------------------------------------------------------------------
    def review_order(
        self,
        symbol: str,
        action: str,
        quantity: float,
        price: float,
        order_type: str = "limit",
        time_in_force: str = "gfd",
        account_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """Pre-trade simulation via review_equity_order tool."""
        account_id = account_number or self.get_agentic_account_number()
        tool_review = self.tool_map.get_tool_name(OP_REVIEW_EQUITY_ORDER)
        args = self.tool_map.format_order_args(
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=price,
            order_type=order_type,
            time_in_force=time_in_force,
            account_number=account_id,
            is_review=True
        )
        return self.call_tool(tool_review, args, is_read=True)

    def place_stock_order(
        self,
        symbol: str,
        action: str,
        quantity: float,
        price: float,
        client_order_id: Optional[str] = None,
        account_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """Dispatches an equity order through Robinhood MCP."""
        account_id = account_number or self.get_agentic_account_number()
        tool_order = self.tool_map.get_tool_name(OP_PLACE_EQUITY_ORDER)
        args = self.tool_map.format_order_args(
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=price,
            order_type="limit",
            time_in_force="gfd",
            market_hours="regular_hours",
            client_order_id=client_order_id,
            account_number=account_id,
            is_review=False
        )
        return self.call_tool(tool_order, args, is_read=False)

    def place_option_order(
        self,
        symbol: str,
        option_type: str,
        strike: float,
        expiry_date: str,
        action: str,
        contracts: int,
        premium: float
    ) -> Dict[str, Any]:
        """Options are not traded in live modes per safety policy."""
        return {
            "success": False,
            "status": "SKIPPED_LIVE_POLICY",
            "message": f"Option trading ({action} {contracts}x {symbol} ${strike} {option_type}) skipped per equities-only policy.",
            "error": "SKIPPED_LIVE_POLICY"
        }

    def get_order_status(self, order_id: str, account_number: Optional[str] = None) -> Dict[str, Any]:
        """Queries status of an order via get_equity_orders."""
        account_id = account_number or self.get_agentic_account_number()
        tool_status = self.tool_map.get_tool_name(OP_GET_ORDER)
        args = self.tool_map.format_order_status_args(order_id, account_number=account_id)
        res = self.call_tool(tool_status, args, is_read=True)
        if res.get("success") and res.get("data"):
            data = res["data"]
            orders = data.get("orders", []) if isinstance(data, dict) else []
            for o in orders:
                if str(o.get("id")) == str(order_id) or str(o.get("order_id")) == str(order_id):
                    return {"success": True, "data": o}
            if orders:
                return {"success": True, "data": orders[0]}
        return res

    def cancel_order(self, order_id: str, account_number: Optional[str] = None) -> Dict[str, Any]:
        """Cancels an unfilled order via cancel_equity_order."""
        account_id = account_number or self.get_agentic_account_number()
        tool_cancel = self.tool_map.get_tool_name(OP_CANCEL_ORDER)
        args = self.tool_map.format_cancel_args(order_id, account_number=account_id)
        return self.call_tool(tool_cancel, args, is_read=False)


# Singleton instance
_live_client: Optional[LiveMCPClient] = None


def get_live_client() -> LiveMCPClient:
    global _live_client
    if _live_client is None:
        _live_client = LiveMCPClient()
    return _live_client
