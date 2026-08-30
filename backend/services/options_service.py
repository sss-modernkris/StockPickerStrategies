import os
import csv
import math
import datetime
import pandas as pd
import numpy as np
import yfinance as yf
from services.backtester import black_scholes_call, black_scholes_put, calc_historical_volatility, get_atm_strike

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(BACKEND_DIR)
OPTIONS_DATA_CSV = os.path.join(BASE_DIR, "OptionsData.csv")

INDEX_FILES = [
    ("DOW100.csv", "Dow 30"),
    ("Nasdaq100.csv", "Nasdaq 100"),
    ("SP100.csv", "S&P 500")
]

def load_index_tickers_map() -> tuple[list[str], dict[str, list[str]]]:
    ticker_to_indexes: dict[str, list[str]] = {}
    
    for filename, index_name in INDEX_FILES:
        path = os.path.join(BASE_DIR, filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    symbol = (row.get('Symbol') or row.get('Ticker', '')).strip().upper()
                    if symbol:
                        symbol = symbol.replace('.', '-')
                        if symbol not in ticker_to_indexes:
                            ticker_to_indexes[symbol] = []
                        if index_name not in ticker_to_indexes[symbol]:
                            ticker_to_indexes[symbol].append(index_name)
                            
    unique_tickers = sorted(list(ticker_to_indexes.keys()))
    return unique_tickers, ticker_to_indexes


def norm_cdf(x: float) -> float:
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0

def norm_pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)

