import yfinance as yf

def test_intervals():
    for interval in ["30m", "15m", "5m"]:
        print(f"\n--- Testing interval: {interval} ---")
        try:
            ticker = yf.Ticker("AAPL")
            history = ticker.history(period="1mo", interval=interval)
            print(f"Total rows: {len(history)}")
            print("Timestamps:")
            # Find some timestamps around 11:00 and 15:00
            for dt in history.index:
                time_str = dt.strftime("%H:%M:%S")
                if time_str in ["11:00:00", "15:00:00", "10:45:00", "14:45:00", "11:15:00", "15:15:00"]:
                    print(dt)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_intervals()
