import urllib.request
import json

def test_endpoint():
    url = "http://127.0.0.1:8080/api/backtest-30d"
    print(f"Requesting backtest from {url}...")
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            data = json.loads(response.read().decode())
            print("\n--- Backtest API Response ---")
            print(f"Total Profit: ${data.get('total_profit'):.2f}")
            print(f"ROI: {data.get('roi_pct'):.2f}%")
            trades = data.get('trades', [])
            print(f"Total trading days backtested: {len(trades)}")
            
            # Print a sample day
            if trades:
                sample_day = trades[0]
                print(f"\nSample Day Detail:")
                print(f"  Screen Date: {sample_day.get('screen_date')}")
                print(f"  Buy Date: {sample_day.get('buy_date')}")
                print(f"  Sell Date: {sample_day.get('sell_date')}")
                print(f"  Daily Profit: ${sample_day.get('daily_profit'):.2f}")
                print(f"  Tickers Traded:")
                for t in sample_day.get('tickers', []):
                    print(f"    - {t.get('ticker')}: Buy at {t.get('buy_price'):.2f}, Sell at {t.get('sell_price'):.2f}, profit: ${t.get('profit'):.2f}")
    except Exception as e:
        print(f"Error calling backtest endpoint: {e}")

if __name__ == "__main__":
    test_endpoint()
