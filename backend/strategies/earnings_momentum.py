from typing import Dict, Any
from models import StrategyResult

def evaluate_earnings_mom(data: Dict[str, Any]) -> StrategyResult:
    """
    Earnings Momentum Strategy:
    Consistent earnings beats and upward revisions.
    We proxy this using strong forward EPS vs trailing EPS.
    """
    info = data.get("info", {})
    
    score = 0
    max_score = 1
    justifications = []
    
    forward_eps = info.get("forwardEps")
    trailing_eps = info.get("trailingEps")
    
    if forward_eps is not None and trailing_eps is not None and trailing_eps > 0:
        growth = (forward_eps - trailing_eps) / trailing_eps
        if growth > 0.10:
            score += 1
            justifications.append(f"Strong Earnings Momentum: Forward EPS (${forward_eps:.2f}) is {growth*100:.1f}% higher than Trailing EPS (${trailing_eps:.2f}).")
        elif growth > 0:
            justifications.append(f"Moderate Earnings Momentum: Forward EPS (${forward_eps:.2f}) is only {growth*100:.1f}% higher than trailing.")
        else:
            justifications.append(f"Negative Earnings Momentum: Forward EPS (${forward_eps:.2f}) is lower than trailing.")
    else:
        justifications.append("Insufficient data for Earnings Momentum (missing forward/trailing EPS).")

    match_percentage = int((score / max_score) * 100)
    
    return StrategyResult(
        strategy_name="Earnings Momentum",
        match_percentage=match_percentage,
        justifications=justifications
    )
