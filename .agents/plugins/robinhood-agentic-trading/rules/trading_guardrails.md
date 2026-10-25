# Trading Safety Guardrails — LIVE (Robinhood Agentic MCP Account)

These rules apply to every order sent to the Robinhood Agentic (MCP) account, whether it comes from the backend Live Execution Gateway or from the IDE agent using the `robinhood-trading` MCP server. Real money is at risk. When in doubt, **do not trade**: log the reason and alert.

## 1. Environment & Authorization
- **Trading Account**: Live orders go only to the Robinhood Agentic (MCP) account through the `robinhood-trading` MCP server (`https://agent.robinhood.com/mcp/trading`). Robinhood picks the account from the OAuth login, not from config.
- **Account Pinning**: Before trading, the account reported by the MCP must match `ROBINHOOD_AGENTIC_ACCOUNT_NUMBER` from `.env`. On a mismatch, refuse all orders. Never write account numbers, OAuth tokens, or secrets into version-controlled files.
- **Environment Isolation**: Sandbox and Live never mix. The sandbox server (`robinhood-sandbox-trading`), its ledger (`rh_sandbox_state.json`), and its prices must never be used as live inputs. Live data must never be written into the sandbox ledger.
- **Trading Mode**: Only `LIVE_APPROVAL` (after explicit user approval of the plan) and `LIVE_AUTONOMOUS` may submit orders. `LIVE_SHADOW` and `SANDBOX` never submit live orders.
- **IDE Agent Restriction**: The IDE agent must NOT place, modify, or cancel live orders unless the user explicitly asks for that specific action in the current conversation. Read-only tools (account, positions, quotes, order history) are allowed for checks.
- **Kill Switch**: If `ROBINHOOD_EMERGENCY_KILL_SWITCH=true`, no live orders may be submitted by anyone, for any reason.

## 2. No Fabrication
- The Broker Agent and IDE agent MUST NOT make up or guess trade confirmations, quotes, fills, balances, or order statuses. All execution data must come directly from `robinhood-trading` MCP tool responses.
- An order counts as **FILLED** only when the MCP order-status response says so. "Submitted" or "accepted" is not "filled".
- Never guess MCP tool names or argument schemas. Use the tool list discovered from the server.

## 3. Order Construction
- **Zero Market Orders**: Every order must be a LIMIT order with an explicit limit price. Time-in-force must be DAY, regular session only (no extended hours, no GTC).
- **Equities Only Rule**: Live trading is equities-only. Filter out option contracts, option strike structures, and crypto symbols. Option signals from the Backtester are logged as `SKIPPED_LIVE_POLICY` and not sent.
- **Idempotency**: Each order uses a deterministic client order id (`{run_id}-{symbol}-{side}`). If an order's status is unknown (timeout or network error), do not resubmit it. Check order history first.
- **Fill Lifecycle**: After submitting, poll order status until filled or `LIVE_FILL_TIMEOUT_SEC` runs out (default 60s), then cancel any unfilled remainder and record the final state.

## 4. Pre-Trade Risk Checks (all must pass)
- **Market Hours**: Orders only during the regular US equity session on NYSE trading days (no holidays, no weekends).
- **Broker Resting Period**: The Broker Agent does not trade between **11:30 AM ET and 1:55 PM ET**. The 2:00 PM ET Backtester run is followed directly by Broker execution.
- **Position Limit**: The Broker Agent MUST NOT start a buy order for a stock already held long, regardless of quantity. New buys are only allowed if the stock is absent from the live portfolio. Blocked buys are logged as `SKIPPED`.
- **Buying Power Constraint**: The Broker Agent must never exceed available buying power (as reported by the MCP) plus realized sell proceeds. Re-check buying power from a fresh MCP read before each BUY.
- **Daily Spend Limit**: Total BUY notional per trading day must not exceed `ROBINHOOD_DAILY_SPEND_LIMIT`.
- **Position Cap**: No single position may exceed `ROBINHOOD_POSITION_CAP_PCT` of total account equity.
- **Daily Drawdown Cap**: If account equity is down more than 2.0% from the prior close, halt all new BUY orders for the day. Sells of displaced holdings are still allowed.
- **Sell Validation**: SELL quantity must not exceed the quantity held. Do not sell a position opened the same trading day (protects against Pattern Day Trader limits).
- **Slippage Guardrail**: Before every order, get a fresh MCP quote. If the bid-ask spread is over 0.50% of mid, do NOT trade; log a warning to the system terminal.
- **Stale Signal Guard**: If the strategy's signal price differs from the live mid-price by more than `LIVE_MAX_SIGNAL_DEVIATION_PCT` (default 1.0%), skip the order and log a warning.

## 5. Failure Handling
- **Circuit Breaker**: After three consecutive network failures, connection drops, auth failures, or unexpected tool outputs, the Broker Agent MUST immediately stop trading, issue a critical alert to the system terminal (and email if configured), and stay stopped until a human resets it.
- **Auth Expiry**: If the OAuth token can't be refreshed, stop live trading and alert. Never fall back to Sandbox, demo credentials, or simulated responses.

## 6. Audit Trail
- Every live order intent, guardrail decision, submission, status poll, fill, cancel, and rejection must be appended to the **live ledger** (`_data/live_trading/ledger.jsonl`). Each entry includes timestamp (ET), trading mode, run id, client order id, Robinhood order id, symbol, side, quantity, limit price, quote used, filled quantity, average fill price, and final status.
- The live ledger must be reconciled against the MCP order history at the end of every run. Any mismatch is a critical alert.