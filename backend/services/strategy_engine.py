from typing import Dict, Any
import pandas as pd
from models import TickerAnalysis, StrategyResult, TechnicalIndicators
from services.finance_client import fetch_ticker_data

from strategies.can_slim import evaluate_can_slim
from strategies.fcf_yield import evaluate_fcf_yield
from strategies.garp import evaluate_garp
from strategies.low_vol_quality import evaluate_low_vol
from strategies.pure_growth import evaluate_pure_growth
from strategies.fundamental_technical import evaluate_fund_tech
from strategies.sentiment_quant import evaluate_sentiment
from strategies.earnings_momentum import evaluate_earnings_mom
from strategies.dividend_aristocrat import evaluate_dividend
from strategies.machine_learning import evaluate_ml_engine
from strategies.willy_algo import evaluate_willy_algo, calculate_willy_vwap

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
        rsi_series = 100 - (100 / (1 + rs))
        rsi_14 = rsi_series.iloc[-1]
        rsi_slope = rsi_series.diff().iloc[-1]
        
        # MACD
        exp1 = closes.ewm(span=12, adjust=False).mean()
        exp2 = closes.ewm(span=26, adjust=False).mean()
        macd_series = exp1 - exp2
        signal_series = macd_series.ewm(span=9, adjust=False).mean()
        macd_line = macd_series.iloc[-1]
        macd_signal = signal_series.iloc[-1]
        macd_slope = macd_series.diff().iloc[-1]
        
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
        
        # WillyAlgo VWAP
        willy_vwap_series = calculate_willy_vwap(history)
        willy_vwap = willy_vwap_series.iloc[-1]
        
        # Calculate ratio of current close to Willy VWAP
        current_close = float(closes.iloc[-1])
        willy_vwap_ratio = current_close / willy_vwap if willy_vwap and willy_vwap != 0 else None
        
        return TechnicalIndicators(
            sma_50=float(sma_50) if pd.notna(sma_50) else None,
            sma_200=float(sma_200) if pd.notna(sma_200) else None,
            ema_20=float(ema_20) if pd.notna(ema_20) else None,
            rsi_14=float(rsi_14) if pd.notna(rsi_14) else None,
            rsi_slope=float(rsi_slope) if pd.notna(rsi_slope) else None,
            macd_line=float(macd_line) if pd.notna(macd_line) else None,
            macd_signal=float(macd_signal) if pd.notna(macd_signal) else None,
            macd_slope=float(macd_slope) if pd.notna(macd_slope) else None,
            bollinger_upper=float(boll_upper) if pd.notna(boll_upper) else None,
            bollinger_middle=float(boll_middle) if pd.notna(boll_middle) else None,
            bollinger_lower=float(boll_lower) if pd.notna(boll_lower) else None,
            volume=volume if pd.notna(volume) else None,
            volume_avg_20=float(volume_avg_20) if pd.notna(volume_avg_20) else None,
            willy_vwap=float(willy_vwap) if pd.notna(willy_vwap) else None,
            willy_vwap_ratio=float(willy_vwap_ratio) if willy_vwap_ratio is not None and pd.notna(willy_vwap_ratio) else None
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
    results.append(evaluate_willy_algo(data))
    
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
        
        
        # Bollinger Bands
        history_df["bb_middle"] = closes.rolling(window=20).mean()
        std_20 = closes.rolling(window=20).std()
        history_df["bb_upper"] = history_df["bb_middle"] + (std_20 * 2)
        history_df["bb_lower"] = history_df["bb_middle"] - (std_20 * 2)
        history_df["willy_vwap"] = calculate_willy_vwap(history_df)
        
        # VWAP ATR Bands (Multiplier 2.0)
        high_low = history_df['High'] - history_df['Low']
        high_close = (history_df['High'] - closes.shift()).abs()
        low_close = (history_df['Low'] - closes.shift()).abs()
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr_14 = tr.rolling(window=14).mean()
        
        history_df["vwap_upper"] = history_df["willy_vwap"] + (atr_14 * 2.0)
        history_df["vwap_lower"] = history_df["willy_vwap"] - (atr_14 * 2.0)
        
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
                "bb_upper": safe_float(row.get("bb_upper")),
                "bb_lower": safe_float(row.get("bb_lower")),
                "bb_middle": safe_float(row.get("bb_middle")),
                "willy_vwap": safe_float(row.get("willy_vwap")),
                "vwap_upper": safe_float(row.get("vwap_upper")),
                "vwap_lower": safe_float(row.get("vwap_lower")),
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
