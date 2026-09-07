"""
Robinhood Model Context Protocol (MCP) Server
Exposes Robinhood trading capabilities as MCP tools strictly within a simulated sandbox environment.
"""

import json
import logging
import math
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("RobinhoodMCPServer")

# Ensure sandbox guardrail
SANDBOX_ACCOUNT_ID = "RH-SIM-SANDBOX-001"
DEFAULT_STARTING_CASH = 25000.0

class RobinhoodSandboxState:
    """In-memory state for the Robinhood Sandbox environment."""
    def __init__(self):
        self.account_id = SANDBOX_ACCOUNT_ID
        self.is_simulated = True
        self.cash = DEFAULT_STARTING_CASH
        self.holdings: Dict[str, Dict[str, Any]] = {
            "NVDA": {"quantity": 50.0, "avg_price": 120.0, "current_price": 128.50, "asset_type": "stock"},
            "TSLA": {"quantity": 30.0, "avg_price": 180.0, "current_price": 175.20, "asset_type": "stock"},
            "AVGO": {"quantity": 15.0, "avg_price": 150.0, "current_price": 158.40, "asset_type": "stock"},
            "F": {"quantity": 400.0, "avg_price": 12.0, "current_price": 11.85, "asset_type": "stock"}
        }
        self.option_positions: Dict[str, Dict[str, Any]] = {}
        self.orders: List[Dict[str, Any]] = [
            {
                "order_id": "RH-ORD-9001",
                "account": SANDBOX_ACCOUNT_ID,
                "symbol": "NVDA",
                "asset_type": "stock",
                "action": "BUY",
                "quantity": 50.0,
                "filled_quantity": 50.0,
                "price": 120.0,
                "avg_fill_price": 120.0,
                "status": "FILLED",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        ]
        self.paused = False
        self.budget_limit = 50000.0

    def get_portfolio(self) -> Dict[str, Any]:
        """Calculates total equity, cash, unrealized/realized P&L, and active positions."""
        holdings_list = []
        stock_equity = 0.0
        total_unrealized_pnl = 0.0

        for symbol, h in self.holdings.items():
            if h["quantity"] <= 0:
                continue
            qty = float(h["quantity"])
            cur_price = float(h.get("current_price", h.get("avg_price", 0.0)))
            avg_price = float(h.get("avg_price", cur_price))
            market_val = round(qty * cur_price, 2)
            cost_basis = round(qty * avg_price, 2)
            unrealized = round(market_val - cost_basis, 2)

            stock_equity += market_val
            total_unrealized_pnl += unrealized

            holdings_list.append({
                "symbol": symbol,
                "asset_type": "stock",
                "quantity": qty,
                "total_quantity": qty,
                "avg_price": avg_price,
                "avg_buy_price": avg_price,
                "current_price": cur_price,
                "market_value": market_val,
                "total_value": market_val,
                "cost_basis": cost_basis,
                "unrealized_pnl": unrealized,
                "unrealized_pnl_pct": round((unrealized / cost_basis * 100.0), 2) if cost_basis > 0 else 0.0
            })

        options_list = []
        option_equity = 0.0
        for opt_key, pos in self.option_positions.items():
            contracts = int(pos["contracts"])
            if contracts <= 0:
                continue
            cur_prem = float(pos.get("current_premium", pos.get("entry_premium", 0.0)))
            entry_prem = float(pos.get("entry_premium", cur_prem))
            market_val = round(contracts * cur_prem * 100.0, 2)
            cost_basis = round(contracts * entry_prem * 100.0, 2)
            unrealized = round(market_val - cost_basis, 2)

            option_equity += market_val
            total_unrealized_pnl += unrealized

            options_list.append({
                "position_id": opt_key,
                "symbol": pos["symbol"],
                "asset_type": "option",
                "option_type": pos["option_type"],
                "strike": pos["strike"],
                "expiry_date": pos["expiry_date"],
                "contracts": contracts,
                "entry_premium": entry_prem,
                "current_premium": cur_prem,
                "market_value": market_val,
                "cost_basis": cost_basis,
                "unrealized_pnl": unrealized,
                "unrealized_pnl_pct": round((unrealized / cost_basis * 100.0), 2) if cost_basis > 0 else 0.0
            })

        total_equity = round(self.cash + stock_equity + option_equity, 2)
        invested_cap = round(stock_equity + option_equity, 2)

        return {
            "account_id": self.account_id,
            "environment": "SANDBOX_SIMULATION",
            "is_connected": True,
            "is_simulated": True,
            "mcp_url": "https://agent.robinhood.com/mcp/trading",
            "cash_available": round(self.cash, 2),
            "buying_power": round(self.cash, 2),
            "invested_capital": invested_cap,
            "stock_equity": round(stock_equity, 2),
            "option_equity": round(option_equity, 2),
            "total_equity": total_equity,
            "unrealized_pnl": round(total_unrealized_pnl, 2),
            "realized_pnl": 0.0,
            "holdings": holdings_list,
            "option_positions": options_list,
            "orders": self.orders[:50],
            "paused": self.paused,
            "budget_limit": self.budget_limit,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def place_stock_order(self, symbol: str, action: str, quantity: float, price: float, order_type: str = "LIMIT") -> Dict[str, Any]:
        """Places a simulated stock order with guardrails."""
        symbol = symbol.strip().upper()
        action = action.strip().upper()
        quantity = float(quantity)
        price = float(price)

        if quantity <= 0 or price <= 0:
            return {"success": False, "error": f"Invalid order quantity ({quantity}) or price ({price})"}

        cost = round(quantity * price, 2)

        if action == "BUY":
            if cost > self.cash:
                return {
                    "success": False,
                    "error": f"Insufficient buying power: required ${cost:,.2f}, available cash is ${self.cash:,.2f}"
                }
            # Execute fill
            self.cash = round(self.cash - cost, 2)
            if symbol in self.holdings:
                curr_qty = self.holdings[symbol]["quantity"]
                curr_avg = self.holdings[symbol]["avg_price"]
                new_qty = curr_qty + quantity
                new_avg = round(((curr_qty * curr_avg) + cost) / new_qty, 2)
                self.holdings[symbol]["quantity"] = new_qty
                self.holdings[symbol]["avg_price"] = new_avg
                self.holdings[symbol]["current_price"] = price
            else:
                self.holdings[symbol] = {
                    "quantity": quantity,
                    "avg_price": price,
                    "current_price": price,
                    "asset_type": "stock"
                }
        elif action == "SELL":
            if symbol not in self.holdings or self.holdings[symbol]["quantity"] < quantity:
                held = self.holdings.get(symbol, {}).get("quantity", 0.0)
                return {
                    "success": False,
                    "error": f"Cannot sell {quantity} shares of {symbol}: only {held} shares currently held"
                }
            # Execute sell fill
            self.cash = round(self.cash + cost, 2)
            self.holdings[symbol]["quantity"] -= quantity
            if self.holdings[symbol]["quantity"] <= 0:
                del self.holdings[symbol]
        else:
            return {"success": False, "error": f"Unknown action: {action}"}

        order_id = f"RH-ORD-{9000 + len(self.orders) + 1}"
        order_record = {
            "order_id": order_id,
            "account": self.account_id,
            "symbol": symbol,
            "asset_type": "stock",
            "action": action,
            "quantity": quantity,
            "filled_quantity": quantity,
            "price": price,
            "avg_fill_price": price,
            "status": "FILLED",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self.orders.insert(0, order_record)

        return {
            "success": True,
            "order": order_record,
            "message": f"Simulated {action} order filled for {quantity} shares of {symbol} at ${price:,.2f} (Total: ${cost:,.2f})"
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
        """Places a simulated option contract order."""
        symbol = symbol.strip().upper()
        option_type = option_type.strip().upper()
        action = action.strip().upper()
        strike = float(strike)
        contracts = int(contracts)
        premium = float(premium)

        if contracts <= 0 or premium <= 0 or strike <= 0:
            return {"success": False, "error": "Invalid option parameters (contracts, strike, or premium <= 0)"}

        cost_of_position = round(contracts * premium * 100.0, 2)
        opt_key = f"{symbol}_{expiry_date}_{strike}_{option_type}"

        if action == "BUY":
            if cost_of_position > self.cash:
                return {
                    "success": False,
                    "error": f"Insufficient buying power for option: requires ${cost_of_position:,.2f}, available is ${self.cash:,.2f}"
                }
            self.cash = round(self.cash - cost_of_position, 2)
            if opt_key in self.option_positions:
                curr_c = self.option_positions[opt_key]["contracts"]
                curr_p = self.option_positions[opt_key]["entry_premium"]
                new_c = curr_c + contracts
                new_p = round(((curr_c * curr_p) + (contracts * premium)) / new_c, 2)
                self.option_positions[opt_key]["contracts"] = new_c
                self.option_positions[opt_key]["entry_premium"] = new_p
                self.option_positions[opt_key]["current_premium"] = premium
            else:
                self.option_positions[opt_key] = {
                    "symbol": symbol,
                    "option_type": option_type,
                    "strike": strike,
                    "expiry_date": expiry_date,
                    "contracts": contracts,
                    "entry_premium": premium,
                    "current_premium": premium,
                    "asset_type": "option"
                }
        elif action == "SELL":
            if opt_key not in self.option_positions or self.option_positions[opt_key]["contracts"] < contracts:
                held = self.option_positions.get(opt_key, {}).get("contracts", 0)
                return {
                    "success": False,
                    "error": f"Cannot sell {contracts} contracts of {opt_key}: only {held} held"
                }
            self.cash = round(self.cash + cost_of_position, 2)
            self.option_positions[opt_key]["contracts"] -= contracts
            if self.option_positions[opt_key]["contracts"] <= 0:
                del self.option_positions[opt_key]
        else:
            return {"success": False, "error": f"Unknown option action: {action}"}

        order_id = f"RH-OPT-{9000 + len(self.orders) + 1}"
        order_record = {
            "order_id": order_id,
            "account": self.account_id,
            "symbol": symbol,
            "asset_type": "option",
            "option_type": option_type,
            "strike": strike,
            "expiry_date": expiry_date,
            "action": action,
            "quantity": contracts,
            "filled_quantity": contracts,
            "price": premium,
            "avg_fill_price": premium,
            "status": "FILLED",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self.orders.insert(0, order_record)

        return {
            "success": True,
            "order": order_record,
            "message": f"Simulated {action} {contracts}x {symbol} ${strike} {option_type} exp {expiry_date} @ ${premium:.2f} (Total: ${cost_of_position:,.2f})"
        }


# Global singleton instance
_sandbox = RobinhoodSandboxState()

def get_sandbox() -> RobinhoodSandboxState:
    return _sandbox


# MCP Protocol Implementation (JSON-RPC 2.0 via Stdio)
TOOLS_SCHEMA = [
    {
        "name": "robinhood_get_portfolio",
        "description": "Retrieves the current Robinhood sandbox portfolio summary including cash balance, buying power, stock holdings, option positions, and active orders.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "robinhood_place_stock_order",
        "description": "Places a simulated stock BUY or SELL order in the Robinhood sandbox environment.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Stock ticker symbol (e.g., 'AAPL', 'NVDA')"},
                "action": {"type": "string", "enum": ["BUY", "SELL"], "description": "Order action: 'BUY' or 'SELL'"},
                "quantity": {"type": "number", "description": "Number of shares to trade"},
                "price": {"type": "number", "description": "Target limit price per share"}
            },
            "required": ["symbol", "action", "quantity", "price"]
        }
    },
    {
        "name": "robinhood_place_option_order",
        "description": "Places a simulated option contract BUY or SELL order (Calls or Puts) in the Robinhood sandbox environment.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Underlying stock ticker symbol (e.g. 'NVDA')"},
                "option_type": {"type": "string", "enum": ["CALL", "PUT"], "description": "Option type: 'CALL' or 'PUT'"},
                "strike": {"type": "number", "description": "Option strike price"},
                "expiry_date": {"type": "string", "description": "Expiration date in YYYY-MM-DD format"},
                "action": {"type": "string", "enum": ["BUY", "SELL"], "description": "Order action: 'BUY' or 'SELL'"},
                "contracts": {"type": "integer", "description": "Number of option contracts (1 contract = 100 shares)"},
                "premium": {"type": "number", "description": "Option premium per share"}
            },
            "required": ["symbol", "option_type", "strike", "expiry_date", "action", "contracts", "premium"]
        }
    }
]

