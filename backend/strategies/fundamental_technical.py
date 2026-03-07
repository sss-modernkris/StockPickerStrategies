from typing import Dict, Any
import numpy as np
import pandas as pd
from backend.models import StrategyResult

def calculate_rsi(data: pd.Series, window=14) -> float:
    delta = data.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return (100 - (100 / (1 + rs))).iloc[-1]

def evaluate_fund_tech(data: Dict[str, Any]) -> StrategyResult:
    """
    Fundamental/Technical Strategy:
    DCF Intrinsic Value > Current Price (using simplified Graham estimation)
    MACD > Signal
    RSI > 30 and < 70 (not overbought/oversold heavily)
    Price > 50 SMA
    """
    info = data.get("info", {})
    history = data.get("history")
    
    score = 0
    max_score = 4
    justifications = []
    
    # Fundamental: Intrinsic Value check
    current_price = info.get("currentPrice", 0)
    # Using Graham formula approximation: V = EPS * (8.5 + 2g) where g is growth rate * 100
    eps = info.get("trailingEps")
    growth = info.get("earningsGrowth")
    if current_price and eps and eps > 0 and growth is not None:
        g = growth * 100
        intrinsic_value = eps * (8.5 + 2 * min(g, 15)) # cap growth at 15% for safety
        if intrinsic_value > current_price:
            score += 1
            justifications.append(f"Undervalued: Intrinsic Value (${intrinsic_value:.2f}) > Price (${current_price:.2f}).")
        else:
            justifications.append(f"Overvalued: Intrinsic Value (${intrinsic_value:.2f}) <= Price (${current_price:.2f}).")
    else:
        justifications.append("Insufficient data to estimate Intrinsic Value.")
        
    if history is not None and len(history) >= 200:
        closes = history["Close"]
        
        # SMA
        sma50 = closes.rolling(window=50).mean().iloc[-1]
        if current_price > sma50:
            score += 1
            justifications.append(f"Bullish Trend: Price (${current_price:.2f}) > 50-day SMA (${sma50:.2f}).")
        else:
            justifications.append(f"Bearish Trend: Price (${current_price:.2f}) < 50-day SMA (${sma50:.2f}).")
            
        # RSI
        try:
            rsi = calculate_rsi(closes)
            if 30 < rsi < 70:
                score += 1
                justifications.append(f"Neutral/Healthy RSI: {rsi:.1f}.")
            else:
                justifications.append(f"Extreme RSI (Overbought/Oversold): {rsi:.1f}.")
        except Exception:
            justifications.append("Failed to calculate RSI.")

        # MACD
        exp1 = closes.ewm(span=12, adjust=False).mean()
        exp2 = closes.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        signal = macd.ewm(span=9, adjust=False).mean()
        macd_val = macd.iloc[-1]
        sig_val = signal.iloc[-1]
        if macd_val > sig_val:
            score += 1
            justifications.append(f"Bullish MACD Cross: MACD ({macd_val:.2f}) > Signal ({sig_val:.2f}).")
        else:
            justifications.append(f"Bearish MACD Cross: MACD ({macd_val:.2f}) < Signal ({sig_val:.2f}).")
            
    else:
        justifications.append("Insufficient historical data for technical analysis.")

    match_percentage = int((score / max_score) * 100)
    return StrategyResult(
        strategy_name="Fundamental/Technical",
        match_percentage=match_percentage,
        justifications=justifications
    )
