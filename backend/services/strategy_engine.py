from typing import Dict, Any
from backend.models import TickerAnalysis, StrategyResult
from backend.services.finance_client import fetch_ticker_data

from backend.strategies.can_slim import evaluate_can_slim
from backend.strategies.fcf_yield import evaluate_fcf_yield
from backend.strategies.garp import evaluate_garp
from backend.strategies.low_vol_quality import evaluate_low_vol
from backend.strategies.pure_growth import evaluate_pure_growth
from backend.strategies.fundamental_technical import evaluate_fund_tech
from backend.strategies.sentiment_quant import evaluate_sentiment
from backend.strategies.earnings_momentum import evaluate_earnings_mom
from backend.strategies.dividend_aristocrat import evaluate_dividend
from backend.strategies.machine_learning import evaluate_ml_engine

def run_all_strategies(symbol: str) -> TickerAnalysis:
    try:
        data = fetch_ticker_data(symbol)
    except Exception as e:
        return TickerAnalysis(
            symbol=symbol,
            strategies=[],
            error=f"Failed to fetch data for {symbol}: {str(e)}"
        )

    results = []
    
    # Run all 10 strategies
    results.append(evaluate_can_slim(data))
    results.append(evaluate_fcf_yield(data))
    results.append(evaluate_garp(data))
    results.append(evaluate_low_vol(data))
    results.append(evaluate_pure_growth(data))
    results.append(evaluate_fund_tech(data))
    results.append(evaluate_sentiment(data))
    results.append(evaluate_earnings_mom(data))
    results.append(evaluate_dividend(data))
    
    # ML Engine is special as it returns additional fields
    ml_result, alpha_prob, top_factor = evaluate_ml_engine(data)
    results.append(ml_result)
    
    # Extract recent price history for frontend charts (e.g. last 6 months)
    price_history = []
    if data.get("history") is not None and not data["history"].empty:
        hist = data["history"].tail(126) # ~6 months
        for date, row in hist.iterrows():
            price_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "close": float(row["Close"])
            })

    return TickerAnalysis(
        symbol=symbol,
        strategies=results,
        alpha_probability=alpha_prob,
        top_factor=top_factor,
        price_history=price_history,
        raw_data=data.get("info")
    )
