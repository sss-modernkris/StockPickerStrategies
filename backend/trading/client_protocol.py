"""
TradingClient Protocol.

Defines the exact interface required by the BrokerAgent and execution pipeline:
- environment: str
- get_portfolio() -> Dict[str, Any]
- place_stock_order(symbol, action, quantity, price) -> Dict[str, Any]
- place_option_order(symbol, option_type, strike, expiry_date, action, contracts, premium) -> Dict[str, Any]
"""

from typing import Any, Dict, Protocol, runtime_checkable


@runtime_checkable
class TradingClient(Protocol):
    environment: str

    def get_portfolio(self) -> Dict[str, Any]:
        """
        Retrieves the current portfolio state.
        Must return a dict containing at minimum:
        - cash_available: float
        - total_equity: float
        - holdings: List[Dict[str, Any]] with keys: symbol, quantity, current_price, avg_price, market_value, unrealized_pnl
        - option_positions: List[Dict[str, Any]]
        - guardrails: Dict[str, Any] with keys: daily_spend_limit, today_spend_total, remaining_daily_budget, position_cap_pct
        """
        ...

    def place_stock_order(
        self,
        symbol: str,
        action: str,
        quantity: float,
        price: float
    ) -> Dict[str, Any]:
        """
        Places an equity order.
        Returns a dict containing:
        - success: bool
        - message: Optional[str]
        - error: Optional[str]
        - order: Optional[Dict[str, Any]]
        """
        ...

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
        Places an option contract order.
        Returns a dict containing:
        - success: bool
        - message: Optional[str]
        - error: Optional[str]
        - order: Optional[Dict[str, Any]]
        """
        ...
