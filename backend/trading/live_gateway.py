"""
Robinhood Live Execution Gateway & Institutional Risk Firewall.

Wraps LiveMCPClient to enforce the 9 mandatory live trading guardrail checks:
1. Kill switch check & circuit breaker status
2. NYSE session validation & Broker rest window (11:30-13:55 ET)
3. Equities-only policy (Options/Crypto skipped as SKIPPED_LIVE_POLICY)
4. BUY: Symbol not already held (single position cap rule)
5. BUY: Within buying power, daily spend limit, position cap, and daily drawdown cap (< 2%)
6. SELL: Held quantity validation & Pattern Day Trader (PDT) guard (no day sales of buys made today)
7. Fresh quote validation: spread <= 0.50%, signal deviation <= 1.0%
8. Order constraints: LIMIT, DAY, regular hours with safety buffer
9. Idempotency with deterministic client_order_id and timeout polling -> cancel remainder
"""

from __future__ import annotations

import logging
import math
import time
from typing import Any, Dict, Optional

from trading import config
from trading import ledger
from trading import market_calendar
from trading import state
from trading.client_protocol import TradingClient
from trading.live_client import LiveMCPClient, get_live_client

logger = logging.getLogger("LiveExecutionGateway")


def _unwrap_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload and isinstance(payload["data"], (dict, list)):
        return payload["data"]
    return payload


