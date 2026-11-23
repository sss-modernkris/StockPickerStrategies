"""
Broker Agent
Receives ranked recommendations from the Backtester Agent, conducts comparative portfolio analysis,
determines optimal liquidation/rebalancing decisions, and dispatches simulated stock & option orders
directly to the Robinhood MCP Sandbox toolset.
"""

import datetime
import logging
import math
import os
import sys
from typing import Any, Dict, List, Tuple

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from trading.factory import get_trading_client
from trading import state, ledger

logger = logging.getLogger("BrokerAgent")

class BrokerAgent:
    """Specialized AI Broker Agent that executes portfolio rebalancing and trade execution."""

    def __init__(self, name: str = "Broker Agent"):
        self.name = name
        self.client = get_trading_client()
        logger.info(f"{self.name} initialized with {getattr(self.client, 'environment', 'UNKNOWN')} connection.")

    def execute_morning_sell(self, trigger_source: str = "SCHEDULED_11AM") -> Dict[str, Any]:
        """
        Executes Morning Sell Phase @ 11:00 AM EST:
        Liquidates currently held shares brought in yesterday's (or previous) market sessions.
        CRITICAL RULE: Irrespective of Operating Mode (Approval or Auto), selling is automatic
        without waiting for user approval.
        - LIVE_APPROVAL: Directly uses LiveExecutionGateway(mode="LIVE_APPROVAL") to execute live SELLs.
        - LIVE_AUTONOMOUS: Uses LiveExecutionGateway(mode="LIVE_AUTONOMOUS") to execute live SELLs.
        - LIVE_SHADOW: Uses ShadowClient to record shadow SELLs.
        - SANDBOX: Uses SandboxClient to simulate SELLs.
        """
        start_time = datetime.datetime.now()
        current_mode = state.get_mode()

        if state.kill_switch_active():
            logger.warning("[MORNING SELL] Execution blocked: Emergency Kill Switch is engaged.")
            return {
                "success": False,
                "error": "Emergency Kill Switch is engaged.",
                "phase": "MORNING_SELL",
                "overall_status": "BLOCKED_KILL_SWITCH"
            }

        # Resolve trading client: in LIVE_APPROVAL or LIVE_AUTONOMOUS, use LiveExecutionGateway
        if current_mode in ("LIVE_APPROVAL", "LIVE_AUTONOMOUS"):
            from trading.live_gateway import LiveExecutionGateway
            exec_client = LiveExecutionGateway(mode=current_mode)
        elif current_mode == "LIVE_SHADOW":
            from trading.shadow_client import ShadowClient
            exec_client = ShadowClient()
        else:
            from trading.sandbox_client import SandboxClient
            exec_client = SandboxClient()

        logger.info(f"[{self.name}] Initiating Morning Sell Phase @ 11:00 AM EST (Mode: {current_mode}, Trigger: {trigger_source})...")

        # 1. Fetch current portfolio
        portfolio = exec_client.get_portfolio()
        holdings = portfolio.get("holdings", [])
        active_holdings = [
            h for h in holdings 
            if float(h.get("quantity", h.get("total_quantity", 0))) > 0
        ]

        if not active_holdings:
            logger.info(f"[{self.name}] No active share holdings found to liquidate in morning session.")
            return {
                "success": True,
                "phase": "MORNING_SELL",
                "trading_mode": current_mode,
                "trigger_source": trigger_source,
                "execution_timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S EST"),
                "holdings_count": 0,
                "liquidated_holdings": [],
                "total_proceeds": 0.0,
                "overall_status": "NO_HOLDINGS_TO_LIQUIDATE",
                "summary": "Morning Sell completed: No currently held shares in portfolio."
            }

        executed_sells = []
        total_proceeds = 0.0

        for h in active_holdings:
            sym = h["symbol"]
            qty = float(h.get("quantity", h.get("total_quantity", 0)))
            price = float(h.get("current_price", h.get("avg_price", h.get("avg_buy_price", 0.0))))
            
            # Fetch fresh quote if price is missing or zero
            if price <= 0:
                try:
                    q = exec_client.get_quote(sym)
                    price = float(q.get("last", q.get("bid", q.get("ask", 0.0))))
                except Exception as qe:
                    logger.debug(f"Could not fetch fresh quote for {sym}: {qe}")

            # Check if fractional share quantity
            is_fractional = not round(qty, 6).is_integer()
            order_type_to_use = "market" if is_fractional else "limit"

            kwargs: Dict[str, Any] = {}
            if current_mode in ("LIVE_APPROVAL", "LIVE_AUTONOMOUS"):
                kwargs["order_type"] = order_type_to_use
                kwargs["market_hours"] = "regular_hours"

            sell_res = exec_client.place_stock_order(
                symbol=sym,
                action="SELL",
                quantity=qty,
                price=price,
                **kwargs
            )

            success = bool(sell_res.get("success"))
            estimated_proceeds = round(qty * price, 2)
            if success:
                total_proceeds = round(total_proceeds + estimated_proceeds, 2)

            executed_sells.append({
                "symbol": sym,
                "action": "SELL",
                "quantity": qty,
                "price": price,
                "estimated_proceeds": estimated_proceeds,
                "status": "FILLED" if success else "FAILED",
                "mcp_response": sell_res.get("message") or sell_res.get("error") or str(sell_res)
            })

        duration = round((datetime.datetime.now() - start_time).total_seconds(), 2)
        summary_msg = f"Morning Sell @ 11:00 AM EST completed: Liquidated {len(executed_sells)} holdings for ${total_proceeds:,.2f} total proceeds."
        logger.info(f"[{self.name}] {summary_msg} (Duration: {duration}s)")

        # Log to audit ledger
        ledger.get_ledger().append(
            ledger.EV_RUN,
            phase="MORNING_SELL",
            mode=current_mode,
            trigger=trigger_source,
            duration_sec=duration,
            sells_count=len(executed_sells),
            total_proceeds=total_proceeds
        )

        return {
            "success": True,
            "phase": "MORNING_SELL",
            "trading_mode": current_mode,
            "trigger_source": trigger_source,
            "execution_timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S EST"),
            "duration_sec": duration,
            "holdings_count": len(active_holdings),
            "liquidated_holdings": executed_sells,
            "total_proceeds": total_proceeds,
            "overall_status": "SUCCESSFUL_EXECUTION",
            "summary": summary_msg
        }

    def evaluate_and_rebalance(self, backtest_output: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes incoming Backtester recommendations, performs portfolio comparative analysis,
        calculates dynamic buying power from initial cash PLUS sell liquidations, and executes stock & option orders
        based on optimal dynamic capital allocation across qualified candidates.
        """
        start_time = datetime.datetime.now()
        # Dynamically reload trading client to reflect active runtime trading mode
        self.client = get_trading_client()
        logger.info(f"[{self.name}] Initiating portfolio comparative analysis & execution pipeline ({getattr(self.client, 'environment', 'UNKNOWN')})...")

        # 1. Fetch current portfolio state via Robinhood MCP / Client
        initial_portfolio = self.client.get_portfolio()
        initial_cash = float(initial_portfolio.get("cash_available", 0.0))
        current_holdings = initial_portfolio.get("holdings", [])
        current_options = initial_portfolio.get("option_positions", [])

        holdings_by_symbol = {h["symbol"]: h for h in current_holdings if h.get("quantity", h.get("total_quantity", 0)) > 0}

        recommendations = backtest_output.get("ranked_recommendations", [])
        recommended_symbols = {r["symbol"]: r for r in recommendations}

        # 2. Portfolio Comparative Analysis: Identify liquidations vs retained positions
        sell_decisions = []
        keep_decisions = []
        estimated_liquidation_cash = 0.0

        for symbol, h in holdings_by_symbol.items():
            qty = float(h.get("quantity", h.get("total_quantity", 0)))
            price = float(h.get("current_price", h.get("avg_price", h.get("avg_buy_price", 0.0))))
            market_val = round(qty * price, 2)
            unrealized_pnl = float(h.get("unrealized_pnl", 0.0))

            if symbol not in recommended_symbols:
                # Security is no longer in top Strategy 1 screener -> Liquidate to free up capital
                sell_decisions.append({
                    "symbol": symbol,
                    "quantity": qty,
                    "price": price,
                    "estimated_proceeds": market_val,
                    "unrealized_pnl": unrealized_pnl,
                    "reason": "Displaced from top screener. Liquidating to fund higher-ranked opportunities."
                })
                estimated_liquidation_cash += market_val
            else:
                keep_decisions.append({
                    "symbol": symbol,
                    "quantity": qty,
                    "current_price": price,
                    "rank": recommended_symbols[symbol].get("rank"),
                    "reason": "Retained: Matches active Strategy 1 top recommendations."
                })

        # 3. Phase 1 Execution: Dispatch SELL Orders via Robinhood Client
        executed_sells = []
        actual_liquidation_proceeds = 0.0

        # Irrespective of Operating Mode (Approval or Auto), selling is automatic without waiting for approval
        sell_client = self.client
        if current_mode == "LIVE_APPROVAL" and sell_decisions:
            from trading.live_gateway import LiveExecutionGateway
            sell_client = LiveExecutionGateway(mode="LIVE_APPROVAL")

        for s in sell_decisions:
            res = sell_client.place_stock_order(
                symbol=s["symbol"],
                action="SELL",
                quantity=s["quantity"],
                price=s["price"]
            )
            success = bool(res.get("success"))
            proceeds = s["estimated_proceeds"] if success else 0.0
            if success:
                actual_liquidation_proceeds += proceeds

            executed_sells.append({
                "symbol": s["symbol"],
                "action": "SELL",
                "quantity": s["quantity"],
                "price": s["price"],
                "proceeds": s["estimated_proceeds"],
                "status": "FILLED" if success else "FAILED",
                "mcp_response": res.get("message") or res.get("error")
            })

        # 4. Refresh portfolio state post-liquidation to get exact cash & guardrails
        post_sell_portfolio = self.client.get_portfolio()
        effective_buying_power = round(initial_cash + actual_liquidation_proceeds, 2)
        # Ensure available deployable cash includes initial cash + realized liquidation proceeds
        available_cash = max(float(post_sell_portfolio.get("cash_available", 0.0)), effective_buying_power)

        guardrails = post_sell_portfolio.get("guardrails", {})
        daily_spend_limit = float(guardrails.get("daily_spend_limit", 5000.0))
        today_spend_total = float(guardrails.get("today_spend_total", 0.0))
        remaining_daily_budget = float(guardrails.get("remaining_daily_budget", max(0.0, daily_spend_limit - today_spend_total)))
        position_cap_pct = float(guardrails.get("position_cap_pct", 25.0))
        total_equity = float(post_sell_portfolio.get("total_equity", available_cash))
        if total_equity <= 0:
            total_equity = available_cash

        # For retail / small accounts (under $3,000) or 5-stock portfolios, ensure position cap accommodates portfolio sizing
        effective_cap_pct = position_cap_pct
        if total_equity > 0 and total_equity < 3000.0 and effective_cap_pct < 25.0:
            effective_cap_pct = 25.0
        max_pos_cap_dollars = total_equity * (effective_cap_pct / 100.0)

        # Track existing market values for position cap checks
        existing_holdings_val = {
            h["symbol"]: float(h.get("market_value", h.get("total_value", 0.0)))
            for h in post_sell_portfolio.get("holdings", [])
        }
        # In shadow or planning mode, remove liquidated symbols from existing_holdings_val
        for s in sell_decisions:
            existing_holdings_val.pop(s["symbol"], None)

        # 5. Phase 2 Execution: Determine and Dispatch BUY Orders for Stocks & Options
        # Uses dynamic portfolio-aware capital allocation across qualified candidates and adaptively sizes.
        executed_buys_stock = []
        executed_buys_options = []

        current_cash_pool = available_cash
        current_daily_pool = remaining_daily_budget
        deployable_capital = min(current_cash_pool, current_daily_pool)

        # Identify buy candidates (recommendations not already held in portfolio)
        retained_symbols = {k["symbol"] for k in keep_decisions}
        buy_candidates = [
            r for r in recommendations
            if float(r.get("current_price", 0.0)) > 0 and r["symbol"] not in retained_symbols
        ]
        num_candidates = len(buy_candidates)

        # Check active sizing mode ('INTEGER' [default] vs 'FRACTIONAL')
        from trading import state
        sizing_mode = state.get_sizing_mode() if hasattr(state, "get_sizing_mode") else "INTEGER"
        planned_shares: Dict[str, Any] = {}
        planned_budgets: Dict[str, float] = {}
        unallocated_cash = deployable_capital

        if sizing_mode == "FRACTIONAL":
            # Fractional share sizing rule:
            # - Allocates $2,000 per stock if funds >= $10,000 (or covers $2,000 for each candidate).
            # - Otherwise divide available amount by 5 (floored to nearest cent).
            # - Sizing: round(budget / price, 6).
            # - Routes orders as type='market' during regular_hours.
            required_for_full_2k = 2000.0 * max(num_candidates, 5)
            if deployable_capital >= required_for_full_2k or (num_candidates > 0 and deployable_capital >= 2000.0 * num_candidates and deployable_capital >= 10000.0):
                per_stock_budget = 2000.0
            else:
                per_stock_budget = math.floor((deployable_capital / 5.0) * 100.0) / 100.0

            for r in buy_candidates:
                sym = r["symbol"]
                price = float(r["current_price"])
                sym_curr_val = existing_holdings_val.get(sym, 0.0)
                avail_cap = max(0.0, max_pos_cap_dollars - sym_curr_val)
                target_budget = min(per_stock_budget, unallocated_cash, avail_cap if avail_cap > 0 else per_stock_budget)

                if target_budget > 0 and price > 0:
                    shs = round(target_budget / price, 6)
                    cost = round(target_budget, 2)
                    if shs > 0 and cost <= unallocated_cash + 0.01:
                        planned_shares[sym] = shs
                        planned_budgets[sym] = min(cost, round(unallocated_cash, 2))
                        unallocated_cash = round(max(0.0, unallocated_cash - planned_budgets[sym]), 2)
                else:
                    planned_shares[sym] = 0.0
                    planned_budgets[sym] = 0.0
        else:
            # Multi-Pass Optimal Integer Share Sizing across deployable capital (Default)
            planned_shares = {r["symbol"]: 0 for r in buy_candidates}
            base_budget_per_stock = (deployable_capital / num_candidates) if num_candidates > 0 else 0.0

            # Pass 1: Base allocation up to base_budget_per_stock
            for r in buy_candidates:
                sym = r["symbol"]
                price = float(r["current_price"])
                sym_curr_val = existing_holdings_val.get(sym, 0.0)
                avail_cap = max(0.0, max_pos_cap_dollars - sym_curr_val)
                pos_cap = max(avail_cap, price)  # allow at least 1 share if within buying power
                target_budget = min(base_budget_per_stock, pos_cap)

                shs = math.floor(target_budget / price)
                # If 1 share slightly exceeds base budget (e.g. higher-priced stock like PM), allow 1 share
                # if within unallocated cash and safe single-position cap tolerance
                if shs == 0 and price <= unallocated_cash and price <= (pos_cap * 1.15):
                    shs = 1

                cost = round(shs * price, 2)
                if cost <= unallocated_cash:
                    planned_shares[sym] = shs
                    planned_budgets[sym] = cost
                    unallocated_cash = round(unallocated_cash - cost, 2)

            # Pass 2: Re-distribute residual unallocated cash to top-ranked candidates
            for r in buy_candidates:
                sym = r["symbol"]
                price = float(r["current_price"])
                sym_curr_val = existing_holdings_val.get(sym, 0.0)
                avail_cap = max(0.0, max_pos_cap_dollars - sym_curr_val)
                pos_cap = max(avail_cap, price)

                while unallocated_cash >= price:
                    next_cost = round((planned_shares[sym] + 1) * price, 2)
                    if next_cost <= pos_cap or planned_shares[sym] == 0:
                        planned_shares[sym] += 1
                        unallocated_cash = round(unallocated_cash - price, 2)
                        planned_budgets[sym] = round(planned_shares[sym] * price, 2)
                    else:
                        break

        is_live_env = "LIVE" in getattr(self.client, "environment", "").upper()

        for r in recommendations:
            symbol = r["symbol"]
            price = float(r.get("current_price", 0.0))
            if price <= 0:
                continue

            stock_sig = r.get("stock_signal", {})
            opt_sig = r.get("option_signal", {})

            # Sync recommendation's stock_signal display with the computed target
            shares_to_buy = planned_shares.get(symbol, 0)
            stock_order_cost = planned_budgets.get(symbol, round(shares_to_buy * price, 2))
            if sizing_mode == "FRACTIONAL":
                r["stock_signal"] = {
                    "action": "BUY",
                    "target_price": round(price, 2),
                    "suggested_budget": round(stock_order_cost, 2),
                    "suggested_shares": float(shares_to_buy)
                }
            else:
                r["stock_signal"] = {
                    "action": "BUY",
                    "target_price": round(price, 2),
                    "suggested_budget": round(stock_order_cost, 2),
                    "suggested_shares": int(shares_to_buy)
                }

            # If symbol is already held in portfolio, skip per live position limit policy
            if symbol in retained_symbols:
                executed_buys_stock.append({
                    "symbol": symbol,
                    "action": "BUY",
                    "quantity": 0,
                    "target_quantity": 0,
                    "price": price,
                    "total_cost": 0.0,
                    "rank": r.get("rank"),
                    "status": "SKIPPED",
                    "partial_fill": False,
                    "mcp_response": f"Skipped: Symbol {symbol} is already held in portfolio. Adding to existing positions is blocked."
                })
                continue

            is_fractional = (sizing_mode == "FRACTIONAL") and not float(shares_to_buy).is_integer()
            order_type_to_use = "market" if is_fractional else "limit"
            market_hours_to_use = "regular_hours" if is_fractional else "regular_hours"

            if shares_to_buy > 0 and stock_order_cost <= current_cash_pool + 0.01:
                buy_res = self.client.place_stock_order(
                    symbol=symbol,
                    action="BUY",
                    quantity=float(shares_to_buy),
                    price=price,
                    order_type=order_type_to_use,
                    market_hours=market_hours_to_use
                )

                if buy_res.get("success"):
                    current_cash_pool = round(max(0.0, current_cash_pool - stock_order_cost), 2)
                    current_daily_pool = round(max(0.0, current_daily_pool - stock_order_cost), 2)
                    existing_holdings_val[symbol] = existing_holdings_val.get(symbol, 0.0) + stock_order_cost

                    status_label = "FILLED"
                    fill_msg = buy_res.get("message") or f"Successfully placed BUY order for {shares_to_buy} shares."

                    executed_buys_stock.append({
                        "symbol": symbol,
                        "action": "BUY",
                        "quantity": shares_to_buy,
                        "target_quantity": shares_to_buy,
                        "price": price,
                        "total_cost": stock_order_cost,
                        "rank": r.get("rank"),
                        "status": status_label,
                        "partial_fill": False,
                        "mcp_response": fill_msg
                    })
                else:
                    executed_buys_stock.append({
                        "symbol": symbol,
                        "action": "BUY",
                        "quantity": shares_to_buy,
                        "target_quantity": shares_to_buy,
                        "price": price,
                        "total_cost": stock_order_cost,
                        "rank": r.get("rank"),
                        "status": "FAILED",
                        "partial_fill": False,
                        "mcp_response": buy_res.get("error") or buy_res.get("message")
                    })
            else:
                executed_buys_stock.append({
                    "symbol": symbol,
                    "action": "BUY",
                    "quantity": 0,
                    "target_quantity": 0,
                    "price": price,
                    "total_cost": 0.0,
                    "rank": r.get("rank"),
                    "status": "SKIPPED",
                    "partial_fill": False,
                    "mcp_response": f"Skipped: Insufficient buying power or single-position cap (${current_cash_pool:,.2f} cash available, price ${price:,.2f})"
                })

            # --- 5b. Option Purchase ---
            if opt_sig:
                target_contracts = int(opt_sig.get("contracts", 0))
                prem = float(opt_sig.get("estimated_premium", 0.0))
                strike = float(opt_sig.get("strike", price))
                expiry = opt_sig.get("expiry_date", "")

                if is_live_env:
                    # Live policy prohibits options
                    executed_buys_options.append({
                        "symbol": symbol,
                        "option_type": "CALL",
                        "strike": strike,
                        "expiry_date": expiry,
                        "contracts": 0,
                        "target_contracts": target_contracts,
                        "premium": prem,
                        "total_cost": 0.0,
                        "rank": r.get("rank"),
                        "status": "SKIPPED_LIVE_POLICY",
                        "partial_fill": False,
                        "mcp_response": "Skipped: Equities only permitted in live trading policy."
                    })
                else:
                    # Sandbox option execution
                    contract_cost = round(prem * 100.0, 2)
                    if target_contracts <= 0 and contract_cost > 0:
                        target_contracts = max(1, math.floor(2000.0 / contract_cost))

                    if target_contracts > 0 and contract_cost > 0:
                        target_opt_cost = round(target_contracts * contract_cost, 2)
                        sym_curr_val = existing_holdings_val.get(symbol, 0.0)
                        avail_pos_cap = max(0.0, max_pos_cap_dollars - sym_curr_val)
                        max_opt_budget = min(current_cash_pool, current_daily_pool, avail_pos_cap)

                        if max_opt_budget >= contract_cost:
                            contracts_to_buy = target_contracts if target_opt_cost <= max_opt_budget else math.floor(max_opt_budget / contract_cost)
                            if contracts_to_buy > 0:
                                opt_order_cost = round(contracts_to_buy * contract_cost, 2)
                                opt_res = self.client.place_option_order(
                                    symbol=symbol,
                                    option_type="CALL",
                                    strike=strike,
                                    expiry_date=expiry,
                                    action="BUY",
                                    contracts=contracts_to_buy,
                                    premium=prem
                                )

                                if opt_res.get("success"):
                                    current_cash_pool = round(max(0.0, current_cash_pool - opt_order_cost), 2)
                                    current_daily_pool = round(max(0.0, current_daily_pool - opt_order_cost), 2)
                                    existing_holdings_val[symbol] = existing_holdings_val.get(symbol, 0.0) + opt_order_cost
                                    status_label = "FILLED" if contracts_to_buy == target_contracts else "PARTIAL"
                                    fill_msg = opt_res.get("message")
                                    if contracts_to_buy < target_contracts:
                                        fill_msg = f"Partially filled {contracts_to_buy}/{target_contracts} contracts (${opt_order_cost:,.2f}) due to available budget."

                                    executed_buys_options.append({
                                        "symbol": symbol,
                                        "option_type": "CALL",
                                        "strike": strike,
                                        "expiry_date": expiry,
                                        "contracts": contracts_to_buy,
                                        "target_contracts": target_contracts,
                                        "premium": prem,
                                        "total_cost": opt_order_cost,
                                        "rank": r.get("rank"),
                                        "status": status_label,
                                        "partial_fill": contracts_to_buy < target_contracts,
                                        "mcp_response": fill_msg
                                    })
                                else:
                                    executed_buys_options.append({
                                        "symbol": symbol,
                                        "option_type": "CALL",
                                        "strike": strike,
                                        "expiry_date": expiry,
                                        "contracts": contracts_to_buy,
                                        "target_contracts": target_contracts,
                                        "premium": prem,
                                        "total_cost": opt_order_cost,
                                        "rank": r.get("rank"),
                                        "status": "FAILED",
                                        "partial_fill": False,
                                        "mcp_response": opt_res.get("error") or opt_res.get("message")
                                    })
                            else:
                                executed_buys_options.append({
                                    "symbol": symbol,
                                    "option_type": "CALL",
                                    "strike": strike,
                                    "expiry_date": expiry,
                                    "contracts": 0,
                                    "target_contracts": target_contracts,
                                    "premium": prem,
                                    "total_cost": 0.0,
                                    "rank": r.get("rank"),
                                    "status": "SKIPPED",
                                    "partial_fill": False,
                                    "mcp_response": f"Skipped: Target {target_contracts} contracts (${target_opt_cost:,.2f}) exceeds available budget (${max_opt_budget:,.2f} available)"
                                })
                        else:
                            executed_buys_options.append({
                                "symbol": symbol,
                                "option_type": "CALL",
                                "strike": strike,
                                "expiry_date": expiry,
                                "contracts": 0,
                                "target_contracts": target_contracts,
                                "premium": prem,
                                "total_cost": 0.0,
                                "rank": r.get("rank"),
                                "status": "SKIPPED",
                                "partial_fill": False,
                                "mcp_response": f"Skipped: Insufficient budget for 1 contract (${max_opt_budget:,.2f} available, contract cost is ${contract_cost:,.2f})"
                            })

        # 6. Post-execution Portfolio Snapshot
        end_time = datetime.datetime.now()

        filled_stocks = [b for b in executed_buys_stock if b["status"] in ["FILLED", "PARTIAL"]]
        filled_options = [o for o in executed_buys_options if o["status"] in ["FILLED", "PARTIAL"]]
        total_spent_buys = sum(b["total_cost"] for b in filled_stocks)
        final_cash = round(current_cash_pool, 2)

        # Projected holdings: retained holdings + newly purchased positions
        projected_holdings = []
        for k in keep_decisions:
            projected_holdings.append({
                "symbol": k["symbol"],
                "quantity": k["quantity"],
                "avg_price": k["current_price"],
                "current_price": k["current_price"],
                "market_value": round(k["quantity"] * k["current_price"], 2),
                "total_value": round(k["quantity"] * k["current_price"], 2)
            })
        for b in executed_buys_stock:
            if b["quantity"] > 0 and b["status"] in ["FILLED", "PARTIAL"]:
                projected_holdings.append({
                    "symbol": b["symbol"],
                    "quantity": b["quantity"],
                    "avg_price": b["price"],
                    "current_price": b["price"],
                    "market_value": b["total_cost"],
                    "total_value": b["total_cost"]
                })

        execution_report = {
            "success": True,
            "agent_name": self.name,
            "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S EST"),
            "environment": getattr(self.client, "environment", "ROBINHOOD_MCP_SANDBOX"),
            "sizing_mode": sizing_mode,
            "initial_cash": initial_cash,
            "liquidation_proceeds": round(actual_liquidation_proceeds, 2),
            "effective_buying_power": effective_buying_power,
            "total_spent_buys": round(total_spent_buys, 2),
            "final_cash_remaining": final_cash,
            "total_portfolio_equity": round(total_equity, 2),
            "comparative_analysis": {
                "holdings_before": len(current_holdings),
                "liquidations_count": len(executed_sells),
                "retained_count": len(keep_decisions),
                "incoming_recommendations_count": len(recommendations)
            },
            "execution_actions": {
                "sells": executed_sells,
                "buys_stock": executed_buys_stock,
                "buys_options": executed_buys_options
            },
            "updated_holdings": projected_holdings,
            "updated_options": post_sell_portfolio.get("option_positions", []),
            "execution_summary": (
                f"Rebalance completed: Liquidated {len(executed_sells)} positions generating ${actual_liquidation_proceeds:,.2f} cash. "
                f"Allocated ${total_spent_buys:,.2f} across {len(filled_stocks)} stock buys (leaving ${final_cash:,.2f} cash) "
                f"in {getattr(self.client, 'environment', 'Robinhood Sandbox')} based on dynamic capital allocation."
            )
        }

        logger.info(f"[{self.name}] Rebalancing execution complete: {execution_report['execution_summary']}")
        return execution_report

if __name__ == "__main__":
    from agents.backtester_agent import BacktesterAgent
    bt = BacktesterAgent()
    bt_res = bt.run_daily_analysis()
    broker = BrokerAgent()
    report = broker.evaluate_and_rebalance(bt_res)
    import json
    print(json.dumps(report, indent=2))
