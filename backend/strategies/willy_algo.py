from typing import Dict, Any, Tuple
import pandas as pd
import numpy as np
from models import StrategyResult

def calculate_willy_vwap(df: pd.DataFrame, window: int = 5) -> pd.Series:
    """
    Calculates Dynamic Swing VWAP (WillyAlgo Indicator).
    Anchors VWAP to swing pivots found via a rolling window.
    """
    if df is None or df.empty or len(df) < window * 2:
        return pd.Series(index=df.index, dtype=float)

    # 1. Identify Pivots (Swing Highs and Lows)
    # A pivot high is a point higher than 'window' points before and after it.
    df = df.copy()
    df['pivot_h'] = df['High'].rolling(window=window*2+1, center=True).apply(lambda x: x[window] == max(x), raw=True)
    df['pivot_l'] = df['Low'].rolling(window=window*2+1, center=True).apply(lambda x: x[window] == min(x), raw=True)
    
    # 2. Iterate and Reset VWAP at each pivot
    willy_vwap = np.full(len(df), np.nan)
    
    current_cum_pv = 0.0
    current_cum_vol = 0.0
    
    for i in range(len(df)):
        # Reset if we hit a pivot high or pivot low
        if df['pivot_h'].iloc[i] == 1.0 or df['pivot_l'].iloc[i] == 1.0:
            current_cum_pv = 0.0
            current_cum_vol = 0.0
            
        typical_price = (df['High'].iloc[i] + df['Low'].iloc[i] + df['Close'].iloc[i]) / 3.0
        vol = df['Volume'].iloc[i]
        
        current_cum_pv += typical_price * vol
        current_cum_vol += vol
        
        if current_cum_vol > 0:
            willy_vwap[i] = current_cum_pv / current_cum_vol
            
    return pd.Series(willy_vwap, index=df.index)

def evaluate_willy_algo(data: Dict[str, Any]) -> StrategyResult:
    """
    Evaluates the result of the WillyAlgo Indicator.
    Score: 100% if Price > Willy VWAP, 0% otherwise.
    """
    history = data.get("history")
    info = data.get("info", {})
    current_price = info.get("currentPrice")
    
    if history is None or history.empty:
        return StrategyResult(
            strategy_name="WillyAlgo Indicator",
            match_percentage=0,
            justifications=["Insufficient historical data."]
        )
    
    # Calculate indicators
    vwap_series = calculate_willy_vwap(history)
    latest_vwap = vwap_series.iloc[-1]
    
    if current_price is None:
        current_price = history["Close"].iloc[-1]
        
    score = 0
    justifications = []
    
    if pd.isna(latest_vwap):
        justifications.append("Could not calculate Swing VWAP (insufficient pivots).")
    elif current_price > latest_vwap:
        score = 100
        justifications.append(f"Bullish: Price (${current_price:.2f}) is above Dynamic Swing VWAP (${latest_vwap:.2f}).")
    else:
        score = 0
        justifications.append(f"Bearish: Price (${current_price:.2f}) is below Dynamic Swing VWAP (${latest_vwap:.2f}).")
        
    return StrategyResult(
        strategy_name="WillyAlgo Indicator",
        match_percentage=score,
        justifications=justifications
    )