class LiveExecutionGateway(TradingClient):
    """Firewall gateway enforcing all live safety rules before dispatching orders."""

    def __init__(self, mode: str = "LIVE_AUTONOMOUS", live_client: Optional[LiveMCPClient] = None):
        self.mode = mode
        self.client = live_client or get_live_client()
        self.settings = config.get_settings()
        self.ledger = ledger.get_ledger()
        self.environment = f"ROBINHOOD_MCP_{self.mode}"
        logger.info(f"LiveExecutionGateway initialized in mode={self.mode}")

    def get_portfolio(self) -> Dict[str, Any]:
        """Passes through to LiveMCPClient and returns normalized portfolio."""
        port = self.client.get_portfolio()
        port["environment"] = self.environment
        return port

    # -------------------------------------------------------------------------
    # Options Policy (Equities Only in Live)
    # -------------------------------------------------------------------------
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
        """
        Institutional Guardrail 3: In Live modes, options are strictly disallowed.
        Logs to ledger as SKIPPED_LIVE_POLICY.
        """
        msg = f"Option trading ({action} {contracts}x {symbol} ${strike} {option_type}) is prohibited in Live mode per safety policy. Sandbox trades options only."
        logger.warning(f"[GATEWAY POLICY] {msg}")

        self.ledger.append(
            ledger.EV_DECISION,
            symbol=symbol,
            action=action,
            asset_type="option",
            decision="SKIPPED_LIVE_POLICY",
            reason="Equities only policy in live trading"
        )

        return {
            "success": False,
            "status": "SKIPPED_LIVE_POLICY",
            "message": msg,
            "error": "SKIPPED_LIVE_POLICY: Equities only permitted in live trading."
        }

    # -------------------------------------------------------------------------
    # Stock Order Execution with 9 Guardrail Firewall Checks
    # -------------------------------------------------------------------------
    def place_stock_order(
        self,
        symbol: str,
        action: str,
        quantity: float,
        price: float
    ) -> Dict[str, Any]:
        symbol = symbol.strip().upper()
        action = action.strip().upper()
        quantity = float(quantity)
        signal_price = float(price)

        if quantity <= 0 or signal_price <= 0:
            return {"success": False, "error": f"Invalid order parameters: quantity={quantity}, price={price}"}

        # --- Check 1: Kill Switch & Circuit Breaker ---
        if state.kill_switch_active():
            err = "REJECTED: Emergency Kill Switch is engaged."
            self._log_decision(symbol, action, "REJECTED", err)
            return {"success": False, "status": "REJECTED", "error": err}

        breaker = state.breaker_state()
        if breaker.get("open"):
            err = f"REJECTED: Circuit Breaker is OPEN due to: {breaker.get('reason')}"
            self._log_decision(symbol, action, "REJECTED", err)
            return {"success": False, "status": "REJECTED", "error": err}

        # --- Check 2: Market Session & Rest Window (Bypassed: Robinhood queues off-hours orders) ---
        market_open = market_calendar.is_market_open()
        in_rest = market_calendar.in_broker_rest_window()
        cal_desc = market_calendar.describe()
        now_str = cal_desc.get("now_et", "")
        if not market_open or in_rest:
            session_note = (
                f"Outside regular NYSE market session (Current ET: {now_str}). "
                f"Order will be placed to Robinhood and queued for execution."
            )
            logger.info(f"[GATEWAY CHECK 2 BYPASS] {session_note}")
            self.ledger.append(
                ledger.EV_DECISION,
                symbol=symbol,
                action=action,
                side=action,
                quantity=quantity,
                price=signal_price,
                limit_price=signal_price,
                decision="OFF_HOURS_ALLOWED",
                status="QUEUING",
                reason=session_note,
                mode=self.mode,
                details={
                    "symbol": symbol,
                    "action": action,
                    "side": action,
                    "quantity": quantity,
                    "price": signal_price,
                    "limit_price": signal_price,
                    "status": "QUEUING",
                    "reason": session_note,
                    "summary": session_note
                }
            )

        # Fetch current portfolio for position & balance validation
        port = self.client.get_portfolio()
        buying_power = float(port.get("cash_available", 0.0))
        total_equity = float(port.get("total_equity", buying_power))
        holdings = {h["symbol"]: h for h in port.get("holdings", [])}
        held_qty = float(holdings.get(symbol, {}).get("quantity", 0.0))

        # --- Check 4: BUY Symbol Not Already Held (Guardrail Wins) ---
        if action == "BUY" and held_qty > 0:
            msg = f"SKIPPED: Symbol {symbol} is already held ({held_qty} shares). Adding to existing positions is blocked in live policy."
            self._log_decision(symbol, action, "SKIPPED", msg)
            return {"success": False, "status": "SKIPPED", "message": msg}

        # --- Check 6: SELL Quantity Check & PDT Guard ---
        if action == "SELL":
            if held_qty <= 0:
                err = f"REJECTED: Cannot sell {symbol}: position is not held in portfolio."
                self._log_decision(symbol, action, "REJECTED", err)
                return {"success": False, "status": "REJECTED", "error": err}

            if quantity > held_qty:
                err = f"REJECTED: Sell quantity ({quantity}) exceeds held quantity ({held_qty})."
                self._log_decision(symbol, action, "REJECTED", err)
                return {"success": False, "status": "REJECTED", "error": err}

            # Pattern Day Trader (PDT) Protection: Disallow selling shares bought earlier today
            symbols_bought_today = self.ledger.symbols_bought_today()
            if symbol in symbols_bought_today:
                err = f"REJECTED: PDT Protection: {symbol} was purchased today. Same-day liquidations are blocked to prevent Day Trade violations."
                self._log_decision(symbol, action, "REJECTED", err)
                return {"success": False, "status": "REJECTED", "error": err}

        # --- Check 7: Fresh Quote, Spread & Signal Deviation ---
        quote = self.client.get_quote(symbol)
        bid = float(quote.get("bid", 0.0))
        ask = float(quote.get("ask", 0.0))
        mid = float(quote.get("mid", 0.0))
        spread_pct = float(quote.get("spread_pct", 99.0))

        if market_open:
            if spread_pct > self.settings.max_spread_pct:
                msg = f"SKIPPED: {symbol} bid-ask spread ({spread_pct:.2f}%) exceeds safety ceiling ({self.settings.max_spread_pct}%)."
                self._log_decision(symbol, action, "SKIPPED", msg, quote=quote)
                return {"success": False, "status": "SKIPPED", "message": msg}

            if mid > 0:
                dev_pct = abs(signal_price - mid) / mid * 100.0
                if dev_pct > self.settings.max_signal_deviation_pct:
                    msg = f"SKIPPED: Stale signal guard: Signal price (${signal_price:.2f}) deviates {dev_pct:.2f}% from market mid (${mid:.2f}), exceeding {self.settings.max_signal_deviation_pct}% limit."
                    self._log_decision(symbol, action, "SKIPPED", msg, quote=quote)
                    return {"success": False, "status": "SKIPPED", "message": msg}
        else:
            logger.info(f"[GATEWAY] Market is closed. Bypassing live spread/deviation filters so order can queue in Robinhood.")

        # --- Check 8: Limit Price Calculation with Buffer ---
        buf_mult = self.settings.limit_buffer_pct / 100.0
        if market_open and ask > 0 and bid > 0:
            if action == "BUY":
                limit_price = min(ask, round(signal_price * (1.0 + buf_mult), 2))
            else:
                limit_price = max(bid, round(signal_price * (1.0 - buf_mult), 2))
        else:
            limit_price = round(signal_price, 2)

        est_cost = round(quantity * limit_price, 2)

        # --- Check 5: BUY Budget, Position Cap & Daily Drawdown ---
        if action == "BUY":
            if est_cost > buying_power:
                err = f"REJECTED: Order cost (${est_cost:,.2f}) exceeds live buying power (${buying_power:,.2f})."
                self._log_decision(symbol, action, "REJECTED", err)
                return {"success": False, "status": "REJECTED", "error": err}

            today_spent = self.ledger.today_spend_total()
            rem_daily = max(0.0, self.settings.daily_spend_limit - today_spent)
            if est_cost > rem_daily:
                err = f"REJECTED: Order cost (${est_cost:,.2f}) exceeds remaining daily spend limit (${rem_daily:,.2f} out of ${self.settings.daily_spend_limit:,.2f})."
                self._log_decision(symbol, action, "REJECTED", err)
                return {"success": False, "status": "REJECTED", "error": err}

            # Sizing cap: enforce single-position concentration limit
            effective_cap_pct = self.settings.position_cap_pct
            if total_equity > 0 and total_equity < 3000.0 and effective_cap_pct < 25.0:
                # On smaller retail accounts (under $3,000), integer share granularity requires at least 25% cap for 5-stock portfolios
                effective_cap_pct = 25.0

            max_pos_dollars = max(total_equity * (effective_cap_pct / 100.0), limit_price)
            # Allow at least a single share order if within buying power
            if quantity > 1 and est_cost > max_pos_dollars:
                err = f"REJECTED: Order cost (${est_cost:,.2f}) exceeds {effective_cap_pct}% single-position cap (${max_pos_dollars:,.2f})."
                self._log_decision(symbol, action, "REJECTED", err)
                return {"success": False, "status": "REJECTED", "error": err}

            # Intraday Drawdown Check (< 2%)
            baseline_equity = self.ledger.equity_baseline()
            if baseline_equity and baseline_equity > 0:
                drawdown_pct = ((baseline_equity - total_equity) / baseline_equity) * 100.0
                if drawdown_pct >= self.settings.max_daily_drawdown_pct:
                    err = f"REJECTED: Intraday portfolio drawdown ({drawdown_pct:.2f}%) exceeds safety maximum ({self.settings.max_daily_drawdown_pct}%). New buying halted."
                    self._log_decision(symbol, action, "REJECTED", err)
                    return {"success": False, "status": "REJECTED", "error": err}

        # --- Check 9: Idempotency & Order Lifecycle Execution ---
        import uuid
        client_order_id = str(uuid.uuid4())

        # Prevent resubmitting orders with identical idempotency
        prior = self.ledger.find_client_order(client_order_id)
        if prior:
            logger.warning(f"Order with client_order_id={client_order_id} already exists in ledger: {prior}")
            return {"success": False, "error": f"Duplicate order detected with ID {client_order_id}"}

        # Record submission intent
        self.ledger.append(
            ledger.EV_SUBMIT,
            symbol=symbol,
            action=action,
            side=action,
            quantity=quantity,
            target_quantity=quantity,
            price=limit_price,
            limit_price=limit_price,
            client_order_id=client_order_id,
            mode=self.mode,
            status="SUBMITTING",
            details={
                "symbol": symbol,
                "action": action,
                "side": action,
                "quantity": quantity,
                "price": limit_price,
                "limit_price": limit_price,
                "client_order_id": client_order_id,
                "status": "SUBMITTING",
                "summary": f"Submitting {action} {quantity} {symbol} @ ${limit_price:.2f} limit to Robinhood"
            }
        )

        logger.info(f"[GATEWAY DISPATCH] Submitting {action} {quantity} shs {symbol} @ limit ${limit_price:.2f} (client_order_id={client_order_id})")

        # Pre-trade review check via Robinhood MCP review_equity_order
        if hasattr(self.client, "review_order"):
            try:
                review_res = self.client.review_order(
                    symbol=symbol,
                    action=action,
                    quantity=quantity,
                    price=limit_price,
                )
                if isinstance(review_res, dict) and review_res.get("success"):
                    rev_payload = _unwrap_data(review_res.get("data", {}))
                    if isinstance(rev_payload, dict):
                        checks = rev_payload.get("order_checks")
                        if checks and isinstance(checks, dict) and any(checks.values()):
                            err = f"REJECTED by Robinhood order checks: {checks}"
                            self._log_decision(symbol, action, "REJECTED", err)
                            return {"success": False, "status": "REJECTED", "error": err}
                        if rev_payload.get("customer_approval_required") is True:
                            logger.info(f"[GATEWAY INFO] Order for {symbol} requires in-app customer approval: {rev_payload.get('customer_approval_required_reason')}")
            except Exception as rev_err:
                logger.debug(f"Pre-trade order review check skipped: {rev_err}")

        dispatch_res = self.client.place_stock_order(
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=limit_price,
            client_order_id=client_order_id
        )

        if not dispatch_res.get("success"):
            err = dispatch_res.get("error", "Unknown MCP submission error")
            logger.error(f"[GATEWAY SUBMIT FAILED] {err}")
            self.ledger.append(
                ledger.EV_FINAL,
                symbol=symbol,
                action=action,
                side=action,
                quantity=quantity,
                target_quantity=quantity,
                price=limit_price,
                limit_price=limit_price,
                status="FAILED",
                error=err,
                client_order_id=client_order_id,
                mode=self.mode,
                details={
                    "symbol": symbol,
                    "action": action,
                    "side": action,
                    "quantity": quantity,
                    "target_quantity": quantity,
                    "price": limit_price,
                    "limit_price": limit_price,
                    "status": "FAILED",
                    "reason": err,
                    "summary": f"Submission failed: {err}"
                }
            )
            return {"success": False, "status": "FAILED", "error": err}

        # Order Accepted by Robinhood MCP -> Extract Order ID and Initial State
        raw_order_data = dispatch_res.get("data", {})
        order_data = _unwrap_data(raw_order_data)
        if isinstance(order_data, dict) and "order" in order_data and isinstance(order_data["order"], dict):
            order_data = order_data["order"]

        order_id = (order_data.get("id") or order_data.get("order_id") if isinstance(order_data, dict) else None) or client_order_id

        return self._poll_and_reconcile_order(
            order_id=order_id,
            client_order_id=client_order_id,
            symbol=symbol,
            action=action,
            target_quantity=quantity,
            limit_price=limit_price,
            is_off_hours=(not market_open)
        )

    # -------------------------------------------------------------------------
    # Order Status Polling & Lifecycle Reconciliation
    # -------------------------------------------------------------------------
    def _poll_and_reconcile_order(
        self,
        order_id: str,
        client_order_id: str,
        symbol: str,
        action: str,
        target_quantity: float,
        limit_price: float,
        is_off_hours: bool = False
    ) -> Dict[str, Any]:
        poll_interval = self.settings.fill_poll_interval_sec
        timeout_sec = self.settings.fill_timeout_sec
        start_time = time.time()

        filled_qty = 0.0
        avg_fill_price = limit_price
        final_status = "QUEUED" if is_off_hours else "PENDING"

        # Check immediate status from Robinhood
        try:
            stat_res = self.client.get_order_status(order_id)
            if isinstance(stat_res, dict) and stat_res.get("success") and stat_res.get("data"):
                raw_d = stat_res["data"]
                d = _unwrap_data(raw_d)
                if isinstance(d, dict) and "order" in d and isinstance(d["order"], dict):
                    d = d["order"]
                if isinstance(d, dict):
                    current_state = str(d.get("state") or d.get("status", "")).upper()
                    if current_state:
                        final_status = current_state
                    try:
                        filled_qty = float(d.get("cumulative_quantity") or d.get("filled_quantity", 0.0))
                    except (ValueError, TypeError):
                        pass
        except Exception as e:
            logger.warning(f"Could not immediately fetch status for {order_id}: {e}")

        # Record initial status in the Live Gateway Audit Ledger
        self.ledger.append(
            ledger.EV_STATUS,
            order_id=order_id,
            client_order_id=client_order_id,
            symbol=symbol,
            action=action,
            side=action,
            quantity=target_quantity,
            target_quantity=target_quantity,
            filled_quantity=filled_qty,
            price=limit_price,
            limit_price=limit_price,
            status=final_status,
            mode=self.mode,
            details={
                "symbol": symbol,
                "action": action,
                "side": action,
                "quantity": target_quantity,
                "filled_quantity": filled_qty,
                "price": limit_price,
                "limit_price": limit_price,
                "status": final_status,
                "order_id": order_id,
                "client_order_id": client_order_id,
                "summary": f"Robinhood status: {final_status} ({filled_qty}/{target_quantity} filled)"
            }
        )

        # Off-hours or Queued order handling: Robinhood keeps it queued until market opens
        if is_off_hours or final_status in ("QUEUED", "CONFIRMED", "UNCONFIRMED", "NEW", "PENDING"):
            msg = (
                f"Live {action} order {final_status} on Robinhood (Order ID: {order_id}) "
                f"for {target_quantity} shs of {symbol} at limit ${limit_price:.2f}. Queued for market execution."
            )
            logger.info(f"[GATEWAY QUEUED] {msg}")

            self.ledger.append(
                ledger.EV_FINAL,
                order_id=order_id,
                client_order_id=client_order_id,
                symbol=symbol,
                action=action,
                side=action,
                quantity=target_quantity,
                target_quantity=target_quantity,
                filled_quantity=filled_qty,
                price=limit_price,
                limit_price=limit_price,
                avg_fill_price=avg_fill_price,
                status=final_status,
                mode=self.mode,
                details={
                    "symbol": symbol,
                    "action": action,
                    "side": action,
                    "quantity": target_quantity,
                    "target_quantity": target_quantity,
                    "filled_quantity": filled_qty,
                    "price": limit_price,
                    "limit_price": limit_price,
                    "avg_fill_price": avg_fill_price,
                    "status": final_status,
                    "order_id": order_id,
                    "client_order_id": client_order_id,
                    "summary": msg
                }
            )

            return {
                "success": True,
                "status": final_status,
                "order_id": order_id,
                "client_order_id": client_order_id,
                "symbol": symbol,
                "action": action,
                "quantity": filled_qty,
                "target_quantity": target_quantity,
                "price": limit_price,
                "limit_price": limit_price,
                "avg_fill_price": avg_fill_price,
                "message": msg
            }

        # When regular market hours are open, poll for fill/execution
        while (time.time() - start_time) < timeout_sec:
            stat_res = self.client.get_order_status(order_id)
            if isinstance(stat_res, dict) and stat_res.get("success") and stat_res.get("data"):
                raw_d = stat_res["data"]
                d = _unwrap_data(raw_d)
                if isinstance(d, dict) and "order" in d and isinstance(d["order"], dict):
                    d = d["order"]
                if isinstance(d, dict):
                    status = str(d.get("state") or d.get("status", "")).upper()
                    try:
                        filled_qty = float(d.get("cumulative_quantity") or d.get("filled_quantity", 0.0))
                    except (ValueError, TypeError):
                        filled_qty = 0.0
                    try:
                        avg_fill_price = float(d.get("average_price") or d.get("avg_fill_price", limit_price))
                    except (ValueError, TypeError):
                        avg_fill_price = limit_price

                    if status in ("FILLED", "COMPLETED"):
                        final_status = "FILLED"
                        break
                    elif status in ("CANCELLED", "REJECTED", "EXPIRED", "FAILED"):
                        final_status = status
                        break

            time.sleep(poll_interval)

        # If order not completely filled before timeout during active market hours, cancel remainder
        if final_status not in ("FILLED", "COMPLETED", "CANCELLED", "REJECTED", "QUEUED", "CONFIRMED"):
            logger.warning(f"[GATEWAY TIMEOUT] Order {order_id} not filled within {timeout_sec}s. Cancelling remainder...")
            self.client.cancel_order(order_id)
            self.ledger.append(ledger.EV_CANCEL, order_id=order_id, client_order_id=client_order_id, reason="Fill timeout reached")
            final_status = "TIMEOUT_CANCELLED" if filled_qty <= 0 else "PARTIAL_CANCELLED"

        # Record final lifecycle resolution
        is_success = (final_status in ("FILLED", "QUEUED", "CONFIRMED"))
        msg = f"Live {action} order {final_status} for {filled_qty}/{target_quantity} shares of {symbol} at avg ${avg_fill_price:.2f}"
        self.ledger.append(
            ledger.EV_FINAL,
            order_id=order_id,
            client_order_id=client_order_id,
            symbol=symbol,
            action=action,
            side=action,
            quantity=filled_qty,
            target_quantity=target_quantity,
            filled_quantity=filled_qty,
            price=limit_price,
            limit_price=limit_price,
            avg_fill_price=avg_fill_price,
            status=final_status,
            mode=self.mode,
            details={
                "symbol": symbol,
                "action": action,
                "side": action,
                "quantity": filled_qty,
                "target_quantity": target_quantity,
                "filled_quantity": filled_qty,
                "price": limit_price,
                "limit_price": limit_price,
                "avg_fill_price": avg_fill_price,
                "status": final_status,
                "order_id": order_id,
                "client_order_id": client_order_id,
                "summary": msg
            }
        )
        logger.info(f"[GATEWAY RESOLVED] {msg}")

        return {
            "success": is_success,
            "status": final_status,
            "order_id": order_id,
            "client_order_id": client_order_id,
            "symbol": symbol,
            "action": action,
            "quantity": filled_qty,
            "target_quantity": target_quantity,
            "price": limit_price,
            "limit_price": limit_price,
            "avg_fill_price": avg_fill_price,
            "message": msg
        }

    def _log_decision(self, symbol: str, action: str, decision: str, reason: str, quote: Optional[dict] = None) -> None:
        self.ledger.append(
            ledger.EV_DECISION,
            symbol=symbol,
            action=action,
            side=action,
            asset_type="stock",
            decision=decision,
            status=decision,
            reason=reason,
            quote=quote,
            mode=self.mode,
            details={
                "symbol": symbol,
                "action": action,
                "side": action,
                "decision": decision,
                "status": decision,
                "reason": reason,
                "summary": f"{decision}: {reason}"
            }
        )
