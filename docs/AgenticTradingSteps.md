# How to set it up when going Live
## Step 1: Perform the one-time OAuth login
Before you can read live account data, authenticate your machine via:

```
cd d:\AI\StockPickerStrategies\backend
python -m trading.live_auth login
```

This opens your browser to log into Robinhood, complete 2FA, and authorize the Agentic connection. The tokens are saved securely at `%USERPROFILE%\.strategicalpha\robinhood_oauth.json`.

## Step 2: Verify your Account ID
Check the status of your connection:

```
python -m trading.live_auth status
```

Note your Robinhood Agentic Account Number (usually an 8-10 digit number).

## Step 3: Update .env
In your root .env file:

```ini
# Safe default startup mode (SANDBOX, LIVE_SHADOW, LIVE_APPROVAL, or LIVE_AUTONOMOUS)
TRADING_MODE=LIVE_APPROVAL
# Robinhood MCP Endpoint
ROBINHOOD_MCP_URL=https://agent.robinhood.com/mcp/trading
# Pin to your real Robinhood Agentic account number for safety:
ROBINHOOD_AGENTIC_ACCOUNT_NUMBER=1234567890
```

**TIP:** Recommended initial mode: Set TRADING_MODE=LIVE_SHADOW or TRADING_MODE=LIVE_APPROVAL first.

`LIVE_SHADOW` connects to Robinhood MCP, verifies real quotes and account balance, but simulates order fills (0 real money risk).
`LIVE_APPROVAL` stages real orders into a 15-minute approval queue in the UI dashboard so you can review every price, quantity, and limit buffer before releasing them to the market.