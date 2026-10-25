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

logger = logging.getLogger("BrokerAgent")

class BrokerAgent:
    """Specialized AI Broker Agent that executes portfolio rebalancing and trade execution."""

    def __init__(self, name: str = "Broker Agent"):
        self.name = name
        self.client = get_trading_client()
        logger.info(f"{self.name} initialized with {getattr(self.client, 'environment', 'UNKNOWN')} connection.")

    def evaluate_and_rebalance(self, backtest_output: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes incoming Backtester recommendations, performs portfolio comparative analysis,
        calculates buying power from initial cash PLUS sell liquidations, and executes stock & option orders
        based on Stage 1 recommended sizing, dynamically sizing down for partial fills when constrained by
        available buying power or Daily Spend Limit.
        """
        start_time = datetime.datetime.now()
        logger.info(f"[{self.name}] Initiating portfolio comparative analysis & execution pipeline...")

        # 1. Fetch current sandbox portfolio state via Robinhood MCP
        initial_portfolio = self.client.get_portfolio()
        initial_cash = float(initial_portfolio.get("cash_available", 0.0))
        current_holdings = initial_portfolio.get("holdings", [])
        current_options = initial_portfolio.get("option_positions", [])

        holdings_by_symbol = {h["symbol"]: h for h in current_holdings if h.get("quantity", h.get("total_quantity", 0)) > 0}

        recommendations = backtest_output.get("ranked_recommendations", [])
        recommended_symbols = {r["symbol"]: r for r in recommendations}

        # 2. Portfolio Comparative Analysis
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

        # 3. Phase 1 Execution: Dispatch SELL Orders via Robinhood MCP
        executed_sells = []
        actual_liquidation_proceeds = 0.0

        for s in sell_decisions:
            res = self.client.place_stock_order(
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

        # 4. Refresh sandbox state post-liquidation to get exact cash & guardrails
        post_sell_portfolio = self.client.get_portfolio()
        available_cash = float(post_sell_portfolio.get("cash_available", initial_cash + actual_liquidation_proceeds))
        effective_buying_power = round(initial_cash + actual_liquidation_proceeds, 2)
        
        guardrails = post_sell_portfolio.get("guardrails", {})
        daily_spend_limit = float(guardrails.get("daily_spend_limit", 5000.0))
        today_spend_total = float(guardrails.get("today_spend_total", 0.0))
        remaining_daily_budget = float(guardrails.get("remaining_daily_budget", max(0.0, daily_spend_limit - today_spend_total)))
        position_cap_pct = float(guardrails.get("position_cap_pct", 15.0))
        total_equity = float(post_sell_portfolio.get("total_equity", available_cash))
        max_pos_cap_dollars = total_equity * (position_cap_pct / 100.0)

        # Track existing market values for position cap checks
        existing_holdings_val = {
            h["symbol"]: float(h.get("market_value", h.get("total_value", 0.0)))
            for h in post_sell_portfolio.get("holdings", [])
        }

        # 5. Phase 2 Execution: Determine and Dispatch BUY Orders for Stocks & Options
        # Uses Stage 1 recommended sizing and adaptively sizes down (partial fill) if budget/guardrail is limited.
        executed_buys_stock = []
        executed_buys_options = []

        current_cash_pool = available_cash
        current_daily_pool = remaining_daily_budget

        for r in recommendations:
            symbol = r["symbol"]
            price = float(r.get("current_price", 0.0))
            if price <= 0:
                continue

            stock_sig = r.get("stock_signal", {})
            opt_sig = r.get("option_signal", {})

            # Current allocation for symbol
            current_sym_val = existing_holdings_val.get(symbol, 0.0)
            avail_pos_cap = max(0.0, max_pos_cap_dollars - current_sym_val)

            # --- 5a. Stock Purchase (based on Stage 1 target quantity) ---
            target_shares = int(stock_sig.get("suggested_shares", 0))
            if target_shares <= 0:
                target_shares = max(1, math.floor(2000.0 / price))

            target_stock_cost = round(target_shares * price, 2)
            
            # The maximum budget available for this stock purchase across cash, daily spend cap, and position cap
            max_stock_budget = min(current_cash_pool, current_daily_pool, avail_pos_cap)

            if max_stock_budget >= price and target_shares > 0:
                if target_stock_cost <= max_stock_budget:
                    shares_to_buy = target_shares
                else:
                    # Partial fill / size down to fit remaining budget
                    shares_to_buy = math.floor(max_stock_budget / price)

                if shares_to_buy > 0:
                    stock_order_cost = round(shares_to_buy * price, 2)
                    buy_res = self.client.place_stock_order(
                        symbol=symbol,
                        action="BUY",
                        quantity=float(shares_to_buy),
                        price=price
                    )
                    
                    if buy_res.get("success"):
                        current_cash_pool = round(max(0.0, current_cash_pool - stock_order_cost), 2)
                        current_daily_pool = round(max(0.0, current_daily_pool - stock_order_cost), 2)
                        existing_holdings_val[symbol] = current_sym_val + stock_order_cost
                        avail_pos_cap = max(0.0, max_pos_cap_dollars - existing_holdings_val[symbol])

                        status_label = "FILLED" if shares_to_buy == target_shares else "PARTIAL"
                        fill_msg = buy_res.get("message")
                        if shares_to_buy < target_shares:
                            fill_msg = f"Partially filled {shares_to_buy}/{target_shares} shares (${stock_order_cost:,.2f}) due to available buying power / spend cap limits."

                        executed_buys_stock.append({
                            "symbol": symbol,
                            "action": "BUY",
                            "quantity": shares_to_buy,
                            "target_quantity": target_shares,
                            "price": price,
                            "total_cost": stock_order_cost,
                            "rank": r.get("rank"),
                            "status": status_label,
                            "partial_fill": shares_to_buy < target_shares,
                            "mcp_response": fill_msg
                        })
                    else:
                        executed_buys_stock.append({
                            "symbol": symbol,
                            "action": "BUY",
                            "quantity": shares_to_buy,
                            "target_quantity": target_shares,
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
                        "target_quantity": target_shares,
                        "price": price,
                        "total_cost": 0.0,
                        "rank": r.get("rank"),
                        "status": "SKIPPED",
                        "partial_fill": False,
                        "mcp_response": f"Skipped: Target {target_shares} shs (${target_stock_cost:,.2f}) exceeds available budget (${max_stock_budget:,.2f} available, price ${price:,.2f})"
                    })
            else:
                executed_buys_stock.append({
                    "symbol": symbol,
                    "action": "BUY",
                    "quantity": 0,
                    "target_quantity": target_shares,
                    "price": price,
                    "total_cost": 0.0,
                    "rank": r.get("rank"),
                    "status": "SKIPPED",
                    "partial_fill": False,
                    "mcp_response": f"Skipped: Insufficient buying power or spend cap (${max_stock_budget:,.2f} available, price ${price:,.2f})"
                })

            # --- 5b. Option Purchase (based on Stage 1 target contracts) ---
            if opt_sig:
                target_contracts = int(opt_sig.get("contracts", 0))
                prem = float(opt_sig.get("estimated_premium", 0.0))
                strike = float(opt_sig.get("strike", price))
                expiry = opt_sig.get("expiry_date", "")
                contract_cost = round(prem * 100.0, 2)

                if target_contracts <= 0 and contract_cost > 0:
                    target_contracts = max(1, math.floor(2000.0 / contract_cost))

                if target_contracts > 0 and contract_cost > 0:
                    target_opt_cost = round(target_contracts * contract_cost, 2)
                    max_opt_budget = min(current_cash_pool, current_daily_pool, avail_pos_cap)

                    if max_opt_budget >= contract_cost:
                        if target_opt_cost <= max_opt_budget:
                            contracts_to_buy = target_contracts
                        else:
                            # Partial fill contracts
                            contracts_to_buy = math.floor(max_opt_budget / contract_cost)

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
                                avail_pos_cap = max(0.0, max_pos_cap_dollars - existing_holdings_val[symbol])

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
        updated_portfolio = self.client.get_portfolio()
        end_time = datetime.datetime.now()

        filled_stocks = [b for b in executed_buys_stock if b["status"] in ["FILLED", "PARTIAL"]]
        filled_options = [o for o in executed_buys_options if o["status"] in ["FILLED", "PARTIAL"]]

        execution_report = {
            "success": True,
            "agent_name": self.name,
            "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S EST"),
            "environment": getattr(self.client, "environment", "ROBINHOOD_MCP_SANDBOX"),
            "initial_cash": initial_cash,
            "liquidation_proceeds": round(actual_liquidation_proceeds, 2),
            "effective_buying_power": effective_buying_power,
            "final_cash_remaining": updated_portfolio.get("cash_available", 0.0),
            "total_portfolio_equity": updated_portfolio.get("total_equity", 0.0),
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
            "updated_holdings": updated_portfolio.get("holdings", []),
            "updated_options": updated_portfolio.get("option_positions", []),
            "execution_summary": (
                f"Rebalance completed: Liquidated {len(executed_sells)} positions generating ${actual_liquidation_proceeds:,.2f} cash. "
                f"Executed {len(filled_stocks)} stock buys and {len(filled_options)} option call contracts in {getattr(self.client, 'environment', 'Robinhood Sandbox')} based on Stage 1 sizing."
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
