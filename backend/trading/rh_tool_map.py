"""
Robinhood MCP Tool Mapping and Schema Resolver.

Maps logical trading operations to actual tool names and argument signatures
discovered from the Robinhood MCP server (``tools/list``).

Logical operations:
- GET_ACCOUNT: fetch account details, buying power, balances
- GET_POSITIONS: fetch active holdings and quantities
- GET_QUOTE: fetch current bid, ask, last price, spread
- PLACE_EQUITY_ORDER: submit limit order for equities
- GET_ORDER: query order status and filled quantities
- CANCEL_ORDER: cancel an open/unfilled order
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Callable, Dict, List, Optional

from trading import config

logger = logging.getLogger("RHToolMap")

# Logical tool operation constants
OP_GET_ACCOUNTS = "GET_ACCOUNTS"
OP_GET_PORTFOLIO = "GET_PORTFOLIO"
OP_GET_POSITIONS = "GET_POSITIONS"
OP_GET_QUOTE = "GET_QUOTE"
OP_PLACE_EQUITY_ORDER = "PLACE_EQUITY_ORDER"
OP_REVIEW_EQUITY_ORDER = "REVIEW_EQUITY_ORDER"
OP_GET_ORDER = "GET_ORDER"
OP_CANCEL_ORDER = "CANCEL_ORDER"

# Candidate tool names in priority order for each logical operation
CANDIDATE_NAMES: Dict[str, List[str]] = {
    OP_GET_ACCOUNTS: [
        "get_accounts",
        "get_account",
        "robinhood_get_accounts",
    ],
    OP_GET_PORTFOLIO: [
        "get_portfolio",
        "get_account_portfolio",
    ],
    OP_GET_POSITIONS: [
        "get_equity_positions",
        "get_positions",
        "get_holdings",
        "robinhood_get_positions",
    ],
    OP_GET_QUOTE: [
        "get_equity_quotes",
        "get_quote",
        "get_market_quote",
        "robinhood_get_quote",
    ],
    OP_PLACE_EQUITY_ORDER: [
        "place_equity_order",
        "place_stock_order",
        "place_order",
        "robinhood_place_stock_order",
    ],
    OP_REVIEW_EQUITY_ORDER: [
        "review_equity_order",
        "review_order",
    ],
    OP_GET_ORDER: [
        "get_equity_orders",
        "get_order",
        "get_order_status",
        "robinhood_get_order",
    ],
    OP_CANCEL_ORDER: [
        "cancel_equity_order",
        "cancel_order",
        "robinhood_cancel_order",
    ],
}


class ToolMap:
    """Resolves logical operations to concrete tool names and prepares arguments."""

    def __init__(self, tools_data: Optional[List[Dict[str, Any]]] = None):
        self.raw_tools: List[Dict[str, Any]] = tools_data or self._load_saved_tools()
        self.tools_by_name: Dict[str, Dict[str, Any]] = {
            t.get("name", ""): t for t in self.raw_tools if "name" in t
        }
        self.resolved_map: Dict[str, str] = {}
        self._resolve_all()

    def _load_saved_tools(self) -> List[Dict[str, Any]]:
        path = config.TOOLS_LIST_FILE
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return data
                    elif isinstance(data, dict) and "tools" in data:
                        return data["tools"]
            except Exception as e:
                logger.warning(f"Failed to read {path}: {e}")
        return []

    def save_tools(self, tools: List[Dict[str, Any]]) -> None:
        """Saves discovered tools to docs/robinhood_mcp_tools.json."""
        self.raw_tools = tools
        self.tools_by_name = {t.get("name", ""): t for t in tools if "name" in t}
        os.makedirs(os.path.dirname(config.TOOLS_LIST_FILE), exist_ok=True)
        with open(config.TOOLS_LIST_FILE, "w", encoding="utf-8") as f:
            json.dump(tools, f, indent=2)
        logger.info(f"Saved {len(tools)} MCP tools to {config.TOOLS_LIST_FILE}")
        self._resolve_all()

    def _resolve_all(self) -> None:
        """Resolves each logical operation against available tools."""
        available_names = set(self.tools_by_name.keys())
        for op, candidates in CANDIDATE_NAMES.items():
            matched = None
            for c in candidates:
                if c in available_names:
                    matched = c
                    break
            # Fallback: substring matching if exact match not found
            if not matched:
                op_keyword = op.lower().replace("place_", "").replace("get_", "").replace("_order", "")
                for name in available_names:
                    if op_keyword in name.lower():
                        matched = name
                        break
            # Default to primary candidate if none discovered yet
            self.resolved_map[op] = matched or candidates[0]
            logger.debug(f"Operation {op} mapped to tool: {self.resolved_map[op]}")

    def get_tool_name(self, op: str) -> str:
        return self.resolved_map.get(op, CANDIDATE_NAMES.get(op, [op])[0])

    def format_order_args(
        self,
        symbol: str,
        action: str,
        quantity: float,
        price: float,
        order_type: str = "limit",
        time_in_force: str = "gfd",
        market_hours: str = "regular_hours",
        client_order_id: Optional[str] = None,
        account_number: Optional[str] = None,
        is_review: bool = False
    ) -> Dict[str, Any]:
        """
        Builds arguments matching the input schema of place_equity_order / review_equity_order.
        """
        import uuid
        tool_name = self.get_tool_name(OP_REVIEW_EQUITY_ORDER if is_review else OP_PLACE_EQUITY_ORDER)
        tool_spec = self.tools_by_name.get(tool_name, {})
        props = tool_spec.get("inputSchema", {}).get("properties", {}) or {}

        args: Dict[str, Any] = {}

        # Account Number
        if account_number:
            args["account_number"] = str(account_number).strip()

        # Symbol
        args["symbol"] = symbol.upper()

        # Side / Action
        side_val = action.lower()
        if "side" in props or not props:
            args["side"] = side_val
        elif "action" in props:
            args["action"] = action.upper()

        # Quantity (string formatting for precision)
        qty_num = float(quantity)
        qty_str = str(int(qty_num)) if qty_num.is_integer() else f"{qty_num:.4f}"
        if "quantity" in props or not props:
            args["quantity"] = qty_str
        elif "shares" in props:
            args["shares"] = qty_num

        # Order Type
        typ_val = order_type.lower()
        if "type" in props or not props:
            args["type"] = typ_val
        elif "order_type" in props:
            args["order_type"] = order_type.upper()

        # Limit Price (required for limit orders)
        if typ_val in ("limit", "stop_limit"):
            price_str = f"{float(price):.2f}"
            if "limit_price" in props or not props:
                args["limit_price"] = price_str
            elif "price" in props:
                args["price"] = float(price)

        # Time In Force ('gfd' or 'gtc')
        tif_val = time_in_force.lower()
        if tif_val in ("day", "gfd"):
            tif_val = "gfd"
        if "time_in_force" in props or not props:
            args["time_in_force"] = tif_val

        # Market Hours
        if "market_hours" in props:
            args["market_hours"] = market_hours

        # Idempotency Ref ID (UUID)
        if not is_review:
            ref_val = client_order_id
            if not ref_val or not self._is_valid_uuid(ref_val):
                ref_val = str(uuid.uuid4())
            if "ref_id" in props or not props:
                args["ref_id"] = ref_val

        return args

    @staticmethod
    def _is_valid_uuid(val: str) -> bool:
        import uuid
        try:
            uuid.UUID(str(val))
            return True
        except (ValueError, AttributeError):
            return False

    def format_quote_args(self, symbol: Any) -> Dict[str, Any]:
        """Formats arguments for get_equity_quotes (supports symbol string or list)."""
        tool_name = self.get_tool_name(OP_GET_QUOTE)
        tool_spec = self.tools_by_name.get(tool_name, {})
        props = tool_spec.get("inputSchema", {}).get("properties", {}) or {}

        symbols_list = [symbol.upper()] if isinstance(symbol, str) else [s.upper() for s in symbol]

        if "symbols" in props or not props:
            return {"symbols": symbols_list}
        elif "symbol" in props:
            return {"symbol": symbols_list[0]}
        elif "ticker" in props:
            return {"ticker": symbols_list[0]}
        return {"symbols": symbols_list}

    def format_order_status_args(self, order_id: str, account_number: Optional[str] = None) -> Dict[str, Any]:
        """Formats arguments for get_equity_orders."""
        tool_name = self.get_tool_name(OP_GET_ORDER)
        tool_spec = self.tools_by_name.get(tool_name, {})
        props = tool_spec.get("inputSchema", {}).get("properties", {}) or {}

        args: Dict[str, Any] = {}
        if account_number and "account_number" in props:
            args["account_number"] = str(account_number).strip()
        elif account_number:
            args["account_number"] = str(account_number).strip()

        if "order_id" in props or not props:
            args["order_id"] = str(order_id)
        elif "id" in props:
            args["id"] = str(order_id)
        return args

    def format_cancel_args(self, order_id: str, account_number: Optional[str] = None) -> Dict[str, Any]:
        """Formats arguments for cancel_equity_order."""
        tool_name = self.get_tool_name(OP_CANCEL_ORDER)
        tool_spec = self.tools_by_name.get(tool_name, {})
        props = tool_spec.get("inputSchema", {}).get("properties", {}) or {}

        args: Dict[str, Any] = {}
        if account_number and "account_number" in props:
            args["account_number"] = str(account_number).strip()
        elif account_number:
            args["account_number"] = str(account_number).strip()

        if "order_id" in props or not props:
            args["order_id"] = str(order_id)
        elif "id" in props:
            args["id"] = str(order_id)
        return args


# Singleton instance
_tool_map: Optional[ToolMap] = None


def get_tool_map() -> ToolMap:
    global _tool_map
    if _tool_map is None:
        _tool_map = ToolMap()
    return _tool_map
