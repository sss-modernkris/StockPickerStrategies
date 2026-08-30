# Project Changes & Release History

This document maintains a chronological record of architectural updates, feature rollouts, branch merges, and refactoring milestones for the **Strategic Alpha Platform**.

---

## 1. Release v20260829 / v20260830 - Unified Branch Merge & Agentic MCP Pipeline

### 🔄 Branch Integration & Merge (`origin/main` into `Krishna-ST`)
- **Unified Master Codebase**: Merged `origin/main` into `Krishna-ST` ([commit f8ba48b]), combining the AI Agentic Trading Sandbox, Robinhood Model Context Protocol (MCP) Server, Call Option Stats 14-Indicator Matrix, and Option Greeks calculation engine.
- **Conflict Resolution & Feature Retention**: Retained multi-mode options exit horizons (1W, 2W, 3W, 1M), dynamic benchmark comparisons (S&P 500 / NASDAQ), and synchronized scrolling layouts while integrating all upstream quantitative additions.

### 🤖 Autonomous AI Agentic Pipeline (`backend/agents/`)
- **Multi-Agent Orchestration Engine** ([backend/agents/pipeline.py](../backend/agents/pipeline.pyy)):
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

## 2. Release v20260828 - Call Option Analytics & Compare Matrix Enhancements

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

## 3. Release v20260820 - Call Option Stats Matrix Modal & UI Ergonomics

### 📋 Call Option Stats Modal (14 Indicators)
- **Comprehensive Deep-Dive View** ([CallOptionStatsModal.tsx](../frontend/src/components/CallOptionStatsModal.tsx)):
  - Interactive modal displaying 14 technical and statistical indicators for candidate tickers.
  - Backend processing engine in [call_option_stats_service.py](../backend/services/call_option_stats_service.py) with CSV caching in `Call_Option_Stats.csv`.

### 🖥️ High-Density Table Usability Enhancements
- **Dual Synchronized Scrollbars**: Added synchronized top and bottom horizontal scrollbars to [ComparisonTable.tsx](../frontend/src/components/ComparisonTable.tsx) and [CallOptionStatsModal.tsx](../frontend/src/components/CallOptionStatsModal.tsx).
- **Sticky Column Headers & Identifiers**: Frozen ticker columns ensure persistent row context during wide horizontal panning.

---

## 4. Release v20260807 - Benchmark Comparison & Timeframe Selectors

- **Multi-Timeframe Backtesting**: Configurable backtest windows (1Wk, 1M, 3M, 6M, 1Y) on the Top Tickers page.
- **Benchmark Alpha Overlay**: Integrated baseline comparison curves for S&P 500 and NASDAQ.
- **Automated Alerts & Email Integration**: Notification pipeline for daily technical trigger signals.

---

## 5. Release v20260703 - Compare Matrix Ergonomics & Strategy 3 Integration

- **Compare Charts Multi-Select**: Added "Select All" and "Deselect All" action buttons for bulk ticker comparison.
- **Strategy 3 Backtester**: Added 30-Day rolling backtest evaluation for Strategy 3 and corresponding glossary reference cards.

---

## 6. Strategic Alpha Dashboard (411x)

### Feature Synchronizations (from v405)
- **Paper Study Page**: Restored full feature parity, including interactive transaction ledger and color-coded P&L tracking without external broker dependencies.
- **Glossary Page**: Updated with comprehensive technical definitions, including **VWAP ATR Band** methodology (14-day ATR, 2.0 multiplier).

### Dashboard Capabilities
- **Auto-Fill Price**: Integrated real-time price fetcher for Paper Study ticker input using `yfinance`.
- **Custom Portfolio Loading**: Dynamic loading of root CSV portfolios with `localStorage` persistence.
- **Sidebar Workflow**: Repositioned portfolio source selector to the top of the navigation sidebar.

---

## 7. Financial ETL Pipeline (20260412-Trans)

### ETL Script Implementation (`etl_script.py`)
- Standardized financial CSV exports from **Ameriprise (AKD)** and **Fidelity (FKD/FSD)** into a uniform 17-column target schema.
- **Cash Normalization**: Standardized money-market funds (`SPAXX**`, `CORE**`, `FCASH**`) to the identifier **`$$CASH_TX`**.
- **Ticker & Numeric Sanitization**: Unified ticker variations (e.g., `BRK'B` / `BRKB` $\rightarrow$ `BRK-B`), stripped formatting characters (`$`, `,`), and cleared transient columns.

