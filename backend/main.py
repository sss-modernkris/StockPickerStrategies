from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from models import TickerAnalysis, HistoryResponse
from services.strategy_engine import run_all_strategies
from services.history_client import fetch_batch_history
import csv
import os

app = FastAPI(
    title="Strategic Alpha Dashboard API",
    description="Backend for the Quant Strategies Dashboard",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthCheck(BaseModel):
    status: str

@app.get("/health")
def health_check() -> HealthCheck:
    return HealthCheck(status="ok")

@app.get("/api/portfolio")
def get_portfolio_tickers():
    tickers = []
    # portfolio.csv is at the root level, one directory up from backend/
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "portfolio.csv")
    try:
        if os.path.exists(file_path):
            with open(file_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if 'Symbol' in row and row['Symbol'].strip():
                        tickers.append(row['Symbol'].strip())
        return {"tickers": tickers}
    except Exception as e:
        return {"tickers": [], "error": str(e)}

@app.get("/api/analyze/{ticker}", response_model=TickerAnalysis)
def analyze_ticker(ticker: str) -> TickerAnalysis:
    analysis = run_all_strategies(ticker.upper())
    if analysis.error:
        # If there's an error in fetching, still returning 200 with error property for UI to display nicely
        pass
    return analysis

@app.get("/api/analyze-batch")
def analyze_batch(tickers: str) -> dict[str, TickerAnalysis]:
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    results = {}
    
    if not ticker_list:
        raise HTTPException(status_code=400, detail="No valid tickers provided")
        
    for ticker in ticker_list:
        analysis = run_all_strategies(ticker)
        results[ticker] = analysis
        
    return results

@app.get("/api/history", response_model=HistoryResponse)
def get_history(tickers: str, period: str = "1y") -> HistoryResponse:
    # tickers should be a comma-separated string like "AAPL,MSFT,NVDA"
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    
    if not ticker_list:
        raise HTTPException(status_code=400, detail="No valid tickers provided")
        
    result = fetch_batch_history(ticker_list, period)
    
    if "error" in result and result["error"]:
        return HistoryResponse(period=period, data=[], error=result["error"])
        
    # Validation will happen automatically by Pydantic Model
    return HistoryResponse(period=period, data=result["data"])

from datetime import datetime
import csv
import os
import yfinance as yf
from models import TransactionModel, TransactionResponse, PortfolioSummaryResponse, HoldingModel

@app.get("/api/price/{ticker}")
def get_ticker_price(ticker: str):
    if not ticker or ticker.upper() == 'CASH':
        raise HTTPException(status_code=400, detail="Invalid ticker")
    try:
        t = yf.Ticker(ticker.upper())
        info = t.fast_info
        if not hasattr(info, 'last_price') or info.last_price is None:
            raise ValueError("Invalid price")
        return {"price": round(info.last_price, 2)}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found or invalid.")

@app.get("/api/paper-study", response_model=PortfolioSummaryResponse)
def get_paper_study():
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "PaperStudy.csv")
    transactions = []
    current_cash = 100000.0
    total_cash_deposited = 100000.0
    holdings_dict = {}
    
    if os.path.exists(file_path):
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
        tickers = list(set([row['Ticker'].strip().upper() for row in rows if 'Ticker' in row and row['Ticker'].strip()]))
        
        latest_prices = {}
        if tickers:
            for ticker in tickers:
                try:
                    latest_prices[ticker] = yf.Ticker(ticker).fast_info.last_price
                except:
                    latest_prices[ticker] = 0.0
                    
        updated_rows = []
        for row in rows:
            clean_row = {k.strip(): v.strip() for k, v in row.items() if k}
            if 'Ticker' in clean_row:
                try:
                    t = clean_row.get('Ticker', '').upper()
                    q = float(clean_row.get('Quantity', 0))
                    p = float(clean_row.get('Price', 0))
                    
                    
                    # Calculate total cost favoring the explicit file value if it exists
                    tc_str = clean_row.get('Total Cost', '')
                    tc = float(tc_str) if tc_str else (q * p)
                    current_cash -= tc
                    
                    # Update holdings average price (exclude CASH operations)
                    if t != 'CASH':
                        if t not in holdings_dict:
                            holdings_dict[t] = {'qty': 0.0, 'avg_buy_price': 0.0}
                        
                        old_qty = holdings_dict[t]['qty']
                        old_avg = holdings_dict[t]['avg_buy_price']
                        
                        if tc > 0: # Buy
                            new_qty = old_qty + q
                            if new_qty > 0:
                                new_avg = (old_qty * old_avg + tc) / new_qty
                            else:
                                new_avg = old_avg
                            holdings_dict[t]['qty'] = new_qty
                            holdings_dict[t]['avg_buy_price'] = new_avg
                        elif tc < 0: # Sell
                            new_qty = old_qty + q
                            holdings_dict[t]['qty'] = new_qty

                    # Determine action based on quantity and ticker
                    if t == 'CASH':
                        if tc < 0:
                            action = 'Deposit'
                            total_cash_deposited += abs(tc)
                        else:
                            action = 'Withdraw'
                            total_cash_deposited -= tc
                    else:
                        action = 'Buy' if q > 0 else 'Sell'
                        
                    curr_price = latest_prices.get(t, 0.0) if t != 'CASH' else 1.0
                    
                    if q < 0:
                        curr_val = q * p
                    elif t == 'CASH':
                        curr_val = abs(tc)
                    else:
                        curr_val = q * curr_price

                    tx = TransactionResponse(
                        date=clean_row.get('Date', ''),
                        ticker=t,
                        quantity=q,
                        price=p,
                        total_cost=tc,
                        current_close_price=curr_price,
                        total_current_value=curr_val,
                        cash_balance=current_cash,
                        action=action
                    )
                    transactions.append(tx)
                    updated_rows.append([
                        tx.date, tx.ticker, tx.quantity, tx.price, tx.total_cost, 
                        tx.current_close_price, tx.total_current_value, tx.cash_balance
                    ])
                except ValueError:
                    pass
                    
        # Synchronously write the CSV update so it stores the new schema and up to date values 
        with open(file_path, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Date', 'Ticker', 'Quantity', 'Price', 'Total Cost', 'Current Close Price', 'Total Current Value', 'Cash Available'])
            writer.writerows(updated_rows)

    holdings_list = []
    invested_capital = 0.0
    for t, h in holdings_dict.items():
        if h['qty'] > 0:
           cp = latest_prices.get(t, 0.0)
           tv = h['qty'] * cp
           pnl = (cp - h['avg_buy_price']) * h['qty']
           invested_capital += tv
           holdings_list.append(HoldingModel(
               ticker=t,
               total_quantity=h['qty'],
               avg_buy_price=h['avg_buy_price'],
               current_price=cp,
               total_value=tv,
               unrealized_pnl=pnl
           ))
           
    total_equity = current_cash + invested_capital
    total_profit = total_equity - total_cash_deposited
    
    # Sort holdings and transactions
    holdings_list.sort(key=lambda x: x.unrealized_pnl, reverse=True)
    transactions.reverse() # show latest first in history

    return PortfolioSummaryResponse(
        current_cash=current_cash,
        invested_capital=invested_capital,
        total_equity=total_equity,
        total_profit=total_profit,
        holdings=holdings_list,
        transactions=transactions
    )

@app.post("/api/paper-study")
def add_paper_study_transaction(tx: TransactionModel):
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "PaperStudy.csv")
    write_header = not os.path.exists(file_path)
    current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    current_cash = 100000.0
    holdings = {}
    if os.path.exists(file_path):
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = row.get('Ticker', '').strip().upper()
                q_str = row.get('Quantity', '0')
                p_str = row.get('Price', '0')
                tc_str = row.get('Total Cost', '')
                try:
                    tc = float(tc_str) if tc_str else (float(q_str) * float(p_str))
                    current_cash -= tc
                    
                    if t != 'CASH':
                        q = float(q_str)
                        if t not in holdings:
                            holdings[t] = 0.0
                        holdings[t] += q
                except ValueError:
                    pass
    
    # Adjust quantity and compute cost based on transaction type
    quantity = tx.quantity
    tx_type = tx.transaction_type.lower()
    ticker = tx.ticker.upper()
    
    if tx_type == 'deposit':
        quantity = 1.0
        ticker = 'CASH'
        total_cost = -abs(tx.price) # negative cost increases cash
    elif tx_type == 'withdraw':
        quantity = 1.0
        ticker = 'CASH'
        total_cost = abs(tx.price)
        if total_cost > current_cash:
            raise HTTPException(status_code=400, detail="Insufficient funds for withdrawal.")
    elif tx_type == 'sell':
        quantity = -abs(tx.quantity)
        total_cost = quantity * tx.price
        held = holdings.get(ticker, 0.0)
        if abs(quantity) > held:
            raise HTTPException(status_code=400, detail=f"Insufficient shares: You only hold {held} shares of {ticker}.")
    else: # buy
        total_cost = quantity * tx.price
        if total_cost > current_cash:
            raise HTTPException(status_code=400, detail="Insufficient funds: Trade exceeds available cash balance.")
        
    new_cash = current_cash - total_cost
    
    if ticker == 'CASH':
        curr_price = 1.0
        total_val = abs(total_cost)
    else:
        try:
            curr_price = yf.Ticker(ticker).fast_info.last_price
        except:
            curr_price = 0.0
        
        if quantity < 0:
            total_val = quantity * tx.price
        else:
            total_val = quantity * curr_price
    
    try:
        with open(file_path, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(['Date', 'Ticker', 'Quantity', 'Price', 'Total Cost', 'Current Close Price', 'Total Current Value', 'Cash Available'])
            
            writer.writerow([current_date, ticker, quantity, tx.price, total_cost, curr_price, total_val, new_cash])
        return {"status": "success", "message": "Transaction added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
