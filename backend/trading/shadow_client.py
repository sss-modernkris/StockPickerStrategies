"""
Shadow Trading Client (LIVE_SHADOW Mode).

Connects to the real Robinhood MCP account for all read operations (buying power,
equity, holdings, quotes), but intercepts all order placement calls:
- Does NOT send orders to Robinhood.
- Records order intentions into ``_data/live_trading/ledger.jsonl`` as ``SHADOW_INTENT``.
- Returns high-fidelity simulated fill responses so the Broker Agent's analysis,
  cash tracking, and execution summary calculate exactly as they would in production.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from trading import ledger
from trading.client_protocol import TradingClient
from trading.live_client import LiveMCPClient, get_live_client

logger = logging.getLogger("ShadowClient")


class ShadowClient(TradingClient):
    """Real read client with simulated shadow order execution."""

    def __init__(self, live_client: Optional[LiveMCPClient] = None):
        self.client = live_client or get_live_client()
        self.environment = "ROBINHOOD_MCP_LIVE_SHADOW"
        self.ledger = ledger.get_ledger()
        logger.info("ShadowClient initialized with real account reads and shadow order recording.")

    def get_portfolio(self) -> Dict[str, Any]:
        """Fetches real account portfolio via Robinhood MCP."""
        port = self.client.get_portfolio()
        port["environment"] = self.environment
        return port

    def place_stock_order(
        self,
        symbol: str,
        action: str,
        quantity: float,
        price: float
    ) -> Dict[str, Any]:
        """
        Records shadow intent into the ledger without submitting to Robinhood.
        """
        symbol = symbol.strip().upper()
        action = action.strip().upper()
        quantity = float(quantity)
        price = float(price)
        cost = round(quantity * price, 2)
        order_id = f"RH-SHADOW-{int(time.time() * 1000)}"

        # Record in live audit ledger
        self.ledger.append(
            ledger.EV_SHADOW,
            symbol=symbol,
            action=action,
            quantity=quantity,
            price=price,
            total_cost=cost,
            order_id=order_id,
            mode="LIVE_SHADOW"
        )

        logger.info(f"[SHADOW INTENT] Simulated {action} {quantity} shs {symbol} @ ${price:.2f} (Total: ${cost:,.2f}) - No live funds committed.")

        return {
            "success": True,
            "status": "FILLED",
            "order_id": order_id,
            "message": f"[SHADOW SIMULATION] {action} {quantity} shs of {symbol} at ${price:.2f} recorded in live shadow ledger.",
            "order": {
                "order_id": order_id,
                "symbol": symbol,
                "action": action,
                "quantity": quantity,
                "filled_quantity": quantity,
                "price": price,
                "avg_fill_price": price,
                "status": "FILLED",
                "environment": self.environment
            }
        }

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
        Options are disallowed in live modes per policy. Shadow client logs SKIPPED_LIVE_POLICY.
        """
        msg = f"[SHADOW POLICY] Option order {action} {contracts}x {symbol} ${strike} {option_type} skipped per live policy (equities only)."
        self.ledger.append(
            ledger.EV_DECISION,
            symbol=symbol,
            action=action,
            asset_type="option",
            decision="SKIPPED_LIVE_POLICY",
            reason="Equities only policy in live trading",
            mode="LIVE_SHADOW"
        )
        return {
            "success": False,
            "status": "SKIPPED_LIVE_POLICY",
            "message": msg,
            "error": "SKIPPED_LIVE_POLICY: Equities only permitted in live trading."
        }
