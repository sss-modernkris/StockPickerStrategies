"""
Robinhood Model Context Protocol (MCP) Server & Agentic Execution Engine
Supports dual-mode execution (SANDBOX & LIVE) with institutional Risk Firewall guardrails
(Daily Spend Limit, Position Equity Cap, and Emergency Kill Switch).
"""

import json
import logging
import math
import os
import sys
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("RobinhoodMCPServer")

# Ensure base paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.rh_live_client import RobinhoodLiveClient, load_env_variables

PROJECT_ROOT = os.path.dirname(BACKEND_DIR) if os.path.basename(BACKEND_DIR) == "backend" else BACKEND_DIR
STATE_FILE = os.path.join(PROJECT_ROOT, "rh_sandbox_state.json")

SANDBOX_ACCOUNT_ID = "RH-SIM-SANDBOX-001"
DEFAULT_STARTING_CASH = 25000.0


class RobinhoodAgenticTradingEngine:
    """
    Unified execution engine and MCP state manager supporting both Sandbox simulation
    and live Robinhood Brokerage trading with automated risk firewall guardrails.
    """

    def __init__(self):
        load_env_variables()
        self.account_id = os.getenv("ROBINHOOD_ACCOUNT_NUMBER", SANDBOX_ACCOUNT_ID)
        self.environment = os.getenv("ROBINHOOD_ENVIRONMENT", "SANDBOX").upper()  # 'SANDBOX' or 'LIVE'
        self.is_simulated = (self.environment == "SANDBOX")
        
        # Risk Firewall Guardrail Defaults (configurable via UI and .env)
        self.daily_spend_limit = float(os.getenv("ROBINHOOD_DAILY_SPEND_LIMIT", "5000.0"))
        self.position_cap_pct = float(os.getenv("ROBINHOOD_POSITION_CAP_PCT", "15.0"))
        self.emergency_kill_switch = os.getenv("ROBINHOOD_EMERGENCY_KILL_SWITCH", "false").lower() in ["true", "1", "yes"]
        self.require_hitl = os.getenv("ROBINHOOD_REQUIRE_HITL_CONFIRMATION", "true").lower() in ["true", "1", "yes"]
        self.paused = self.emergency_kill_switch
        self.budget_limit = self.daily_spend_limit

        # Daily Spend Tracker
        self.today_spend_total = 0.0
        self.last_spend_date = str(date.today())

        # Portfolio State
        self.cash = DEFAULT_STARTING_CASH
        self.holdings: Dict[str, Dict[str, Any]] = {}
        self.option_positions: Dict[str, Dict[str, Any]] = {}
        self.orders: List[Dict[str, Any]] = []

        # Live Client Instance
        self.live_client = RobinhoodLiveClient()

        # Load persisted state
        self.load_state()

    def _refresh_daily_spend_tracker(self):
        """Resets today's spend accumulator if calendar date has rolled over."""
        current_date = str(date.today())
        if self.last_spend_date != current_date:
            self.today_spend_total = 0.0
            self.last_spend_date = current_date
            self.save_state()

    def save_state(self):
        """Persists state to local JSON file."""
        try:
            state = {
                "account_id": self.account_id,
                "environment": self.environment,
                "cash": self.cash,
                "holdings": self.holdings,
                "option_positions": self.option_positions,
                "orders": self.orders,
                "daily_spend_limit": self.daily_spend_limit,
                "position_cap_pct": self.position_cap_pct,
                "emergency_kill_switch": self.emergency_kill_switch,
                "require_hitl": self.require_hitl,
                "paused": self.paused,
                "budget_limit": self.budget_limit,
                "today_spend_total": self.today_spend_total,
                "last_spend_date": self.last_spend_date,
                "last_saved": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
            logger.debug(f"Saved state to {STATE_FILE}")
        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    def load_state(self):
        """Loads state from local JSON file if exists."""
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    state = json.load(f)
                self.cash = float(state.get("cash", DEFAULT_STARTING_CASH))
                self.holdings = state.get("holdings", {})
                self.option_positions = state.get("option_positions", {})
                self.orders = state.get("orders", [])
                
                # Load guardrails (respecting user saves while supporting env fallbacks)
                if "environment" in state:
                    self.environment = state["environment"]
                    self.is_simulated = (self.environment == "SANDBOX")
                if "daily_spend_limit" in state:
                    self.daily_spend_limit = float(state["daily_spend_limit"])
                if "position_cap_pct" in state:
                    self.position_cap_pct = float(state["position_cap_pct"])
                if "emergency_kill_switch" in state:
                    self.emergency_kill_switch = bool(state["emergency_kill_switch"])
                    self.paused = self.emergency_kill_switch
                if "require_hitl" in state:
                    self.require_hitl = bool(state["require_hitl"])
                if "today_spend_total" in state:
                    self.today_spend_total = float(state["today_spend_total"])
                if "last_spend_date" in state:
                    self.last_spend_date = str(state["last_spend_date"])

                self.budget_limit = self.daily_spend_limit
                self._refresh_daily_spend_tracker()
                logger.info(f"Loaded Robinhood Agentic Trading State ({self.environment} mode, {len(self.holdings)} holdings, {len(self.orders)} orders)")
            except Exception as e:
                logger.error(f"Failed to load state from {STATE_FILE}: {e}")

    def reset_sandbox(self):
        """Resets the sandbox back to clean starting state ($25,000 cash, no holdings, no orders)."""
        self.cash = DEFAULT_STARTING_CASH
        self.holdings = {}
        self.option_positions = {}
        self.orders = []
        self.today_spend_total = 0.0
        self.last_spend_date = str(date.today())
        self.save_state()
        logger.info("Robinhood sandbox state reset to initial default ($25,000 cash).")
        return {
            "status": "success",
            "message": "Sandbox reset successfully to $25,000 cash with empty holdings and order ledger."
        }

    def update_guardrails(
        self,
        environment: Optional[str] = None,
        daily_spend_limit: Optional[float] = None,
        position_cap_pct: Optional[float] = None,
        emergency_kill_switch: Optional[bool] = None,
        require_hitl: Optional[bool] = None,
        paused: Optional[bool] = None,
        budget_limit: Optional[float] = None
    ) -> Dict[str, Any]:
        """Updates trading guardrails and environment dynamically from UI."""
        if environment is not None:
            self.environment = environment.upper()
            self.is_simulated = (self.environment == "SANDBOX")
        if daily_spend_limit is not None:
            self.daily_spend_limit = float(daily_spend_limit)
            self.budget_limit = self.daily_spend_limit
        if budget_limit is not None:
            self.daily_spend_limit = float(budget_limit)
            self.budget_limit = self.daily_spend_limit
        if position_cap_pct is not None:
            self.position_cap_pct = float(position_cap_pct)
        if emergency_kill_switch is not None:
            self.emergency_kill_switch = bool(emergency_kill_switch)
            self.paused = self.emergency_kill_switch
        if paused is not None:
            self.paused = bool(paused)
            self.emergency_kill_switch = self.paused
        if require_hitl is not None:
            self.require_hitl = bool(require_hitl)

        self.save_state()
        logger.info(f"Updated Guardrails: env={self.environment}, kill_switch={self.emergency_kill_switch}, daily_limit=${self.daily_spend_limit:,.2f}, cap={self.position_cap_pct}%")
        return {
            "status": "success",
            "message": "Guardrails updated successfully",
            "guardrails": self.get_guardrails_summary()
        }

    def get_guardrails_summary(self) -> Dict[str, Any]:
        """Returns active guardrails and daily spend telemetry."""
        self._refresh_daily_spend_tracker()
        remaining_daily_budget = max(0.0, round(self.daily_spend_limit - self.today_spend_total, 2))
        return {
            "environment": self.environment,
            "is_simulated": self.is_simulated,
            "daily_spend_limit": self.daily_spend_limit,
            "today_spend_total": round(self.today_spend_total, 2),
            "remaining_daily_budget": remaining_daily_budget,
            "position_cap_pct": self.position_cap_pct,
            "emergency_kill_switch": self.emergency_kill_switch,
            "require_hitl": self.require_hitl,
            "paused": self.paused,
            "account_id": self.account_id,
            "api_key_configured": self.live_client.is_configured(),
            "api_key_status": self.live_client.validate_connection()
        }

    def validate_order_guardrails(self, action: str, cost: float, symbol: str) -> Tuple[bool, Optional[str]]:
        """
        Enforces safety firewall guardrails before any order (BUY) is executed:
        1. Emergency Kill Switch / Paused check
        2. Daily Spend Limit check
        3. Single-position Equity Cap check
        """
        self._refresh_daily_spend_tracker()

        # Guardrail 1: Emergency Kill Switch
        if self.emergency_kill_switch or self.paused:
            return False, "EMERGENCY KILL SWITCH ACTIVE: Trading execution is halted by user safeguard."

        # Sells only generate cash, so spend limits apply strictly to BUY orders
        if action.upper() == "BUY":
            # Guardrail 2: Daily Spend Limit
            if self.today_spend_total + cost > self.daily_spend_limit:
                rem = max(0.0, self.daily_spend_limit - self.today_spend_total)
                return False, (
                    f"GUARDRAIL TRIGGERED: Order cost (${cost:,.2f}) exceeds remaining Daily Spend Limit "
                    f"(${rem:,.2f} available out of ${self.daily_spend_limit:,.2f} daily cap)."
                )

            # Guardrail 3: Single Position Equity Cap
            portfolio = self.get_portfolio()
            total_equity = portfolio.get("total_equity", DEFAULT_STARTING_CASH)
            max_allowed_position = total_equity * (self.position_cap_pct / 100.0)
            
            existing_pos_value = 0.0
            if symbol in self.holdings:
                existing_pos_value = float(self.holdings[symbol].get("market_value", 0.0))
            
            if (existing_pos_value + cost) > max_allowed_position:
                return False, (
                    f"GUARDRAIL TRIGGERED: Total allocation for {symbol} (${existing_pos_value + cost:,.2f}) "
                    f"exceeds maximum {self.position_cap_pct}% single-position cap (${max_allowed_position:,.2f} max allowed on ${total_equity:,.2f} equity)."
                )

        return True, None

    def get_portfolio(self) -> Dict[str, Any]:
        """Calculates total equity, cash, unrealized/realized P&L, active positions, and guardrails."""
        self._refresh_daily_spend_tracker()
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
                "strike": float(pos["strike"]),
                "expiry_date": pos["expiry_date"],
                "contracts": contracts,
                "entry_premium": entry_prem,
                "current_premium": cur_prem,
                "market_value": market_val,
                "cost_basis": cost_basis,
                "unrealized_pnl": unrealized,
                "unrealized_pnl_pct": round((unrealized / cost_basis * 100.0), 2) if cost_basis > 0 else 0.0
            })

        invested_cap = round(stock_equity + option_equity, 2)
        total_equity = round(self.cash + invested_cap, 2)

        return {
            "account_id": self.account_id,
            "environment": self.environment,
            "is_simulated": self.is_simulated,
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
            "guardrails": self.get_guardrails_summary(),
            "paused": self.paused,
            "emergency_kill_switch": self.emergency_kill_switch,
            "budget_limit": self.daily_spend_limit,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def place_stock_order(self, symbol: str, action: str, quantity: float, price: float, order_type: str = "LIMIT") -> Dict[str, Any]:
        """
        Executes a stock order in either SANDBOX or LIVE mode with pre-flight risk checks.
        """
        symbol = symbol.strip().upper()
        action = action.strip().upper()
        quantity = float(quantity)
        price = float(price)

        if quantity <= 0 or price <= 0:
            return {"success": False, "error": f"Invalid order quantity ({quantity}) or price ({price})"}

        cost = round(quantity * price, 2)

        # 1. Enforce Guardrails Firewall
        passed, error_msg = self.validate_order_guardrails(action=action, cost=cost, symbol=symbol)
        if not passed:
            logger.warning(f"Order rejected by Guardrail: {error_msg}")
            return {"success": False, "error": error_msg}

        # 2. Handle Live Trading Dispatch
        if self.environment == "LIVE":
            live_res = self.live_client.place_live_stock_order(
                symbol=symbol, action=action, quantity=quantity, price=price, order_type=order_type
            )
            if not live_res.get("success"):
                return live_res

            # Track spend on successful live BUY
            if action == "BUY":
                self.today_spend_total = round(self.today_spend_total + cost, 2)

            order_record = {
                "order_id": live_res.get("order_id", f"RH-LIVE-{len(self.orders)+1}"),
                "account": self.account_id,
                "environment": "LIVE",
                "symbol": symbol,
                "asset_type": "stock",
                "action": action,
                "quantity": quantity,
                "filled_quantity": quantity,
                "price": price,
                "avg_fill_price": price,
                "status": live_res.get("status", "FILLED"),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            self.orders.insert(0, order_record)
            self.save_state()
            return live_res

        # 3. Handle Sandbox Execution
        if action == "BUY":
            if cost > self.cash:
                return {
                    "success": False,
                    "error": f"Insufficient sandbox buying power: required ${cost:,.2f}, available cash is ${self.cash:,.2f}"
                }
            self.cash = round(self.cash - cost, 2)
            self.today_spend_total = round(self.today_spend_total + cost, 2)

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
            self.cash = round(self.cash + cost, 2)
            self.holdings[symbol]["quantity"] -= quantity
            if self.holdings[symbol]["quantity"] <= 0:
                del self.holdings[symbol]
        else:
            return {"success": False, "error": f"Unknown action: {action}"}

        order_id = f"RH-SIM-{9000 + len(self.orders) + 1}"
        order_record = {
            "order_id": order_id,
            "account": self.account_id,
            "environment": "SANDBOX",
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
        self.save_state()

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
        """
        Executes an option contract order in either SANDBOX or LIVE mode with pre-flight risk checks.
        """
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

        # 1. Enforce Guardrails Firewall
        passed, error_msg = self.validate_order_guardrails(action=action, cost=cost_of_position, symbol=symbol)
        if not passed:
            logger.warning(f"Option order rejected by Guardrail: {error_msg}")
            return {"success": False, "error": error_msg}

        # 2. Handle Live Trading Dispatch
        if self.environment == "LIVE":
            live_res = self.live_client.place_live_option_order(
                symbol=symbol,
                option_type=option_type,
                strike=strike,
                expiry_date=expiry_date,
                action=action,
                contracts=contracts,
                premium=premium
            )
            if not live_res.get("success"):
                return live_res

            if action == "BUY":
                self.today_spend_total = round(self.today_spend_total + cost_of_position, 2)

            order_record = {
                "order_id": live_res.get("order_id", f"RH-OPT-LIVE-{len(self.orders)+1}"),
                "account": self.account_id,
                "environment": "LIVE",
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
                "status": live_res.get("status", "FILLED"),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            self.orders.insert(0, order_record)
            self.save_state()
            return live_res

        # 3. Handle Sandbox Execution
        if action == "BUY":
            if cost_of_position > self.cash:
                return {
                    "success": False,
                    "error": f"Insufficient buying power for option: requires ${cost_of_position:,.2f}, available is ${self.cash:,.2f}"
                }
            self.cash = round(self.cash - cost_of_position, 2)
            self.today_spend_total = round(self.today_spend_total + cost_of_position, 2)

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

        order_id = f"RH-OPT-SIM-{9000 + len(self.orders) + 1}"
        order_record = {
            "order_id": order_id,
            "account": self.account_id,
            "environment": "SANDBOX",
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
        self.save_state()

        return {
            "success": True,
            "order": order_record,
            "message": f"Simulated {action} {contracts}x {symbol} ${strike} {option_type} exp {expiry_date} @ ${premium:.2f} (Total: ${cost_of_position:,.2f})"
        }


# Global singleton instance
_engine = RobinhoodAgenticTradingEngine()

def get_sandbox() -> RobinhoodAgenticTradingEngine:
    return _engine


# MCP Protocol Implementation (JSON-RPC 2.0 via Stdio)
TOOLS_SCHEMA = [
    {
        "name": "robinhood_get_portfolio",
        "description": "Retrieves the current Robinhood portfolio summary including cash balance, buying power, stock holdings, option positions, guardrails, and active orders.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "robinhood_place_stock_order",
        "description": "Places a stock BUY or SELL order with automated Risk Firewall guardrails.",
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
        "description": "Places an option contract BUY or SELL order (Calls or Puts) with automated Risk Firewall guardrails.",
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
    logger.info("Starting Robinhood Agentic Trading MCP Server on stdio...")
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
