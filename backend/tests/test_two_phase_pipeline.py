"""
Unit and integration tests for the Two-Phase Automated Trading Pipeline:
- Phase 1: 11:00 AM EST Morning Sell Trigger (Automatic in both Approval and Auto modes)
- Phase 2: 14:00 EST Afternoon Buy Trigger (Approval waits for HITL approval, Auto dispatches automatically)
- Zero-Block Automatic Execution in Approval Mode
"""

import datetime
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from agents.broker_agent import BrokerAgent
from agents.pipeline import TradingPipeline
from trading import approval, ledger, state


class TestTwoPhasePipeline(unittest.TestCase):
    def setUp(self):
        state.reset_breaker()
        state.set_kill_switch(False)
        state.set_mode("SANDBOX")

    def test_pipeline_schedule_configuration(self):
        pipeline = TradingPipeline()
        status = pipeline.get_status()
        self.assertEqual(status["morning_sell_time_est"], "11:00 EST/EDT")
        self.assertEqual(status["afternoon_buy_time_est"], "14:00 EST/EDT")
        self.assertIn("11:00", status["schedule_description"])
        self.assertIn("14:00", status["schedule_description"])

    def test_next_run_time_calculation(self):
        pipeline = TradingPipeline()
        next_run = pipeline.get_next_run_time()
        self.assertTrue("Morning Sell" in next_run or "Afternoon Buy" in next_run)

    def test_morning_sell_automatic_in_sandbox(self):
        broker = BrokerAgent()
        # Seed 1 holding in sandbox
        sb = broker.client
        sb.place_stock_order("AAPL", "BUY", 5, 150.0)

        report = broker.execute_morning_sell(trigger_source="TEST_MORNING")
        self.assertTrue(report["success"])
        self.assertEqual(report["phase"], "MORNING_SELL")
        self.assertEqual(report["overall_status"], "SUCCESSFUL_EXECUTION")
        self.assertGreaterEqual(report["holdings_count"], 1)

        # Confirm 0 active holdings remain
        port = sb.get_portfolio()
        active = [h for h in port.get("holdings", []) if h.get("quantity", 0) > 0]
        self.assertEqual(len(active), 0)

    def test_morning_sell_no_holdings_graceful(self):
        broker = BrokerAgent()
        report = broker.execute_morning_sell(trigger_source="TEST_EMPTY")
        self.assertTrue(report["success"])
        self.assertEqual(report["overall_status"], "NO_HOLDINGS_TO_LIQUIDATE")
        self.assertEqual(report["holdings_count"], 0)

    @patch("trading.live_gateway.LiveExecutionGateway.place_stock_order")
    @patch("trading.live_gateway.LiveExecutionGateway.get_portfolio")
    def test_morning_sell_automatic_in_live_approval(self, mock_port, mock_place):
        # Set mode to LIVE_APPROVAL
        state.set_mode("LIVE_APPROVAL")
        self.assertEqual(state.get_mode(), "LIVE_APPROVAL")

        # Mock portfolio with 2 holdings from yesterday
        mock_port.return_value = {
            "account_id": "810601369",
            "cash_available": 500.0,
            "total_equity": 3500.0,
            "holdings": [
                {"symbol": "NVDA", "quantity": 10.0, "current_price": 120.0},
                {"symbol": "MSFT", "quantity": 5.0, "current_price": 400.0}
            ]
        }
        mock_place.return_value = {"success": True, "status": "FILLED", "order_id": "RH-SELL-123"}

        broker = BrokerAgent()
        report = broker.execute_morning_sell(trigger_source="SCHEDULED_11AM")

        self.assertTrue(report["success"])
        self.assertEqual(report["holdings_count"], 2)
        # Verify LiveExecutionGateway.place_stock_order was called directly without waiting for user approval
        self.assertEqual(mock_place.call_count, 2)
        called_symbols = {c.kwargs.get("symbol") or c.args[0] for c in mock_place.call_args_list}
        self.assertIn("NVDA", called_symbols)
        self.assertIn("MSFT", called_symbols)

    def tearDown(self):
        state.set_mode("SANDBOX")


if __name__ == "__main__":
    unittest.main()
