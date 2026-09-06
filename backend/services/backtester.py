import os
import csv
import time
import math
import datetime
import pandas as pd
import numpy as np
import yfinance as yf
from typing import Optional, Tuple, Dict, List, Any
from scipy.stats import norm
from strategies.willy_algo import calculate_willy_vwap

# Paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(BACKEND_DIR)

# Global in-memory cache to avoid repeated heavy API downloads
_backtest_cache = {
    "last_fetched": 0.0,  # Unix timestamp
    "indicators": {},     # ticker -> DataFrame with daily indicators
    "daily_data": None,   # Raw daily DataFrame
    "data_30m": None      # Raw 30m DataFrame (timezone converted)
}

CACHE_TTL_SECONDS = 3600  # 1 hour

def load_universe_tickers() -> list[str]:
    tickers = set()
    for filename in ["DOW100.csv", "Nasdaq100.csv", "SP100.csv"]:
        path = os.path.join(BASE_DIR, filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    symbol = (row.get('Symbol') or row.get('Ticker', '')).strip().upper()
                    if symbol:
                        # yfinance expects hyphens instead of dots for classes
                        symbol = symbol.replace('.', '-')
                        tickers.add(symbol)
    return sorted(list(tickers))

def run_willy_backtest_py(prices_slice: pd.DataFrame, initial_capital: float = 10000.0) -> float:
    """
    Python equivalent of the frontend runWillyBacktest.
    Runs the Willy VWAP strategy on a slice of daily data.
    """
    if len(prices_slice) == 0:
        return initial_capital
        
    start_close = prices_slice['Close'].iloc[0]
    if pd.isna(start_close) or start_close <= 0:
        return initial_capital
        
    cash = 0.0
    shares = initial_capital / start_close
    is_holding = True
    
    for i in range(1, len(prices_slice)):
        close = prices_slice['Close'].iloc[i]
        willy_vwap = prices_slice['willy_vwap'].iloc[i]
        prev_close = prices_slice['Close'].iloc[i - 1]
        prev_willy_vwap = prices_slice['willy_vwap'].iloc[i - 1]
        
        if pd.isna(close) or close <= 0:
            continue
            
        if is_holding:
            # Sell condition: close falls below willy_vwap
            if pd.notna(willy_vwap) and close < willy_vwap:
                cash = shares * close
                shares = 0.0
                is_holding = False
        else:
            # Buy condition: close crosses above willy_vwap
            prev_was_below = pd.isna(prev_willy_vwap) or prev_close <= prev_willy_vwap
            curr_is_above = pd.notna(willy_vwap) and close > willy_vwap
            if curr_is_above and prev_was_below:
                shares = cash / close
                cash = 0.0
                is_holding = True
                
    last_close = prices_slice['Close'].iloc[-1]
    return (shares * last_close) if is_holding else cash

def get_backtest_data(tickers: list[str]) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    """
    Fetches daily and 30m data for all tickers, caching results in-memory.
    """
    now = time.time()
    if (now - _backtest_cache["last_fetched"] < CACHE_TTL_SECONDS and 
            _backtest_cache["daily_data"] is not None and 
            _backtest_cache["data_30m"] is not None):
        print("[BACKTEST] Reusing cached market data")
        return _backtest_cache["indicators"], _backtest_cache["daily_data"], _backtest_cache["data_30m"]

    print(f"[BACKTEST] Downloading data for {len(tickers)} tickers...")
    
    INDEX_TICKERS = ["^DJI", "^GSPC", "^NDX"]
    download_tickers = sorted(list(set(tickers + INDEX_TICKERS)))
    
    # 1. Download daily data
    daily_data = yf.download(download_tickers, period="2y", interval="1d", progress=False)
    
    # 2. Download 30m data
    data_30m = yf.download(tickers, period="1mo", interval="30m", progress=False)
    data_30m.index = data_30m.index.tz_convert('America/New_York')
    
    # 3. Calculate indicators for each ticker
    indicators = {}
    for ticker in tickers:
        try:
            # Multi-index extraction: cols are (Attribute, Ticker)
            closes = daily_data['Close'][ticker]
            highs = daily_data['High'][ticker]
            lows = daily_data['Low'][ticker]
            volumes = daily_data['Volume'][ticker]
            
            df = pd.DataFrame(index=daily_data.index)
            df['Close'] = closes
            df['High'] = highs
            df['Low'] = lows
            df['Volume'] = volumes
            
            # Calculate Willy VWAP
            df['willy_vwap'] = calculate_willy_vwap(df)
            
            # MACD
            exp1 = closes.ewm(span=12, adjust=False).mean()
            exp2 = closes.ewm(span=26, adjust=False).mean()
            macd = exp1 - exp2
            macd_signal = macd.ewm(span=9, adjust=False).mean()
            df['macd_hist'] = macd - macd_signal
            df['macd_slope'] = macd.diff()
            
            # RSI 14
            delta = closes.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['rsi_14'] = 100 - (100 / (1 + rs))
            
            indicators[ticker] = df
        except Exception as e:
            # Handle potential missing/failed tickers
            print(f"[BACKTEST] Error preparing indicators for {ticker}: {e}")
            
    # Save to global cache
    _backtest_cache["last_fetched"] = now
    _backtest_cache["indicators"] = indicators
    _backtest_cache["daily_data"] = daily_data
    _backtest_cache["data_30m"] = data_30m
    
    return indicators, daily_data, data_30m

def execute_30d_backtest(strategy_num: int = 1, period: str = "1m") -> dict:
    tickers = load_universe_tickers()
    indicators, daily_data, data_30m = get_backtest_data(tickers)
    
    PERIOD_DAYS_MAP = {
        "1w": 7,
        "1m": 30,
        "3m": 90,
        "6m": 180,
        "1y": 365
    }
    lookback_days = PERIOD_DAYS_MAP.get(period.lower(), 30)
    
    # Define the calendar lookback window
    today = datetime.datetime.now().date()
    start_date = today - datetime.timedelta(days=lookback_days)
    
    all_dates = sorted(list(daily_data.index))
    trading_days = [d for d in all_dates if d.date() >= start_date]
    
    trades_ledger = []
    total_profit = 0.0
    
    for T in trading_days:
        idx = all_dates.index(T)
        # Ensure we have the next trading day T+1 (buy) and T+2 (sell)
        if idx + 2 >= len(all_dates):
            continue
            
        T_plus_1 = all_dates[idx + 1]
        T_plus_2 = all_dates[idx + 2]
        
        T_str = T.strftime('%Y-%m-%d')
        T_plus_1_str = T_plus_1.strftime('%Y-%m-%d')
        T_plus_2_str = T_plus_2.strftime('%Y-%m-%d')
        
        selected_tickers = []
        for ticker in tickers:
            df = indicators.get(ticker)
            if df is None or T not in df.index:
                continue
                
            close_T = df.loc[T, 'Close']
            willy_vwap_T = df.loc[T, 'willy_vwap']
            macd_hist_T = df.loc[T, 'macd_hist']
            macd_slope_T = df.loc[T, 'macd_slope']
            rsi_T = df.loc[T, 'rsi_14']
            
            if pd.isna(close_T) or pd.isna(willy_vwap_T) or pd.isna(macd_hist_T) or pd.isna(macd_slope_T) or pd.isna(rsi_T):
                continue
                
            if strategy_num in (1, 3):
                # Screen Criteria for Strategy 1 & 3
                # 1. Willy Market = Bull (Price > Willy VWAP)
                if close_T <= willy_vwap_T:
                    continue
                    
                # 2. Strategy Value > 10,000 (1-week backtest of $10k initial capital ending on T)
                one_week_start = T - datetime.timedelta(days=7)
                slice_df = df.loc[one_week_start:T]
                strat_val_1w = run_willy_backtest_py(slice_df, 10000.0)
                if strat_val_1w <= 10000.0:
                    continue
                    
                # 3. MACD Hist between -0.5 and 0.5
                if macd_hist_T <= -0.5 or macd_hist_T >= 0.5:
                    continue
                    
                # 4. MACD Slope > 0
                if macd_slope_T <= 0:
                    continue
                    
                # 5. RSI 14 between 30 and 70
                if rsi_T <= 30 or rsi_T >= 70:
                    continue
                    
                # Rank by 1-week rolling Willy backtest value (strat_val_1w)
                selected_tickers.append((ticker, strat_val_1w))
            else:
                # Screen Criteria for Strategy 2
                # 1. Willy Market = Bull (Price > Willy VWAP)
                if close_T <= willy_vwap_T:
                    continue
                    
                # We need strat_val_1w for ranking!
                one_week_start = T - datetime.timedelta(days=7)
                slice_df = df.loc[one_week_start:T]
                strat_val_1w = run_willy_backtest_py(slice_df, 10000.0)
                
                # Rank by 1-week rolling Willy backtest value (strat_val_1w)
                selected_tickers.append((ticker, strat_val_1w))
            
        # Sort and select top 5
        selected_tickers.sort(key=lambda x: x[1], reverse=True)
        top_5 = selected_tickers[:5]
        
        # Execute Trades
        daily_profit = 0.0
        traded_items = []
        
        for ticker, strat_val in top_5:
            # Target timestamps in 30m dataset
            buy_dt = pd.Timestamp(f"{T_plus_1_str} 15:00:00", tz='America/New_York')
            if strategy_num == 3:
                sell_dt = pd.Timestamp(f"{T_plus_2_str} 14:30:00", tz='America/New_York')
            else:
                sell_dt = pd.Timestamp(f"{T_plus_2_str} 11:00:00", tz='America/New_York')
            
            buy_price = None
            sell_price = None
            
            # Look up in 30m data
            if buy_dt in data_30m.index:
                buy_price = data_30m.loc[buy_dt, ('Open', ticker)]
            if sell_dt in data_30m.index:
                sell_price = data_30m.loc[sell_dt, ('Open', ticker)]
                
            # Fallback if 30m data is missing or NaN
            if pd.isna(buy_price) or buy_price is None:
                if T_plus_1 in daily_data.index:
                    buy_price = daily_data.loc[T_plus_1, ('Close', ticker)]
            if pd.isna(sell_price) or sell_price is None:
                if T_plus_2 in daily_data.index:
                    sell_price = daily_data.loc[T_plus_2, ('Close', ticker)]
                    
            if pd.notna(buy_price) and pd.notna(sell_price) and buy_price > 0:
                shares = 2000.0 / buy_price
                sell_value = shares * sell_price
                profit = sell_value - 2000.0
                daily_profit += profit
                
                traded_items.append({
                    "ticker": ticker,
                    "buy_price": float(buy_price),
                    "sell_price": float(sell_price),
                    "shares": float(shares),
                    "profit": float(profit),
                    "strategy_value": float(strat_val)
                })
                
        total_profit += daily_profit

        # Calculate daily index returns
        dow_ret = 0.0
        sp_ret = 0.0
        nasdaq_ret = 0.0
        
        if daily_data is not None and not daily_data.empty:
            try:
                if T_plus_1 in daily_data.index and T_plus_2 in daily_data.index:
                    for symbol, name in [('^DJI', 'dow'), ('^GSPC', 'sp'), ('^NDX', 'nasdaq')]:
                        if ('Close', symbol) in daily_data.columns or ('Close' in daily_data and symbol in daily_data['Close']):
                            p_start = daily_data.loc[T_plus_1, ('Close', symbol)]
                            p_end = daily_data.loc[T_plus_2, ('Close', symbol)]
                            if pd.notna(p_start) and pd.notna(p_end) and p_start > 0:
                                val = float((p_end - p_start) / p_start * 100.0)
                                if name == 'dow': dow_ret = val
                                elif name == 'sp': sp_ret = val
                                elif name == 'nasdaq': nasdaq_ret = val
            except Exception as e:
                print(f"[BACKTEST] Error calculating index returns for {T_str}: {e}")
        
        trades_ledger.append({
            "screen_date": T_str,
            "buy_date": T_plus_1_str,
            "sell_date": T_plus_2_str,
            "tickers": traded_items,
            "daily_profit": float(daily_profit),
            "dow_return": dow_ret,
            "sp_return": sp_ret,
            "nasdaq_return": nasdaq_ret
        })
        
    roi_pct = (total_profit / 10000.0) * 100.0
    
    sp500_pct_change = 0.0
    try:
        if len(trading_days) > 0 and '^GSPC' in daily_data['Close'].columns:
            first_day = trading_days[0]
            last_day = pd.Timestamp(trades_ledger[-1]["sell_date"]) if trades_ledger else trading_days[-1]
            
            sp500_closes = daily_data['Close']['^GSPC'].dropna()
            
            start_series = sp500_closes[sp500_closes.index <= first_day]
            sp500_start = float(start_series.iloc[-1]) if not start_series.empty else float(sp500_closes.iloc[0])
            
            end_series = sp500_closes[sp500_closes.index <= last_day]
            sp500_end = float(end_series.iloc[-1]) if not end_series.empty else float(sp500_closes.iloc[-1])
            
            if sp500_start > 0:
                sp500_pct_change = float(((sp500_end - sp500_start) / sp500_start) * 100.0)
    except Exception as e:
        print(f"[BACKTEST] Error calculating S&P 500 % change: {e}")
    
    return {
        "total_profit": float(total_profit),
        "roi_pct": float(roi_pct),
        "sp500_pct_change": float(sp500_pct_change),
        "trades": trades_ledger
    }


# ─────────────────────────────────────────────────────────────────────────────
# OPTIONS BACKTESTING — Black-Scholes Synthetic Pricing Engine
# ─────────────────────────────────────────────────────────────────────────────

def black_scholes_call(S: float, K: float, T_years: float, r: float, sigma: float) -> float:
    """
    Standard Black-Scholes price for a European CALL option.
    S      - Current underlying price
    K      - Strike price
    T_years- Time to expiry in years (e.g., 7/365)
    r      - Annual risk-free rate (e.g., 0.05 for 5%)
    sigma  - Annual volatility (historical vol as IV proxy)
    Returns the option premium per share. Multiply by 100 for 1 contract.
    """
    if T_years <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        # Intrinsic value only at / after expiry
        return max(S - K, 0.0)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T_years) / (sigma * math.sqrt(T_years))
    d2 = d1 - sigma * math.sqrt(T_years)
    price = S * norm.cdf(d1) - K * math.exp(-r * T_years) * norm.cdf(d2)
    return max(float(price), 0.0)


