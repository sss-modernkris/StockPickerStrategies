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
        if 'Close' not in data.columns:
            return {"data": [], "error": "Close price data not available."}
            
        close_data = data['Close']
        if isinstance(close_data, pd.Series):
            close_data = pd.DataFrame({tickers[0]: close_data})
            
        volume_data = data['Volume'] if 'Volume' in data.columns else None
        if isinstance(volume_data, pd.Series):
            volume_data = pd.DataFrame({tickers[0]: volume_data})

        for ticker in tickers:
            if ticker in close_data.columns:
                ticker_series = close_data[ticker]
                if isinstance(ticker_series, pd.DataFrame):
                    ticker_series = ticker_series.iloc[:, 0]
                ticker_series = ticker_series.dropna()
                
                vol_series = None
                if volume_data is not None and ticker in volume_data.columns:
                    vol_series = volume_data[ticker]
                    if isinstance(vol_series, pd.DataFrame):
                        vol_series = vol_series.iloc[:, 0]

                history = []
                for date, close_price in ticker_series.items():
                    vol_val = None
                    if vol_series is not None and date in vol_series.index and not pd.isna(vol_series.loc[date]):
                        vol_val = float(vol_series.loc[date])
                    
                    item = {
                        "date": date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10],
                        "close": float(close_price)
                    }
                    if vol_val is not None:
                        item["volume"] = vol_val
                    history.append(item)
                    
                results.append({
                    "symbol": ticker,
                    "history": history
                })

        return {"data": results}

    except Exception as e:
        return {"data": [], "error": str(e)}