def calculate_option_greeks(
    S: float, 
    K: float, 
    target_days: int, 
    sigma: float, 
    r: float = 0.05
) -> dict:
    """
    Computes Black-Scholes Option Greeks: Delta, Gamma, Theta (per day), Vega (per 1% IV), Rho (per 1% rate).
    """
    T = max(target_days / 365.0, 0.0001)
    sigma = max(sigma, 0.0001)
    sqrt_T = math.sqrt(T)

    d1 = (math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T

    n_d1 = norm_cdf(d1)
    n_d2 = norm_cdf(d2)
    n_minus_d2 = norm_cdf(-d2)
    np_d1 = norm_pdf(d1)

    call_delta = n_d1
    put_delta = n_d1 - 1.0
    gamma = np_d1 / (S * sigma * sqrt_T)
    vega = (S * np_d1 * sqrt_T) / 100.0

    call_theta_ann = -(S * np_d1 * sigma) / (2 * sqrt_T) - r * K * math.exp(-r * T) * n_d2
    put_theta_ann = -(S * np_d1 * sigma) / (2 * sqrt_T) + r * K * math.exp(-r * T) * n_minus_d2

    call_theta = call_theta_ann / 365.0
    put_theta = put_theta_ann / 365.0

    call_rho = (K * T * math.exp(-r * T) * n_d2) / 100.0
    put_rho = (-K * T * math.exp(-r * T) * n_minus_d2) / 100.0

    return {
        "call_delta": round(call_delta, 4),
        "put_delta": round(put_delta, 4),
        "gamma": round(gamma, 4),
        "call_theta": round(call_theta, 4),
        "put_theta": round(put_theta, 4),
        "vega": round(vega, 4),
        "call_rho": round(call_rho, 4),
        "put_rho": round(put_rho, 4)
    }


def get_live_or_bs_option_price(
    ticker_obj: yf.Ticker, 
    symbol: str, 
    stock_price: float, 
    strike: float, 
    target_days: int, 
    closes: pd.Series, 
    risk_free_rate: float = 0.05
) -> tuple[float, float, float, dict]:
    """
    Attempts to fetch live call & put prices and implied volatility from yfinance option chain.
    If unavailable, falls back to Black-Scholes pricing model.
    Returns (call_price, put_price, iv, greeks_dict).
    """
    t_years = target_days / 365.0
    sigma = calc_historical_volatility(closes, window=30)
    
    call_price = None
    put_price = None
    live_iv = None
    
    # Attempt yfinance option chain lookup
    try:
        expirations = ticker_obj.options
        if expirations:
            today = datetime.date.today()
            target_date = today + datetime.timedelta(days=target_days)
            
            # Find closest expiration date
            exp_dates = [datetime.datetime.strptime(exp, "%Y-%m-%d").date() for exp in expirations]
            closest_exp = min(exp_dates, key=lambda d: abs((d - target_date).days))
            closest_exp_str = closest_exp.strftime("%Y-%m-%d")
            
            chain = ticker_obj.option_chain(closest_exp_str)
            calls = chain.calls
            puts = chain.puts
            
            # Find contract matching nearest strike
            if not calls.empty:
                calls['strike_diff'] = (calls['strike'] - strike).abs()
                best_call = calls.sort_values('strike_diff').iloc[0]
                price_val = best_call.get('lastPrice') or best_call.get('ask') or best_call.get('bid')
                if pd.notna(price_val) and float(price_val) > 0:
                    call_price = float(price_val)
                iv_val = best_call.get('impliedVolatility')
                if pd.notna(iv_val) and float(iv_val) > 0:
                    live_iv = float(iv_val)
                    
            if not puts.empty:
                puts['strike_diff'] = (puts['strike'] - strike).abs()
                best_put = puts.sort_values('strike_diff').iloc[0]
                price_val = best_put.get('lastPrice') or best_put.get('ask') or best_put.get('bid')
                if pd.notna(price_val) and float(price_val) > 0:
                    put_price = float(price_val)
                if live_iv is None:
                    iv_val = best_put.get('impliedVolatility')
                    if pd.notna(iv_val) and float(iv_val) > 0:
                        live_iv = float(iv_val)
    except Exception:
        pass
        
    vol_used = live_iv if (live_iv is not None and live_iv > 0) else sigma
    if vol_used is None or vol_used <= 0:
        vol_used = 0.25
        
    # Black-Scholes Fallback if live chain data missing/incomplete
    if call_price is None:
        call_price = black_scholes_call(stock_price, strike, t_years, risk_free_rate, vol_used)
    if put_price is None:
        put_price = black_scholes_put(stock_price, strike, t_years, risk_free_rate, vol_used)
        
    greeks = calculate_option_greeks(stock_price, strike, target_days, vol_used, risk_free_rate)
    
    return round(call_price, 2), round(put_price, 2), round(vol_used, 4), greeks


def generate_and_save_options_data() -> dict:
    tickers, ticker_indexes = load_index_tickers_map()
    if not tickers:
        return {"status": "error", "message": "No tickers found in index files.", "processed_count": 0}
        
    print(f"[OPTIONS SERVICE] Fetching options & Greeks data for {len(tickers)} tickers across Dow 30, Nasdaq 100, and S&P 500...")
    
    current_time_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Download market data in batch to optimize speed
    daily_data = yf.download(tickers, period="3mo", interval="1d", progress=False)
    
    csv_headers = [
        "Date",
        "Ticker",
        "Index_Source",
        "Stock_Price",
        "ATM_Strike",
        "Implied_Volatility",
        "1W_Call_Price",
        "1W_Put_Price",
        "1W_Call_Delta",
        "1W_Put_Delta",
        "1W_Gamma",
        "1W_Call_Theta",
        "1W_Put_Theta",
        "1W_Vega",
        "1W_Call_Rho",
        "1W_Put_Rho",
        "2W_Call_Price",
        "2W_Put_Price",
        "2W_Call_Delta",
        "2W_Put_Delta",
        "2W_Gamma",
        "2W_Call_Theta",
        "2W_Put_Theta",
        "2W_Vega",
        "2W_Call_Rho",
        "2W_Put_Rho",
        "3W_Call_Price",
        "3W_Put_Price",
        "3W_Call_Delta",
        "3W_Put_Delta",
        "3W_Gamma",
        "3W_Call_Theta",
        "3W_Put_Theta",
        "3W_Vega",
        "3W_Call_Rho",
        "3W_Put_Rho"
    ]
    
    file_exists = os.path.exists(OPTIONS_DATA_CSV)
    header_matches = False
    if file_exists:
        try:
            with open(OPTIONS_DATA_CSV, "r", encoding="utf-8-sig") as f:
                first_line = f.readline().strip()
                if first_line == ",".join(csv_headers):
                    header_matches = True
        except Exception:
            pass

    rows_to_append = []
    processed_count = 0
    
    for symbol in tickers:
        try:
            # Extract historical closes for volatility & latest stock price
            if ('Close', symbol) in daily_data.columns:
                closes = daily_data['Close'][symbol].dropna()
            elif 'Close' in daily_data and symbol in daily_data['Close']:
                closes = daily_data['Close'][symbol].dropna()
            else:
                closes = pd.Series(dtype=float)
                
            stock_price = None
            if not closes.empty:
                stock_price = float(closes.iloc[-1])
                
            if stock_price is None or pd.isna(stock_price) or stock_price <= 0:
                # Fallback ticker lookup
                t_obj = yf.Ticker(symbol)
                stock_price = t_obj.fast_info.last_price
                
            if stock_price is None or pd.isna(stock_price) or stock_price <= 0:
                continue
                
            atm_strike = get_atm_strike(stock_price)
            t_obj = yf.Ticker(symbol)
            
            # Fetch 1W (7d), 2W (14d), 3W (21d) Call/Put prices & Option Greeks
            c_1w, p_1w, iv_1w, g_1w = get_live_or_bs_option_price(t_obj, symbol, stock_price, atm_strike, 7, closes)
            c_2w, p_2w, iv_2w, g_2w = get_live_or_bs_option_price(t_obj, symbol, stock_price, atm_strike, 14, closes)
            c_3w, p_3w, iv_3w, g_3w = get_live_or_bs_option_price(t_obj, symbol, stock_price, atm_strike, 21, closes)
            
            index_source = " / ".join(ticker_indexes.get(symbol, []))
            
            rows_to_append.append([
                current_time_str,
                symbol,
                index_source,
                f"{stock_price:.2f}",
                f"{atm_strike:.2f}",
                f"{iv_1w:.4f}",
                f"{c_1w:.2f}",
                f"{p_1w:.2f}",
                f"{g_1w['call_delta']:.4f}",
                f"{g_1w['put_delta']:.4f}",
                f"{g_1w['gamma']:.4f}",
                f"{g_1w['call_theta']:.4f}",
                f"{g_1w['put_theta']:.4f}",
                f"{g_1w['vega']:.4f}",
                f"{g_1w['call_rho']:.4f}",
                f"{g_1w['put_rho']:.4f}",
                f"{c_2w:.2f}",
                f"{p_2w:.2f}",
                f"{g_2w['call_delta']:.4f}",
                f"{g_2w['put_delta']:.4f}",
                f"{g_2w['gamma']:.4f}",
                f"{g_2w['call_theta']:.4f}",
                f"{g_2w['put_theta']:.4f}",
                f"{g_2w['vega']:.4f}",
                f"{g_2w['call_rho']:.4f}",
                f"{g_2w['put_rho']:.4f}",
                f"{c_3w:.2f}",
                f"{p_3w:.2f}",
                f"{g_3w['call_delta']:.4f}",
                f"{g_3w['put_delta']:.4f}",
                f"{g_3w['gamma']:.4f}",
                f"{g_3w['call_theta']:.4f}",
                f"{g_3w['put_theta']:.4f}",
                f"{g_3w['vega']:.4f}",
                f"{g_3w['call_rho']:.4f}",
                f"{g_3w['put_rho']:.4f}"
            ])
            processed_count += 1
        except Exception as e:
            print(f"[OPTIONS SERVICE] Error processing options for {symbol}: {e}")
            
    if not rows_to_append:
        return {"status": "error", "message": "Failed to collect options data.", "processed_count": 0}
        
    # Write or append to OptionsData.csv (overwrite if old schema headers exist)
    write_headers = not file_exists or not header_matches
    mode = 'a' if (file_exists and header_matches) else 'w'
    
    with open(OPTIONS_DATA_CSV, mode=mode, newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        if write_headers:
            writer.writerow(csv_headers)
        writer.writerows(rows_to_append)
        
    print(f"[OPTIONS SERVICE] Successfully saved {processed_count} rows with Option Greeks to {OPTIONS_DATA_CSV}")
    return {
        "status": "success",
        "message": f"Successfully updated OptionsData.csv with {processed_count} tickers and full Option Greeks data.",
        "processed_count": processed_count,
        "filename": "OptionsData.csv",
        "filepath": OPTIONS_DATA_CSV,
        "timestamp": current_time_str
    }

