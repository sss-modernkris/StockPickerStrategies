# Strategic Alpha Stock Picker Dashboard Documentation

The **Strategic Alpha Dashboard** is an institutional-grade, full-stack quantitative stock analysis platform. It integrates modern machine learning models, classical momentum indicators, and financial strategy models to evaluate equity tickers, backtest custom trading rules, simulate paper trading, and interface directly with broker gateways.

---

## 📋 1. Core Requirements

The application is engineered to meet the following functional and non-functional requirements:

### A. Real-Time Single-Ticker Evaluation
*   **11 Quantitative Strategy Models**: Calculate eligibility scores in real-time across 11 distinct investment methodologies (GARP, Pure Growth, CAN SLIM, Dividend Value, etc.).
*   **Justification Engine**: Dynamically synthesize human-readable explanations behind indicator calculations to provide transparent "Why" insights behind strategy matches.
*   **Machine Learning Integration**: Feed normalized ticker metrics into an XGBoost classifier model to output the probability of Alpha outperformance.
*   **Trend Visualization**: Render responsive 6-month historical price charts with overlays for technical review.

### B. Macroscopic Comparison & Backtesting
*   **Multi-Ticker Table**: Row-by-row visual comparison of all favorite or loaded tickers.
*   **Dynamic Sorting**: Sort tables on any strategy or ML score to easily rank assets.
*   **Willy VWAP Backtesting Engine**: Compute and compare the performance of the self-anchoring Willy VWAP strategy versus a passive "Buy & Hold" approach over a dynamic 4-month rolling window with initial capital of $10,000.
*   **Transaction Ledgers**: Generate a detailed chronological trade log for each backtest, tracking dates, actions (BUY/SELL), execution prices, shares, cash, and running portfolio values.

### C. Multi-Asset Compare Charts
*   **Normalized Baseline**: Chart multiple tickers on a relative performance index starting at a baseline of 100, enabling "apples-to-apples" comparison over multiple timeframes (1M, 3M, 6M, 1Y, 5Y).

### D. Technical Indicators & Advanced Charting
*   **Indicators Panel**: Display real-time computations of support/resistance bands, SMAs (9, 50, 200), EMA (20), RSI (14) with slopes, Bollinger Bands, and MACD.
*   **Automated Chart Capturing**: Standardize screenshot formatting using Playwright/Puppeteer with a 90% viewport scaling zoom factor to ensure no axis indicators or bottom oscillators are cropped.

### E. Paper Study & Simulation
*   **Multi-Portfolio Support**: Load custom CSV files from the workspace as active portfolios, with `localStorage` persistence.
*   **Real-Time Price Autofill**: Query `yfinance` to automatically populate current market prices on ticker input.
*   **Simulated Ledger**: Write transaction records (Date, Ticker, Quantity, Price, Total Cost, Running Cash) to persistent workspace CSV files while tracking real-time unrealized P&L.

### F. Broker Integration
*   **Interactive Brokers Gateway**: Securely connect to a local IB Gateway or TWS session using `ib_insync` to monitor account equity, cash balances, open orders, and active positions in a unified interface.

### G. Benchmark Index Comparative Analysis (Top Tickers)
*   **Index Multi-Select Support**: Load and compare constituents of major benchmark indices (`DOW100.csv` / Dow 30, `Nasdaq100.csv` / Nasdaq 100, and `SP100.csv` / S&P 500) using a multi-select toggle layout.
*   **Set Union Merging**: Add/remove index selections dynamically, automatically performing a set union of all tickers across the selected indices.
*   **Safe Chunked Loading**: Fetch analysis data in small, background-loaded consecutive chunks of 10 tickers to avoid Yahoo Finance query timeouts.
*   **Quantitative Screener**: Execute a 5-layer screen filtering matching symbols (Willy Market = Bull, 1-mo backtest strategy value > $10,000, MACD Hist within ±0.5, MACD Slope > 0, and RSI between 30 and 70) and save candidates to `Top_Tickers_to_buy.csv` in the project root.

---

## 🎨 2. Design Factors & Aesthetics

The design of the application prioritizes visual excellence and ergonomic efficiency:

