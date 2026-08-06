import yfinance as yf

def test_batch_download():
    tickers = ["AAPL", "MSFT", "GOOG", "AMZN"]
    
    print("Downloading 1mo 30m batch:")
    data_30m = yf.download(tickers, period="1mo", interval="30m")
    print(data_30m.head())
    print("Columns:", data_30m.columns)
    
    print("\nDownloading 1y 1d batch:")
    data_daily = yf.download(tickers, period="1y", interval="1d")
    print(data_daily.head())
    print("Columns:", data_daily.columns)

if __name__ == "__main__":
    test_batch_download()
