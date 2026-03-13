from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.models import TickerAnalysis, HistoryResponse
from backend.services.strategy_engine import run_all_strategies
from backend.services.history_client import fetch_batch_history
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
