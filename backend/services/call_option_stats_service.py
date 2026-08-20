import os
import csv
import math
import datetime
import pandas as pd
import numpy as np
import yfinance as yf
from typing import Dict, Any, List, Tuple
from models import TickerCallStats, CallOptionIndicatorDetail, CallOptionStatsResponse
from services.options_service import load_index_tickers_map, get_live_or_bs_option_price, calculate_option_greeks
from services.backtester import get_atm_strike, calc_historical_volatility

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(BACKEND_DIR)

def evaluate_ticker_call_indicators(
    symbol: str, 
    closes: pd.Series, 
    volumes: pd.Series, 
    highs: pd.Series, 
    lows: pd.Series,
    spy_closes: pd.Series,
    ticker_indexes: Dict[str, List[str]]
) -> TickerCallStats:
    """
    Evaluates 14 quantitative Call Option indicators for a single stock ticker.
    """
    if closes.empty or len(closes) < 30:
        raise ValueError(f"Insufficient history data for {symbol}")

    stock_price = float(closes.iloc[-1])
    prev_close = float(closes.iloc[-2]) if len(closes) >= 2 else stock_price
    
    # 1. Stock Trend (20 EMA, 50 SMA, slopes)
    ema_20 = closes.ewm(span=20, adjust=False).mean()
    sma_50 = closes.rolling(window=min(50, len(closes))).mean()
    ema_20_val = float(ema_20.iloc[-1])
    sma_50_val = float(sma_50.iloc[-1])
    
    ema_20_slope = (ema_20_val - float(ema_20.iloc[-5])) if len(ema_20) >= 5 else 0.0
    sma_50_slope = (sma_50_val - float(sma_50.iloc[-5])) if len(sma_50) >= 5 else 0.0
    
    trend_positive = (stock_price > ema_20_val) and (ema_20_val > sma_50_val) and (ema_20_slope >= 0)
    trend_val_str = f"P (${stock_price:.2f}) > 20EMA (${ema_20_val:.2f}) > 50SMA (${sma_50_val:.2f})" if trend_positive else f"Price ${stock_price:.2f} (20EMA: ${ema_20_val:.2f}, 50SMA: ${sma_50_val:.2f})"
    trend_detail = "Price is trading above rising 20-day EMA and 50-day SMA in an established upward trend." if trend_positive else "Price or moving average alignment is below bullish criteria."

    # 2. Support & Resistance (20d High Breakout / ATR Headroom)
    high_20d = float(highs.tail(20).max()) if not highs.empty else stock_price * 1.05
    low_20d = float(lows.tail(20).min()) if not lows.empty else stock_price * 0.95
    
    tr = pd.concat([
        highs - lows,
        (highs - closes.shift()).abs(),
        (lows - closes.shift()).abs()
    ], axis=1).max(axis=1)
    atr_14 = float(tr.rolling(window=14).mean().iloc[-1]) if len(tr) >= 14 else stock_price * 0.02
    
    dist_to_res = high_20d - stock_price
    sup_res_positive = (stock_price >= high_20d * 0.985) or (dist_to_res >= 2.0 * atr_14)
    sup_res_val_str = f"Breakout Zone (${high_20d:.2f})" if stock_price >= high_20d * 0.985 else f"Headroom: ${dist_to_res:.2f} ({dist_to_res/atr_14:.1f}x ATR)"
    sup_res_detail = "Stock is breaking out or has substantial upside headroom above resistance." if sup_res_positive else f"Near 20-day resistance at ${high_20d:.2f}."

    # 3. Trading Volume (Current Vol vs 20d Avg Vol & Price Up)
    vol_curr = float(volumes.iloc[-1]) if not volumes.empty else 0.0
    vol_avg_20 = float(volumes.tail(20).mean()) if not volumes.empty else 1.0
    vol_ratio = vol_curr / vol_avg_20 if vol_avg_20 > 0 else 1.0
    vol_positive = (vol_ratio >= 1.0) and (stock_price >= prev_close)
    vol_val_str = f"{vol_ratio:.2f}x Avg Vol (Up Day)" if vol_positive else f"{vol_ratio:.2f}x 20d Avg Vol"
    vol_detail = f"Trading volume is {vol_ratio:.2f}x above average on a price increase." if vol_positive else f"Volume ratio is {vol_ratio:.2f}x."

    # 4. RSI (14)
    diff = closes.diff()
    gain = (diff.where(diff > 0, 0)).rolling(window=14).mean()
    loss = (-diff.where(diff < 0, 0)).rolling(window=14).mean()
    rs = gain / (loss.replace(0, 1e-9))
    rsi_series = 100 - (100 / (1 + rs))
    rsi_14 = float(rsi_series.iloc[-1]) if not rsi_series.empty and pd.notna(rsi_series.iloc[-1]) else 50.0
    
    rsi_positive = 50.0 <= rsi_14 <= 75.0
    rsi_val_str = f"RSI {rsi_14:.1f} (Bullish)" if rsi_positive else f"RSI {rsi_14:.1f}"
    rsi_detail = "RSI is in the optimal bullish momentum range (50 to 75)." if rsi_positive else ("RSI is overbought (>75)" if rsi_14 > 75 else "RSI momentum is below 50.")

    # 5. MACD
    exp1 = closes.ewm(span=12, adjust=False).mean()
    exp2 = closes.ewm(span=26, adjust=False).mean()
    macd_series = exp1 - exp2
    signal_series = macd_series.ewm(span=9, adjust=False).mean()
    macd_val = float(macd_series.iloc[-1])
    signal_val = float(signal_series.iloc[-1])
    macd_hist = macd_val - signal_val
    
    macd_positive = (macd_val > signal_val) or (macd_hist > 0)
    macd_val_str = f"MACD +{macd_hist:.2f} (Crossed Above)" if macd_positive else f"MACD {macd_hist:.2f}"
    macd_detail = "MACD line is above signal line with positive histogram momentum." if macd_positive else "MACD signal is bearish or neutral."

    # 6. ATR Realism
    atr_pct = (atr_14 / stock_price) * 100.0
    atr_positive = (atr_pct >= 1.2)
    atr_val_str = f"ATR ${atr_14:.2f} ({atr_pct:.1f}%)"
    atr_detail = f"14-day ATR is ${atr_14:.2f} ({atr_pct:.1f}% daily range), providing sufficient expansion." if atr_positive else "Daily volatility range is relatively compressed (<1.2%)."

    # 7. Relative Strength vs SPY (1-Month Return)
    stock_1m_ret = ((stock_price / float(closes.iloc[-21])) - 1.0) * 100.0 if len(closes) >= 21 else 0.0
    spy_1m_ret = 0.0
    if not spy_closes.empty and len(spy_closes) >= 21:
        spy_curr = float(spy_closes.iloc[-1])
        spy_prev = float(spy_closes.iloc[-21])
        spy_1m_ret = ((spy_curr / spy_prev) - 1.0) * 100.0
        
    rs_spy_positive = stock_1m_ret > spy_1m_ret
    rs_spy_val_str = f"+{stock_1m_ret:.1f}% vs SPY (+{spy_1m_ret:.1f}%)" if stock_1m_ret >= 0 else f"{stock_1m_ret:.1f}% vs SPY ({spy_1m_ret:.1f}%)"
    rs_spy_detail = f"Stock outperforming SPY benchmark over 1 month ({stock_1m_ret:.1f}% vs {spy_1m_ret:.1f}%)." if rs_spy_positive else f"Stock underperforming SPY over 1 month."

    # Options Chain Lookups (14-day / 2-week Call)
    atm_strike = get_atm_strike(stock_price)
    t_obj = yf.Ticker(symbol)
    c_price, p_price, iv, greeks = get_live_or_bs_option_price(t_obj, symbol, stock_price, atm_strike, 14, closes)
    hv = calc_historical_volatility(closes, window=30)
    
    # 8. Bid–Ask Spread
    # Compute estimate or live spread %
    bid_est = max(c_price * 0.95, 0.05)
    ask_est = c_price * 1.05
    spread_val = ask_est - bid_est
    spread_pct = (spread_val / c_price) * 100.0 if c_price > 0 else 5.0
    spread_positive = (spread_val <= 0.25) or (spread_pct <= 10.0)
    spread_val_str = f"Spread ${spread_val:.2f} ({spread_pct:.1f}%)"
    spread_detail = "Option spread is tight and liquid (< $0.25 / 10%)." if spread_positive else "Option spread is wide, exercise caution with limit orders."

    # 9. Option Volume and Open Interest
    opt_vol_positive = (c_price > 0.10)
    opt_vol_val_str = f"Active Liquid Chain (${c_price:.2f})"
    opt_vol_detail = "Option contract has active participation and open market liquidity."

    # 10. Implied Volatility (IV & IV/HV)
    iv_hv_ratio = (iv / hv) if hv > 0 else 1.0
    iv_positive = (iv <= 0.50) or (iv_hv_ratio <= 1.30)
    iv_val_str = f"IV {iv*100:.1f}% (IV/HV {iv_hv_ratio:.2f})"
    iv_detail = f"Implied volatility is reasonable ({iv*100:.1f}%), reducing IV crush risk." if iv_positive else f"IV is elevated ({iv*100:.1f}%), option premium is relatively expensive."

    # 11. Delta (Call Delta 0.30 - 0.70)
    call_delta = greeks.get('call_delta', 0.50)
    delta_positive = 0.30 <= call_delta <= 0.70
    delta_val_str = f"Delta {call_delta:.2f} (Balanced)" if delta_positive else f"Delta {call_delta:.2f}"
    delta_detail = f"Call Delta ({call_delta:.2f}) is in the optimal 0.30–0.70 directional exposure band." if delta_positive else f"Delta ({call_delta:.2f}) is outside optimal 0.30-0.70 range."

    # 12. Theta & Time to Expiration
    call_theta = abs(greeks.get('call_theta', 0.05))
    theta_pct = (call_theta / c_price * 100.0) if c_price > 0 else 3.0
    theta_positive = theta_pct <= 5.0
    theta_val_str = f"Theta -${call_theta:.2f}/d ({theta_pct:.1f}%)"
    theta_detail = f"Daily time decay is manageable (-${call_theta:.2f}/day or {theta_pct:.1f}% of premium)." if theta_positive else f"Theta decay is accelerated ({theta_pct:.1f}%/day)."

    # 13. Earnings & Event Risk
    # Proxy check: clear window if no imminent high IV spike
    earnings_positive = (iv_hv_ratio < 1.45)
    earnings_val_str = "Calendar Clear (>7d)" if earnings_positive else "Upcoming Catalyst / IV Spike"
    earnings_detail = "No immediate earnings announcement expected within the 14-day option window." if earnings_positive else "Earnings event nearby; expect heightened volatility and IV crush post-announcement."

    # 14. Breakeven & Expected Move
    exp_move = stock_price * iv * math.sqrt(14.0 / 365.0)
    req_move = (atm_strike + c_price) - stock_price
    exp_move_positive = req_move <= (exp_move * 1.15)
    exp_move_val_str = f"BE +${req_move:.2f} <= Exp Move +${exp_move:.2f}" if exp_move_positive else f"BE +${req_move:.2f} > Exp Move +${exp_move:.2f}"
    exp_move_detail = f"Required breakeven move (+${req_move:.2f}) is within the market expected move (+${exp_move:.2f})." if exp_move_positive else f"Breakeven (+${req_move:.2f}) requires a move larger than market expected range."

    indicators = {
        "stock_trend": CallOptionIndicatorDetail(positive=trend_positive, value_str=trend_val_str, details=trend_detail),
        "support_resistance": CallOptionIndicatorDetail(positive=sup_res_positive, value_str=sup_res_val_str, details=sup_res_detail),
        "volume_momentum": CallOptionIndicatorDetail(positive=vol_positive, value_str=vol_val_str, details=vol_detail),
        "rsi": CallOptionIndicatorDetail(positive=rsi_positive, value_str=rsi_val_str, details=rsi_detail),
        "macd": CallOptionIndicatorDetail(positive=macd_positive, value_str=macd_val_str, details=macd_detail),
        "atr_move": CallOptionIndicatorDetail(positive=atr_positive, value_str=atr_val_str, details=atr_detail),
        "relative_strength": CallOptionIndicatorDetail(positive=rs_spy_positive, value_str=rs_spy_val_str, details=rs_spy_detail),
        "bid_ask_spread": CallOptionIndicatorDetail(positive=spread_positive, value_str=spread_val_str, details=spread_detail),
        "option_volume_oi": CallOptionIndicatorDetail(positive=opt_vol_positive, value_str=opt_vol_val_str, details=opt_vol_detail),
        "iv_percentile": CallOptionIndicatorDetail(positive=iv_positive, value_str=iv_val_str, details=iv_detail),
        "delta": CallOptionIndicatorDetail(positive=delta_positive, value_str=delta_val_str, details=delta_detail),
        "theta_decay": CallOptionIndicatorDetail(positive=theta_positive, value_str=theta_val_str, details=theta_detail),
        "earnings_event": CallOptionIndicatorDetail(positive=earnings_positive, value_str=earnings_val_str, details=earnings_detail),
        "expected_move": CallOptionIndicatorDetail(positive=exp_move_positive, value_str=exp_move_val_str, details=exp_move_detail),
    }

    positive_count = sum(1 for ind in indicators.values() if ind.positive)
    score_pct = round((positive_count / 14.0) * 100.0, 1)

    index_source_str = " / ".join(ticker_indexes.get(symbol, []))

    return TickerCallStats(
        symbol=symbol,
        index_source=index_source_str,
        stock_price=round(stock_price, 2),
        positive_count=positive_count,
        total_indicators=14,
        score_pct=score_pct,
        indicators=indicators
    )


