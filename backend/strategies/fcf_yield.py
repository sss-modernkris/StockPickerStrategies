from typing import Dict, Any
from backend.models import StrategyResult

def evaluate_fcf_yield(data: Dict[str, Any]) -> StrategyResult:
    """
    Free Cash Flow Yield:
    Target FCF Yield (FCF / EV) > 5%
    Combined with 12-month momentum > 0.
    """
    info = data.get("info", {})
    history = data.get("history")
    
    score = 0
    max_score = 2
    justifications = []
    
    fcf = info.get("freeCashflow")
    ev = info.get("enterpriseValue")
    
    if fcf and ev and ev > 0:
        fcf_yield = fcf / ev
        if fcf_yield > 0.05:
            score += 1
            justifications.append(f"FCF Yield is highly attractive at {fcf_yield*100:.2f}% (> 5%).")
        else:
            justifications.append(f"FCF Yield is {fcf_yield*100:.2f}%, below the 5% target.")
    else:
        justifications.append("FCF Yield calculation unavailable (missing FCF or EV data).")
        
    # Momentum
    if history is not None and len(history) >= 252:
        start_price = history["Close"].iloc[-252]
        end_price = history["Close"].iloc[-1]
        ret = (end_price - start_price) / start_price
        if ret > 0:
            score += 1
            justifications.append(f"Positive 12-month trailing momentum: {ret*100:.1f}%.")
        else:
            justifications.append(f"Negative 12-month momentum: {ret*100:.1f}%.")
    else:
        justifications.append("Insufficient historical data for momentum calculation.")

    match_percentage = int((score / max_score) * 100)
    
    return StrategyResult(
        strategy_name="FCF Yield",
        match_percentage=match_percentage,
        justifications=justifications
    )
