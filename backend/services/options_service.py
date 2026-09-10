import os
import csv
import math
import datetime
from typing import Optional, List, Dict, Tuple, Any
import pandas as pd

import numpy as np
import yfinance as yf
from scipy.stats import norm
from scipy.optimize import brentq
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
                t_obj = yf.Ticker(symbol.replace('.', '-'))
                stock_price = t_obj.fast_info.last_price
                
            if stock_price is None or pd.isna(stock_price) or stock_price <= 0:
                continue
                
            atm_strike = get_atm_strike(stock_price)
            t_obj = yf.Ticker(symbol.replace('.', '-'))
            
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


def black_scholes_call_full(S: float, K: float, T: float, r: float, sigma: float, q: float = 0.0) -> float:
    """
    Black-Scholes European call option pricing.
    S: Stock price
    K: Strike price
    T: Time to expiration in years
    r: Risk-free rate
    sigma: Volatility
    q: Dividend yield
    """
    T = max(T, 0.0001)
    sigma = max(sigma, 0.0001)
    d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    return float(S * np.exp(-q * T) * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))


def call_implied_volatility_solver(
    market_price: float,
    S: float,
    K: float,
    days_to_expiration: int,
    r: float = 0.04,
    q: float = 0.0
) -> float:
    """
    Calculates implied volatility of a call option given market premium, stock price,
    strike, days to expiration, risk-free rate, and dividend yield using Brent's method.
    """
    T = max(days_to_expiration, 1) / 365.0

    minimum_price = max(S * np.exp(-q * T) - K * np.exp(-r * T), 0.0)
    maximum_price = S * np.exp(-q * T)

    # Bound check
    if market_price <= minimum_price:
        adj_price = minimum_price + 0.01
    elif market_price >= maximum_price:
        adj_price = maximum_price - 0.01
    else:
        adj_price = market_price

    def pricing_error(sigma):
        theoretical = black_scholes_call_full(S=S, K=K, T=T, r=r, sigma=sigma, q=q)
        return theoretical - adj_price

    try:
        iv = brentq(pricing_error, 0.0001, 5.0)
    except Exception:
        best_iv = 0.25
        min_err = float('inf')
        for iv_cand in np.linspace(0.001, 3.0, 300):
            err = abs(pricing_error(iv_cand))
            if err < min_err:
                min_err = err
                best_iv = float(iv_cand)
        iv = best_iv

    return float(iv)


def calculate_20d_historical_volatility(closes: pd.Series) -> float:
    """
    Computes 20-day annualized historical volatility from daily log returns.
    """
    if len(closes) < 2:
        return 0.25
    sub_closes = closes.tail(21).values
    log_returns = np.diff(np.log(sub_closes))
    if len(log_returns) < 2:
        return 0.25
    daily_volatility = np.std(log_returns, ddof=1)
    annualized_volatility = daily_volatility * np.sqrt(252)
    return float(annualized_volatility)