*   **Aesthetic Glassmorphism UI**: Uses a premium, dark-mode optimized color palette. Cards and widgets feature translucent backgrounds with thin borders, backdrop blurs, and neon accents to resemble a modern trading desk terminal.
*   **Color-Coded Feedback**: Match percentages are styled dynamically—Green for strong matches ($\ge$ 75%), Yellow for moderate matches (40-74%), and Red for weak matches (< 40%)—ensuring readability.
*   **Sticky Ticker Column**: Lock target stock identifiers to the left edge of comparison grids to maintain context when scrolling horizontally through complex data sets.
*   **Performance Optimization**: Utilizes parallel API requests, history caching, and batch query endpoints to keep UI rendering latency below 700ms.

---

## 🏛️ 3. General Design & Architecture

```mermaid
graph TD
    User([User Browser]) <--> |Next.js 16 / React 19 / Recharts| Frontend[Next.js Dev Server]
    Frontend <--> |HTTP / JSON| Backend[FastAPI App]
    Backend <--> |yfinance API| Yahoo[Yahoo Finance API]
    Backend <--> |ib_insync Socket| IBGate[IB Gateway / TWS]
    Backend <--> |Local File I/O| CSV[(Workspace CSVs & JSONs)]
    
    subgraph Strategy Engine
        Backend --> FT[Fundamental & Technical Strategies]
        Backend --> ML[XGBoost ML Classifier]
        Backend --> Willy[Dynamic VWAP Anchor Engine]
    end
```

### A. Dynamic Self-Anchoring VWAP (WillyAlgo)
Unlike a standard daily-reset VWAP, the **WillyAlgo** dynamically detects market structure changes using a swing pivot detection algorithm (configured with a default 5-bar window). The moment a significant swing high or low is reached, the VWAP anchors reset to 0, tracking volume fair value from the pivot forward.

### B. Viewport Scaling Optimization
For automated portfolio reports, a dedicated script uses Chromium to capture technical charts. The viewport is styled with a `90%` zoom factor to ensure all bottom indicators, MACD labels, and legends are captured without cropping.

---

## 💻 4. Implementation Details

### A. Technical Stack
*   **Backend**: Python, FastAPI, Uvicorn, `yfinance` (Data Fetcher), `xgboost` & `scikit-learn` (Predictive Models), `ib_insync` (IBKR Bridge).
*   **Frontend**: Next.js 16, React 19, TypeScript, Recharts (Responsive Charting), Tailwind CSS (Glassmorphism design system).
*   **Dev-Ops/Execution**: Python Virtual Environment (`.venv`), Node Package Manager (Webpack bundler mode to ensure compatibility with Node v24).