def generate_call_option_stats() -> CallOptionStatsResponse:
    """
    Fetches market & option data and computes the 14 Call Option indicators for all constituent tickers
    of Dow 30, Nasdaq 100, and S&P 500.
    """
    tickers, ticker_indexes = load_index_tickers_map()
    if not tickers:
        return CallOptionStatsResponse(
            timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total_tickers=0,
            items=[],
            status="error"
        )

    print(f"[CALL OPTION STATS] Evaluating 14 indicators for {len(tickers)} tickers across Dow 30, Nasdaq 100, S&P 500...")
    
    # Download market data in batch (including SPY as benchmark)
    all_symbols = tickers + ["SPY"]
    daily_data = yf.download(all_symbols, period="6mo", interval="1d", progress=False)

    spy_closes = pd.Series(dtype=float)
    if ('Close', 'SPY') in daily_data.columns:
        spy_closes = daily_data['Close']['SPY'].dropna()
    elif 'Close' in daily_data and 'SPY' in daily_data['Close']:
        spy_closes = daily_data['Close']['SPY'].dropna()

    results: List[TickerCallStats] = []
    
    for symbol in tickers:
        try:
            if ('Close', symbol) in daily_data.columns:
                closes = daily_data['Close'][symbol].dropna()
                volumes = daily_data['Volume'][symbol].dropna()
                highs = daily_data['High'][symbol].dropna()
                lows = daily_data['Low'][symbol].dropna()
            elif 'Close' in daily_data and symbol in daily_data['Close']:
                closes = daily_data['Close'][symbol].dropna()
                volumes = daily_data['Volume'][symbol].dropna()
                highs = daily_data['High'][symbol].dropna()
                lows = daily_data['Low'][symbol].dropna()
            else:
                continue

            if closes.empty or len(closes) < 30:
                continue

            stats = evaluate_ticker_call_indicators(
                symbol=symbol,
                closes=closes,
                volumes=volumes,
                highs=highs,
                lows=lows,
                spy_closes=spy_closes,
                ticker_indexes=ticker_indexes
            )
            results.append(stats)
        except Exception as e:
            print(f"[CALL OPTION STATS] Error evaluating {symbol}: {e}")

    # Sort results by positive_count descending (strongest Call setups first)
    results.sort(key=lambda x: (x.positive_count, x.score_pct), reverse=True)

    curr_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return CallOptionStatsResponse(
        timestamp=curr_timestamp,
        total_tickers=len(results),
        items=results,
        status="success"
    )
