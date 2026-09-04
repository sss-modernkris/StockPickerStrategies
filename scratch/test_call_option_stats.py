import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from services.call_option_stats_service import generate_call_option_stats

if __name__ == "__main__":
    print("Testing generate_call_option_stats()...")
    res = generate_call_option_stats()
    print("Status:", res.status)
    print("Total tickers evaluated:", res.total_tickers)
    if res.items:
        top_item = res.items[0]
        print(f"Top Ticker: {top_item.symbol} (+ve Score: {top_item.positive_count}/{top_item.total_indicators}, {top_item.score_pct}%)")
        print(f"  1W Slope: {top_item.slope_1w}, 1W Std: {top_item.std_1w}")
        print(f"  2W Slope: {top_item.slope_2w}, 2W Std: {top_item.std_2w}")
        print(f"  4W Slope: {top_item.slope_4w}, 4W Std: {top_item.std_4w}")
        print("Indicators sample:")
        for k, v in list(top_item.indicators.items())[:5]:
            print(f"  {k}: positive={v.positive}, val='{v.value_str}'")
