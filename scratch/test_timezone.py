import yfinance as yf

def test_timezone():
    tickers = ["AAPL"]
    data_30m = yf.download(tickers, period="1mo", interval="30m")
    
    # Convert index timezone
    data_30m.index = data_30m.index.tz_convert("America/New_York")
    print("New York timestamps:")
    for dt in data_30m.index[:20]:
        print(dt)

if __name__ == "__main__":
    test_timezone()
