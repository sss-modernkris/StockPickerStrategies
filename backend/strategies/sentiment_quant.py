from typing import Dict, Any
import numpy as np
from backend.models import StrategyResult

def evaluate_sentiment(data: Dict[str, Any]) -> StrategyResult:
    """
    Sentiment/Quant Strategy:
    Since real-time put/call and VIX per stock might need paid APIs,
    we mock a dynamic sentiment model based on recent extreme volume patterns and recent returns.
    """
    history = data.get("history")
    
    score = 0
    max_score = 2
    justifications = []
    
    if history is not None and len(history) >= 20:
        # Mock Put/Call Ratio Proxy: using relative downside vs upside volatility
        returns = history["Close"].pct_change().dropna()
        down_vol = returns[returns < 0].std()
        up_vol = returns[returns > 0].std()
        
        if up_vol > down_vol:
            score += 1
            justifications.append("Options Sentiment Proxy: Implied bullish skew (Calls > Puts proxy).")
        else:
            justifications.append("Options Sentiment Proxy: Implied bearish skew (Puts > Calls proxy).")
            
        recent_vol = history["Volume"].iloc[-5:].mean()
        hist_vol = history["Volume"].iloc[-20:].mean()
        
        if recent_vol > hist_vol:
            score += 1
            justifications.append("Institutional Sentiment: Increasing volume trend points to accumulation/distribution intensity.")
        else:
            justifications.append("Institutional Sentiment: Decreasing volume trend points to waning interest.")
    else:
        justifications.append("Insufficient data for sentiment proxy analysis.")

    match_percentage = int((score / max_score) * 100)
    return StrategyResult(
        strategy_name="Sentiment/Quant",
        match_percentage=match_percentage,
        justifications=justifications
    )
