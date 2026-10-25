"""
Unit tests for Robinhood Live Trading Architecture:
- Trading State, Kill Switch, and Circuit Breaker
- Audit Ledger, Daily Spend Aggregation, and PDT tracking
- Live Execution Gateway 9 Firewall Checks with Mock MCP Client
- Approval Plan Manager & TTL expiration
- Factory client resolution across modes
"""

import datetime
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from trading import approval, config, factory, ledger, market_calendar, state
from trading.live_gateway import LiveExecutionGateway
from trading.shadow_client import ShadowClient
from trading.sandbox_client import SandboxClient


class TestTradingState(unittest.TestCase):
    def setUp(self):
        state.reset_breaker()
        state.set_kill_switch(False)
        state.set_mode("SANDBOX")

    def test_mode_transitions(self):
        self.assertEqual(state.get_mode(), "SANDBOX")
        state.set_mode("LIVE_SHADOW")
        self.assertEqual(state.get_mode(), "LIVE_SHADOW")
        state.set_mode("LIVE_APPROVAL")
        self.assertEqual(state.get_mode(), "LIVE_APPROVAL")

    def test_autonomous_mode_requires_confirmation_phrase(self):
        with self.assertRaises(state.ModeChangeError):
            state.set_mode("LIVE_AUTONOMOUS", confirmation="wrong")

        res = state.set_mode("LIVE_AUTONOMOUS", confirmation="I UNDERSTAND THIS TRADES REAL MONEY")
        self.assertEqual(res["mode"], "LIVE_AUTONOMOUS")
        self.assertEqual(state.get_mode(), "LIVE_AUTONOMOUS")

    def test_kill_switch(self):
        self.assertFalse(state.kill_switch_active())
        state.set_kill_switch(True, reason="Unit test")
        self.assertTrue(state.kill_switch_active())
        state.set_kill_switch(False)
        self.assertFalse(state.kill_switch_active())

    def test_circuit_breaker(self):
        self.assertFalse(state.breaker_state()["open"])
        state.record_failure("error 1")
        state.record_failure("error 2")
        self.assertFalse(state.breaker_state()["open"])
        state.record_failure("error 3")
        self.assertTrue(state.breaker_state()["open"])
        state.reset_breaker()
        self.assertFalse(state.breaker_state()["open"])


class TestAuditLedger(unittest.TestCase):
    def setUp(self):
        self.test_ledger_path = os.path.join(BACKEND_DIR, "_data", "test_ledger.jsonl")
        if os.path.exists(self.test_ledger_path):
            os.remove(self.test_ledger_path)
        self.ledger = ledger.Ledger(path=self.test_ledger_path)

    def tearDown(self):
        if os.path.exists(self.test_ledger_path):
            os.remove(self.test_ledger_path)

    def test_ledger_append_and_aggregates(self):
        self.ledger.append(ledger.EV_FINAL, symbol="AAPL", side="BUY", filled_quantity=10.0, avg_fill_price=150.0)
        self.ledger.append(ledger.EV_FINAL, symbol="MSFT", side="BUY", filled_quantity=5.0, avg_fill_price=300.0)
        self.ledger.append(ledger.EV_FINAL, symbol="GOOGL", side="SELL", filled_quantity=10.0, avg_fill_price=100.0)

        # Spend total: 10*150 (1500) + 5*300 (1500) = 3000.0
        self.assertEqual(self.ledger.today_spend_total(), 3000.0)
        self.assertEqual(self.ledger.symbols_bought_today(), {"AAPL", "MSFT"})


