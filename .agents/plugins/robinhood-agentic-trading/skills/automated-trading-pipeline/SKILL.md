---
name: automated-trading-pipeline
description: >-
  Drives a continuous, hands-free loop inside the Antigravity IDE platform. Automated daily stock analysis and LIVE trading workflow using the Backtester Agent, Broker Agent, and the Robinhood Trading Model Context Protocol (MCP) server (`robinhood-trading`, https://agent.robinhood.com/mcp/trading) against the Robinhood Agentic (MCP) account. Use for operating, monitoring, approving, or troubleshooting live trading. For internal simulation, use the `sandbox-trading-pipeline` skill instead.
---

# Automated AI Trading Pipeline Skill — LIVE

This skill defines the procedures for operating and monitoring the dual-agent trading workflow against the **live** Robinhood Agentic (MCP) account.

> **Before any action that could result in a live order, read and apply `rules/trading_guardrails.md`.**

## Trading Modes

The execution target is selected by `TRADING_MODE` in `.env`. Agent inputs, strategy, and output schema are identical in every mode. Only the client the Broker Agent calls changes.

| Mode | Portfolio reads | Orders | Purpose |
|---|---|---|---|
| `SANDBOX` | Simulator | Simulator (`robinhood-sandbox-trading`) | Internal testing (default) |
| `LIVE_SHADOW` | Live MCP account | Recorded as `SHADOW_INTENT`, never sent | Rollout phase A |
| `LIVE_APPROVAL` | Live MCP account | Plan is shown for approval; approved orders are re-checked and sent | Rollout phase B |
| `LIVE_AUTONOMOUS` | Live MCP account | Sent automatically through the Live Execution Gateway | Rollout phase C |

## Agent Architecture

### Execution Routine Sequence
**Context:** The agent finishes its rest interval, wakes up, and runs the Backtester Agent and Broker Agent.
**Execution Trace:**
1. Confirms `TRADING_MODE`, that the kill switch is off, and that the circuit breaker is closed.
2. Confirms an active, authenticated connection to `robinhood-trading` and that the reported Agentic account matches `ROBINHOOD_AGENTIC_ACCOUNT_NUMBER`.
3. Verifies that account drawdown is within the allowed 2.0% daily risk cap.
4. Runs the Backtester Agent, then the Broker Agent (live orders only in `LIVE_APPROVAL` after approval, or in `LIVE_AUTONOMOUS`).
5. Records every intent, decision, and fill to the live ledger `_data/live_trading/ledger.jsonl` and reconciles it against MCP order history.

### 1. Backtester Agent *(unchanged)*
- **Trigger**: Runs every trading day at 2:00 PM Market Time (EST).
- **Universe**: Dow 30, Nasdaq 100, and S&P 500 (~170 index constituents).
- **Strategy**: Strategy 1 (1-Week lookback momentum).
  - Price > Willy VWAP (Bull Market state)
  - 1-Week Strategy Value > $10,000
  - MACD Hist $\in (-0.5, 0.5)$ and MACD Slope $> 0$
  - RSI $14 \in (30, 70)$
- **Output**: Ranked recommendations and execution signals for stocks, plus optional ATM Call options.

### 2. Broker Agent *(inputs and strategy unchanged)*
- **Input**: Ingests ranked recommendations from the Backtester Agent.
- **Portfolio Comparative Analysis**: Compares current Robinhood Agentic account holdings against recommendations.
- **Dynamic Buying Power**: Liquidates displaced holdings to create cash, then sizes buy orders.
- **Execution**: Sends stock orders only through the `robinhood-trading` MCP via the Live Execution Gateway. In Live, option signals are logged as `SKIPPED_LIVE_POLICY` (equities only), and buys of already-held symbols are logged as `SKIPPED` (Position Limit).
- **Resting Period**: The Broker Agent rests between **11:30 AM ET and 1:55 PM ET** to avoid mid-day trading disruptions and inefficient position monitoring. It runs right after the 2:00 PM ET Backtester run.

### 3. Live Execution Gateway
Sits between the Broker Agent and the MCP. For every order it runs the pre-trade checks in `trading_guardrails.md`, in this order:
kill switch / mode → market hours / rest window / holiday → equities only → position limit → buying power / daily spend / position cap / drawdown → sell validation → fresh quote spread & stale-signal check → LIMIT/DAY order with deterministic client order id → poll for fill → cancel any remainder at timeout → ledger.

## IDE Operator Procedures (`robinhood-trading` MCP)

### Connect / Re-authenticate
1. Open **Additional Options (...) > MCP Servers** and enable `robinhood-trading`.
2. Finish the Robinhood OAuth login in the browser. On first connect, Robinhood asks you to open or select the **MCP account**. A primary individual account in good standing is required.
3. If the connection breaks, disconnect and reconnect the server (Robinhood's recommended fix).

### Discover Tools (do not guess names)
- List the tools exposed by `robinhood-trading` (categories: Account/portfolio, Watchlist, Market data, Equities, Options, Crypto) and use only the names and argument schemas actually exposed.
- Keep `docs/robinhood_mcp_tools.json` and `backend/trading/rh_tool_map.py` in sync with the discovered list.

### Pre-Flight Check (read-only, run before enabling or advancing a live mode)
1. Read account details and confirm the account is the Agentic (MCP) account matching `ROBINHOOD_AGENTIC_ACCOUNT_NUMBER`.
2. Read buying power, positions, and open orders. Report them exactly as returned.
3. Compare MCP positions with the latest live ledger state and report any differences.
4. Check `GET /api/trading/live/health` (once available).

### Allowed vs. Forbidden IDE Actions
- ✅ Read-only queries, reconciliation, reporting, approving or rejecting pending plans via the API **when the user asks**.
- ❌ Placing, modifying, or cancelling live orders unless the user explicitly asks for that specific action in the current conversation.
- ❌ Reporting any quote, fill, or balance that did not come from an MCP tool response.

## How to Trigger & Inspect

### API Endpoints
- **Run Full Pipeline**: `POST /api/agents/pipeline/run`
- **Run Backtester Only**: `POST /api/agents/backtester/run`
- **Run Broker Rebalance**: `POST /api/agents/broker/rebalance`
- **Get Pipeline Status**: `GET /api/agents/pipeline/status`

### Planned Live Endpoints *(not yet implemented — see the implementation plan, Phase 5)*
- `GET|POST /api/trading/mode` — view or change `TRADING_MODE` (`LIVE_AUTONOMOUS` requires a confirmation phrase)
- `POST /api/trading/kill-switch` — turn the emergency stop on or off
- `GET /api/trading/live/health` — OAuth, MCP reachability, circuit-breaker state
- `GET /api/trading/live/ledger` — live audit ledger
- `GET /api/agents/broker/pending-plan`, `POST /api/agents/broker/approve`, `POST /api/agents/broker/reject` — approval flow (plans expire after 15 min or at 3:55 PM ET)

## Live Trading Guardrails
**Context:** Before executing any trade, the Broker Agent must consult `trading_guardrails.md` for critical risk-management rules and constraints.

**Context:** The agent is authorized to perform live trading operations only through the Robinhood Trading MCP integration, using the `robinhood-trading` server.

**Execution Rule:** The Broker Agent MUST NOT make up or guess trade confirmations, market quotes, or order status updates. All execution-related information must come directly from the `robinhood-trading` MCP tools.

**Security Protocol:** The Broker Agent may execute trades only in the dedicated Robinhood Agentic (MCP) account, and only in `LIVE_APPROVAL` (after approval) or `LIVE_AUTONOMOUS` mode. Account numbers, tokens, and secrets live in `.env` or the user profile, never in plugin files.

## Troubleshooting
- **Auth / 401 errors**: Re-authenticate (see Connect). The backend trips the circuit breaker on refresh failure. It never falls back to sandbox.
- **Orders rejected by Robinhood**: Check Robinhood in-app agent approval settings and buying power. Report the exact MCP error text.
- **Ledger mismatch**: Stop live trading (kill switch) and reconcile against MCP order history before resuming.
