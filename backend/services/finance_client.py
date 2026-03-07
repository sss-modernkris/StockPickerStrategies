import yfinance as yf
import pandas as pd
from typing import Dict, Any, Optional

def fetch_ticker_data(ticker_symbol: str) -> Dict[str, Any]:
    """
    Fetches comprehensive data for a given ticker using yfinance.
    Runs synchronously but FastAPI will execute this in a threadpool to avoid blocking.
    """
    ticker = yf.Ticker(ticker_symbol)
    
    # 1. Historical data (2 years for rolling ML feature calculation)
    history = ticker.history(period="2y")
    
    # 2. Financials (Income Statement, Balance Sheet, Cash Flow)
    # yfinance returns DataFrames where columns are dates, we take the most recent
    
    info = ticker.info
    
    # We will need fundamentals for strategy formulas
    # Some fields may be missing, we handle that gracefully downstream.
    
    return {
        "symbol": ticker_symbol,
        "history": history,
        "info": info,
        "financials": ticker.financials,
        "balance_sheet": ticker.balance_sheet,
        "cashflow": ticker.cashflow
    }
