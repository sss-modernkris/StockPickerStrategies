from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class StrategyResult(BaseModel):
    strategy_name: str
    match_percentage: int
    justifications: List[str]

class PricePoint(BaseModel):
    date: str
    close: float

class TickerAnalysis(BaseModel):
    symbol: str
    strategies: List[StrategyResult]
    alpha_probability: Optional[float] = None
    top_factor: Optional[str] = None
    price_history: Optional[List[PricePoint]] = None
    raw_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
