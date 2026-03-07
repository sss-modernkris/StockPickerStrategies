from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.models import TickerAnalysis
from backend.services.strategy_engine import run_all_strategies

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

@app.get("/api/analyze/{ticker}", response_model=TickerAnalysis)
def analyze_ticker(ticker: str) -> TickerAnalysis:
    analysis = run_all_strategies(ticker.upper())
    if analysis.error:
        # If there's an error in fetching, still returning 200 with error property for UI to display nicely
        pass
    return analysis
