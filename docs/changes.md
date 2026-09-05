# Project Changes & Release History

This document maintains a chronological record of architectural updates, feature rollouts, branch merges, and refactoring milestones for the **Strategic Alpha Platform**.

---

## 1. Release v20260905 - 24x7 Autonomous Daily Agentic Pipeline for Docker

### ⏰ Autonomous 24x7 In-Process Background Scheduler (`backend/agents/`)
- **Continuous Clock Monitoring Engine** ([backend/agents/pipeline.py](../backend/agents/pipeline.py)):
  - Built an autonomous background daemon scheduler thread (`_scheduler_loop`) running continuously within the 24x7 Docker container backend.
  - **Market Timezone Alignment**: Implemented timezone-aware evaluation using Python standard library `zoneinfo.ZoneInfo("America/New_York")`, guaranteeing exact 2:00 PM US Eastern Market Time (EST/EDT) execution regardless of host/Docker container system timezone.
  - **Trading Day Filter**: Automatically restricts scheduled executions to active market weekdays (Monday through Friday).
  - **Exact-Once Execution Guarantee**: Enforces date-based execution tracking (`last_scheduled_date`) to guarantee the pipeline runs precisely once per trading day.
  - **Dynamic Next-Run Calculation**: Calculates dynamic `next_run_time_est` taking into account upcoming weekdays, weekends, and daylight saving time (EST/EDT).
  - Added programmatic lifecycle management with `start_scheduler()` and `stop_scheduler()`.

### 🐳 Docker & FastAPI Application Lifecycle Integration (`backend/main.py`)
- **FastAPI Startup/Shutdown Hooks**:
  - Registered `@app.on_event("startup")` and `@app.on_event("shutdown")` lifecycle handlers to start the autonomous scheduler immediately when the backend container boots up and shut down cleanly on container termination.
- **Import Compatibility**:
  - Updated [backend/agents/__init__.py](../backend/agents/__init__.py) to support both root-level and package-relative module imports across container and local environments.

### 🖥️ Frontend 24x7 Auto-Trigger Badge & Telemetry (`frontend/src/components/BrokersPanel.tsx`)
- **Live Scheduler Telemetry**:
  - Expanded `PipelineStatus` interface to include `scheduler_enabled`, `scheduler_running`, and `next_run_time_est`.
  - Added a live pulsating green badge displaying `24x7 Auto-Trigger: Next: <YYYY-MM-DD HH:MM:SS EST/EDT>` next to the manual execution button.

### 🏷️ Version Synchronization (`v20260905`)
- Synchronized version tags across `README.md`, `frontend/src/app/page.tsx`, and `frontend/src/components/TickerSidebar.tsx`.

---

## 2. Release v20260904 - Call Option Stats Multi-Period Linear Fit & Trend Metrics

### 📊 Call Option Stats Matrix Multi-Period Linear Fit (`frontend/src/components/CallOptionStatsModal.tsx`)
- **Multi-Horizon Timeframe Selector**:
  - Added interactive timeframe buttons (`1Wk`, `2Wk`, `4Wk`, `6Wk`, `3 months`, `6 months`) dynamically calculating Ordinary Least Squares (OLS) linear fit slope and standard deviation over 1-year price history.
- **Dynamic Trend Metrics & Normalized Ratios**:
  - Inserted 3 dynamic columns (**Trend**, **Slope %**, **Std %**) directly adjacent to the Price ($) column:
    - $\text{Slope \%} = \text{Slope} \times 100 / \text{Price}$ (measures percentage drift rate relative to spot price)
    - $\text{Std \%} = \text{Std Dev} \times 100 / \text{Price}$ (measures normalized dispersion relative to spot price)
    - $\text{Trend} = \text{Slope \%} / \text{Std \%}$ (signal-to-noise quality metric for directional momentum)
- **Interactive Sorting & Visual Cues**:
  - Fully sortable columns with color-coded positive/negative badges for immediate breakout identification.

### 📈 Compare Charts Matrix Expansion (`frontend/src/components/NormalizedComparePanel.tsx`)
- Added `Current Price`, OLS `Linear Fit Slope` ($m$), and `Residual Standard Deviation` ($\text{Std}$) columns to the summary metrics table with dynamic lookback recalculation.

### 📖 Strategy Glossary Quantitative Enhancements (`frontend/src/components/StrategyGlossary.tsx`)
- Added a full-width featured technical guide explaining the quantitative rationale for using positive Linear Fit Slope paired with low Residual Std Dev for high-probability Call Option momentum trades.

