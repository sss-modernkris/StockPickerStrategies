from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class StrategyResult(BaseModel):
    strategy_name: str
    match_percentage: int
    justifications: List[str]

class PricePoint(BaseModel):
    date: str
    close: float

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
