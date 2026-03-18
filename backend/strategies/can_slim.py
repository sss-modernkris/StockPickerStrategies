from typing import Dict, Any
from models import StrategyResult

def evaluate_can_slim(data: Dict[str, Any]) -> StrategyResult:
    """
    CAN SLIM Strategy:
    C: Current quarterly EPS growth > 20%
    A: Annual EPS growth > 20%
    V: Volume trend (last volume > avg 50d volume)
    RS: Relative Strength (12m return > 0, proxy)
    """
    info = data.get("info", {})
    history = data.get("history")
    
    score = 0
    max_score = 4
    justifications = []
    
    # C - Current Quarterly EPS
    q_growth = info.get("earningsQuarterlyGrowth", 0)
    if q_growth and q_growth > 0.20:
        score += 1
        justifications.append(f"Strong current quarterly EPS growth: {q_growth*100:.1f}% (> 20%).")
    else:
        q_growth_disp = q_growth * 100 if q_growth else "N/A"
        justifications.append(f"Quarterly EPS growth is {q_growth_disp}%, lacking the 20% minimum.")

    # A - Annual EPS growth (proxy using revenue or earnings growth if available)
    # Since yfinance might just have 'revenueGrowth' or we use 'earningsGrowth'
    y_growth = info.get("earningsGrowth", 0)
    if y_growth and y_growth > 0.20:
        score += 1
        justifications.append(f"Strong annual earnings growth: {y_growth*100:.1f}% (> 20%).")
    else:
        y_growth_disp = y_growth * 100 if y_growth else "N/A"
        justifications.append(f"Annual earnings growth is {y_growth_disp}%.")

    # Volume
    if history is not None and len(history) >= 50:
        recent_vol = history["Volume"].iloc[-1]
        avg_vol = history["Volume"].iloc[-50:].mean()
        if recent_vol > avg_vol:
            score += 1
            justifications.append(f"Recent volume ({recent_vol:,.0f}) exceeds 50-day average ({avg_vol:,.0f}).")
        else:
            justifications.append("Recent volume fails to exceed the 50-day average.")
    else:
        justifications.append("Insufficient volume history.")

    # RS proxy (1 year return positive)
    if history is not None and len(history) >= 252:
        start_price = history["Close"].iloc[-252]
        end_price = history["Close"].iloc[-1]
        ret = (end_price - start_price) / start_price
        if ret > 0.2:
            score += 1
            justifications.append(f"Strong relative strength proxy (12-m return): {ret*100:.1f}% (> 20%).")
        else:
            justifications.append(f"12-month return is {ret*100:.1f}%, inadequate for relative strength.")
    else:
        justifications.append("Insufficient price history for RS calculation.")

    match_percentage = int((score / max_score) * 100)
    
    return StrategyResult(
        strategy_name="CAN SLIM",
        match_percentage=match_percentage,
        justifications=justifications
    )
