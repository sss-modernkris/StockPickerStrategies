"""
Unit tests for BrokerAgent dynamic capital allocation and small-account portfolio sizing.
"""

import os
import sys
import unittest
from unittest.mock import MagicMock

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from agents.broker_agent import BrokerAgent


class TestBrokerDynamicAllocation(unittest.TestCase):
    def setUp(self):
        self.broker = BrokerAgent(name="Test Broker")
        self.mock_client = MagicMock()
        self.broker.client = self.mock_client

    def test_rebalance_allocates_initial_cash_plus_liquidations(self):
        """
        Tests the user scenario:
        - Initial cash: $774.60
        - Liquidated positions: CPRT ($149.08) and MCHP ($80.06) = $229.14
        - Total deployable cash: $1,003.74
        - Recommendations: INTC ($92.07), GM ($85.72), PM ($208.50), WFC ($84.81), ABT ($104.57)
        - Expected: All 5 stocks planned to buy, deploying ~$942.84, with PM included (1 share),
          rather than starving PM and stopping at $367.17.
        """
        # 1. Mock initial portfolio
        self.mock_client.get_portfolio.return_value = {
            "cash_available": 774.60,
            "total_equity": 1004.21,
            "holdings": [
                {"symbol": "CPRT", "quantity": 5.0, "current_price": 29.815, "market_value": 149.08, "unrealized_pnl": 0.0},
                {"symbol": "MCHP", "quantity": 1.0, "current_price": 80.06, "market_value": 80.06, "unrealized_pnl": 0.0},
            ],
            "guardrails": {
                "daily_spend_limit": 5000.0,
                "today_spend_total": 0.0,
                "remaining_daily_budget": 5000.0,
                "position_cap_pct": 25.0,
            }
        }
        self.mock_client.environment = "ROBINHOOD_MCP_LIVE_APPROVAL"
        self.mock_client.place_stock_order.return_value = {"success": True, "message": "Shadow filled"}

        backtest_output = {
            "success": True,
            "ranked_recommendations": [
                {"symbol": "INTC", "current_price": 92.07, "rank": 1},
                {"symbol": "GM", "current_price": 85.72, "rank": 2},
                {"symbol": "PM", "current_price": 208.50, "rank": 3},
                {"symbol": "WFC", "current_price": 84.81, "rank": 4},
                {"symbol": "ABT", "current_price": 104.57, "rank": 5},
            ]
        }

        report = self.broker.evaluate_and_rebalance(backtest_output)

        self.assertTrue(report["success"])
        self.assertEqual(report["initial_cash"], 774.60)
        self.assertEqual(report["liquidation_proceeds"], 229.14)
        self.assertEqual(report["effective_buying_power"], 1003.74)

        buys = report["execution_actions"]["buys_stock"]
        buy_map = {b["symbol"]: b for b in buys}

        # Verify all 5 stocks were allocated shares (> 0)
        self.assertGreater(buy_map["INTC"]["quantity"], 0)
        self.assertGreater(buy_map["GM"]["quantity"], 0)
        self.assertGreater(buy_map["PM"]["quantity"], 0, "PM should be allocated at least 1 share")
        self.assertGreater(buy_map["WFC"]["quantity"], 0)
        self.assertGreater(buy_map["ABT"]["quantity"], 0)

        # Specifically, check PM got 1 share ($208.50)
        self.assertEqual(buy_map["PM"]["quantity"], 1)

        # Check total spent is > $900 (90%+ utilization of the $1,003.74)
        total_buys_cost = report["total_spent_buys"]
        self.assertGreater(total_buys_cost, 900.0, f"Expected > $900 total buy cost, got ${total_buys_cost}")
        self.assertLessEqual(total_buys_cost, 1003.74)

        # Final remaining cash should be under $100
        self.assertLessEqual(report["final_cash_remaining"], 100.0)

    def test_held_symbol_is_skipped(self):
        """Tests that a recommendation already held in portfolio is not re-bought."""
        self.mock_client.get_portfolio.return_value = {
            "cash_available": 1000.0,
            "total_equity": 2000.0,
            "holdings": [
                {"symbol": "AAPL", "quantity": 10.0, "current_price": 100.0, "market_value": 1000.0},
            ],
            "guardrails": {
                "daily_spend_limit": 5000.0,
                "today_spend_total": 0.0,
                "remaining_daily_budget": 5000.0,
                "position_cap_pct": 25.0,
            }
        }
        self.mock_client.place_stock_order.return_value = {"success": True}

        backtest_output = {
            "success": True,
            "ranked_recommendations": [
                {"symbol": "AAPL", "current_price": 100.0, "rank": 1},  # Retained
                {"symbol": "MSFT", "current_price": 100.0, "rank": 2},  # New buy
            ]
        }

        report = self.broker.evaluate_and_rebalance(backtest_output)
        buys = {b["symbol"]: b for b in report["execution_actions"]["buys_stock"]}
        self.assertEqual(buys["AAPL"]["status"], "SKIPPED")
        self.assertIn("already held", buys["AAPL"]["mcp_response"])
        self.assertGreater(buys["MSFT"]["quantity"], 0)


if __name__ == "__main__":
    unittest.main()

