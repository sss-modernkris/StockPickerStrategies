from typing import Dict, Any
from backend.models import StrategyResult

def evaluate_garp(data: Dict[str, Any]) -> StrategyResult:
    """
    GARP Strategy:
    Targets a PEG Ratio <= 1.0 (Growth at a Reasonable Price)
    """
    info = data.get("info", {})
    
    score = 0
    max_score = 1
    justifications = []
    
    peg = info.get("pegRatio")
    
    if peg is not None:
        if 0 < peg <= 1.0:
            score += 1
            justifications.append(f"Matches GARP because PEG is {peg:.2f} (<= 1.0).")
        elif peg < 0:
            justifications.append(f"PEG ratio is negative ({peg:.2f}), indicating earnings decline or inconsistencies.")
        else:
            justifications.append(f"Does not match GARP criteria; PEG is {peg:.2f} (> 1.0).")
    else:
        # fallback
        pe = info.get("trailingPE")
        growth = info.get("earningsGrowth")
        if pe and growth and growth > 0:
            synthetic_peg = pe / (growth * 100)
            if 0 < synthetic_peg <= 1.0:
                score += 1
                justifications.append(f"Matches GARP via estimated PEG {synthetic_peg:.2f}.")
            else:
                justifications.append(f"Estimated PEG is {synthetic_peg:.2f} (> 1.0).")
        else:
            justifications.append("PEG Ratio unavailable and insufficient data to estimate.")

    match_percentage = int((score / max_score) * 100)
    
    return StrategyResult(
        strategy_name="GARP",
        match_percentage=match_percentage,
        justifications=justifications
    )
