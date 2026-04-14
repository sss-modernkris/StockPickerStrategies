# Strategic Alpha Stock Picker Dashboard

The **Strategic Alpha Dashboard** is a high-performance, full-stack quantitative stock analysis platform. It combines traditional financial strategies with modern machine learning to provide deep insights into stock performance, technical indicators, and fundamental metrics.

Built with **Next.js 15**, **FastAPI**, and powered by **yfinance**, it offers a responsive, dark-mode optimized experience for traders and analysts.

---

## 🚀 Key Features & Pages

### 1. Dashboard (Main Evaluation)
The primary view for evaluating individual stocks. It runs **11 quantitative strategies** in real-time and provides a visual price trend for the last 6 months.
- **Match Percentages**: Instantly see how a stock aligns with proven strategies.
- **Bullish/Bearish Justifications**: Human-readable points explaining the "Why" behind the numbers.
- **ML Alpha Probability**: Predicts outperformance based on an XGBoost model.

![Dashboard View](images/dashboard_new.png)

### 2. Comparison Table
Track your entire portfolio at a glance.
- **Interactive Sorting**: Click any header (Ticker, CAN SLIM, FCF Yield, etc.) to sort.
- **Color-Coded Metrics**: Green ($\ge$ 75%), Yellow ($\ge$ 40%), and Red for quick visual filtering.
- **6-Month Sparklines**: Mini-charts for immediate trend comparison.

![Comparison Table](images/comparison_new.png)

### 3. Compare Charts (Relative Performance)
Visualize multiple stocks on a level playing field by indexing all selected assets to a baseline of 100.
- **Multi-Ticker Selection**: Overlay different companies to see who is leading the pack.
- **Timeframe Toggles**: Switch between 1-week, 1-month, 6-month, and 1-year views.

![Compare Charts](images/compare_charts_new.png)

### 4. Technicals & Advanced Charts
Deep dive into price action and momentum.
- **Technicals**: Real-time calculations for RSI, MACD, Bollinger Bands, and Moving Averages.
- **Advanced Charts**: TradingView-style visualization tracking MACD Histograms and RSI slopes.
- **WillyAlgo VWAP**: Specialized anchor-based price analysis.

![Technicals View](images/technicals_new.png)
![Advanced Charts](images/adv_charts_new.png)

### 5. Raw Data & Strategy Glossary
- **Raw Data**: Access the unfiltered Fundamental Data payload (150+ metrics) from `yfinance`.
- **Glossary**: Comprehensive documentation of the internal methodology for all strategies.

![Raw Data](images/raw_data_new.png)
![Strategy Glossary](images/glossary_new.png)

### 6. Paper Study & Simulation
Log and track simulated transactions to practice strategy execution.
- **Auto-Fill Price**: Fetches real-time price when you enter a ticker.
- **P&L Tracking**: Automatically calculates unrealized gains based on your average buy price.
- **Persistent Ledger**: Transactions are saved to a local CSV for record-keeping.

![Paper Study](images/paper_study_new.png)

---

## 🛠️ The Strategy Engine

The dashboard evaluates every ticker against **11 distinct models**:

1.  **CAN SLIM**: Focuses on quarterly/annual EPS growth and current price strength.
2.  **FCF Yield**: Targets high free cash flow relative to enterprise value.
3.  **GARP**: Growth At a Reasonable Price (PEG ratio focus).
4.  **Low Volatility & Quality**: Selects stocks with stable price action and strong profitability.
5.  **Pure Growth**: High revenue and earnings trajectory.
6.  **Fundamental Technical**: Combines valuation with 50/200-day trend alignment.
7.  **Sentiment Quant**: Volume trends and momentum-based RSI analysis.
8.  **Earnings Momentum**: Focuses on revisions and surprises.
9.  **Dividend Aristocrat**: Reliability of income and payout ratios.
10. **Willy Algo (VWAP)**: Anchor-based volume-weighted price analysis with ATR bands.
11. **Machine Learning (XGBoost)**: A quantitative model predicting the probability of alpha outperformance.

---

## ⚙️ Setup & Installation

### Option 1: Docker (Recommended)
Ensure you have Docker and Docker Compose installed.
```bash
docker-compose up -d --build
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`

### Option 2: Manual Setup

#### Backend (FastAPI)
1. Navigate to `backend/`
2. Create and activate a virtual environment.
3. Install dependencies: `pip install -r requirements.txt`
4. Start the server:
```bash
python -m uvicorn main:app --host localhost --port 8080
```

#### Frontend (Next.js)
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Start the dev server:
```bash
npm run dev
```

---

## 📁 Data Management

- **Portfolio Selection**: Use the sidebar to upload or select custom CSV files as ticker sources.
- **CSV Format**: Ticker files should have a column header named `Symbol`.
- **Persistence**: Your selected portfolio and view preferences are saved to `localStorage` for seamless return visits.