def black_scholes_put(S: float, K: float, T_years: float, r: float, sigma: float) -> float:
    """Standard Black-Scholes price for a European PUT option."""
    if T_years <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return max(K - S, 0.0)
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T_years) / (sigma * math.sqrt(T_years))
    d2 = d1 - sigma * math.sqrt(T_years)
    price = K * math.exp(-r * T_years) * norm.cdf(-d2) - S * norm.cdf(-d1)
    return max(float(price), 0.0)


def calc_historical_volatility(closes: pd.Series, window: int = 30) -> float:
    """
    Annualized Historical Volatility from log returns.
    Used as a proxy for Implied Volatility in the Black-Scholes model.
    Returns a float (e.g., 0.25 for 25% annualized vol).
    """
    if len(closes) < 5:
        return 0.25  # Fallback default
    log_returns = np.log(closes / closes.shift(1)).dropna()
    if len(log_returns) < 2:
        return 0.25
    # Use last `window` returns; annualize by sqrt(252) trading days
    recent = log_returns.iloc[-window:] if len(log_returns) >= window else log_returns
    daily_vol = float(recent.std())
    annualized_vol = daily_vol * math.sqrt(252)
    # Clamp to a sensible range: 10% – 200%
    return max(0.10, min(annualized_vol, 2.00))


def get_atm_strike(price: float) -> float:
    """
    Round the underlying price to the nearest ATM option strike.
    - Price ≤ $50   → nearest $1 increment
    - Price ≤ $200  → nearest $5 increment
    - Price > $200  → nearest $10 increment
    """
    if price <= 50:
        return round(price)
    elif price <= 200:
        return round(price / 5) * 5
    else:
        return round(price / 10) * 10


