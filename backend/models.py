from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class StrategyResult(BaseModel):
    strategy_name: str
    match_percentage: int
    justifications: List[str]

class PricePoint(BaseModel):
    date: str
    close: float
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    sma_9: Optional[float] = None
    sma_12: Optional[float] = None
    sma_26: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    rsi_14: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_lower: Optional[float] = None
    bb_middle: Optional[float] = None
class TickerHistory(BaseModel):
    symbol: str
    history: List[PricePoint]
class HistoryResponse(BaseModel):
    period: str
    data: List[TickerHistory]
    error: Optional[str] = None


class TechnicalIndicators(BaseModel):
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    ema_20: Optional[float] = None
    rsi_14: Optional[float] = None
    macd_line: Optional[float] = None
    macd_signal: Optional[float] = None
    bollinger_upper: Optional[float] = None
    bollinger_middle: Optional[float] = None
    bollinger_lower: Optional[float] = None
    volume: Optional[int] = None
    volume_avg_20: Optional[float] = None

class TickerAnalysis(BaseModel):
    symbol: str
    strategies: List[StrategyResult]
    alpha_probability: Optional[float] = None
    top_factor: Optional[str] = None
    price_history: Optional[List[PricePoint]] = None
    technical_indicators: Optional[TechnicalIndicators] = None
    raw_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class TransactionModel(BaseModel):
    ticker: str
    quantity: float
    price: float
    total_cost: float
    transaction_type: str

class TransactionResponse(BaseModel):
    date: str
    ticker: str
    quantity: float
    price: float
    total_cost: float
    current_close_price: Optional[float] = None
    total_current_value: Optional[float] = None
    cash_balance: Optional[float] = None
    action: Optional[str] = None

class HoldingModel(BaseModel):
    ticker: str
    total_quantity: float
    avg_buy_price: float
    current_price: float
    total_value: float
    unrealized_pnl: float

class PortfolioSummaryResponse(BaseModel):
    current_cash: float
    invested_capital: float
    total_equity: float
    total_profit: float
    holdings: List[HoldingModel]
    transactions: List[TransactionResponse]
