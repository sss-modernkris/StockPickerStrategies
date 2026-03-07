from typing import Dict, Any
from backend.models import StrategyResult

def evaluate_dividend(data: Dict[str, Any]) -> StrategyResult:
    """
    Dividend Aristocrat Approach:
    Attractive Yield with sustainable payout ratio.
    """
    info = data.get("info", {})
    
    score = 0
    max_score = 2
    justifications = []
    
    yield_val = info.get("dividendYield", 0) or 0
    payout = info.get("payoutRatio", 0) or 0
    
    if yield_val > 0.02:
        score += 1
        justifications.append(f"Attractive Dividend Yield: {yield_val*100:.2f}% (> 2%).")
    else:
        justifications.append(f"Dividend Yield: {yield_val*100:.2f}% (Below 2% target).")
        
    if 0 < payout < 0.75:
        score += 1
        justifications.append(f"Sustainable Payout Ratio: {payout*100:.1f}% (< 75%).")
    elif payout == 0:
        justifications.append("No common dividend payout recorded.")
    else:
        justifications.append(f"High Payout Ratio Risk: {payout*100:.1f}% (> 75%).")

    match_percentage = int((score / max_score) * 100)
    
    return StrategyResult(
        strategy_name="Dividend Value",
        match_percentage=match_percentage,
        justifications=justifications
    )