def execute_options_backtest(period: str = "1m", exit_mode: str = "intraday") -> dict:
    """
    Options backtesting strategy.
    Uses the same Strategy 1 screening criteria (5 filters + top-5 ranking).
    For each trading day T:
      - Screen tickers on T (same as Strategy 1)
      - Buy ATM weekly CALL options at T+1 3:00 PM open using Black-Scholes pricing
      - Exit either:
          exit_mode='intraday' → Reprice via BS at T+2 11:00 AM  (same timing as Strategy 1)
          exit_mode='expiry'   → Hold to next weekly expiry (7 calendar days from entry)

    Capital per position: $2,000.
    Contracts = floor(2000 / (entry_premium_per_share * 100)).
    Min 1 contract if premium is affordable, else 0 contracts (skip).
    Risk-free rate: 5% annually.
    """
    tickers = load_universe_tickers()
    indicators, daily_data, data_30m = get_backtest_data(tickers)

    PERIOD_DAYS_MAP = {
        "1w": 7,
        "1m": 30,
        "3m": 90,
        "6m": 180,
        "1y": 365
    }
    lookback_days = PERIOD_DAYS_MAP.get(period.lower(), 30)

    today = datetime.datetime.now().date()
    start_date = today - datetime.timedelta(days=lookback_days)

    all_dates = sorted(list(daily_data.index))
    trading_days = [d for d in all_dates if d.date() >= start_date]

    RISK_FREE_RATE = 0.05          # 5% annual risk-free rate
    CAPITAL_PER_TRADE = 2000.0    # $2,000 per options position
    WEEKLY_EXPIRY_DAYS = 7        # Target next weekly expiry ~7 calendar days out

    trades_ledger = []
    total_profit = 0.0

    for T in trading_days:
        idx = all_dates.index(T)
        if idx + 2 >= len(all_dates):
            continue

        T_plus_1 = all_dates[idx + 1]
        T_plus_2 = all_dates[idx + 2]

        T_str = T.strftime('%Y-%m-%d')
        T_plus_1_str = T_plus_1.strftime('%Y-%m-%d')
        T_plus_2_str = T_plus_2.strftime('%Y-%m-%d')

        # ── Screen tickers (same 5-filter Strategy 1 criteria) ───────────────
        selected_tickers = []
        for ticker in tickers:
            df = indicators.get(ticker)
            if df is None or T not in df.index:
                continue

            close_T = df.loc[T, 'Close']
            willy_vwap_T = df.loc[T, 'willy_vwap']
            macd_hist_T = df.loc[T, 'macd_hist']
            macd_slope_T = df.loc[T, 'macd_slope']
            rsi_T = df.loc[T, 'rsi_14']

            if pd.isna(close_T) or pd.isna(willy_vwap_T) or pd.isna(macd_hist_T) or pd.isna(macd_slope_T) or pd.isna(rsi_T):
                continue

            # Filter 1: Willy Market = Bull
            if close_T <= willy_vwap_T:
                continue

            # Filter 2: 1-week strategy value > $10,000
            one_week_start = T - datetime.timedelta(days=7)
            slice_df = df.loc[one_week_start:T]
            strat_val_1w = run_willy_backtest_py(slice_df, 10000.0)
            if strat_val_1w <= 10000.0:
                continue

            # Filter 3: MACD Hist ∈ (-0.5, 0.5)
            if macd_hist_T <= -0.5 or macd_hist_T >= 0.5:
                continue

            # Filter 4: MACD Slope > 0
            if macd_slope_T <= 0:
                continue

            # Filter 5: RSI 14 ∈ (30, 70)
            if rsi_T <= 30 or rsi_T >= 70:
                continue

            selected_tickers.append((ticker, strat_val_1w))

        # Sort by 1-wk strategy value, take top 5
        selected_tickers.sort(key=lambda x: x[1], reverse=True)
        top_5 = selected_tickers[:5]

        # ── Execute options trades ────────────────────────────────────────────
        daily_profit = 0.0
        traded_items = []

        for ticker, strat_val in top_5:
            try:
                df = indicators.get(ticker)
                if df is None:
                    continue

                # ── Get underlying entry price (T+1 3:00 PM open in 30m data) ──
                buy_dt = pd.Timestamp(f"{T_plus_1_str} 15:00:00", tz='America/New_York')
                underlying_entry = None
                if buy_dt in data_30m.index:
                    v = data_30m.loc[buy_dt, ('Open', ticker)]
                    if pd.notna(v):
                        underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    # Fallback to daily close
                    if T_plus_1 in daily_data.index:
                        v = daily_data.loc[T_plus_1, ('Close', ticker)]
                        if pd.notna(v):
                            underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    continue

                # ── Get underlying exit price ─────────────────────────────────
                if exit_mode == 'intraday':
                    # Exit T+2 11:00 AM (same as Strategy 1)
                    sell_dt = pd.Timestamp(f"{T_plus_2_str} 11:00:00", tz='America/New_York')
                    underlying_exit = None
                    if sell_dt in data_30m.index:
                        v = data_30m.loc[sell_dt, ('Open', ticker)]
                        if pd.notna(v):
                            underlying_exit = float(v)
                    if underlying_exit is None or underlying_exit <= 0:
                        if T_plus_2 in daily_data.index:
                            v = daily_data.loc[T_plus_2, ('Close', ticker)]
                            if pd.notna(v):
                                underlying_exit = float(v)
                    if underlying_exit is None or underlying_exit <= 0:
                        continue
                    # Time from entry to exit: approximately 0.5 trading day = 0.002 years
                    time_from_entry_to_exit_years = 0.5 / 252
                else:
                    # Hold to expiry: weekly expiry ~7 calendar days from T+1
                    expiry_date = T_plus_1.date() + datetime.timedelta(days=WEEKLY_EXPIRY_DAYS)
                    # Find nearest trading day <= expiry
                    expiry_ts = None
                    for d in reversed(all_dates):
                        if d.date() <= expiry_date:
                            expiry_ts = d
                            break
                    if expiry_ts is None:
                        continue
                    if expiry_ts in daily_data.index:
                        v = daily_data.loc[expiry_ts, ('Close', ticker)]
                        if pd.notna(v):
                            underlying_exit = float(v)
                        else:
                            continue
                    else:
                        continue
                    time_from_entry_to_exit_years = 0  # At expiry, T=0 → intrinsic only

                # ── Compute Historical Volatility at T ─────────────────────────
                hv_window = 30
                closes_up_to_T = df.loc[:T, 'Close'].dropna()
                sigma = calc_historical_volatility(closes_up_to_T, window=hv_window)

                # ── Option parameters ─────────────────────────────────────────
                strike = get_atm_strike(underlying_entry)
                # Time to expiry from entry to weekly expiry (~7 cal days)
                total_T_years = WEEKLY_EXPIRY_DAYS / 365.0

                # ── Price option at ENTRY (T+1 3:00 PM) ──────────────────────
                entry_premium = black_scholes_call(
                    S=underlying_entry,
                    K=strike,
                    T_years=total_T_years,
                    r=RISK_FREE_RATE,
                    sigma=sigma
                )
                if entry_premium <= 0:
                    continue

                # Contracts = floor(capital / (premium_per_share * 100))
                # Each contract = 100 shares
                contracts = int(CAPITAL_PER_TRADE / (entry_premium * 100))
                if contracts < 1:
                    contracts = 1  # Always buy at least 1 contract if affordable

                cost_of_position = contracts * entry_premium * 100
                if cost_of_position > CAPITAL_PER_TRADE * 1.5:
                    # Too expensive even for 1 contract — skip
                    continue

                # ── Price option at EXIT ──────────────────────────────────────
                if exit_mode == 'intraday':
                    remaining_T_years = total_T_years - time_from_entry_to_exit_years
                    exit_premium = black_scholes_call(
                        S=underlying_exit,
                        K=strike,
                        T_years=max(remaining_T_years, 0.0),
                        r=RISK_FREE_RATE,
                        sigma=sigma  # Using same vol (vol of vol would be more realistic)
                    )
                else:
                    # At expiry: intrinsic value only = max(S - K, 0)
                    exit_premium = max(underlying_exit - strike, 0.0)

                exit_value = contracts * exit_premium * 100
                profit = exit_value - cost_of_position
                daily_profit += profit

                underlying_pct_change = ((underlying_exit - underlying_entry) / underlying_entry) * 100.0
                leverage_multiple = (profit / cost_of_position) if cost_of_position > 0 else 0.0

                # Expiry date for display
                expiry_display = (T_plus_1.date() + datetime.timedelta(days=WEEKLY_EXPIRY_DAYS)).strftime('%Y-%m-%d')

                traded_items.append({
                    "ticker": ticker,
                    "strike": float(strike),
                    "expiry_date": expiry_display,
                    "underlying_entry": float(underlying_entry),
                    "underlying_exit": float(underlying_exit),
                    "underlying_pct_change": float(underlying_pct_change),
                    "entry_premium": float(entry_premium),
                    "exit_premium": float(exit_premium),
                    "contracts": contracts,
                    "cost_of_position": float(cost_of_position),
                    "exit_value": float(exit_value),
                    "profit": float(profit),
                    "leverage_multiple": float(leverage_multiple),
                    "strategy_value": float(strat_val),
                    "iv_used": float(sigma)
                })

            except Exception as e:
                print(f"[OPTIONS BACKTEST] Error on ticker {ticker} for {T_str}: {e}")
                continue

        total_profit += daily_profit

        # ── Index returns for comparison ──────────────────────────────────────
        dow_ret = 0.0
        sp_ret = 0.0
        nasdaq_ret = 0.0
        if daily_data is not None and not daily_data.empty:
            try:
                if T_plus_1 in daily_data.index and T_plus_2 in daily_data.index:
                    for symbol, name in [('^DJI', 'dow'), ('^GSPC', 'sp'), ('^NDX', 'nasdaq')]:
                        if ('Close', symbol) in daily_data.columns or ('Close' in daily_data and symbol in daily_data['Close']):
                            p_start = daily_data.loc[T_plus_1, ('Close', symbol)]
                            p_end = daily_data.loc[T_plus_2, ('Close', symbol)]
                            if pd.notna(p_start) and pd.notna(p_end) and p_start > 0:
                                val = float((p_end - p_start) / p_start * 100.0)
                                if name == 'dow': dow_ret = val
                                elif name == 'sp': sp_ret = val
                                elif name == 'nasdaq': nasdaq_ret = val
            except Exception as e:
                print(f"[OPTIONS BACKTEST] Error calculating index returns for {T_str}: {e}")

        trades_ledger.append({
            "screen_date": T_str,
            "buy_date": T_plus_1_str,
            "sell_date": T_plus_2_str,
            "tickers": traded_items,
            "daily_profit": float(daily_profit),
            "dow_return": dow_ret,
            "sp_return": sp_ret,
            "nasdaq_return": nasdaq_ret
        })

    roi_pct = (total_profit / 10000.0) * 100.0

    # Overall S&P 500 change for the period
    sp500_pct_change = 0.0
    try:
        if len(trading_days) > 0 and '^GSPC' in daily_data['Close'].columns:
            first_day = trading_days[0]
            last_day = pd.Timestamp(trades_ledger[-1]["sell_date"]) if trades_ledger else trading_days[-1]
            sp500_closes = daily_data['Close']['^GSPC'].dropna()
            start_series = sp500_closes[sp500_closes.index <= first_day]
            sp500_start = float(start_series.iloc[-1]) if not start_series.empty else float(sp500_closes.iloc[0])
            end_series = sp500_closes[sp500_closes.index <= last_day]
            sp500_end = float(end_series.iloc[-1]) if not end_series.empty else float(sp500_closes.iloc[-1])
            if sp500_start > 0:
                sp500_pct_change = float(((sp500_end - sp500_start) / sp500_start) * 100.0)
    except Exception as e:
        print(f"[OPTIONS BACKTEST] Error calculating S&P 500 % change: {e}")

    return {
        "total_profit": float(total_profit),
        "roi_pct": float(roi_pct),
        "sp500_pct_change": float(sp500_pct_change),
        "exit_mode": exit_mode,
        "trades": trades_ledger
    }


