import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import yfinance as yf
import pandas as pd
import numpy as np
import datetime
from strategies.willy_algo import calculate_willy_vwap

def run_willy_backtest_py(prices_slice, initial_capital=10000.0):
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
            if pd.notna(willy_vwap) and close < willy_vwap:
                cash = shares * close
                shares = 0.0
                is_holding = False
        else:
            prev_was_below = pd.isna(prev_willy_vwap) or prev_close <= prev_willy_vwap
            curr_is_above = pd.notna(willy_vwap) and close > willy_vwap
            if curr_is_above and prev_was_below:
                shares = cash / close
                cash = 0.0
                is_holding = True
    last_close = prices_slice['Close'].iloc[-1]
    return (shares * last_close) if is_holding else cash

def dry_run():
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN"]
    
    # 1. Download daily data
    print("Downloading daily data...")
    daily_data = yf.download(tickers, period="1y", interval="1d")
    
    # 2. Download 30m data
    print("Downloading 30m data...")
    data_30m = yf.download(tickers, period="1mo", interval="30m")
    data_30m.index = data_30m.index.tz_convert('America/New_York')
    
    # Calculate indicators for each ticker
    indicators = {}
    for ticker in tickers:
        df = pd.DataFrame(index=daily_data.index)
        df['Close'] = daily_data['Close'][ticker]
        df['High'] = daily_data['High'][ticker]
        df['Low'] = daily_data['Low'][ticker]
        df['Volume'] = daily_data['Volume'][ticker]
        
        # Calculate Willy VWAP
        df['willy_vwap'] = calculate_willy_vwap(df)
        
        # MACD
        closes = df['Close']
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

    # Find trading days in the last 30 calendar days
    today = datetime.datetime.now().date()
    start_date = today - datetime.timedelta(days=30)
    
    all_dates = sorted(list(daily_data.index))
    trading_days = [d for d in all_dates if d.date() >= start_date]
    
    print(f"Trading days in the last 30 calendar days: {len(trading_days)}")
    
    total_profit = 0.0
    
    for T in trading_days:
        idx = all_dates.index(T)
        if idx + 2 >= len(all_dates):
            continue
            
        T_plus_1 = all_dates[idx + 1]
        T_plus_2 = all_dates[idx + 2]
        
        print(f"\nEvaluating Screen on: {T.strftime('%Y-%m-%d')}")
        print(f"Buy on: {T_plus_1.strftime('%Y-%m-%d')} at 15:00:00")
        print(f"Sell on: {T_plus_2.strftime('%Y-%m-%d')} at 11:00:00")
        
        selected_tickers = []
        for ticker in tickers:
            df = indicators[ticker]
            # Get values as of day T
            close_T = df.loc[T, 'Close']
            willy_vwap_T = df.loc[T, 'willy_vwap']
            macd_hist_T = df.loc[T, 'macd_hist']
            macd_slope_T = df.loc[T, 'macd_slope']
            rsi_T = df.loc[T, 'rsi_14']
            
            if pd.isna(close_T) or pd.isna(willy_vwap_T) or pd.isna(macd_hist_T) or pd.isna(macd_slope_T) or pd.isna(rsi_T):
                continue
                
            # Run screen criteria
            # 1. Bull: Close > willy_vwap
            if close_T <= willy_vwap_T:
                continue
            # 2. Strategy Value > 10000 (1-week backtest ending on T)
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
                
            # Calculate Strategy Value (4-month backtest ending on T) for ranking
            four_months_start = T - datetime.timedelta(days=120)
            slice_4m = df.loc[four_months_start:T]
            strat_val_4m = run_willy_backtest_py(slice_4m, 10000.0)
            
            selected_tickers.append((ticker, strat_val_4m))
            
        # Rank by strategy value descending
        selected_tickers.sort(key=lambda x: x[1], reverse=True)
        top_5 = selected_tickers[:5]
        
        print("Selected Tickers:", top_5)
        
        # Run trade execution
        daily_trades_profit = 0.0
        for ticker, _ in top_5:
            # Entry on T+1 at 3:00 PM (15:00:00)
            buy_dt = pd.Timestamp(f"{T_plus_1.strftime('%Y-%m-%d')} 15:00:00", tz='America/New_York')
            sell_dt = pd.Timestamp(f"{T_plus_2.strftime('%Y-%m-%d')} 11:00:00", tz='America/New_York')
            
            buy_price = None
            sell_price = None
            
            if buy_dt in data_30m.index:
                buy_price = data_30m.loc[buy_dt, ('Open', ticker)]
            if sell_dt in data_30m.index:
                sell_price = data_30m.loc[sell_dt, ('Open', ticker)]
                
            # Fallback if 30m index is missing or NaN
            if pd.isna(buy_price) or buy_price is None:
                buy_price = daily_data.loc[T_plus_1, ('Close', ticker)]
            if pd.isna(sell_price) or sell_price is None:
                sell_price = daily_data.loc[T_plus_2, ('Close', ticker)]
                
            if pd.notna(buy_price) and pd.notna(sell_price) and buy_price > 0:
                shares = 2000.0 / buy_price
                sell_val = shares * sell_price
                profit = sell_val - 2000.0
                daily_trades_profit += profit
                print(f"  {ticker}: Buy at {buy_price:.2f}, Sell at {sell_price:.2f}, Profit: ${profit:.2f}")
                
        total_profit += daily_trades_profit
        print(f"Daily Profit for {T.strftime('%Y-%m-%d')}: ${daily_trades_profit:.2f}")
        
    print(f"\nTotal 30-day Backtest Profit: ${total_profit:.2f}")

if __name__ == "__main__":
    dry_run()
