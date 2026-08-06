import yfinance as yf

def test_hourly_data():
    ticker = yf.Ticker("AAPL")
    history = ticker.history(period="1mo", interval="1h")
    print(history.head(10))
    print("Timestamps:")
    for dt in history.index[:15]:
        print(dt)

if __name__ == "__main__":
    test_hourly_data()