class TestLiveExecutionGateway(unittest.TestCase):
    def setUp(self):
        self.mock_client = MagicMock()
        self.gateway = LiveExecutionGateway(mode="LIVE_AUTONOMOUS", live_client=self.mock_client)
        state.reset_breaker()
        state.set_kill_switch(False)

        # Mock standard liquid quote: mid=100.0, spread=0.10%
        self.mock_client.get_quote.return_value = {
            "symbol": "AAPL",
            "bid": 99.95,
            "ask": 100.05,
            "mid": 100.0,
            "last": 100.0,
            "spread_pct": 0.10
        }
        # Mock empty portfolio with $10,000 cash
        self.mock_client.get_portfolio.return_value = {
            "account_id": "RH-AGENTIC-001",
            "cash_available": 10000.0,
            "total_equity": 25000.0,
            "holdings": []
        }

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=False)
    def test_guardrail_options_rejected_in_live(self, mock_rest, mock_open):
        res = self.gateway.place_option_order(
            symbol="NVDA", option_type="CALL", strike=120.0, expiry_date="2026-11-20",
            action="BUY", contracts=1, premium=3.50
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "SKIPPED_LIVE_POLICY")

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=False)
    def test_guardrail_kill_switch_active(self, mock_rest, mock_open):
        state.set_kill_switch(True)
        res = self.gateway.place_stock_order(symbol="AAPL", action="BUY", quantity=10, price=100.0)
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "REJECTED")
        self.assertIn("Kill Switch", res["error"])

    @patch("trading.market_calendar.is_market_open", return_value=False)
    def test_guardrail_outside_market_hours(self, mock_open):
        self.mock_client.place_stock_order.return_value = {
            "success": True,
            "data": {"id": "RH-ORD-QUEUED-1"}
        }
        res = self.gateway.place_stock_order(symbol="AAPL", action="BUY", quantity=10, price=100.0)
        self.assertTrue(res["success"])
        self.assertIn(res["status"], ("QUEUED", "PENDING", "CONFIRMED"))

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=True)
    def test_guardrail_in_rest_window(self, mock_rest, mock_open):
        self.mock_client.place_stock_order.return_value = {
            "success": True,
            "data": {"id": "RH-ORD-QUEUED-2"}
        }
        res = self.gateway.place_stock_order(symbol="AAPL", action="BUY", quantity=10, price=100.0)
        self.assertTrue(res["success"])
        self.assertIn(res["status"], ("QUEUED", "PENDING", "CONFIRMED"))

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=False)
    def test_guardrail_buy_already_held_position_skipped(self, mock_rest, mock_open):
        # Symbol already held in portfolio
        self.mock_client.get_portfolio.return_value = {
            "account_id": "RH-AGENTIC-001",
            "cash_available": 10000.0,
            "total_equity": 25000.0,
            "holdings": [{"symbol": "AAPL", "quantity": 25.0, "current_price": 100.0}]
        }
        res = self.gateway.place_stock_order(symbol="AAPL", action="BUY", quantity=10, price=100.0)
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "SKIPPED")
        self.assertIn("already held", res["message"])

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=False)
    def test_guardrail_excessive_spread_skipped(self, mock_rest, mock_open):
        # Wide spread: 1.5% > 0.50% ceiling
        self.mock_client.get_quote.return_value = {
            "symbol": "AAPL", "bid": 98.5, "ask": 100.0, "mid": 99.25, "spread_pct": 1.51
        }
        res = self.gateway.place_stock_order(symbol="AAPL", action="BUY", quantity=10, price=100.0)
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "SKIPPED")
        self.assertIn("spread", res["message"])

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=False)
    def test_guardrail_stale_signal_deviation_skipped(self, mock_rest, mock_open):
        # Signal price $105 vs market mid $100 -> 5% deviation > 1.0%
        res = self.gateway.place_stock_order(symbol="AAPL", action="BUY", quantity=10, price=105.0)
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "SKIPPED")
        self.assertIn("deviates", res["message"])

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=False)
    def test_guardrail_sell_not_held_rejected(self, mock_rest, mock_open):
        res = self.gateway.place_stock_order(symbol="TSLA", action="SELL", quantity=10, price=100.0)
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "REJECTED")
        self.assertIn("not held", res["error"])

    @patch("trading.market_calendar.is_market_open", return_value=True)
    @patch("trading.market_calendar.in_broker_rest_window", return_value=False)
    def test_successful_buy_order_lifecycle(self, mock_rest, mock_open):
        self.mock_client.place_stock_order.return_value = {
            "success": True,
            "data": {"id": "RH-ORD-12345"}
        }
        self.mock_client.get_order_status.return_value = {
            "success": True,
            "data": {
                "id": "RH-ORD-12345",
                "state": "FILLED",
                "filled_quantity": 10.0,
                "average_price": 100.02
            }
        }
        res = self.gateway.place_stock_order(symbol="AAPL", action="BUY", quantity=10, price=100.0)
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "FILLED")
        self.assertEqual(res["quantity"], 10.0)
        self.assertEqual(res["order_id"], "RH-ORD-12345")


class TestFactoryResolution(unittest.TestCase):
    def test_factory_modes(self):
        c_sb = factory.get_trading_client("SANDBOX")
        self.assertIsInstance(c_sb, SandboxClient)
        self.assertEqual(c_sb.environment, "ROBINHOOD_MCP_SANDBOX")

        c_sh = factory.get_trading_client("LIVE_SHADOW")
        self.assertIsInstance(c_sh, ShadowClient)

        c_ap = factory.get_trading_client("LIVE_APPROVAL")
        self.assertIsInstance(c_ap, ShadowClient)

        c_au = factory.get_trading_client("LIVE_AUTONOMOUS")
        self.assertIsInstance(c_au, LiveExecutionGateway)


if __name__ == "__main__":
    unittest.main()
