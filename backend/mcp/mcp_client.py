"""
Robinhood MCP Client Wrapper
Provides structured Python access to Robinhood MCP tools for the Broker Agent.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from mcp.rh_mcp_server import get_sandbox, handle_mcp_request

logger = logging.getLogger("RobinhoodMCPClient")

class RobinhoodMCPClient:
    """Client for dispatching calls to Robinhood MCP Sandbox tools."""

    def __init__(self, use_in_process: bool = True):
        self.use_in_process = use_in_process
        self.sandbox = get_sandbox()
        logger.info("Robinhood MCP Sandbox Client initialized.")

    def get_portfolio(self) -> Dict[str, Any]:
        """Calls the 'robinhood_get_portfolio' MCP tool."""
        req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "robinhood_get_portfolio",
                "arguments": {}
            }
        }
        resp = handle_mcp_request(req)
        if "result" in resp and "content" in resp["result"]:
            text = resp["result"]["content"][0]["text"]
            return json.loads(text)
        elif "error" in resp:
            logger.error(f"Error from robinhood_get_portfolio: {resp['error']}")
            return {"error": resp["error"]["message"]}
        return self.sandbox.get_portfolio()

    def place_stock_order(self, symbol: str, action: str, quantity: float, price: float) -> Dict[str, Any]:
        """Calls the 'robinhood_place_stock_order' MCP tool."""
        req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "robinhood_place_stock_order",
                "arguments": {
                    "symbol": symbol,
                    "action": action,
                    "quantity": quantity,
                    "price": price
                }
            }
        }
        resp = handle_mcp_request(req)
        if "result" in resp and "content" in resp["result"]:
            text = resp["result"]["content"][0]["text"]
            return json.loads(text)
        elif "error" in resp:
            return {"success": False, "error": resp["error"]["message"]}
        return {"success": False, "error": "Unknown error calling MCP tool"}

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
        """Calls the 'robinhood_place_option_order' MCP tool."""
        req = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "robinhood_place_option_order",
                "arguments": {
                    "symbol": symbol,
                    "option_type": option_type,
                    "strike": strike,
                    "expiry_date": expiry_date,
                    "action": action,
                    "contracts": contracts,
                    "premium": premium
                }
            }
        }
        resp = handle_mcp_request(req)
        if "result" in resp and "content" in resp["result"]:
            text = resp["result"]["content"][0]["text"]
            return json.loads(text)
        elif "error" in resp:
            return {"success": False, "error": resp["error"]["message"]}
        return {"success": False, "error": "Unknown error calling MCP tool"}