def calc_trend_score_py(closes: pd.Series, window: int = 10) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """
    Computes OLS Slope %, Std %, and Trend score (Slope % / Std %) for a price series slice.
    """
    if len(closes) < window or window < 2:
        return None, None, None
    sub = closes.tail(window).values
    stock_price = float(sub[-1])
    if stock_price <= 0:
        return None, None, None
    n = len(sub)
    x = np.arange(n)
    mean_x = np.mean(x)
    mean_y = np.mean(sub)
    denom = np.sum((x - mean_x) ** 2)
    if denom == 0:
        return None, None, None
    slope = float(np.sum((x - mean_x) * (sub - mean_y)) / denom)
    intercept = mean_y - slope * mean_x
    y_fit = slope * x + intercept
    residuals = sub - y_fit
    std_dev = float(np.sqrt(np.mean(residuals ** 2)))
    if math.isnan(slope) or math.isnan(std_dev) or std_dev <= 0:
        return None, None, None
    slope_pct = (slope * 100.0) / stock_price
    std_pct = (std_dev * 100.0) / stock_price
    if std_pct <= 0:
        return None, None, None
    trend_score = slope_pct / std_pct
    return round(slope_pct, 4), round(std_pct, 4), round(trend_score, 4)


def execute_trend_options_backtest(period: str = "1m") -> dict:
    """
    Trend-Filtered Call Options Strategy Backtest.
    Screening Criteria on Day T:
      - Volume: Volume > 20d Avg & Price >= Prev Close
      - RSI: Bullish RSI range (30 < RSI < 75)
      - MACD: Positive momentum (MACD Slope > 0 or MACD Hist > 0)
      - Trend: Positive OLS linear fit slope & Trend (Slope % / Std % > 0)
      - Selection: Rank qualified tickers by Trend score (Slope % / Std %) and select top 5

    Trade Specs:
      - Buy 1-month ATM CALL options ($2,000 capital per position) at entry date (T+1) using Black-Scholes.
      - Exit 1 week later (T+7 calendar days / 5 trading days) with 23 days remaining to expiry.
      - Re-price options via Black-Scholes formula at exit.
      - Cumulative P&L, ROI %, and full transaction ledger maintained.
    """
    tickers = load_universe_tickers()
    indicators, daily_data, data_30m = get_backtest_data(tickers)

    PERIOD_DAYS_MAP = {
        "1w": 7,
        "1m": 30,
        "3m": 90,
        "6m": 180,
        "1y": 365
    }
    lookback_days = PERIOD_DAYS_MAP.get(period.lower(), 30)

    today = datetime.datetime.now().date()
    start_date = today - datetime.timedelta(days=lookback_days)

    all_dates = sorted(list(daily_data.index))
    trading_days = [d for d in all_dates if d.date() >= start_date]

    RISK_FREE_RATE = 0.05          # 5% annual risk-free rate
    CAPITAL_PER_TRADE = 2000.0    # $2,000 per options position
    OPTION_EXPIRY_DAYS = 30       # 1-month expiration (30 calendar days)
    HOLDING_DAYS = 7              # 1-week holding period (7 calendar days)

    trades_ledger = []
    total_profit = 0.0

    for T in trading_days:
        idx = all_dates.index(T)
        # Entry on T+1, Exit 1 week later (T+5 trading days)
        if idx + 5 >= len(all_dates):
            continue

        T_plus_1 = all_dates[idx + 1]
        T_plus_exit = all_dates[min(idx + 6, len(all_dates) - 1)]

        T_str = T.strftime('%Y-%m-%d')
        T_plus_1_str = T_plus_1.strftime('%Y-%m-%d')
        T_exit_str = T_plus_exit.strftime('%Y-%m-%d')

        # ── Screen & Rank Tickers ─────────────────────────────────────────────
        selected_tickers = []
        for ticker in tickers:
            df = indicators.get(ticker)
            if df is None or T not in df.index:
                continue

            close_T = df.loc[T, 'Close']
            volume_T = df.loc[T, 'Volume']
            macd_hist_T = df.loc[T, 'macd_hist']
            macd_slope_T = df.loc[T, 'macd_slope']
            rsi_T = df.loc[T, 'rsi_14']

            if pd.isna(close_T) or pd.isna(volume_T) or pd.isna(macd_hist_T) or pd.isna(macd_slope_T) or pd.isna(rsi_T):
                continue

            # 1. Volume Condition: Vol > 20d Avg & Price Up
            sub_vol = df.loc[:T, 'Volume'].tail(20)
            vol_avg = sub_vol.mean() if not sub_vol.empty else 1.0
            prev_close_T = df.loc[:T, 'Close'].iloc[-2] if len(df.loc[:T, 'Close']) >= 2 else close_T
            if volume_T < vol_avg or close_T < prev_close_T:
                continue

            # 2. RSI Condition: 30 < RSI < 75
            if rsi_T <= 30 or rsi_T >= 75:
                continue

            # 3. MACD Condition: MACD Slope > 0 or MACD Hist > 0
            if macd_slope_T <= 0 and macd_hist_T <= 0:
                continue

            # 4. Trend Condition: OLS Linear Fit Slope % / Std % > 0
            closes_slice = df.loc[:T, 'Close'].dropna()
            slope_pct, std_pct, trend_score = calc_trend_score_py(closes_slice, window=10)
            if trend_score is None or trend_score <= 0:
                continue

            selected_tickers.append((ticker, trend_score, slope_pct, std_pct))

        # Sort by Trend score descending, take top 5
        selected_tickers.sort(key=lambda x: x[1], reverse=True)
        top_5 = selected_tickers[:5]

        # ── Execute 1-Month Call Options (Held 1 Week) ───────────────────────
        daily_profit = 0.0
        traded_items = []

        for ticker, trend_score, slope_pct, std_pct in top_5:
            try:
                df = indicators.get(ticker)
                if df is None:
                    continue

                # ── Underlying Entry Price (T+1 3:00 PM or daily close) ───────
                buy_dt = pd.Timestamp(f"{T_plus_1_str} 15:00:00", tz='America/New_York')
                underlying_entry = None
                if buy_dt in data_30m.index:
                    v = data_30m.loc[buy_dt, ('Open', ticker)]
                    if pd.notna(v):
                        underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    if T_plus_1 in daily_data.index:
                        v = daily_data.loc[T_plus_1, ('Close', ticker)]
                        if pd.notna(v):
                            underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    continue

                # ── Underlying Exit Price (T+exit daily close) ────────────────
                underlying_exit = None
                if T_plus_exit in daily_data.index:
                    v = daily_data.loc[T_plus_exit, ('Close', ticker)]
                    if pd.notna(v):
                        underlying_exit = float(v)
                if underlying_exit is None or underlying_exit <= 0:
                    continue

                # ── Historical Volatility at T ────────────────────────────────
                closes_up_to_T = df.loc[:T, 'Close'].dropna()
                sigma = calc_historical_volatility(closes_up_to_T, window=30)

                # ── Option Parameters ─────────────────────────────────────────
                strike = get_atm_strike(underlying_entry)
                entry_time_years = OPTION_EXPIRY_DAYS / 365.0       # 30 days = 0.0822 yrs
                exit_time_years = (OPTION_EXPIRY_DAYS - HOLDING_DAYS) / 365.0  # 23 days = 0.0630 yrs

                # ── Option Entry Premium (Black-Scholes 30-day Call) ─────────
                entry_premium = black_scholes_call(
                    S=underlying_entry,
                    K=strike,
                    T_years=entry_time_years,
                    r=RISK_FREE_RATE,
                    sigma=sigma
                )
                if entry_premium <= 0:
                    continue

                contracts = int(CAPITAL_PER_TRADE / (entry_premium * 100))
                if contracts < 1:
                    contracts = 1

                cost_of_position = contracts * entry_premium * 100
                if cost_of_position > CAPITAL_PER_TRADE * 1.5:
                    continue

                # ── Option Exit Premium (Black-Scholes 23-day Call) ──────────
                exit_premium = black_scholes_call(
                    S=underlying_exit,
                    K=strike,
                    T_years=exit_time_years,
                    r=RISK_FREE_RATE,
                    sigma=sigma
                )

                exit_value = contracts * exit_premium * 100
                profit = exit_value - cost_of_position
                daily_profit += profit

                underlying_pct_change = ((underlying_exit - underlying_entry) / underlying_entry) * 100.0
                leverage_multiple = (profit / cost_of_position) if cost_of_position > 0 else 0.0
                expiry_display = (T_plus_1.date() + datetime.timedelta(days=OPTION_EXPIRY_DAYS)).strftime('%Y-%m-%d')

                traded_items.append({
                    "ticker": ticker,
                    "strike": float(strike),
                    "expiry_date": expiry_display,
                    "underlying_entry": float(underlying_entry),
                    "underlying_exit": float(underlying_exit),
                    "underlying_pct_change": float(underlying_pct_change),
                    "entry_premium": float(entry_premium),
                    "exit_premium": float(exit_premium),
                    "contracts": contracts,
                    "cost_of_position": float(cost_of_position),
                    "exit_value": float(exit_value),
                    "profit": float(profit),
                    "leverage_multiple": float(leverage_multiple),
                    "trend_score": float(trend_score),
                    "slope_pct": float(slope_pct) if slope_pct is not None else 0.0,
                    "std_pct": float(std_pct) if std_pct is not None else 0.0,
                    "iv_used": float(sigma)
                })

            except Exception as e:
                print(f"[TREND OPTIONS BACKTEST] Error on ticker {ticker} for {T_str}: {e}")
                continue

        total_profit += daily_profit

        # ── Index returns ─────────────────────────────────────────────────────
        dow_ret = 0.0
        sp_ret = 0.0
        nasdaq_ret = 0.0
        if daily_data is not None and not daily_data.empty:
            try:
                if T_plus_1 in daily_data.index and T_plus_exit in daily_data.index:
                    for symbol, name in [('^DJI', 'dow'), ('^GSPC', 'sp'), ('^NDX', 'nasdaq')]:
                        if ('Close', symbol) in daily_data.columns or ('Close' in daily_data and symbol in daily_data['Close']):
                            p_start = daily_data.loc[T_plus_1, ('Close', symbol)]
                            p_end = daily_data.loc[T_plus_exit, ('Close', symbol)]
                            if pd.notna(p_start) and pd.notna(p_end) and p_start > 0:
                                val = float((p_end - p_start) / p_start * 100.0)
                                if name == 'dow': dow_ret = val
                                elif name == 'sp': sp_ret = val
                                elif name == 'nasdaq': nasdaq_ret = val
            except Exception as e:
                print(f"[TREND OPTIONS BACKTEST] Error calculating index returns for {T_str}: {e}")

        trades_ledger.append({
            "screen_date": T_str,
            "buy_date": T_plus_1_str,
            "sell_date": T_exit_str,
            "tickers": traded_items,
            "daily_profit": float(daily_profit),
            "dow_return": dow_ret,
            "sp_return": sp_ret,
            "nasdaq_return": nasdaq_ret
        })

    roi_pct = (total_profit / 10000.0) * 100.0

    sp500_pct_change = 0.0
    try:
        if len(trading_days) > 0 and '^GSPC' in daily_data['Close'].columns:
            first_day = trading_days[0]
            last_day = pd.Timestamp(trades_ledger[-1]["sell_date"]) if trades_ledger else trading_days[-1]
            sp500_closes = daily_data['Close']['^GSPC'].dropna()
            start_series = sp500_closes[sp500_closes.index <= first_day]
            sp500_start = float(start_series.iloc[-1]) if not start_series.empty else float(sp500_closes.iloc[0])
            end_series = sp500_closes[sp500_closes.index <= last_day]
            sp500_end = float(end_series.iloc[-1]) if not end_series.empty else float(sp500_closes.iloc[-1])
            if sp500_start > 0:
                sp500_pct_change = float(((sp500_end - sp500_start) / sp500_start) * 100.0)
    except Exception as e:
        print(f"[TREND OPTIONS BACKTEST] Error calculating S&P 500 % change: {e}")

    return {
        "total_profit": float(total_profit),
        "roi_pct": float(roi_pct),
        "sp500_pct_change": float(sp500_pct_change),
        "strategy_name": "Trend-Filtered 1-Month Call Options (1-Wk Hold)",
        "trades": trades_ledger
    }


