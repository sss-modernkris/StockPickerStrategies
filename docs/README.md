# Strategic Alpha Documentation Hub

Welcome to the **Strategic Alpha Platform Documentation Directory**. This directory houses all architectural guides, quant strategy algorithms, operational manuals, and backtesting references for the project.

---

## 📑 Documentation Index

| Document | Description | Topics Covered |
| :--- | :--- | :--- |
| **[Documentation.md](Documentation.md)** | **Master System Documentation** | Architecture, 11 Quant Strategy Models, Options Backtest Engine, AI Agents (Backtester & Broker), Robinhood MCP Sandbox Pipeline, Mermaid Flowcharts |
| **[operation.md](operation.md)** | **User Operation & Navigation Guide** | Guide to the 4 primary UI views (Dashboard, Comparison Table, Raw Data, Technical Indicators, Compare Charts) |
| **[Strategies.md](Strategies.md)** | **Strategy Slides Visual Reference** | Visual deck containing slides 1 through 12 of the core trading strategies |
| **[VWAP.md](VWAP.md)** | **WillyAlgo Dynamic Swing VWAP Math** | Centered rolling window pivot detection, dynamic price-volume reset triggers, mathematical formulas, and ATR boundary envelopes |
| **[WillyAlgo_Indicator_Guide.md](WillyAlgo_Indicator_Guide.md)** | **WillyAlgo Indicator User Guide** | Practical trader guide for interpreting 100% vs 0% matches, buy/sell decision rules, and trailing stop methodologies |
| **[changes.md](changes.md)** | **Project Changelog & Evolution** | Chronological record of architectural updates, feature rollouts, and refactoring milestones |
| **[walkthrough.md](walkthrough.md)** | **Feature Walkthrough & Verifications** | Detailed implementation walkthrough covering multi-mode intraday exit horizons, baseline performance calculations, and verification metrics |
| **[Portfolio_Positions_May-29-2026 - 4223_Analysis_Report.md](Portfolio_Positions_May-29-2026%20-%204223_Analysis_Report.md)** | **Portfolio Technical Analysis Report Sample** | Sample synthesized portfolio analysis report with posture classifications, ATR boundary envelopes, and embedded technical charts |

---

## 🏛️ Directory Structure

```text
docs/
├── README.md                                             # Master documentation index (this file)
├── Documentation.md                                      # Comprehensive system architecture & model docs
├── operation.md                                          # Dashboard navigation & operational guide
├── Strategies.md                                         # Strategy visual slides (1 to 12)
├── VWAP.md                                               # Dynamic Swing VWAP algorithm & mathematical specs
├── WillyAlgo_Indicator_Guide.md                          # Trader guide for Dynamic Swing VWAP signals
├── changes.md                                            # Chronological project changelog
├── walkthrough.md                                        # Options exit horizons & baseline walkthrough
└── Portfolio_Positions_May-29-2026 - 4223_Analysis_Report.md # Sample technical analysis report
```

---

## 🔗 Quick Links to Workspace Resources

- **Main Platform Readme**: [../README.md](../README.md)
- **Backend API**: [../backend/main.py](../backend/main.py)
- **Quant Backtesting Engine**: [../backend/services/backtester.py](../backend/services/backtester.py)
- **Robinhood MCP Sandbox Server**: [../backend/mcp/rh_mcp_server.py](../backend/mcp/rh_mcp_server.py)
- **Frontend App**: [../frontend/src/app/page.tsx](../frontend/src/app/page.tsx)