### B. Core File Structure
*   [`backend/main.py`](file:///c:/Users/moder/AntiGravity/StockPickerStrategies-20260610/backend/main.py): Primary REST API containing endpoints for analysis, backtests, raw data, paper simulation, reports, and IB configuration.
*   [`backend/models.py`](file:///c:/Users/moder/AntiGravity/StockPickerStrategies-20260610/backend/models.py): Pydantic schema schemas mapping the data structures.
*   [`backend/strategies/`](file:///c:/Users/moder/AntiGravity/StockPickerStrategies-20260610/backend/strategies): Python modules evaluating individual strategy parameters (e.g., `can_slim.py`, `willy_algo.py`, `machine_learning.py`).
*   [`backend/services/strategy_engine.py`](file:///c:/Users/moder/AntiGravity/StockPickerStrategies-20260610/backend/services/strategy_engine.py): Main coordinator running the ticker metrics through all strategy models.
*   [`frontend/src/components/`](file:///c:/Users/moder/AntiGravity/StockPickerStrategies-20260610/frontend/src/components): React widgets (e.g., `AnalysisPanel.tsx`, `BacktestDetails.tsx`).

---

## 🚀 5. How to Use the Application

### A. Local Setup & Execution

#### 1. Start the Backend (FastAPI)
Navigate to the `backend/` directory, activate the Python virtual environment, and boot the server using Uvicorn:
```bash
cd backend
.venv\Scripts\activate
python -m uvicorn main:app --host localhost --port 8080
```
Verify the server status by visiting [http://localhost:8080/health](http://localhost:8080/health) (should return `{"status":"ok"}`).

#### 2. Start the Frontend (Next.js)
Navigate to the `frontend/` directory and boot the development server in Webpack mode:
```bash
cd frontend
npx next dev --webpack
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

### B. Interface Guide & Features

#### 1. Single Ticker Dashboard
*   **Action**: Enter a stock ticker (e.g., `AAPL`, `NVDA`) in the search bar and press enter.
*   **Insight**: The interface displays a 6-month historical trend line alongside the **Quant Factors Breakdown** panel showing dynamic percentages and justification cards. The **ML Alpha Probability** panel reports the predicted likelihood of outperforming the benchmark.

![Main Dashboard](images/dashboard_new.png)

#### 2. Portfolio Comparison & Backtesting
*   **Action**: Toggle to the *Comparison* tab to view the list of tracked tickers. Click on columns to sort them.
*   **Willy VWAP Backtest**: Select any ticker in the table to open the detailed backtest drawer. It simulates the self-anchored Willy VWAP trading rule over a rolling 4-month window, plotting the equity curve (Strategy vs. Buy & Hold) and generating a full transaction ledger.

![Comparison and Backtesting Panel](images/comparison_new.png)

#### 3. Relative Performance (Compare Charts)
*   **Action**: Click the *Compare Charts* tab.
*   **Insight**: Select multiple tickers to view their indexed performance. All selected stocks start at a baseline of `100` at the beginning of the timeframe, letting you compare percentage growth directly.

![Compare Charts Page](images/compare_charts_new.png)

#### 4. Technical Indicators
*   **Action**: Open the *Technical Indicators* tab.
*   **Insight**: Inspect short and long-term Moving Averages (9, 50, 200), Bollinger Bands, RSI momentum curves, and MACD histograms.

![Technicals Page](images/technicals_new.png)

#### 5. Advanced Charts
*   **Action**: Access the *Advanced Charts* screen.
*   **Insight**: View high-resolution TradingView-style charts. This view is optimized for Playwright captures, rendering bottom oscillators perfectly at a 90% zoom ratio.

![Advanced Charts Page](images/adv_charts_new.png)

#### 6. Raw Data Exploration
*   **Action**: Select the *Raw Data* tab.
*   **Insight**: Explore the raw financial payload (150+ metrics) directly parsed from `yfinance`, categorized by valuation, profile, trading, and balance sheet metrics.

![Raw Data Page](images/raw_data_new.png)

#### 7. Strategy Glossary
*   **Action**: Open the *Glossary* tab.
*   **Insight**: View the mathematical references, formulas, and metric boundaries for every strategy in the engine, including the exact hyperparameters of the XGBoost classifier.

![Strategy Glossary Page](images/glossary_new.png)

#### 8. Paper Study Simulation
*   **Action**: Toggle to the *Paper Study* page.
*   **Insight**: Run paper transactions. Enter a ticker to auto-fill its current price, select transaction type (Buy, Sell, Deposit, Withdraw), and input quantities. The local ledger updates instantly, displaying current cash, active holdings, and unrealized profit.

![Paper Study Page](images/paper_study_new.png)

#### 9. Broker Gateway
*   **Action**: Select the *Brokers* tab.
*   **Insight**: Log in with your Interactive Brokers gateway credentials. The screen retrieves your real-time buying power, net liquidation value, active orders, and live positions from TWS/IB Gateway.

![Brokers Page](images/brokers_new.png)

#### 10. Top Tickers Analysis & Buy Screener
*   **Action**: Select the *Top Tickers* tab. Click to toggle selection for **Dow 30**, **Nasdaq 100**, and **S&P 500**.
*   **Screener Action**: Click the **Run Buy Screen** button. View the list of matching candidates in the glassmorphic container, then click **Save to Top_Tickers_to_buy.csv** to output the buy list to the workspace.

![Top Tickers Page](images/top_tickers.png)

![Buy Screener Active](images/top_tickers_screened.png)

![Buy List CSV Saved Banner](images/top_tickers_saved.png)