def execute_slope_options_backtest(period: str = "1m", slope_period: str = "2w") -> dict:
    """
    Slope % Filtered 1-Month Call Options Strategy Backtest.
    Screening Criteria on Day T:
      - Volume: Volume > 20d Avg & Price >= Prev Close
      - RSI: Bullish RSI range (30 < RSI < 75)
      - MACD: Positive momentum (MACD Slope > 0 or MACD Hist > 0)
      - Slope %: Positive OLS linear fit slope % (Slope % > 0) based on selected matrix timeframe (1Wk, 2Wk, 4Wk, 6Wk, 3M, 6M)
      - Selection: Rank qualified tickers by Slope % descending and select top 5

    Trade Specs:
      - Buy 1-month ATM CALL options ($2,000 capital per position) at entry date (T+1) using Black-Scholes.
      - Exit 1 week later (T+7 calendar days / 5 trading days) with 23 days remaining to expiry.
      - Re-price options via Black-Scholes formula at exit.
      - Cumulative P&L, ROI %, and full transaction ledger maintained.
    """
    tickers = load_universe_tickers()
    indicators, daily_data, data_30m = get_backtest_data(tickers)

    PERIOD_DAYS_MAP = {
        "1w": 7,
        "1m": 30,
        "3m": 90,
        "6m": 180,
        "1y": 365
    }
    lookback_days = PERIOD_DAYS_MAP.get(period.lower(), 30)

    SLOPE_WINDOW_MAP = {
        "1w": 5,
        "2w": 10,
        "4w": 20,
        "6w": 30,
        "3m": 63,
        "6m": 126
    }
    slope_window = SLOPE_WINDOW_MAP.get(slope_period.lower(), 10)

    today = datetime.datetime.now().date()
    start_date = today - datetime.timedelta(days=lookback_days)

    all_dates = sorted(list(daily_data.index))
    trading_days = [d for d in all_dates if d.date() >= start_date]

    RISK_FREE_RATE = 0.05          # 5% annual risk-free rate
    CAPITAL_PER_TRADE = 2000.0    # $2,000 per options position
    OPTION_EXPIRY_DAYS = 30       # 1-month expiration (30 calendar days)
    HOLDING_DAYS = 7              # 1-week holding period (7 calendar days)

    trades_ledger = []
    total_profit = 0.0

    for T in trading_days:
        idx = all_dates.index(T)
        # Entry on T+1, Exit 1 week later (T+5 trading days)
        if idx + 5 >= len(all_dates):
            continue

        T_plus_1 = all_dates[idx + 1]
        T_plus_exit = all_dates[min(idx + 6, len(all_dates) - 1)]

        T_str = T.strftime('%Y-%m-%d')
        T_plus_1_str = T_plus_1.strftime('%Y-%m-%d')
        T_exit_str = T_plus_exit.strftime('%Y-%m-%d')

        # ── Screen & Rank Tickers ─────────────────────────────────────────────
        selected_tickers = []
        for ticker in tickers:
            df = indicators.get(ticker)
            if df is None or T not in df.index:
                continue

            close_T = df.loc[T, 'Close']
            volume_T = df.loc[T, 'Volume']
            macd_hist_T = df.loc[T, 'macd_hist']
            macd_slope_T = df.loc[T, 'macd_slope']
            rsi_T = df.loc[T, 'rsi_14']

            if pd.isna(close_T) or pd.isna(volume_T) or pd.isna(macd_hist_T) or pd.isna(macd_slope_T) or pd.isna(rsi_T):
                continue

            # 1. Volume Condition: Vol > 20d Avg & Price Up
            sub_vol = df.loc[:T, 'Volume'].tail(20)
            vol_avg = sub_vol.mean() if not sub_vol.empty else 1.0
            prev_close_T = df.loc[:T, 'Close'].iloc[-2] if len(df.loc[:T, 'Close']) >= 2 else close_T
            if volume_T < vol_avg or close_T < prev_close_T:
                continue

            # 2. RSI Condition: 30 < RSI < 75
            if rsi_T <= 30 or rsi_T >= 75:
                continue

            # 3. MACD Condition: MACD Slope > 0 or MACD Hist > 0
            if macd_slope_T <= 0 and macd_hist_T <= 0:
                continue

            # 4. Slope Condition: OLS Linear Fit Slope % > 0 over selected slope_window
            closes_slice = df.loc[:T, 'Close'].dropna()
            slope_pct, std_pct, trend_score = calc_trend_score_py(closes_slice, window=slope_window)
            if slope_pct is None or slope_pct <= 0:
                continue

            selected_tickers.append((ticker, slope_pct, std_pct, trend_score))

        # Sort by Slope % descending, take top 5
        selected_tickers.sort(key=lambda x: x[1], reverse=True)
        top_5 = selected_tickers[:5]

        # ── Execute 1-Month Call Options (Held 1 Week) ───────────────────────
        daily_profit = 0.0
        traded_items = []

        for ticker, slope_pct, std_pct, trend_score in top_5:
            try:
                df = indicators.get(ticker)
                if df is None:
                    continue

                # ── Underlying Entry Price (T+1 3:00 PM or daily close) ───────
                buy_dt = pd.Timestamp(f"{T_plus_1_str} 15:00:00", tz='America/New_York')
                underlying_entry = None
                if buy_dt in data_30m.index:
                    v = data_30m.loc[buy_dt, ('Open', ticker)]
                    if pd.notna(v):
                        underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    if T_plus_1 in daily_data.index:
                        v = daily_data.loc[T_plus_1, ('Close', ticker)]
                        if pd.notna(v):
                            underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    continue

                # ── Underlying Exit Price (T+exit daily close) ────────────────
                underlying_exit = None
                if T_plus_exit in daily_data.index:
                    v = daily_data.loc[T_plus_exit, ('Close', ticker)]
                    if pd.notna(v):
                        underlying_exit = float(v)
                if underlying_exit is None or underlying_exit <= 0:
                    continue

                # ── Historical Volatility at T ────────────────────────────────
                closes_up_to_T = df.loc[:T, 'Close'].dropna()
                sigma = calc_historical_volatility(closes_up_to_T, window=30)

                # ── Option Parameters ─────────────────────────────────────────
                strike = get_atm_strike(underlying_entry)
                entry_time_years = OPTION_EXPIRY_DAYS / 365.0       # 30 days = 0.0822 yrs
                exit_time_years = (OPTION_EXPIRY_DAYS - HOLDING_DAYS) / 365.0  # 23 days = 0.0630 yrs

                # ── Option Entry Premium (Black-Scholes 30-day Call) ─────────
                entry_premium = black_scholes_call(
                    S=underlying_entry,
                    K=strike,
                    T_years=entry_time_years,
                    r=RISK_FREE_RATE,
                    sigma=sigma
                )
                if entry_premium <= 0:
                    continue

                contracts = int(CAPITAL_PER_TRADE / (entry_premium * 100))
                if contracts < 1:
                    contracts = 1

                cost_of_position = contracts * entry_premium * 100
                if cost_of_position > CAPITAL_PER_TRADE * 1.5:
                    continue

                # ── Option Exit Premium (Black-Scholes 23-day Call) ──────────
                exit_premium = black_scholes_call(
                    S=underlying_exit,
                    K=strike,
                    T_years=exit_time_years,
                    r=RISK_FREE_RATE,
                    sigma=sigma
                )

                exit_value = contracts * exit_premium * 100
                profit = exit_value - cost_of_position
                daily_profit += profit

                underlying_pct_change = ((underlying_exit - underlying_entry) / underlying_entry) * 100.0
                leverage_multiple = (profit / cost_of_position) if cost_of_position > 0 else 0.0
                expiry_display = (T_plus_1.date() + datetime.timedelta(days=OPTION_EXPIRY_DAYS)).strftime('%Y-%m-%d')

                traded_items.append({
                    "ticker": ticker,
                    "strike": float(strike),
                    "expiry_date": expiry_display,
                    "underlying_entry": float(underlying_entry),
                    "underlying_exit": float(underlying_exit),
                    "underlying_pct_change": float(underlying_pct_change),
                    "entry_premium": float(entry_premium),
                    "exit_premium": float(exit_premium),
                    "contracts": contracts,
                    "cost_of_position": float(cost_of_position),
                    "exit_value": float(exit_value),
                    "profit": float(profit),
                    "leverage_multiple": float(leverage_multiple),
                    "slope_pct": float(slope_pct),
                    "std_pct": float(std_pct) if std_pct is not None else 0.0,
                    "trend_score": float(trend_score) if trend_score is not None else 0.0,
                    "iv_used": float(sigma)
                })

            except Exception as e:
                print(f"[SLOPE OPTIONS BACKTEST] Error on ticker {ticker} for {T_str}: {e}")
                continue

        total_profit += daily_profit

        # ── Index returns ─────────────────────────────────────────────────────
        dow_ret = 0.0
        sp_ret = 0.0
        nasdaq_ret = 0.0
        if daily_data is not None and not daily_data.empty:
            try:
                if T_plus_1 in daily_data.index and T_plus_exit in daily_data.index:
                    for symbol, name in [('^DJI', 'dow'), ('^GSPC', 'sp'), ('^NDX', 'nasdaq')]:
                        if ('Close', symbol) in daily_data.columns or ('Close' in daily_data and symbol in daily_data['Close']):
                            p_start = daily_data.loc[T_plus_1, ('Close', symbol)]
                            p_end = daily_data.loc[T_plus_exit, ('Close', symbol)]
                            if pd.notna(p_start) and pd.notna(p_end) and p_start > 0:
                                val = float((p_end - p_start) / p_start * 100.0)
                                if name == 'dow': dow_ret = val
                                elif name == 'sp': sp_ret = val
                                elif name == 'nasdaq': nasdaq_ret = val
            except Exception as e:
                print(f"[SLOPE OPTIONS BACKTEST] Error calculating index returns for {T_str}: {e}")

        trades_ledger.append({
            "screen_date": T_str,
            "buy_date": T_plus_1_str,
            "sell_date": T_exit_str,
            "tickers": traded_items,
            "daily_profit": float(daily_profit),
            "dow_return": dow_ret,
            "sp_return": sp_ret,
            "nasdaq_return": nasdaq_ret
        })

    roi_pct = (total_profit / 10000.0) * 100.0

    sp500_pct_change = 0.0
    try:
        if len(trading_days) > 0 and '^GSPC' in daily_data['Close'].columns:
            first_day = trading_days[0]
            last_day = pd.Timestamp(trades_ledger[-1]["sell_date"]) if trades_ledger else trading_days[-1]
            sp500_closes = daily_data['Close']['^GSPC'].dropna()
            start_series = sp500_closes[sp500_closes.index <= first_day]
            sp500_start = float(start_series.iloc[-1]) if not start_series.empty else float(sp500_closes.iloc[0])
            end_series = sp500_closes[sp500_closes.index <= last_day]
            sp500_end = float(end_series.iloc[-1]) if not end_series.empty else float(sp500_closes.iloc[-1])
            if sp500_start > 0:
                sp500_pct_change = float(((sp500_end - sp500_start) / sp500_start) * 100.0)
    except Exception as e:
        print(f"[SLOPE OPTIONS BACKTEST] Error calculating S&P 500 % change: {e}")

    return {
        "total_profit": float(total_profit),
        "roi_pct": float(roi_pct),
        "sp500_pct_change": float(sp500_pct_change),
        "strategy_name": f"Slope % Filtered 1-Month Call Options (1-Wk Hold, {slope_period.upper()} Matrix Window)",
        "slope_period": slope_period,
        "trades": trades_ledger
    }


