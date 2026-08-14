import os
import csv
import time
import datetime
import pandas as pd
import yfinance as yf
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
    
    # 1. Download daily data
    daily_data = yf.download(tickers, period="1y", interval="1d", progress=False)
    
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

def execute_30d_backtest(strategy_num: int = 1) -> dict:
    tickers = load_universe_tickers()
    indicators, daily_data, data_30m = get_backtest_data(tickers)
    
    # Define the 30 calendar days window
    today = datetime.datetime.now().date()
    start_date = today - datetime.timedelta(days=30)
    
    all_dates = sorted(list(daily_data.index))
    trading_days = [d for d in all_dates if d.date() >= start_date]
    
    # Download index data for benchmarking
    index_symbols = ['^DJI', '^GSPC', '^NDX']
    try:
        index_data = yf.download(index_symbols, period="1y", interval="1d", progress=False)
    except Exception as e:
        print(f"[BACKTEST] Error downloading index data: {e}")
        index_data = pd.DataFrame()

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
        
        if not index_data.empty:
            try:
                if T_plus_1 in index_data.index and T_plus_2 in index_data.index:
                    for symbol, name in [('^DJI', 'dow'), ('^GSPC', 'sp'), ('^NDX', 'nasdaq')]:
                        p_start = index_data.loc[T_plus_1, ('Close', symbol)]
                        p_end = index_data.loc[T_plus_2, ('Close', symbol)]
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

    # Calculate overall index ROI over the entire backtest window
    dow_overall = 0.0
    sp_overall = 0.0
    nasdaq_overall = 0.0
    
    if not index_data.empty:
        valid_days = []
        for T in trading_days:
            idx = all_dates.index(T)
            if idx + 2 >= len(all_dates):
                continue
            valid_days.append((all_dates[idx + 1], all_dates[idx + 2]))
            
        if valid_days:
            first_entry = valid_days[0][0]
            last_exit = valid_days[-1][1]
            try:
                if first_entry in index_data.index and last_exit in index_data.index:
                    for symbol, name in [('^DJI', 'dow'), ('^GSPC', 'sp'), ('^NDX', 'nasdaq')]:
                        p_start = index_data.loc[first_entry, ('Close', symbol)]
                        p_end = index_data.loc[last_exit, ('Close', symbol)]
                        if pd.notna(p_start) and pd.notna(p_end) and p_start > 0:
                            val = float((p_end - p_start) / p_start * 100.0)
                            if name == 'dow': dow_overall = val
                            elif name == 'sp': sp_overall = val
                            elif name == 'nasdaq': nasdaq_overall = val
            except Exception as e:
                print(f"[BACKTEST] Error calculating overall index returns: {e}")
    
    return {
        "total_profit": float(total_profit),
        "roi_pct": float(roi_pct),
        "dow_roi_pct": dow_overall,
        "sp_roi_pct": sp_overall,
        "nasdaq_roi_pct": nasdaq_overall,
        "trades": trades_ledger
    }
