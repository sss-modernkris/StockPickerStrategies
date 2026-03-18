from typing import Dict, Any
import numpy as np
from models import StrategyResult

def evaluate_low_vol(data: Dict[str, Any]) -> StrategyResult:
    """
    Low-Vol/Quality Strategy:
    Low Standard deviation of returns.
    Low Debt-to-Equity (< 2.0).
    High ROE (> 15%).
    """
    info = data.get("info", {})
    history = data.get("history")
    
    score = 0
    max_score = 3
    justifications = []
    
    # Volatility
    if history is not None and len(history) >= 20:
        returns = history["Close"].pct_change().dropna()
        annual_vol = returns.std() * np.sqrt(252)
        if annual_vol < 0.25: # Arbitrary < 25% threshold for "low vol" proxy
            score += 1
            justifications.append(f"Low annualized volatility: {annual_vol*100:.1f}%.")
        else:
            justifications.append(f"High annualized volatility: {annual_vol*100:.1f}%.")
    else:
        justifications.append("Insufficient data for volatility.")
        
    # Debt/Equity
    de = info.get("debtToEquity")
    if de is not None:
        if de < 200: # yfinance D/E is often multiplied by 100, e.g. 150 = 1.5 D/E
            score += 1
            justifications.append(f"Healthy Debt-to-Equity ratio: {de/100:.2f}.")
        else:
            justifications.append(f"Elevated Debt-to-Equity ratio: {de/100:.2f}.")
    else:
        justifications.append("Debt-to-Equity data missing.")
        
    # ROE
    roe = info.get("returnOnEquity")
    if roe is not None:
        if roe > 0.15:
            score += 1
            justifications.append(f"Strong Return on Equity (ROE): {roe*100:.1f}% (> 15%).")
        else:
            justifications.append(f"Low Return on Equity (ROE): {roe*100:.1f}%.")
    else:
        justifications.append("Return on Equity data missing.")

    match_percentage = int((score / max_score) * 100)
    
    return StrategyResult(
        strategy_name="Low-Vol/Quality",
        match_percentage=match_percentage,
        justifications=justifications
    )
