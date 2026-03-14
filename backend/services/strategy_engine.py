from typing import Dict, Any
import pandas as pd
from backend.models import TickerAnalysis, StrategyResult, TechnicalIndicators
from backend.services.finance_client import fetch_ticker_data

from backend.strategies.can_slim import evaluate_can_slim
from backend.strategies.fcf_yield import evaluate_fcf_yield
from backend.strategies.garp import evaluate_garp
from backend.strategies.low_vol_quality import evaluate_low_vol
from backend.strategies.pure_growth import evaluate_pure_growth
from backend.strategies.fundamental_technical import evaluate_fund_tech
from backend.strategies.sentiment_quant import evaluate_sentiment
from backend.strategies.earnings_momentum import evaluate_earnings_mom
from backend.strategies.dividend_aristocrat import evaluate_dividend
from backend.strategies.machine_learning import evaluate_ml_engine

def calculate_technical_indicators(data: Dict[str, Any]) -> TechnicalIndicators:
    history = data.get("history")
    
    if history is None or history.empty or len(history) < 200:
        return None

    try:
        closes = history["Close"]
        
        # SMA 50 & 200
        sma_50 = closes.rolling(window=50).mean().iloc[-1]
        sma_200 = closes.rolling(window=200).mean().iloc[-1]
        
        # EMA 20
        ema_20 = closes.ewm(span=20, adjust=False).mean().iloc[-1]
        
        # RSI 14
        delta = closes.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi_14 = (100 - (100 / (1 + rs))).iloc[-1]
        
        # MACD
        exp1 = closes.ewm(span=12, adjust=False).mean()
        exp2 = closes.ewm(span=26, adjust=False).mean()
        macd_series = exp1 - exp2
        signal_series = macd_series.ewm(span=9, adjust=False).mean()
        macd_line = macd_series.iloc[-1]
        macd_signal = signal_series.iloc[-1]
        
        # Bollinger Bands (20-day SMA +/- 2 std dev)
        sma_20 = closes.rolling(window=20).mean()
        std_20 = closes.rolling(window=20).std()
        boll_upper = (sma_20 + (std_20 * 2)).iloc[-1]
        boll_middle = sma_20.iloc[-1]
        boll_lower = (sma_20 - (std_20 * 2)).iloc[-1]
        
        # Volume
        volume_series = history["Volume"]
        volume = int(volume_series.iloc[-1])
        volume_avg_20 = float(volume_series.rolling(window=20).mean().iloc[-1])
        
        return TechnicalIndicators(
            sma_50=float(sma_50) if pd.notna(sma_50) else None,
            sma_200=float(sma_200) if pd.notna(sma_200) else None,
            ema_20=float(ema_20) if pd.notna(ema_20) else None,
            rsi_14=float(rsi_14) if pd.notna(rsi_14) else None,
            macd_line=float(macd_line) if pd.notna(macd_line) else None,
            macd_signal=float(macd_signal) if pd.notna(macd_signal) else None,
            bollinger_upper=float(boll_upper) if pd.notna(boll_upper) else None,
            bollinger_middle=float(boll_middle) if pd.notna(boll_middle) else None,
            bollinger_lower=float(boll_lower) if pd.notna(boll_lower) else None,
            volume=volume if pd.notna(volume) else None,
            volume_avg_20=float(volume_avg_20) if pd.notna(volume_avg_20) else None
        )
    except Exception as e:
        print(f"Error calculating technical indicators: {e}")
        return None

def run_all_strategies(symbol: str) -> TickerAnalysis:
    try:
        data = fetch_ticker_data(symbol)
    except Exception as e:
        return TickerAnalysis(
            symbol=symbol,
            strategies=[],
            error=f"Failed to fetch data for {symbol}: {str(e)}"
        )

    results = []
    
    # Run all 10 strategies
    results.append(evaluate_can_slim(data))
    results.append(evaluate_fcf_yield(data))
    results.append(evaluate_garp(data))
    results.append(evaluate_low_vol(data))
    results.append(evaluate_pure_growth(data))
    results.append(evaluate_fund_tech(data))
    results.append(evaluate_sentiment(data))
    results.append(evaluate_earnings_mom(data))
    results.append(evaluate_dividend(data))
    
    # ML Engine is special as it returns additional fields
    ml_result, alpha_prob, top_factor = evaluate_ml_engine(data)
    results.append(ml_result)
    
    # Extract recent price history for frontend charts (e.g. last 6 months)
    price_history = []
    if data.get("history") is not None and not data["history"].empty:
        history_df = data["history"].copy()
        closes = history_df["Close"]
        
        # Precompute the requested historical series arrays
        history_df["sma_9"] = closes.rolling(window=9).mean()
        history_df["sma_12"] = closes.rolling(window=12).mean()
        history_df["sma_26"] = closes.rolling(window=26).mean()
        history_df["sma_50"] = closes.rolling(window=50).mean()
        history_df["sma_200"] = closes.rolling(window=200).mean()
        
        delta = closes.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        history_df["rsi_14"] = 100 - (100 / (1 + rs))
        
        exp1 = closes.ewm(span=12, adjust=False).mean()
        exp2 = closes.ewm(span=26, adjust=False).mean()
        macd = exp1 - exp2
        macd_signal = macd.ewm(span=9, adjust=False).mean()
        macd_hist = macd - macd_signal
        
        history_df["macd"] = macd
        history_df["macd_signal"] = macd_signal
        history_df["macd_hist"] = macd_hist
        
        # Capture the last 126 days (~6 months)
        hist = history_df.tail(126) 
        
        for date, row in hist.iterrows():
            def safe_float(val):
                return float(val) if pd.notna(val) else None
                
            price_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "close": float(row["Close"]),
                "macd": safe_float(row.get("macd")),
                "macd_signal": safe_float(row.get("macd_signal")),
                "macd_hist": safe_float(row.get("macd_hist")),
                "sma_9": safe_float(row.get("sma_9")),
                "sma_12": safe_float(row.get("sma_12")),
                "sma_26": safe_float(row.get("sma_26")),
                "sma_50": safe_float(row.get("sma_50")),
                "sma_200": safe_float(row.get("sma_200")),
                "rsi_14": safe_float(row.get("rsi_14")),
            })

    return TickerAnalysis(
        symbol=symbol,
        strategies=results,
        alpha_probability=alpha_prob,
        top_factor=top_factor,
        price_history=price_history,
        technical_indicators=calculate_technical_indicators(data),
        raw_data=data.get("info")
    )