def execute_slope_options_2day_backtest(period: str = "1m", slope_period: str = "2w") -> dict:
    """
    Slope % Filtered 1-Month Call Options Strategy Backtest (2-Day Holding Period).
    Screening Criteria on Day T:
      - Volume: Volume > 20d Avg & Price >= Prev Close
      - RSI: Bullish RSI range (30 < RSI < 75)
      - MACD: Positive momentum (MACD Slope > 0 or MACD Hist > 0)
      - Slope %: Positive OLS linear fit slope % (Slope % > 0) based on selected matrix timeframe (1Wk, 2Wk, 4Wk, 6Wk, 3M, 6M)
      - Selection: Rank qualified tickers by Slope % descending and select top 5

    Trade Specs:
      - Buy 1-month ATM CALL options ($2,000 capital per position) at entry date (T+1) using Black-Scholes.
      - Exit 2 days later (T+2 / 28 days remaining to expiry).
      - Re-price options via Black-Scholes formula at exit.
      - Cumulative P&L, ROI %, and full transaction ledger maintained.
    """
    tickers = load_universe_tickers()
    indicators, daily_data, data_30m = get_backtest_data(tickers)

    PERIOD_DAYS_MAP = {
        "1w": 7,
        "1m": 30,
        "3m": 90,
        "6m": 180,
        "1y": 365
    }
    lookback_days = PERIOD_DAYS_MAP.get(period.lower(), 30)

    SLOPE_WINDOW_MAP = {
        "1w": 5,
        "2w": 10,
        "4w": 20,
        "6w": 30,
        "3m": 63,
        "6m": 126
    }
    slope_window = SLOPE_WINDOW_MAP.get(slope_period.lower(), 10)

    today = datetime.datetime.now().date()
    start_date = today - datetime.timedelta(days=lookback_days)

    all_dates = sorted(list(daily_data.index))
    trading_days = [d for d in all_dates if d.date() >= start_date]

    RISK_FREE_RATE = 0.05          # 5% annual risk-free rate
    CAPITAL_PER_TRADE = 2000.0    # $2,000 per options position
    OPTION_EXPIRY_DAYS = 30       # 1-month expiration (30 calendar days)
    HOLDING_DAYS = 2              # 2-day holding period (2 calendar days)

    trades_ledger = []
    total_profit = 0.0

    for T in trading_days:
        idx = all_dates.index(T)
        # Entry on T+1, Exit 2 days later (T+2 trading day)
        if idx + 2 >= len(all_dates):
            continue

        T_plus_1 = all_dates[idx + 1]
        T_plus_exit = all_dates[idx + 2]

        T_str = T.strftime('%Y-%m-%d')
        T_plus_1_str = T_plus_1.strftime('%Y-%m-%d')
        T_exit_str = T_plus_exit.strftime('%Y-%m-%d')

        # ── Screen & Rank Tickers ─────────────────────────────────────────────
        selected_tickers = []
        for ticker in tickers:
            df = indicators.get(ticker)
            if df is None or T not in df.index:
                continue

            close_T = df.loc[T, 'Close']
            volume_T = df.loc[T, 'Volume']
            macd_hist_T = df.loc[T, 'macd_hist']
            macd_slope_T = df.loc[T, 'macd_slope']
            rsi_T = df.loc[T, 'rsi_14']

            if pd.isna(close_T) or pd.isna(volume_T) or pd.isna(macd_hist_T) or pd.isna(macd_slope_T) or pd.isna(rsi_T):
                continue

            # 1. Volume Condition: Vol > 20d Avg & Price Up
            sub_vol = df.loc[:T, 'Volume'].tail(20)
            vol_avg = sub_vol.mean() if not sub_vol.empty else 1.0
            prev_close_T = df.loc[:T, 'Close'].iloc[-2] if len(df.loc[:T, 'Close']) >= 2 else close_T
            if volume_T < vol_avg or close_T < prev_close_T:
                continue

            # 2. RSI Condition: 30 < RSI < 75
            if rsi_T <= 30 or rsi_T >= 75:
                continue

            # 3. MACD Condition: MACD Slope > 0 or MACD Hist > 0
            if macd_slope_T <= 0 and macd_hist_T <= 0:
                continue

            # 4. Slope Condition: OLS Linear Fit Slope % > 0 over selected slope_window
            closes_slice = df.loc[:T, 'Close'].dropna()
            slope_pct, std_pct, trend_score = calc_trend_score_py(closes_slice, window=slope_window)
            if slope_pct is None or slope_pct <= 0:
                continue

            selected_tickers.append((ticker, slope_pct, std_pct, trend_score))

        # Sort by Slope % descending, take top 5
        selected_tickers.sort(key=lambda x: x[1], reverse=True)
        top_5 = selected_tickers[:5]

        # ── Execute 1-Month Call Options (Held 2 Days) ───────────────────────
        daily_profit = 0.0
        traded_items = []

        for ticker, slope_pct, std_pct, trend_score in top_5:
            try:
                df = indicators.get(ticker)
                if df is None:
                    continue

                # ── Underlying Entry Price (T+1 3:00 PM or daily close) ───────
                buy_dt = pd.Timestamp(f"{T_plus_1_str} 15:00:00", tz='America/New_York')
                underlying_entry = None
                if buy_dt in data_30m.index:
                    v = data_30m.loc[buy_dt, ('Open', ticker)]
                    if pd.notna(v):
                        underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    if T_plus_1 in daily_data.index:
                        v = daily_data.loc[T_plus_1, ('Close', ticker)]
                        if pd.notna(v):
                            underlying_entry = float(v)
                if underlying_entry is None or underlying_entry <= 0:
                    continue

                # ── Underlying Exit Price (T+exit daily close) ────────────────
                underlying_exit = None
                if T_plus_exit in daily_data.index:
                    v = daily_data.loc[T_plus_exit, ('Close', ticker)]
                    if pd.notna(v):
                        underlying_exit = float(v)
                if underlying_exit is None or underlying_exit <= 0:
                    continue

                # ── Historical Volatility at T ────────────────────────────────
                closes_up_to_T = df.loc[:T, 'Close'].dropna()
                sigma = calc_historical_volatility(closes_up_to_T, window=30)

                # ── Option Parameters ─────────────────────────────────────────
                strike = get_atm_strike(underlying_entry)
                entry_time_years = OPTION_EXPIRY_DAYS / 365.0       # 30 days = 0.0822 yrs
                exit_time_years = (OPTION_EXPIRY_DAYS - HOLDING_DAYS) / 365.0  # 28 days = 0.0767 yrs

                # ── Option Entry Premium (Black-Scholes 30-day Call) ─────────
                entry_premium = black_scholes_call(
                    S=underlying_entry,
                    K=strike,
                    T_years=entry_time_years,
                    r=RISK_FREE_RATE,
                    sigma=sigma
                )
                if entry_premium <= 0:
                    continue

                contracts = int(CAPITAL_PER_TRADE / (entry_premium * 100))
                if contracts < 1:
                    contracts = 1

                cost_of_position = contracts * entry_premium * 100
                if cost_of_position > CAPITAL_PER_TRADE * 1.5:
                    continue

                # ── Option Exit Premium (Black-Scholes 28-day Call) ──────────
                exit_premium = black_scholes_call(
                    S=underlying_exit,
                    K=strike,
                    T_years=exit_time_years,
                    r=RISK_FREE_RATE,
                    sigma=sigma
                )

                exit_value = contracts * exit_premium * 100
                profit = exit_value - cost_of_position
                daily_profit += profit

                underlying_pct_change = ((underlying_exit - underlying_entry) / underlying_entry) * 100.0
                leverage_multiple = (profit / cost_of_position) if cost_of_position > 0 else 0.0
                expiry_display = (T_plus_1.date() + datetime.timedelta(days=OPTION_EXPIRY_DAYS)).strftime('%Y-%m-%d')

                traded_items.append({
                    "ticker": ticker,
                    "strike": float(strike),
                    "expiry_date": expiry_display,
                    "underlying_entry": float(underlying_entry),
                    "underlying_exit": float(underlying_exit),
                    "underlying_pct_change": float(underlying_pct_change),
                    "entry_premium": float(entry_premium),
                    "exit_premium": float(exit_premium),
                    "contracts": contracts,
                    "cost_of_position": float(cost_of_position),
                    "exit_value": float(exit_value),
                    "profit": float(profit),
                    "leverage_multiple": float(leverage_multiple),
                    "slope_pct": float(slope_pct),
                    "std_pct": float(std_pct) if std_pct is not None else 0.0,
                    "trend_score": float(trend_score) if trend_score is not None else 0.0,
                    "iv_used": float(sigma)
                })

            except Exception as e:
                print(f"[SLOPE 2-DAY OPTIONS BACKTEST] Error on ticker {ticker} for {T_str}: {e}")
                continue

        total_profit += daily_profit

        # ── Index returns ─────────────────────────────────────────────────────
        dow_ret = 0.0
        sp_ret = 0.0
        nasdaq_ret = 0.0
        if daily_data is not None and not daily_data.empty:
            try:
                if T_plus_1 in daily_data.index and T_plus_exit in daily_data.index:
                    for symbol, name in [('^DJI', 'dow'), ('^GSPC', 'sp'), ('^NDX', 'nasdaq')]:
                        if ('Close', symbol) in daily_data.columns or ('Close' in daily_data and symbol in daily_data['Close']):
                            p_start = daily_data.loc[T_plus_1, ('Close', symbol)]
                            p_end = daily_data.loc[T_plus_exit, ('Close', symbol)]
                            if pd.notna(p_start) and pd.notna(p_end) and p_start > 0:
                                val = float((p_end - p_start) / p_start * 100.0)
                                if name == 'dow': dow_ret = val
                                elif name == 'sp': sp_ret = val
                                elif name == 'nasdaq': nasdaq_ret = val
            except Exception as e:
                print(f"[SLOPE 2-DAY OPTIONS BACKTEST] Error calculating index returns for {T_str}: {e}")

        trades_ledger.append({
            "screen_date": T_str,
            "buy_date": T_plus_1_str,
            "sell_date": T_exit_str,
            "tickers": traded_items,
            "daily_profit": float(daily_profit),
            "dow_return": dow_ret,
            "sp_return": sp_ret,
            "nasdaq_return": nasdaq_ret
        })

    roi_pct = (total_profit / 10000.0) * 100.0

    sp500_pct_change = 0.0
    try:
        if len(trading_days) > 0 and '^GSPC' in daily_data['Close'].columns:
            first_day = trading_days[0]
            last_day = pd.Timestamp(trades_ledger[-1]["sell_date"]) if trades_ledger else trading_days[-1]
            sp500_closes = daily_data['Close']['^GSPC'].dropna()
            start_series = sp500_closes[sp500_closes.index <= first_day]
            sp500_start = float(start_series.iloc[-1]) if not start_series.empty else float(sp500_closes.iloc[0])
            end_series = sp500_closes[sp500_closes.index <= last_day]
            sp500_end = float(end_series.iloc[-1]) if not end_series.empty else float(sp500_closes.iloc[-1])
            if sp500_start > 0:
                sp500_pct_change = float(((sp500_end - sp500_start) / sp500_start) * 100.0)
    except Exception as e:
        print(f"[SLOPE 2-DAY OPTIONS BACKTEST] Error calculating S&P 500 % change: {e}")

    return {
        "total_profit": float(total_profit),
        "roi_pct": float(roi_pct),
        "sp500_pct_change": float(sp500_pct_change),
        "strategy_name": f"Slope % Filtered 1-Month Call Options (2-Day Hold, {slope_period.upper()} Matrix Window)",
        "slope_period": slope_period,
        "trades": trades_ledger
    }



