import os
import sys

backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, backend_path)

from services.backtester import execute_30d_backtest

if __name__ == "__main__":
    for period in ["1w", "1m", "3m", "6m", "1y"]:
        print(f"\n--- Testing Strategy 1 with period={period} ---")
        res = execute_30d_backtest(strategy_num=1, period=period)
        print(f"Period: {period}")
        print(f"Total Profit: ${res['total_profit']:.2f}")
        print(f"ROI Pct: {res['roi_pct']:.2f}%")
        print(f"S&P 500 % Change: {res.get('sp500_pct_change', 0.0):.2f}%")
        print(f"Trades count: {len(res['trades'])}")
