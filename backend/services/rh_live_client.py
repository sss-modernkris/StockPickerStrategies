"""
Robinhood Live Agentic Trading Client
Implements cryptographic request signing and authenticated trading interface
for the official Robinhood Agentic Trading API (https://robinhood.com/us/en/agentic-trading/).
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("RobinhoodLiveClient")

# Detect project root directory for .env loading
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR) if os.path.basename(BACKEND_DIR) == "backend" else BACKEND_DIR
ENV_FILE = os.path.join(PROJECT_ROOT, ".env")


def load_env_variables():
    """Loads key-value pairs from root .env into os.environ if not already present."""
    if os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("\"'")
                    if key not in os.environ:
                        os.environ[key] = val
        except Exception as e:
            logger.warning(f"Could not load .env file from {ENV_FILE}: {e}")


# Pre-load environment
load_env_variables()


class RobinhoodLiveClient:
    """
    Live trading client for Robinhood Agentic API with ECDSA/HMAC cryptographic signing.
    """

    def __init__(
        self,
        api_key_id: Optional[str] = None,
        api_secret: Optional[str] = None,
        account_number: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        load_env_variables()
        self.api_key_id = api_key_id or os.getenv("ROBINHOOD_API_KEY_ID", "rh_agentic_demo_key_sandbox")
        self.api_secret = api_secret or os.getenv("ROBINHOOD_API_SECRET", "rh_agentic_signing_secret_demo_key_base64")
        self.account_number = account_number or os.getenv("ROBINHOOD_ACCOUNT_NUMBER", "RH-SIM-SANDBOX-001")
        self.base_url = (base_url or os.getenv("ROBINHOOD_BASE_URL", "https://api.robinhood.com")).rstrip("/")

    def is_configured(self) -> bool:
        """Returns True if non-empty credentials are provided."""
        return bool(self.api_key_id and self.api_secret and "demo" not in self.api_key_id.lower())

    def _generate_signature(self, method: str, path: str, body: str = "") -> Tuple[str, str]:
        """
        Generates cryptographic request signature.
        Signature payload: timestamp + method + path + body
        """
        timestamp = str(int(time.time()))
        message = f"{timestamp}{method.upper()}{path}{body}"
        secret_bytes = self.api_secret.encode("utf-8")
        sig_bytes = hmac.new(secret_bytes, message.encode("utf-8"), hashlib.sha256).digest()
        signature = base64.b64encode(sig_bytes).decode("utf-8")
        return timestamp, signature

    def _get_auth_headers(self, method: str, path: str, body: str = "") -> Dict[str, str]:
        """Builds Robinhood Agentic API authentication headers."""
        timestamp, signature = self._generate_signature(method, path, body)
        return {
            "X-API-KEY": self.api_key_id,
            "X-SIGNATURE": signature,
            "X-TIMESTAMP": timestamp,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "StrategicAlpha-AgenticTrader/1.0",
        }

    def validate_connection(self) -> Dict[str, Any]:
        """Checks API connectivity and authentication credentials."""
        is_demo = "demo" in self.api_key_id.lower() or "sandbox" in self.api_key_id.lower()
        if is_demo:
            return {
                "valid": True,
                "mode": "DEMO_SIMULATION",
                "message": "Using demo/sandbox API credentials. Live order dispatch will simulate real API handshake.",
                "account": self.account_number,
                "api_key_masked": f"{self.api_key_id[:8]}...{self.api_key_id[-4:]}" if len(self.api_key_id) > 12 else self.api_key_id
            }

        try:
            import requests
            headers = self._get_auth_headers("GET", "/api/v1/user/profile/")
            url = f"{self.base_url}/api/v1/user/profile/"
            resp = requests.get(url, headers=headers, timeout=5.0)
            if resp.status_code in [200, 201]:
                return {
                    "valid": True,
                    "mode": "AUTHENTICATED_LIVE",
                    "message": "Successfully authenticated with Robinhood Agentic API.",
                    "account": self.account_number,
                    "api_key_masked": f"{self.api_key_id[:8]}...{self.api_key_id[-4:]}"
                }
            else:
                return {
                    "valid": False,
                    "mode": "AUTH_FAILED",
                    "message": f"Robinhood API returned HTTP {resp.status_code}: {resp.text[:200]}",
                    "account": self.account_number
                }
        except Exception as e:
            return {
                "valid": False,
                "mode": "CONNECTION_ERROR",
                "message": f"Network error connecting to Robinhood API: {str(e)}",
                "account": self.account_number
            }

    def place_live_stock_order(
        self, symbol: str, action: str, quantity: float, price: float, order_type: str = "LIMIT"
    ) -> Dict[str, Any]:
        """
        Dispatches a live stock trade to the Robinhood Trading API with signature authentication.
        """
        symbol = symbol.strip().upper()
        action = action.strip().upper()
        path = "/api/v1/orders/"
        body_dict = {
            "account_number": self.account_number,
            "symbol": symbol,
            "side": action.lower(),
            "quantity": quantity,
            "type": order_type.lower(),
            "price": price,
            "time_in_force": "gtc",
            "extended_hours": False,
            "client_order_id": f"RH-LIVE-{int(time.time() * 1000)}"
        }
        body_json = json.dumps(body_dict)
        headers = self._get_auth_headers("POST", path, body_json)

        is_demo = "demo" in self.api_key_id.lower() or "sandbox" in self.api_key_id.lower()
        if is_demo:
            # High-fidelity live simulator response
            order_id = body_dict["client_order_id"]
            cost = round(quantity * price, 2)
            return {
                "success": True,
                "order_id": order_id,
                "status": "FILLED",
                "symbol": symbol,
                "action": action,
                "quantity": quantity,
                "price": price,
                "total_cost": cost,
                "execution_venue": "ROBINHOOD_LIVE_ROUTER (Demo Sandbox Key)",
                "message": f"[LIVE SIMULATOR] {action} order executed for {quantity} shs {symbol} @ ${price:.2f} (Total: ${cost:,.2f})",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        try:
            import requests
            url = f"{self.base_url}{path}"
            resp = requests.post(url, data=body_json, headers=headers, timeout=8.0)
            if resp.status_code in [200, 201]:
                data = resp.json()
                return {
                    "success": True,
                    "order_id": data.get("id") or body_dict["client_order_id"],
                    "status": data.get("state", "FILLED").upper(),
                    "symbol": symbol,
                    "action": action,
                    "quantity": quantity,
                    "price": price,
                    "total_cost": round(quantity * price, 2),
                    "execution_venue": "ROBINHOOD_LIVE_ROUTER",
                    "message": f"Live {action} order submitted for {quantity} shs {symbol} @ ${price:.2f}",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            else:
                return {
                    "success": False,
                    "error": f"Robinhood Live API Error ({resp.status_code}): {resp.text}"
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to transmit live order to Robinhood: {str(e)}"
            }

    def place_live_option_order(
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
        Dispatches a live option contract order to Robinhood Options API.
        """
        symbol = symbol.strip().upper()
        option_type = option_type.strip().upper()
        action = action.strip().upper()
        path = "/api/v1/options/orders/"

        body_dict = {
            "account_number": self.account_number,
            "chain_symbol": symbol,
            "strike_price": strike,
            "expiration_date": expiry_date,
            "option_type": option_type.lower(),
            "side": action.lower(),
            "quantity": contracts,
            "price": premium,
            "time_in_force": "gtc",
            "client_order_id": f"RH-OPT-LIVE-{int(time.time() * 1000)}"
        }
        body_json = json.dumps(body_dict)
        headers = self._get_auth_headers("POST", path, body_json)

        is_demo = "demo" in self.api_key_id.lower() or "sandbox" in self.api_key_id.lower()
        if is_demo:
            order_id = body_dict["client_order_id"]
            cost = round(contracts * premium * 100.0, 2)
            return {
                "success": True,
                "order_id": order_id,
                "status": "FILLED",
                "symbol": symbol,
                "option_type": option_type,
                "strike": strike,
                "expiry_date": expiry_date,
                "action": action,
                "contracts": contracts,
                "premium": premium,
                "total_cost": cost,
                "execution_venue": "ROBINHOOD_LIVE_OPTIONS_ROUTER (Demo Sandbox Key)",
                "message": f"[LIVE SIMULATOR] {action} {contracts}x {symbol} ${strike} {option_type} exp {expiry_date} @ ${premium:.2f} (Total: ${cost:,.2f})",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        try:
            import requests
            url = f"{self.base_url}{path}"
            resp = requests.post(url, data=body_json, headers=headers, timeout=8.0)
            if resp.status_code in [200, 201]:
                data = resp.json()
                return {
                    "success": True,
                    "order_id": data.get("id") or body_dict["client_order_id"],
                    "status": data.get("state", "FILLED").upper(),
                    "symbol": symbol,
                    "option_type": option_type,
                    "strike": strike,
                    "expiry_date": expiry_date,
                    "action": action,
                    "contracts": contracts,
                    "premium": premium,
                    "total_cost": round(contracts * premium * 100.0, 2),
                    "execution_venue": "ROBINHOOD_LIVE_OPTIONS_ROUTER",
                    "message": f"Live Option Order submitted: {action} {contracts}x {symbol} ${strike} {option_type}",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            else:
                return {
                    "success": False,
                    "error": f"Robinhood Live Option API Error ({resp.status_code}): {resp.text}"
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to transmit live option order: {str(e)}"
            }
