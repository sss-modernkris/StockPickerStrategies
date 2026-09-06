from fastapi import FastAPI, HTTPException, BackgroundTasks
from typing import List, Optional
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from models import TickerAnalysis, HistoryResponse, HoldingModel, IBOrderModel, TransactionModel, TransactionResponse, PortfolioSummaryResponse, StockAnalysisItem, PortfolioAnalysisResponse, SaveReportRequest, CallOptionStatsResponse
from services.strategy_engine import run_all_strategies
from services.history_client import fetch_batch_history
from services.ib_client import IBClient
from services.rh_client import RHClient
from services.backtester import execute_30d_backtest, execute_options_backtest, execute_trend_options_backtest, execute_slope_options_backtest, execute_slope_options_2day_backtest
from services.options_service import generate_and_save_options_data
from services.call_option_stats_service import generate_call_option_stats
from services.email_service import send_email_with_attachment
import csv
import os
import json


app = FastAPI(
    title="Strategic Alpha Dashboard API",
    description="Backend for the Quant Strategies Dashboard",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    """Starts the 24x7 autonomous daily trading pipeline scheduler on container boot."""
    try:
        from agents.pipeline import get_pipeline
        pipeline = get_pipeline()
        pipeline.start_scheduler()
        print(f"[STARTUP] Autonomous 24x7 Trading Pipeline Scheduler active. Next execution: {pipeline.get_next_run_time()}")
    except Exception as e:
        print(f"[STARTUP] Error starting Trading Pipeline scheduler: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully shuts down the background pipeline scheduler."""
    try:
        from agents.pipeline import get_pipeline
        pipeline = get_pipeline()
        pipeline.stop_scheduler()
        print("[SHUTDOWN] Autonomous Trading Pipeline Scheduler stopped.")
    except Exception as e:
        print(f"[SHUTDOWN] Error stopping Trading Pipeline scheduler: {e}")


# Standardize data paths relative to this script
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)
PORTFOLIO_CSV = os.path.join(BASE_DIR, "portfolio.csv")
PAPER_STUDY_CSV = os.path.join(BASE_DIR, "PaperStudy.csv")

print(f"Backend Directory: {BACKEND_DIR}")
print(f"Base Directory: {BASE_DIR}")
print(f"Portfolio CSV: {PORTFOLIO_CSV}")
print(f"Paper Study CSV: {PAPER_STUDY_CSV}")

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

class LoginRequest(BaseModel):
    username: str
    password: str

class LogRequest(BaseModel):
    level: str
    message: str
    data: dict | list | str | int | float | bool | None = None

@app.post("/api/logs")
def post_logs(log: LogRequest):
    prefix = f"[FRONTEND {log.level.upper()}]"
    if log.data:
        print(f"{prefix} {log.message} - {log.data}")
    else:
        print(f"{prefix} {log.message}")
    return {"status": "ok"}

class SaveCsvRequest(BaseModel):
    filename: str
    content: str

@app.post("/api/save_csv")
def save_csv(req: SaveCsvRequest):
    try:
        safe_filename = os.path.basename(req.filename)
        filepath = os.path.join(BASE_DIR, safe_filename)
        print(f"Saving to: {filepath}")
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            f.write(req.content)

        email_sent = False
        email_msg = ""
        if safe_filename == "Top_Tickers_to_buy.csv":
            target_email = "modernkris@gmail.com"
            subject = "Top Tickers Buy Screen Results - Top_Tickers_to_buy.csv"
            body = (
                "Hello,\n\n"
                "Attached is the latest Top_Tickers_to_buy.csv generated from your Strategic Alpha Dashboard (Top Tickers tab).\n\n"
                "Best regards,\n"
                "Strategic Alpha Quant Engine"
            )
            email_sent, email_msg = send_email_with_attachment(
                to_email=target_email,
                subject=subject,
                body=body,
                file_path=filepath
            )

        return {
            "status": "success",
            "message": f"Successfully saved to {filepath}",
            "email_sent": email_sent,
            "email_message": email_msg
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class IBDataResponse(BaseModel):
    unrealized_pnl: float
    realized_pnl: float
    buying_power: float
    cash_available: float
    invested_capital: float
    total_equity: float
    holdings: List[HoldingModel]
    orders: List[IBOrderModel]

ib_control = IBClient()
rh_control = RHClient()

class RHConnectRequest(BaseModel):
    mcp_url: str = "https://agent.robinhood.com/mcp/trading"
    simulate: bool = False

class RHControlsRequest(BaseModel):
    paused: Optional[bool] = None
    budget_limit: Optional[float] = None

@app.get("/api/ib/config")
def get_ib_config():
    username = os.getenv("IB_USERNAME")
    password = os.getenv("IB_PASSWORD")
    print("IB Username: ", username)
    print("IB Password: ", password)
    res = {
        "is_configured": bool(username and password),
        "is_connected": ib_control.is_connected()
    }
    print("IB Config: ", res)
    return res

@app.post("/api/ib/login")
def ib_login(credentials: LoginRequest):
    # In a real scenario, we might use the credentials to start a gateway 
    # or authenticate against a service. For now, we connect to the local API.
    print("Attempting to login to IB at " + credentials.username + "/api/ib/login")
    success, error_msg = ib_control.connect()
    if success:
        return {"status": "success", "message": "Logged into Interactive Brokers"}
    else:
        # For development/demo, if it fails, we provide the actual error or a generic one.
        raise HTTPException(status_code=500, detail=f"Failed to connect to IB Gateway/TWS: {error_msg}. Ensure it is running and API is enabled.")

@app.get("/api/ib/data", response_model=IBDataResponse)
def get_ib_data():
    data = ib_control.get_portfolio_summary()
    if data:
        return data
    else:
        raise HTTPException(status_code=400, detail="Not connected to Interactive Brokers")

@app.get("/api/rh/config")
def get_rh_config():
    from mcp.rh_mcp_server import get_sandbox
    sb = get_sandbox()
    return {
        "is_connected": True,
        "mcp_url": "https://agent.robinhood.com/mcp/trading",
        "is_simulated": True,
        "paused": sb.paused,
        "budget_limit": sb.budget_limit
    }

@app.post("/api/rh/connect")
def rh_connect(req: RHConnectRequest):
    return {"status": "success", "message": "Connected to Robinhood MCP Sandbox"}

@app.post("/api/rh/disconnect")
def rh_disconnect():
    return {"status": "success", "message": "Disconnected from Robinhood MCP Sandbox"}

@app.get("/api/rh/data")
def get_rh_data():
    from mcp.rh_mcp_server import get_sandbox
    sb = get_sandbox()
    return sb.get_portfolio()

@app.post("/api/rh/order")
def place_rh_order(ticker: str, action: str, quantity: float, price: float):
    from mcp.rh_mcp_server import get_sandbox
    sb = get_sandbox()
    res = sb.place_stock_order(ticker, action, quantity, price)
    if res.get("success"):
        return {"status": "success", "message": res.get("message")}
    else:
        raise HTTPException(status_code=400, detail=res.get("error"))

@app.post("/api/rh/controls")
def update_rh_controls(req: RHControlsRequest):
    from mcp.rh_mcp_server import get_sandbox
    sb = get_sandbox()
    if req.paused is not None:
        sb.paused = req.paused
    if req.budget_limit is not None:
        sb.budget_limit = req.budget_limit
    return {"status": "success", "message": "Controls updated successfully"}

# -----------------------------------------------------------------------------
# SPECIALIZED AI AGENTS & ROBINHOOD MCP SANDBOX PIPELINE
# -----------------------------------------------------------------------------

@app.get("/api/agents/pipeline/status")
def get_agents_pipeline_status():
    """Returns the live status of the Backtester Agent, Broker Agent, and scheduled 2:00 PM EST trigger."""
    try:
        from agents.pipeline import get_pipeline
        pipeline = get_pipeline()
        return pipeline.get_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pipeline status: {str(e)}")

@app.post("/api/agents/pipeline/run")
def run_agents_pipeline():
    """
    Triggers the end-to-end automated linear data pipeline:
    1. Backtester Agent runs Strategy 1 on Dow 30, Nasdaq 100, S&P 500 universe.
    2. Broker Agent performs comparative portfolio analysis, calculates buying power from cash and sell liquidations.
    3. Dispatches simulated stock and option orders directly to Robinhood MCP Sandbox.
    """
    try:
        from agents.pipeline import get_pipeline
        pipeline = get_pipeline()
        report = pipeline.run_pipeline()
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")

@app.post("/api/agents/backtester/run")
def run_backtester_agent():
    """Runs the Backtester Agent independently to generate ranked signals on the index universe."""
    try:
        from agents.backtester_agent import BacktesterAgent
        agent = BacktesterAgent()
        result = agent.run_daily_analysis()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtester Agent failed: {str(e)}")

@app.post("/api/agents/broker/rebalance")
def run_broker_agent_rebalance(payload: Optional[dict] = None):
    """
    Runs the Broker Agent to compare current portfolio against recommendations,
    execute sell liquidations, and place buy orders in the Robinhood Sandbox.
    """
    try:
        from agents.backtester_agent import BacktesterAgent
        from agents.broker_agent import BrokerAgent
        if not payload or not payload.get("ranked_recommendations"):
            bt = BacktesterAgent()
            payload = bt.run_daily_analysis()
        broker = BrokerAgent()
        report = broker.evaluate_and_rebalance(payload)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Broker Agent execution failed: {str(e)}")

@app.get("/api/portfolio")
def get_portfolio_tickers(filename: str = "portfolio.csv"):
    # Security: prevent path traversal
    safe_filename = os.path.basename(filename)
    if safe_filename != filename:
         raise HTTPException(status_code=400, detail="Invalid filename format. Path traversal is not allowed.")
    
    # Path relative to project root (one level up from backend/)
    file_path = os.path.join(BASE_DIR, safe_filename)
    
    tickers = []
    try:
        if os.path.exists(file_path):
            with open(file_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Clean up header/keys in case they have spaces or BOM issues
                    clean_row = {k.strip() if k else k: v for k, v in row.items()}
                    if 'Symbol' in clean_row and clean_row['Symbol'].strip():
                        tickers.append(clean_row['Symbol'].strip())
        else:
            raise HTTPException(status_code=404, detail=f"File {safe_filename} not found in project directory.")
        return {"tickers": tickers}
    except Exception as e:
        return {"tickers": [], "error": str(e)}

@app.get("/api/list-portfolios")
def list_portfolios():
    """Lists all .csv files in the project root that can be used as portfolios."""
    files = [f for f in os.listdir(BASE_DIR) if f.endswith('.csv')]
    # Priority to PaperStudy.csv and portfolio.csv if they exist
    files.sort(key=lambda x: (x != 'PaperStudy.csv', x != 'portfolio.csv', x))
    return {"files": files}

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

@app.get("/api/price/{ticker}")
def get_current_price(ticker: str):
    try:
        t = yf.Ticker(ticker.upper())
        price = t.fast_info.last_price
        return {"price": price}
    except Exception as e:
        raise HTTPException(status_code=404, detail="Ticker not found or price unavailable")

import yfinance as yf

@app.get("/api/paper-study", response_model=PortfolioSummaryResponse)
def get_paper_study(filename: str = "PaperStudy.csv"):
    # Security: prevent path traversal
    safe_filename = os.path.basename(filename)
    target_path = os.path.join(BASE_DIR, safe_filename)
    
    transactions = []
    current_cash = 100000.0
    holdings_dict = {}
    
    if os.path.exists(target_path):
        with open(target_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
        tickers = list(set([ (row.get('Symbol') or row.get('Ticker', '')).strip().upper() for row in rows if row.get('Symbol') or row.get('Ticker')]))
        
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
            symbol_key = 'Symbol' if 'Symbol' in clean_row else 'Ticker'
            if symbol_key in clean_row:
                try:
                    t = clean_row.get(symbol_key, '').upper()
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
                        action = 'Deposit' if tc < 0 else 'Withdraw'
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
                        symbol=t,
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
                        tx.date, tx.symbol, tx.quantity, tx.price, tx.total_cost, 
                        tx.current_close_price, tx.total_current_value, tx.cash_balance
                    ])
                except ValueError:
                    pass
                    
                    pass
                    
        # Synchronously write the CSV update so it stores the new schema and up to date values 
        with open(target_path, mode='w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['Date', 'Symbol', 'Quantity', 'Price', 'Total Cost', 'Current Close Price', 'Total Current Value', 'Cash Available'])
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
               symbol=t,
               total_quantity=h['qty'],
               avg_buy_price=h['avg_buy_price'],
               current_price=cp,
               total_value=tv,
               unrealized_pnl=pnl
           ))
           
    total_equity = current_cash + invested_capital
    
    # Sort holdings and transactions
    holdings_list.sort(key=lambda x: x.unrealized_pnl, reverse=True)
    transactions.reverse() # show latest first in history

    # Fetch real IB orders if connected
    ib_orders = []
    if ib_control.is_connected():
        ib_orders = ib_control.get_orders()

    # Fetch Robinhood orders if connected
    rh_orders = []
    if rh_control.is_connected():
        rh_orders = rh_control.get_orders()

    return PortfolioSummaryResponse(
        current_cash=current_cash,
        invested_capital=invested_capital,
        total_equity=total_equity,
        holdings=holdings_list,
        transactions=transactions,
        ib_orders=ib_orders,
        rh_orders=rh_orders
    )

@app.post("/api/paper-study")
def add_paper_study_transaction(tx: TransactionModel):
    # Security: prevent path traversal
    safe_filename = os.path.basename(tx.filename or "PaperStudy.csv")
    target_path = os.path.join(BASE_DIR, safe_filename)
    
    write_header = not os.path.exists(target_path)
    current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    current_cash = 100000.0
    holdings = {}
    if os.path.exists(target_path):
        with open(target_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = (row.get('Symbol') or row.get('Ticker', '')).strip().upper()
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
    ticker = tx.symbol.upper()
    
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
    
    # If IB is connected, attempt to place a real order for BUY/SELL
    ib_msg = ""
    if ib_control.is_connected() and tx_type in ['buy', 'sell']:
        success, msg = ib_control.place_order(ticker, tx_type.upper(), abs(tx.quantity), tx.price)
        if not success:
            raise HTTPException(status_code=500, detail=f"IB Order Failed: {msg}")
        ib_msg = f" (IB Order: {msg})"

    # If Robinhood is connected, attempt to place a real order for BUY/SELL
    rh_msg = ""
    if rh_control.is_connected() and tx_type in ['buy', 'sell']:
        success, msg = rh_control.place_order(ticker, tx_type.upper(), abs(tx.quantity), tx.price)
        if not success:
            raise HTTPException(status_code=500, detail=f"Robinhood Order Failed: {msg}")
        rh_msg = f" (Robinhood Order: {msg})"

    try:
        with open(target_path, mode='a', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(['Date', 'Symbol', 'Quantity', 'Price', 'Total Cost', 'Current Close Price', 'Total Current Value', 'Cash Available'])
            
            writer.writerow([current_date, ticker, quantity, tx.price, total_cost, curr_price, total_val, new_cash])
        return {"status": "success", "message": f"Transaction added successfully{ib_msg}{rh_msg}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import subprocess

def run_take_screenshots_script(filename: str):
    try:
        script_path = os.path.join(BASE_DIR, "take_screenshots.py")
        python_exe = r"C:\Users\moder\AppData\Local\Programs\Python\Python311\python.exe"
        print(f"[BACKGROUND] Starting screenshot capture: {python_exe} {script_path} --portfolio {filename}")
        subprocess.Popen([python_exe, script_path, "--portfolio", filename], cwd=BASE_DIR)
    except Exception as e:
        print(f"[BACKGROUND] Error launching screenshots script: {e}")

@app.get("/api/run-analysis", response_model=PortfolioAnalysisResponse)
def run_analysis(background_tasks: BackgroundTasks, filename: str = "portfolio-01.csv") -> PortfolioAnalysisResponse:
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(BASE_DIR, safe_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Portfolio file {safe_filename} not found.")
        
    tickers = []
    try:
        with open(file_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                clean_row = {k.strip() if k else k: v for k, v in row.items()}
                if 'Symbol' in clean_row and clean_row['Symbol'].strip():
                    tickers.append(clean_row['Symbol'].strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading portfolio: {str(e)}")
        
    items = []
    for ticker in tickers:
        if ticker.upper() == 'CASH':
            continue
            
        try:
            analysis = run_all_strategies(ticker.upper())
            if analysis.error or not analysis.price_history or not analysis.technical_indicators:
                continue
                
            latest = analysis.price_history[-1]
            close = float(latest.close)
            willy = float(analysis.technical_indicators.willy_vwap)
            upper = float(latest.vwap_upper) if latest.vwap_upper is not None else willy * 1.10
            lower = float(latest.vwap_lower) if latest.vwap_lower is not None else willy * 0.90
            
            # Determine Posture & Recommendation
            if close > upper:
                posture = "Overbought (Above Upper ATR)"
                recommendation = "SELL / TAKE PROFITS"
                details = [
                    f"Price (${close:.2f}) has broken above the 2.0 ATR Upper Band (${upper:.2f}).",
                    "This signifies an extremely overextended bullish swing with high probability of near-term mean reversion.",
                    f"Willy VWAP Dynamic Support sits at ${willy:.2f}. Recommend locking in gains."
                ]
            elif close < lower:
                posture = "Oversold (Below Lower ATR)"
                recommendation = "BUY / ACCUMULATE"
                details = [
                    f"Price (${close:.2f}) has fallen below the 2.0 ATR Lower Band (${lower:.2f}).",
                    "This indicates highly oversold conditions within the dynamic volatility channel.",
                    f"Willy VWAP Dynamic Pivot sits at ${willy:.2f}. Bounces off this level provide a highly defined risk/reward ratio."
                ]
            elif close > willy:
                posture = "Bullish Swing (Mid-channel)"
                recommendation = "HOLD"
                details = [
                    f"Price (${close:.2f}) is in an orderly upward trend above the Willy VWAP Dynamic Anchor (${willy:.2f}).",
                    f"Upward momentum is intact. The nearest resistance target sits at the upper ATR line (${upper:.2f}).",
                    "Maintain current swing long postures."
                ]
            else:
                posture = "Bearish Swing (Retraction Zone)"
                recommendation = "HOLD / WATCH FOR BUY"
                details = [
                    f"Price (${close:.2f}) is retracing in a bearish short-term swing below the Willy VWAP pivot (${willy:.2f}).",
                    f"Approaching the lower ATR support envelope at ${lower:.2f}.",
                    "Hold current shares but watch for a volume-supported bounce near the support boundary to add exposure."
                ]
                
            items.append(StockAnalysisItem(
                symbol=ticker.upper(),
                close=close,
                willy_vwap=willy,
                vwap_upper=upper,
                vwap_lower=lower,
                posture=posture,
                recommendation=recommendation,
                details=details
            ))
        except Exception as e:
            print(f"Error processing {ticker} in /api/run-analysis: {e}")
            
    response_data = PortfolioAnalysisResponse(
        filename=safe_filename,
        items=items,
        status="complete"
    )
    
    # Persist the dynamic calculations to last_analysis.json
    try:
        last_analysis_path = os.path.join(BASE_DIR, "last_analysis.json")
        with open(last_analysis_path, "w", encoding="utf-8") as f:
            json.dump(response_data.model_dump(), f, indent=2)
    except Exception as e:
        print(f"Error persisting last_analysis.json: {e}")
        
    background_tasks.add_task(run_take_screenshots_script, safe_filename)
    
    # Return with status triggered so the frontend knows background CAPTURE has started
    response_data.status = "triggered"
    return response_data

@app.get("/api/last-analysis", response_model=PortfolioAnalysisResponse)
def get_last_analysis() -> PortfolioAnalysisResponse:
    last_analysis_path = os.path.join(BASE_DIR, "last_analysis.json")
    if os.path.exists(last_analysis_path):
        try:
            with open(last_analysis_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return PortfolioAnalysisResponse(**data)
        except Exception as e:
            print(f"Error loading last_analysis.json: {e}")
            
    return PortfolioAnalysisResponse(
        filename="",
        items=[],
        status="idle"
    )

@app.post("/api/save-analysis-report")
def save_analysis_report(req: SaveReportRequest):
    # 1. Prevent Path Traversal and ensure file extension is .md
    safe_filename = os.path.basename(req.filename)
    if not safe_filename.endswith(".md"):
        safe_filename += ".md"
    
    # 2. Check if we have last analysis
    last_analysis_path = os.path.join(BASE_DIR, "last_analysis.json")
    if not os.path.exists(last_analysis_path):
        raise HTTPException(status_code=404, detail="No active analysis data found. Run Live Analysis first.")
        
    try:
        with open(last_analysis_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            portfolio_data = PortfolioAnalysisResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read analysis data: {str(e)}")
        
    if not portfolio_data.items:
        raise HTTPException(status_code=400, detail="Analysis data is empty. Run Live Analysis first.")
        
    # 3. Build Markdown content
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    md = []
    md.append(f"# Strategic Alpha Portfolio Analysis Report")
    md.append("")
    md.append(f"- **Generated:** {timestamp}")
    md.append(f"- **Source Portfolio:** `{portfolio_data.filename}`")
    md.append("")
    md.append("## Executive Summary")
    md.append("")
    
    # Calculate stats
    total_tickers = len(portfolio_data.items)
    buys = sum(1 for item in portfolio_data.items if "BUY" in item.recommendation.upper())
    sells = sum(1 for item in portfolio_data.items if "SELL" in item.recommendation.upper())
    holds = total_tickers - buys - sells
    
    md.append(f"- **Total Tickers Analyzed:** {total_tickers}")
    md.append(f"- **BUY / ACCUMULATE Recommendations:** {buys}")
    md.append(f"- **SELL / TAKE PROFITS Recommendations:** {sells}")
    md.append(f"- **HOLD / WATCH Recommendations:** {holds}")
    md.append("")
    
    # 4. Action Matrix Table
    md.append("## Action Matrix Table")
    md.append("")
    md.append("| Ticker | Current Price ($) | Willy VWAP Support ($) | ATR Lower Support ($) | ATR Upper Resistance ($) | Posture | Recommendation |")
    md.append("| :--- | :---: | :---: | :---: | :---: | :--- | :--- |")
    for item in portfolio_data.items:
        md.append(f"| **{item.symbol}** | {item.close:.2f} | {item.willy_vwap:.2f} | {item.vwap_lower:.2f} | {item.vwap_upper:.2f} | {item.posture} | **{item.recommendation}** |")
    md.append("")
    
    # 5. Detailed Ticker Justifications & Charts
    md.append("## Detailed Technical Justifications")
    md.append("")
    
    # Relative path from base dir to images: frontend/public/images_advanced/
    for item in portfolio_data.items:
        md.append(f"### {item.symbol} - {item.recommendation}")
        md.append("")
        md.append(f"- **Current Close Price:** ${item.close:.2f}")
        md.append(f"- **Willy VWAP Dynamic Support:** ${item.willy_vwap:.2f}")
        md.append(f"- **ATR Boundary Envelope:** ${item.vwap_lower:.2f} (Lower Support) to ${item.vwap_upper:.2f} (Upper Resistance)")
        md.append(f"- **Technical Posture:** {item.posture}")
        md.append("")
        md.append("#### Justification Bulletins:")
        for detail in item.details:
            md.append(f"- {detail}")
        md.append("")
        
        # Verify if chart image exists
        image_name = f"{item.symbol}_advanced_chart.png"
        image_rel_path = os.path.join("frontend", "public", "images_advanced", image_name)
        image_abs_path = os.path.join(BASE_DIR, image_rel_path)
        
        # Render dynamic screenshot
        md.append("#### Technical Analysis Chart")
        md.append("")
        if os.path.exists(image_abs_path):
            md.append(f"![{item.symbol} Technical Chart](frontend/public/images_advanced/{image_name})")
        else:
            md.append("> *Note: Chart screenshot generation is in progress or unavailable for this ticker.*")
        md.append("")
        md.append("---")
        md.append("")
        
    markdown_content = "\n".join(md)
    
    # 6. Write Markdown file to base directory
    output_path = os.path.join(BASE_DIR, safe_filename)
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        return {"status": "success", "message": f"Successfully saved analysis report to {safe_filename}", "filepath": output_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write markdown report: {str(e)}")

@app.get("/api/backtest-30d")
def get_30d_backtest(period: str = "1m"):
    try:
        result = execute_30d_backtest(strategy_num=1, period=period)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest execution failed: {str(e)}")

@app.get("/api/backtest-30d/strategy2")
def get_30d_backtest_strategy2(period: str = "1m"):
    try:
        result = execute_30d_backtest(strategy_num=2, period=period)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest Strategy 2 execution failed: {str(e)}")

@app.get("/api/backtest-30d/strategy3")
def get_30d_backtest_strategy3(period: str = "1m"):
    try:
        result = execute_30d_backtest(strategy_num=3, period=period)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest Strategy 3 execution failed: {str(e)}")


@app.get("/api/backtest-30d/options")
def get_options_backtest(period: str = "1m", exit_mode: str = "intraday_2"):
    """
    Options backtesting endpoint.
    Uses Strategy 1 screening (5 filters, top-5 by 1-wk strategy value).
    Buys ATM weekly CALL options priced via Black-Scholes.
    
    Query params:
      period:    '1w', '1m', '3m', '6m', '1y'
      exit_mode: 'intraday_2', 'intraday_3', 'intraday_5', 'intraday_7',
                 'intraday_10', 'intraday_12', 'intraday_14', 'intraday_21',
                 'intraday', 'expiry'
    """
    try:
        result = execute_options_backtest(period=period, exit_mode=exit_mode)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Options backtest execution failed: {str(e)}")


@app.get("/api/backtest-30d/options-trend")
def get_options_trend_backtest(period: str = "1m"):
    """
    Trend-Filtered 1-Month Call Options Backtest Endpoint (Held 1 Week).
    Screens tickers on day T by Volume, RSI, MACD, and positive Trend (Slope % / Std %).
    Ranks top 5 by Trend score, purchases 1-month ATM calls ($2k per trade), and exits 1 week later.
    """
    try:
        result = execute_trend_options_backtest(period=period)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trend Options backtest execution failed: {str(e)}")


@app.get("/api/backtest-30d/options-slope")
def get_options_slope_backtest(period: str = "1m", slope_period: str = "2w"):
    """
    Slope % Filtered 1-Month Call Options Backtest Endpoint (Held 1 Week).
    Screens tickers on day T by Volume, RSI, MACD, and positive Slope % over selected Call Option Stats Matrix period.
    Ranks top 5 by Slope % descending, purchases 1-month ATM calls ($2k per trade), and exits 1 week later.
    """
    try:
        result = execute_slope_options_backtest(period=period, slope_period=slope_period)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Slope Options backtest execution failed: {str(e)}")


@app.get("/api/backtest-30d/options-slope-2day")
def get_options_slope_2day_backtest(period: str = "1m", slope_period: str = "2w"):
    """
    Slope % Filtered 1-Month Call Options Backtest Endpoint (Held 2 Days).
    Screens tickers on day T by Volume, RSI, MACD, and positive Slope % over selected Call Option Stats Matrix period.
    Ranks top 5 by Slope % descending, purchases 1-month ATM calls ($2k per trade), and exits 2 days later.
    """
    try:
        result = execute_slope_options_2day_backtest(period=period, slope_period=slope_period)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Slope 2-Day Options backtest execution failed: {str(e)}")


@app.post("/api/get-options-data")
@app.get("/api/get-options-data")
def get_options_data():
    """
    Fetches 1W, 2W, and 3W Call & Put options data for all tickers in Dow 30, Nasdaq 100, and S&P 500.
    Logs output in Format A schema to OptionsData.csv.
    """
    try:
        res = generate_and_save_options_data()
        if res.get("status") == "error":
            raise HTTPException(status_code=500, detail=res.get("message"))
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate options data: {str(e)}")


@app.get("/api/call-option-stats", response_model=CallOptionStatsResponse)
def get_call_option_stats():
    """
    Evaluates 14 quantitative Call Option indicators for all constituent tickers of Dow 30, Nasdaq 100, and S&P 500.
    Returns ranked TickerCallStats matrix with +ve indicator counts in Column 1.
    """
    try:
        res = generate_call_option_stats()
        if res.status == "error":
            raise HTTPException(status_code=500, detail="Failed to evaluate Call Option Stats.")
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Call Option Stats evaluation failed: {str(e)}")
