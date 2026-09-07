---
name: automated-trading-pipeline
description: >-
  Automated daily stock analysis and simulated trading workflow using the Backtester Agent,
  Broker Agent, and Robinhood Model Context Protocol (MCP) sandbox environment.
---

# Automated AI Trading Pipeline Skill

This skill defines the procedures for operating and monitoring the dual-agent trading workflow:

## Agent Architecture

### 1. Backtester Agent
- **Trigger**: Runs every trading day at 2:00 PM Market Time (EST).
- **Universe**: Dow 30, Nasdaq 100, and S&P 500 (~170 index constituents).
- **Strategy**: Strategy 1 (1-Week lookback momentum).
  - Price > Willy VWAP (Bull Market state)
  - 1-Week Strategy Value > $10,000
  - MACD Hist $\in (-0.5, 0.5)$ and MACD Slope $> 0$
  - RSI $14 \in (30, 70)$
- **Output**: Ranked recommendations and execution signals for stocks and ATM Call options.

### 2. Broker Agent
- **Input**: Ingests ranked recommendations from the Backtester Agent.
- **Portfolio Comparative Analysis**: Compares current Robinhood sandbox holdings against recommendations.
- **Dynamic Buying Power**: Liquidates displaced holdings to create cash, then sizes buy orders.
- **Execution**: Dispatches stock and option buy orders strictly to the Robinhood MCP sandbox.

## How to Trigger & Inspect

### API Endpoints
- **Run Full Pipeline**: `POST /api/agents/pipeline/run`
- **Run Backtester Only**: `POST /api/agents/backtester/run`
- **Run Broker Rebalance**: `POST /api/agents/broker/rebalance`
- **Get Pipeline Status**: `GET /api/agents/pipeline/status`

### Sandbox Guardrails
All trade orders are executed against `RH-SIM-SANDBOX-001`. Live real-money trading is disabled by design.
