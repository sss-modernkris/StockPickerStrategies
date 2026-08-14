import os
import csv
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import yfinance as yf

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_universe():
    tickers = set()
    for filename in ["DOW100.csv", "Nasdaq100.csv", "SP100.csv"]:
        path = os.path.join(BASE_DIR, filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    symbol = (row.get('Symbol') or row.get('Ticker', '')).strip().upper()
                    if symbol:
                        tickers.add(symbol)
    return sorted(list(tickers))

def test_full_universe():
    tickers = load_universe()
    print(f"Total unique tickers: {len(tickers)}")
    print("Downloading daily batch for all tickers...")
    daily_data = yf.download(tickers, period="1y", interval="1d")
    print(f"Daily shape: {daily_data.shape}")
    print("Downloading 30m batch for all tickers...")
    data_30m = yf.download(tickers, period="1mo", interval="30m")
    print(f"30m shape: {data_30m.shape}")

if __name__ == "__main__":
    test_full_universe()
