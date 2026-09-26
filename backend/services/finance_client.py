import yfinance as yf
import pandas as pd
from typing import Dict, Any, Optional

def fetch_ticker_data(ticker_symbol: str) -> Dict[str, Any]:
    """
    Fetches comprehensive data for a given ticker using yfinance.
    Normalizes ticker symbols (e.g. BRK.B -> BRK-B) and handles rate-limits gracefully.
    """
    clean_symbol = ticker_symbol.strip().upper()
    symbol_to_fetch = clean_symbol.replace('.', '-')
    
    ticker = yf.Ticker(symbol_to_fetch)
    
    # 1. Historical data (2 years for rolling ML feature calculation)
    history = None
    try:
        history = ticker.history(period="2y")
    except Exception as e:
        history = None

    if history is None or history.empty:
        try:
            # Fallback to yf.download if ticker.history is empty or rate limited
            dl = yf.download(symbol_to_fetch, period="2y", progress=False)
            if not dl.empty:
                if isinstance(dl.columns, pd.MultiIndex):
                    if symbol_to_fetch in dl.columns.levels[1]:
                        dl = dl.xs(symbol_to_fetch, level=1, axis=1)
                    else:
                        dl = dl.iloc[:, :6]
                history = dl
        except Exception:
            pass

    if history is None:
        history = pd.DataFrame()
    elif not history.empty:
        if isinstance(history.columns, pd.MultiIndex):
            try:
                if symbol_to_fetch in history.columns.levels[1]:
                    history = history.xs(symbol_to_fetch, level=1, axis=1)
                else:
                    history.columns = history.columns.get_level_values(0)
            except Exception:
                history.columns = history.columns.get_level_values(0)

        clean_cols = {}
        for col in history.columns:
            col_data = history[col]
            if isinstance(col_data, pd.DataFrame):
                col_data = col_data.iloc[:, 0]
            clean_cols[col] = col_data

        history = pd.DataFrame(clean_cols)

    # 2. Financials & Info (wrap in try-except to avoid rate-limiting/scraper failures)
    info = {}
    try:
        info = ticker.info or {}
    except Exception:
        info = {"symbol": clean_symbol, "shortName": clean_symbol}

    financials = None
    try:
        financials = ticker.financials
    except Exception:
        financials = pd.DataFrame()

    balance_sheet = None
    try:
        balance_sheet = ticker.balance_sheet
    except Exception:
        balance_sheet = pd.DataFrame()

    cashflow = None
    try:
        cashflow = ticker.cashflow
    except Exception:
        cashflow = pd.DataFrame()

    return {
        "symbol": clean_symbol,
        "history": history,
        "info": info,
        "financials": financials,
        "balance_sheet": balance_sheet,
        "cashflow": cashflow
    }