def compute_ticker_volatility_analytics(
    symbol: str,
    stock_price: Optional[float] = None,
    strike_price: Optional[float] = None,
    option_premium: Optional[float] = None,
    bid_price: Optional[float] = None,
    ask_price: Optional[float] = None,
    expiration_date: Optional[str] = None,
    days_to_expiration: Optional[int] = 30,
    risk_free_rate: float = 0.04,
    dividend_yield: float = 0.0
) -> dict:
    """
    Master volatility analysis function combining 20d Historical Volatility,
    Call Option Implied Volatility (IV) inversion, Option Greeks, and Volatility Spread.
    """
    symbol = symbol.strip().upper()
    days_to_exp = days_to_expiration if (days_to_expiration and days_to_expiration > 0) else 30

    if expiration_date:
        try:
            exp_d = datetime.datetime.strptime(expiration_date, "%Y-%m-%d").date()
            today = datetime.date.today()
            calc_days = (exp_d - today).days
            if calc_days > 0:
                days_to_exp = calc_days
        except Exception:
            pass

    # Fetch 20d historical price data if stock price or HV needed
    t_obj = yf.Ticker(symbol.replace('.', '-'))
    history = pd.DataFrame()
    try:
        history = t_obj.history(period="3mo")
    except Exception:
        pass

    closes = history['Close'].dropna() if not history.empty and 'Close' in history else pd.Series(dtype=float)

    if stock_price is None or stock_price <= 0:
        if not closes.empty:
            stock_price = float(closes.iloc[-1])
        else:
            try:
                stock_price = float(t_obj.fast_info.last_price)
            except Exception:
                stock_price = 100.0

    if strike_price is None or strike_price <= 0:
        strike_price = get_atm_strike(stock_price)

    # Determine Option Premium, Bid, Ask, and Midpoint from live chain if missing
    midpoint = None
    if bid_price is None or ask_price is None or option_premium is None:
        try:
            expirations = t_obj.options
            if expirations:
                today = datetime.date.today()
                target_date = today + datetime.timedelta(days=days_to_exp)
                exp_dates = [datetime.datetime.strptime(exp, "%Y-%m-%d").date() for exp in expirations]
                closest_exp = min(exp_dates, key=lambda d: abs((d - target_date).days))
                calc_days = (closest_exp - today).days
                if calc_days > 0:
                    days_to_exp = calc_days
                closest_exp_str = closest_exp.strftime("%Y-%m-%d")
                
                chain = t_obj.option_chain(closest_exp_str)
                calls = chain.calls
                if not calls.empty:
                    calls['strike_diff'] = (calls['strike'] - strike_price).abs()
                    best_call = calls.sort_values('strike_diff').iloc[0]
                    
                    b = best_call.get('bid')
                    a = best_call.get('ask')
                    lp = best_call.get('lastPrice')
                    
                    if pd.notna(b) and pd.notna(a) and float(b) > 0 and float(a) > 0:
                        if bid_price is None:
                            bid_price = round(float(b), 2)
                        if ask_price is None:
                            ask_price = round(float(a), 2)
                        midpoint = round((bid_price + ask_price) / 2.0, 2)
                        if option_premium is None:
                            option_premium = midpoint
                    elif pd.notna(lp) and float(lp) > 0:
                        if option_premium is None:
                            option_premium = round(float(lp), 2)
                        if bid_price is None:
                            bid_price = round(option_premium * 0.98, 2)
                        if ask_price is None:
                            ask_price = round(option_premium * 1.02, 2)
                        midpoint = round((bid_price + ask_price) / 2.0, 2)
        except Exception:
            pass

    if bid_price is not None and ask_price is not None and bid_price > 0 and ask_price > 0:
        midpoint = round((bid_price + ask_price) / 2.0, 2)

    if option_premium is None or option_premium <= 0:
        if midpoint is not None:
            option_premium = midpoint
        else:
            # Default BS call estimate if no premium provided
            hv_est = calculate_20d_historical_volatility(closes) if not closes.empty else 0.25
            t_yrs = days_to_exp / 365.0
            option_premium = round(black_scholes_call_full(stock_price, strike_price, t_yrs, risk_free_rate, hv_est, dividend_yield), 2)

    if bid_price is None or bid_price <= 0:
        bid_price = round(option_premium * 0.98, 2)
    if ask_price is None or ask_price <= 0:
        ask_price = round(option_premium * 1.02, 2)
    if midpoint is None:
        midpoint = round((bid_price + ask_price) / 2.0, 2)

    # 1. 20-Day Historical Volatility
    hv_20d = calculate_20d_historical_volatility(closes) if not closes.empty else 0.25

    # 2. Implied Volatility (IV)
    iv_mid = call_implied_volatility_solver(
        market_price=option_premium,
        S=stock_price,
        K=strike_price,
        days_to_expiration=days_to_exp,
        r=risk_free_rate,
        q=dividend_yield
    )

    iv_bid = None
    if bid_price is not None and bid_price > 0:
        iv_bid = call_implied_volatility_solver(
            market_price=bid_price,
            S=stock_price,
            K=strike_price,
            days_to_expiration=days_to_exp,
            r=risk_free_rate,
            q=dividend_yield
        )

    iv_ask = None
    if ask_price is not None and ask_price > 0:
        iv_ask = call_implied_volatility_solver(
            market_price=ask_price,
            S=stock_price,
            K=strike_price,
            days_to_expiration=days_to_exp,
            r=risk_free_rate,
            q=dividend_yield
        )

    # 3. Volatility Spread (IV - HV)
    vol_spread = iv_mid - hv_20d
    vol_spread_pct = (vol_spread / hv_20d * 100.0) if hv_20d > 0 else 0.0

    if vol_spread > 0.10:
        interpretation = "Significantly Elevated (High IV Premium — Market expects substantial price movement or imminent event)"
    elif vol_spread > 0.03:
        interpretation = "Moderately Elevated (Option premium is pricing higher volatility than recent price action)"
    elif vol_spread >= -0.03:
        interpretation = "Balanced / Fairly Priced (Option IV aligns closely with recent 20-day historical volatility)"
    else:
        interpretation = "Discount / Low IV (Option premium is pricing lower volatility than recent stock price fluctuations)"

    # 4. Option Greeks
    greeks = calculate_option_greeks(
        S=stock_price,
        K=strike_price,
        target_days=days_to_exp,
        sigma=iv_mid,
        r=risk_free_rate
    )

    # 5. Breakeven & Required Return
    breakeven = strike_price + option_premium
    req_move_pct = ((breakeven - stock_price) / stock_price * 100.0) if stock_price > 0 else 0.0

    return {
        "symbol": symbol,
        "stock_price": round(stock_price, 2),
        "strike_price": round(strike_price, 2),
        "days_to_expiration": days_to_exp,
        "option_premium": round(option_premium, 2),
        "midpoint_premium": midpoint,
        "bid_price": round(bid_price, 2) if bid_price else None,
        "ask_price": round(ask_price, 2) if ask_price else None,
        "historical_volatility_20d": round(hv_20d, 4),
        "implied_volatility": round(iv_mid, 4),
        "implied_volatility_bid": round(iv_bid, 4) if iv_bid else None,
        "implied_volatility_ask": round(iv_ask, 4) if iv_ask else None,
        "volatility_spread": round(vol_spread, 4),
        "volatility_spread_pct": round(vol_spread_pct, 2),
        "interpretation": interpretation,
        "breakeven_price": round(breakeven, 2),
        "required_move_pct": round(req_move_pct, 2),
        "greeks": greeks,
        "status": "success"
    }


