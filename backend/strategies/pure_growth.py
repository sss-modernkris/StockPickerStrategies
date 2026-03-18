from typing import Dict, Any
from models import StrategyResult

def evaluate_pure_growth(data: Dict[str, Any]) -> StrategyResult:
    """
    Pure Growth/Value Strategy:
    High Revenue CAGR vs P/B and P/E.
    For simplicity:
    Revenue Growth > 15%
    P/E < 30
    P/B < 5
    """
    info = data.get("info", {})
    
    score = 0
    max_score = 3
    justifications = []
    
    rev_growth = info.get("revenueGrowth")
    pe = info.get("trailingPE")
    pb = info.get("priceToBook")
    
    if rev_growth is not None:
        if rev_growth > 0.15:
            score += 1
            justifications.append(f"Strong Revenue Growth: {rev_growth*100:.1f}% (> 15%).")
        else:
            justifications.append(f"Revenue Growth: {rev_growth*100:.1f}%.")
    else:
        justifications.append("Revenue Growth data unavailable.")
        
    if pe is not None:
        if 0 < pe < 30:
            score += 1
            justifications.append(f"Reasonable P/E Ratio: {pe:.2f} (< 30).")
        else:
            justifications.append(f"P/E Ratio: {pe:.2f}.")
    else:
        justifications.append("P/E Ratio data unavailable.")
        
    if pb is not None:
        if 0 < pb < 5:
            score += 1
            justifications.append(f"Reasonable P/B Ratio: {pb:.2f} (< 5).")
        else:
            justifications.append(f"P/B Ratio: {pb:.2f}.")
    else:
        justifications.append("Price to Book data unavailable.")

    match_percentage = int((score / max_score) * 100)
    
    return StrategyResult(
        strategy_name="Pure Growth/Value",
        match_percentage=match_percentage,
        justifications=justifications
    )
