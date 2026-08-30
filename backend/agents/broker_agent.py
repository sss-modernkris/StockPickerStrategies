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

from mcp.mcp_client import RobinhoodMCPClient

logger = logging.getLogger("BrokerAgent")

class BrokerAgent:
    """Specialized AI Broker Agent that executes sandbox portfolio rebalancing and trade execution."""

    def __init__(self, name: str = "Broker Agent"):
        self.name = name
        self.client = RobinhoodMCPClient()
        logger.info(f"{self.name} initialized with Robinhood MCP Sandbox connection.")

    def evaluate_and_rebalance(self, backtest_output: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes incoming Backtester recommendations, performs portfolio comparative analysis,
        calculates buying power from cash and sell liquidations, and executes stock & option orders.
        """
        start_time = datetime.datetime.now()
        logger.info(f"[{self.name}] Initiating portfolio comparative analysis & execution pipeline...")

        # 1. Fetch current sandbox portfolio state via Robinhood MCP
        portfolio = self.client.get_portfolio()
        current_cash = float(portfolio.get("cash_available", 0.0))
        current_holdings = portfolio.get("holdings", [])
        current_options = portfolio.get("option_positions", [])

        holdings_by_symbol = {h["symbol"]: h for h in current_holdings if h["quantity"] > 0}

        recommendations = backtest_output.get("ranked_recommendations", [])
        recommended_symbols = {r["symbol"]: r for r in recommendations}

        # 2. Portfolio Comparative Analysis
        sell_decisions = []
        keep_decisions = []
        liquidation_cash_generated = 0.0

        for symbol, h in holdings_by_symbol.items():
            qty = float(h["quantity"])
            price = float(h.get("current_price", h.get("avg_price", 0.0)))
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
                    "reason": f"Displaced from top screener. Liquidating to fund higher-ranked opportunities."
                })
                liquidation_cash_generated += market_val
            else:
                keep_decisions.append({
                    "symbol": symbol,
                    "quantity": qty,
                    "current_price": price,
                    "rank": recommended_symbols[symbol].get("rank"),
                    "reason": "Retained: Matches active Strategy 1 top recommendations."
                })

        # 3. Calculate Dynamic Buying Power with Sell Executions
        projected_buying_power = round(current_cash + liquidation_cash_generated, 2)

        # 4. Phase 1 Execution: Dispatch SELL Orders via Robinhood MCP
        executed_sells = []
        for s in sell_decisions:
            res = self.client.place_stock_order(
                symbol=s["symbol"],
                action="SELL",
                quantity=s["quantity"],
                price=s["price"]
            )
            executed_sells.append({
                "symbol": s["symbol"],
                "action": "SELL",
                "quantity": s["quantity"],
                "price": s["price"],
                "proceeds": s["estimated_proceeds"],
                "status": "FILLED" if res.get("success") else "FAILED",
                "mcp_response": res.get("message") or res.get("error")
            })

        # 5. Phase 2 Execution: Determine and Dispatch BUY Orders for Stocks & Options
        # Target top candidates that are either not held or need position sizing
        executed_buys_stock = []
        executed_buys_options = []

        # Available budget per trade based on updated buying power
        num_new_targets = max(1, len(recommendations))
        per_target_budget = min(projected_buying_power / num_new_targets, 5000.0) if projected_buying_power > 0 else 0.0

        for r in recommendations:
            symbol = r["symbol"]
            price = float(r["current_price"])
            opt_sig = r.get("option_signal", {})

            # 5a. Stock Buy: Allocate ~60% of target budget
            stock_alloc = per_target_budget * 0.60
            if stock_alloc > 100.0 and price > 0:
                shares = math.floor(stock_alloc / price)
                if shares > 0:
                    buy_res = self.client.place_stock_order(
                        symbol=symbol,
                        action="BUY",
                        quantity=float(shares),
                        price=price
                    )
                    executed_buys_stock.append({
                        "symbol": symbol,
                        "action": "BUY",
                        "quantity": shares,
                        "price": price,
                        "total_cost": round(shares * price, 2),
                        "rank": r.get("rank"),
                        "status": "FILLED" if buy_res.get("success") else "FAILED",
                        "mcp_response": buy_res.get("message") or buy_res.get("error")
                    })

            # 5b. Option Buy: Allocate ~40% of target budget for ATM Call Option
            opt_alloc = per_target_budget * 0.40
            if opt_alloc > 100.0 and opt_sig:
                prem = float(opt_sig.get("estimated_premium", 0.0))
                strike = float(opt_sig.get("strike", price))
                expiry = opt_sig.get("expiry_date", "")
                if prem > 0:
                    contracts = math.floor(opt_alloc / (prem * 100.0))
                    if contracts < 1 and opt_alloc >= (prem * 100.0 * 0.5):
                        contracts = 1  # Buy at least 1 contract if within reach
                    if contracts > 0:
                        opt_res = self.client.place_option_order(
                            symbol=symbol,
                            option_type="CALL",
                            strike=strike,
                            expiry_date=expiry,
                            action="BUY",
                            contracts=contracts,
                            premium=prem
                        )
                        executed_buys_options.append({
                            "symbol": symbol,
                            "option_type": "CALL",
                            "strike": strike,
                            "expiry_date": expiry,
                            "contracts": contracts,
                            "premium": prem,
                            "total_cost": round(contracts * prem * 100.0, 2),
                            "rank": r.get("rank"),
                            "status": "FILLED" if opt_res.get("success") else "FAILED",
                            "mcp_response": opt_res.get("message") or opt_res.get("error")
                        })

        # 6. Post-execution Portfolio Snapshot
        updated_portfolio = self.client.get_portfolio()
        end_time = datetime.datetime.now()

        execution_report = {
            "success": True,
            "agent_name": self.name,
            "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S EST"),
            "environment": "ROBINHOOD_MCP_SANDBOX",
            "initial_cash": current_cash,
            "liquidation_proceeds": round(liquidation_cash_generated, 2),
            "effective_buying_power": projected_buying_power,
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
                f"Rebalance completed: Liquidated {len(executed_sells)} positions generating ${liquidation_cash_generated:,.2f} cash. "
                f"Executed {len(executed_buys_stock)} stock buys and {len(executed_buys_options)} option call contracts in Robinhood Sandbox."
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