---

## 3. Release v20260829 / v20260830 - Unified Branch Merge & Agentic MCP Pipeline

### 🔄 Branch Integration & Merge (`origin/main` into `Krishna-ST`)
- **Unified Master Codebase**: Merged `origin/main` into `Krishna-ST` ([commit f8ba48b]), combining the AI Agentic Trading Sandbox, Robinhood Model Context Protocol (MCP) Server, Call Option Stats 14-Indicator Matrix, and Option Greeks calculation engine.
- **Conflict Resolution & Feature Retention**: Retained multi-mode options exit horizons (1W, 2W, 3W, 1M), dynamic benchmark comparisons (S&P 500 / NASDAQ), and synchronized scrolling layouts while integrating all upstream quantitative additions.

### 🤖 Autonomous AI Agentic Pipeline (`backend/agents/`)
- **Multi-Agent Orchestration Engine** ([backend/agents/pipeline.py](../backend/agents/pipeline.py)):
  - Built an automated daily pipeline executing end-to-end stock screening, signal scoring, and trade execution.
- **Backtester Agent** ([backend/agents/backtester_agent.py](../backend/agents/backtester_agent.py)):
  - Continuously analyzes technical indicators (RSI, Bollinger Bands, Dynamic Swing VWAP, SMA crossovers) to rank and surface top candidate tickers.
- **Broker Agent** ([backend/agents/broker_agent.py](../backend/agents/broker_agent.py)):
  - Evaluates risk-adjusted position sizing, parses capital allocation rules, and places paper orders through the MCP interface.
- **Antigravity Customization & Skills Integration**:
  - Implemented plugin manifest at [plugins/robinhood-agentic-trading/plugin.json](../.agents/plugins/robinhood-agentic-trading/plugin.json).
  - Added trading execution guardrails ([rules/trading_guardrails.md](../.agents/plugins/robinhood-agentic-trading/rules/trading_guardrails.md)).
  - Created automated workflow skill ([skills/automated-trading-pipeline/SKILL.md](../.agents/plugins/robinhood-agentic-trading/skills/automated-trading-pipeline/SKILL.md)).

### 🔌 Robinhood MCP Sandbox Server (`backend/mcp/`)
- **Model Context Protocol Implementation** ([backend/mcp/rh_mcp_server.py](../backend/mcp/rh_mcp_server.py)):
  - Standardized JSON-RPC 2.0 interface exposing Robinhood trading operations to LLM agents.
  - Implemented core tool handlers: `rh_get_account_profile`, `rh_get_positions`, `rh_get_stock_quote`, `rh_place_stock_order`, `rh_get_option_chains`, `rh_place_option_order`, and `rh_get_order_history`.
- **MCP Client Bridge** ([backend/mcp/mcp_client.py](../backend/mcp/mcp_client.py)):
  - Provides async client communication with the MCP server, enabling interactive UI and CLI agent dispatch.
- **Interactive Broker Dashboard** ([frontend/src/components/BrokersPanel.tsx](../frontend/src/components/BrokersPanel.tsx)):
  - Real-time display of simulated portfolio balances, position tables, order history, and manual/automated agent trigger buttons.

### 📊 Multi-Horizon Options Exit Evaluation
- **Dynamic Holding Horizons** ([backend/services/backtester.py](/backend/services/backtester.py)):
  - Evaluates Call and Put options across 1-Week, 2-Week, 3-Week, and 1-Month holding periods.
- **Index Benchmark Baseline Overlays**:
  - Compares strategy returns directly against S&P 500 (`^GSPC`) and NASDAQ Composite (`^IXIC`) benchmarks across matched holding periods.

### 📚 Documentation Hub Reorganization
- **Centralized Docs Hub** ([docs/README.md](../docs/README.md)):
  - Consolidated and organized all architectural guides, algorithm mathematics, operational manuals, and reports into the [docs/](../docs/) directory.
  - Created comprehensive master documentation ([docs/Documentation.md](../docs/Documentation.md)) covering all 11 quantitative strategy models, backtesting engines, and agent pipelines.
  - Added feature walkthrough guide ([docs/Options_Walkthrough.md](../docs/Options_Walkthrough.md)).

---

## 4. Release v20260828 - Call Option Analytics & Compare Matrix Enhancements

