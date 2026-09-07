"""
Backtester Agent
Automates daily stock screening and 1-week systematic backtesting on the major indices (Dow 30, Nasdaq 100, S&P 500).
Generates actionable stock and options execution signals for the Broker Agent.
"""

import csv
import datetime
import logging
import math
import os
import sys
from typing import Any, Dict, List, Tuple

import pandas as pd
import numpy as np

# Adjust path for backend modules
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(BACKEND_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.backtester import (
    load_universe_tickers,
    get_backtest_data,
    run_willy_backtest_py,
    get_atm_strike,
    black_scholes_call,
    calc_historical_volatility
)

logger = logging.getLogger("BacktesterAgent")

class BacktesterAgent:
    """Specialized AI Agent that systematically screens and backtests market universe daily."""

    def __init__(self, name: str = "Backtester Agent"):
        self.name = name
        self.trigger_schedule = "14:00 EST (Every Trading Day)"
        logger.info(f"{self.name} initialized. Trigger schedule: {self.trigger_schedule}")

    def run_daily_analysis(self) -> Dict[str, Any]:
        """
        Executes Strategy 1 (1-Week lookback) screening on Dow 30, Nasdaq 100, and S&P 500 constituents.
        Identifies high-viability setups and generates ranked execution recommendations.
        """
        start_time = datetime.datetime.now()
        logger.info(f"[{self.name}] Starting systematic Strategy 1 (1-Week) backtest analysis...")

        # 1. Load universe tickers
        tickers = load_universe_tickers()
        indicators, daily_data, data_30m = get_backtest_data(tickers)

        if not indicators or daily_data is None or daily_data.empty:
            logger.error(f"[{self.name}] Failed to retrieve market indicator dataset.")
            return {
                "success": False,
                "error": "Market data unavailable for backtest execution",
                "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S EST")
            }

        all_dates = sorted(list(daily_data.index))
        if len(all_dates) < 5:
            return {"success": False, "error": "Insufficient market history"}

        latest_date = all_dates[-1]
        one_week_start = latest_date - datetime.timedelta(days=7)

        screened_candidates = []

        # 2. Apply Strategy 1 Criteria (5 quantitative filters)
        for ticker in tickers:
            df = indicators.get(ticker)
            if df is None or latest_date not in df.index:
                continue

            row = df.loc[latest_date]
            close = float(row.get('Close', 0.0))
            willy_vwap = float(row.get('willy_vwap', 0.0))
            macd_hist = float(row.get('macd_hist', 0.0))
            macd_slope = float(row.get('macd_slope', 0.0))
            rsi_14 = float(row.get('rsi_14', 0.0))

            if any(pd.isna(x) or x <= 0 for x in [close, willy_vwap]):
                continue
            if any(pd.isna(x) for x in [macd_hist, macd_slope, rsi_14]):
                continue

            # Filter 1: Willy Market = Bull (Price > Willy VWAP)
            if close <= willy_vwap:
                continue

            # Filter 2: 1-Week Strategy Value > $10,000
            slice_df = df.loc[one_week_start:latest_date]
            strat_val_1w = run_willy_backtest_py(slice_df, 10000.0)
            if strat_val_1w <= 10000.0:
                continue

            # Filter 3: MACD Hist in (-0.5, 0.5)
            if macd_hist <= -0.5 or macd_hist >= 0.5:
                continue

            # Filter 4: MACD Slope > 0
            if macd_slope <= 0:
                continue

            # Filter 5: RSI 14 in (30, 70)
            if rsi_14 <= 30 or rsi_14 >= 70:
                continue

            # Compute Historical Volatility (30-day realized)
            closes_history = df.loc[:latest_date, 'Close'].dropna()
            sigma = calc_historical_volatility(closes_history, window=30)
            strike = get_atm_strike(close)

            # Sizing & Option signal estimation (Weekly option ~7 DTE)
            total_T_years = 7.0 / 365.0
            r_rate = 0.05
            call_premium = black_scholes_call(
                S=close,
                K=strike,
                T_years=total_T_years,
                r=r_rate,
                sigma=sigma
            )

            # Contract sizing for $2,000 position
            contracts = int(2000.0 / (call_premium * 100.0)) if call_premium > 0 else 1
            if contracts < 1:
                contracts = 1

            screened_candidates.append({
                "symbol": ticker,
                "strategy_value_1w": float(strat_val_1w),
                "strategy_return_pct": round(((strat_val_1w - 10000.0) / 10000.0) * 100.0, 2),
                "current_price": round(close, 2),
                "willy_market": "Bull",
                "willy_vwap": round(willy_vwap, 2),
                "macd_hist": round(macd_hist, 3),
                "macd_slope": round(macd_slope, 4),
                "rsi_14": round(rsi_14, 1),
                "iv": round(sigma, 3),
                "stock_signal": {
                    "action": "BUY",
                    "target_price": round(close, 2),
                    "suggested_budget": 2000.0,
                    "suggested_shares": int(2000.0 / close) if close > 0 else 0
                },
                "option_signal": {
                    "action": "BUY",
                    "option_type": "CALL",
                    "strike": float(strike),
                    "expiry_date": (latest_date.date() + datetime.timedelta(days=7)).strftime("%Y-%m-%d"),
                    "estimated_premium": round(call_premium, 2),
                    "contracts": contracts,
                    "estimated_position_cost": round(contracts * call_premium * 100.0, 2)
                }
            })

        # 3. Rank candidates by 1-Week Strategy Value in descending order
        screened_candidates.sort(key=lambda x: x["strategy_value_1w"], reverse=True)
        top_recommendations = screened_candidates[:5]

        # Assign ranks
        for idx, item in enumerate(top_recommendations, 1):
            item["rank"] = idx

        end_time = datetime.datetime.now()
        execution_duration_sec = round((end_time - start_time).total_seconds(), 2)

        result_payload = {
            "success": True,
            "agent_name": self.name,
            "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S EST"),
            "trigger_schedule": self.trigger_schedule,
            "universe_scanned": len(tickers),
            "strategy": "Strategy 1 (1-Week Lookback Momentum Screener)",
            "total_qualified": len(screened_candidates),
            "top_ranked_count": len(top_recommendations),
            "ranked_recommendations": top_recommendations,
            "execution_duration_sec": execution_duration_sec,
            "summary_signal": f"Identified {len(top_recommendations)} high-viability setups from {len(tickers)} scanned index constituents."
        }

        logger.info(f"[{self.name}] Completed analysis: {len(top_recommendations)} recommendations generated in {execution_duration_sec}s")
        return result_payload

if __name__ == "__main__":
    agent = BacktesterAgent()
    res = agent.run_daily_analysis()
    import json
    print(json.dumps(res, indent=2))
