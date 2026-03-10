import yfinance as yf
import pandas as pd
from typing import List, Dict, Any

def fetch_batch_history(tickers: List[str], period: str = "1y") -> Dict[str, Any]:
    """
    Fetches historical data for multiple tickers at once.
    Period can be "1mo", "3mo", "6mo", "1y", "5y", etc.
    """
    if not tickers:
        return {"data": []}

    try:
        # download automatically handles multiple tickers
        # It returns a MultiIndex DataFrame if len(tickers) > 1, else a regular DataFrame
        tickers_str = " ".join(tickers)
        data = yf.download(tickers_str, period=period, group_by='column', progress=False, threads=False)
        
        # If there's an error fetching the data, yfinance might not raise an exception,
        # but the dataframe could be empty
        if data.empty:
            return {"data": [], "error": "No data returned from Yahoo Finance."}

        results = []
        
        if len(tickers) == 1:
            ticker = tickers[0]
            # When downloading a single ticker, the columns are just 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume'
            # Drop NaN rows which might appear on holidays, etc.
            valid_data = data['Close'].dropna()
            
            history = []
            for date, close_price in valid_data.items():
                history.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "close": float(close_price)
                })
                
            results.append({
                "symbol": ticker,
                "history": history
            })
        else:
            # Handle MultiIndex columns (Price Type, Ticker)
            # We just want the 'Close' column for each ticker
            
            # yfinance returns MultiIndex like: ('Close', 'AAPL'), ('Close', 'MSFT')
            if 'Close' not in data.columns:
               return {"data": [], "error": "Close price data not available."}
               
            close_data = data['Close']
            
            for ticker in tickers:
                if ticker in close_data.columns:
                    ticker_series = close_data[ticker].dropna()
                    
                    history = []
                    for date, close_price in ticker_series.items():
                        history.append({
                            "date": date.strftime("%Y-%m-%d"),
                            "close": float(close_price)
                        })
                        
                    results.append({
                        "symbol": ticker,
                        "history": history
                    })

        return {"data": results}

    except Exception as e:
        return {"data": [], "error": str(e)}