def handle_mcp_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """Processes MCP JSON-RPC requests."""
    method = request.get("method")
    req_id = request.get("id")

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": TOOLS_SCHEMA}
        }

    if method == "tools/call":
        params = request.get("params", {})
        tool_name = params.get("name")
        args = params.get("arguments", {})
        sb = get_sandbox()

        try:
            if tool_name == "robinhood_get_portfolio":
                result = sb.get_portfolio()
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
                }

            elif tool_name == "robinhood_place_stock_order":
                res = sb.place_stock_order(
                    symbol=args["symbol"],
                    action=args["action"],
                    quantity=args["quantity"],
                    price=args["price"]
                )
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"content": [{"type": "text", "text": json.dumps(res, indent=2)}]}
                }

            elif tool_name == "robinhood_place_option_order":
                res = sb.place_option_order(
                    symbol=args["symbol"],
                    option_type=args["option_type"],
                    strike=args["strike"],
                    expiry_date=args["expiry_date"],
                    action=args["action"],
                    contracts=args["contracts"],
                    premium=args["premium"]
                )
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {"content": [{"type": "text", "text": json.dumps(res, indent=2)}]}
                }

            else:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Tool not found: {tool_name}"}
                }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32000, "message": str(e)}
            }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": -32601, "message": f"Method not supported: {method}"}
    }

def run_stdio_server():
    """Runs the MCP server over standard input/output."""
    logger.info("Starting Robinhood MCP Sandbox Server on stdio...")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            resp = handle_mcp_request(req)
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"Error handling MCP stdio line: {e}")

if __name__ == "__main__":
    run_stdio_server()