### 📈 Compare Charts Matrix Expansion
- **Ordinary Least Squares (OLS) Linear Fit Slope ($m$)**: Quantifies directional momentum and rate of price change over selected lookback intervals.
- **Residual Standard Deviation ($\text{Std}$)**: Measures price dispersion and volatility relative to the linear trendline.
- **Real-Time Current Price Integration**: Embedded current price directly into matrix comparisons for instant valuation context.
- **Dynamic Lookback Recalculation**: Recomputes slope and volatility metrics on the fly as time horizons shift (1M, 3M, 6M, 1Y).

### 📖 Strategy Glossary Quantitative Enhancements
- **Options Selection Criteria**: Added a dedicated reference card in [StrategyGlossary.tsx](../frontend/src/components/StrategyGlossary.tsx) detailing how positive Linear Fit Slope paired with low Residual Std Dev identifies high-probability Call Option momentum breakouts.

### 🧮 Option Greeks Calculation Engine
- **Full Greeks Coverage**: Computed Black-Scholes Greeks ($\Delta$, $\Gamma$, $\Theta$, $\mathcal{V}$, $\rho$) for Call and Put options across 1W, 2W, and 3W expirations.
- **Data Export**: Results automatically processed and written to `OptionsData.csv`.

---

## 5. Release v20260820 - Call Option Stats Matrix Modal & UI Ergonomics

### 📋 Call Option Stats Modal (14 Indicators)
- **Comprehensive Deep-Dive View** ([CallOptionStatsModal.tsx](../frontend/src/components/CallOptionStatsModal.tsx)):
  - Interactive modal displaying 14 technical and statistical indicators for candidate tickers.
  - Backend processing engine in [call_option_stats_service.py](../backend/services/call_option_stats_service.py) with CSV caching in `Call_Option_Stats.csv`.

### 🖥️ High-Density Table Usability Enhancements
- **Dual Synchronized Scrollbars**: Added synchronized top and bottom horizontal scrollbars to [ComparisonTable.tsx](../frontend/src/components/ComparisonTable.tsx) and [CallOptionStatsModal.tsx](../frontend/src/components/CallOptionStatsModal.tsx).
- **Sticky Column Headers & Identifiers**: Frozen ticker columns ensure persistent row context during wide horizontal panning.

---

## 6. Release v20260807 - Benchmark Comparison & Timeframe Selectors

- **Multi-Timeframe Backtesting**: Configurable backtest windows (1Wk, 1M, 3M, 6M, 1Y) on the Top Tickers page.
- **Benchmark Alpha Overlay**: Integrated baseline comparison curves for S&P 500 and NASDAQ.
- **Automated Alerts & Email Integration**: Notification pipeline for daily technical trigger signals.

---

## 7. Release v20260703 - Compare Matrix Ergonomics & Strategy 3 Integration

- **Compare Charts Multi-Select**: Added "Select All" and "Deselect All" action buttons for bulk ticker comparison.
- **Strategy 3 Backtester**: Added 30-Day rolling backtest evaluation for Strategy 3 and corresponding glossary reference cards.

---

## 8. Strategic Alpha Dashboard (411x)

### Feature Synchronizations (from v405)
- **Paper Study Page**: Restored full feature parity, including interactive transaction ledger and color-coded P&L tracking without external broker dependencies.
- **Glossary Page**: Updated with comprehensive technical definitions, including **VWAP ATR Band** methodology (14-day ATR, 2.0 multiplier).

### Dashboard Capabilities
- **Auto-Fill Price**: Integrated real-time price fetcher for Paper Study ticker input using `yfinance`.
- **Custom Portfolio Loading**: Dynamic loading of root CSV portfolios with `localStorage` persistence.
- **Sidebar Workflow**: Repositioned portfolio source selector to the top of the navigation sidebar.

---

## 9. Financial ETL Pipeline (20260412-Trans)

### ETL Script Implementation (`etl_script.py`)
- Standardized financial CSV exports from **Ameriprise (AKD)** and **Fidelity (FKD/FSD)** into a uniform 17-column target schema.
- **Cash Normalization**: Standardized money-market funds (`SPAXX**`, `CORE**`, `FCASH**`) to the identifier **`$$CASH_TX`**.
- **Ticker & Numeric Sanitization**: Unified ticker variations (e.g., `BRK'B` / `BRKB` $\rightarrow$ `BRK-B`), stripped formatting characters (`$`, `,`), and cleared transient columns.

