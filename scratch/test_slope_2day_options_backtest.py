import sys
import os

backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, backend_dir)

from services.backtester import execute_slope_options_2day_backtest

print("Testing execute_slope_options_2day_backtest(period='1m', slope_period='2w')...")
res = execute_slope_options_2day_backtest(period="1m", slope_period="2w")
print("Strategy Name:", res.get("strategy_name"))
print("Slope Period:", res.get("slope_period"))
print("Total Profit:", res.get("total_profit"))
print("ROI %:", res.get("roi_pct"))
print("S&P 500 % Change:", res.get("sp500_pct_change"))
print("Total Days in Ledger:", len(res.get("trades", [])))

if res.get("trades"):
    first_trade_day = res["trades"][0]
    print("Sample Day:", first_trade_day["screen_date"], "Buy:", first_trade_day["buy_date"], "Sell:", first_trade_day["sell_date"])
    print("Daily Profit:", first_trade_day["daily_profit"])
    print("Traded Tickers:", len(first_trade_day["tickers"]))
    if first_trade_day["tickers"]:
        print("First Ticker Detail:", first_trade_day["tickers"][0])

print("Test finished successfully!")
