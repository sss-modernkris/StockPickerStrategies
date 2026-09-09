import yfinance as yf
import pandas as pd
from typing import List, Dict, Any

def fetch_batch_history(tickers: List[str], period: str = "1y") -> Dict[str, Any]:
    """
    Fetches historical data for multiple tickers at once.
    Period can be "1mo", "3mo", "6mo", "1y", "5y", etc.
    Normalizes symbols (e.g. BRK.B -> BRK-B) for yfinance and maps results back to requested symbols.
    """
    if not tickers:
        return {"data": []}

    try:
        # Create map from requested symbol to yfinance symbol (dots to hyphens)
        ticker_map = {t.strip().upper(): t.strip().upper().replace('.', '-') for t in tickers if t.strip()}
        download_tickers = list(set(ticker_map.values()))
        tickers_str = " ".join(download_tickers)
        
        data = yf.download(tickers_str, period=period, group_by='column', progress=False, threads=False)
        
        if data.empty:
            return {"data": [], "error": "No data returned from Yahoo Finance."}

        results = []
        if 'Close' not in data.columns:
            return {"data": [], "error": "Close price data not available."}
            
        close_data = data['Close']
        if isinstance(close_data, pd.Series):
            first_yf_sym = download_tickers[0]
            close_data = pd.DataFrame({first_yf_sym: close_data})
            
        volume_data = data['Volume'] if 'Volume' in data.columns else None
        if isinstance(volume_data, pd.Series):
            first_yf_sym = download_tickers[0]
            volume_data = pd.DataFrame({first_yf_sym: volume_data})

        for original_ticker, yf_ticker in ticker_map.items():
            found_col = None
            if yf_ticker in close_data.columns:
                found_col = yf_ticker
            elif original_ticker in close_data.columns:
                found_col = original_ticker

            if found_col is not None:
                ticker_series = close_data[found_col]
                if isinstance(ticker_series, pd.DataFrame):
                    ticker_series = ticker_series.iloc[:, 0]
                ticker_series = ticker_series.dropna()
                
                vol_series = None
                if volume_data is not None:
                    vol_col = found_col if found_col in volume_data.columns else (yf_ticker if yf_ticker in volume_data.columns else None)
                    if vol_col:
                        vol_series = volume_data[vol_col]
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
                    "symbol": original_ticker,
                    "history": history
                })

        return {"data": results}

    except Exception as e:
        return {"data": [], "error": str(e)}

