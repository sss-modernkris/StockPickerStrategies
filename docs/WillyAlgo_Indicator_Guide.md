# WillyAlgo Indicator (Dynamic Swing VWAP) - Detailed Logic

The **WillyAlgo Indicator** is a sophisticated trend-following tool that combines volume-weighted fair value with market structure. Unlike a standard VWAP, which usually resets every day at market open, or a Fixed Anchor, which stays at one specific date, the **WillyAlgo Indicator** is **self-anchoring**.

## 1. How the Logic Works (The "Engine")

The algorithm identifies "Swing Pivots" to decide when to restart its calculation.

### Step 1: Pivot Detection
The code looks for **Swing Highs** and **Swing Lows**. A point is defined as a pivot if its value is higher (for Highs) or lower (for Lows) than all the points in a surrounding "window" (default is 5 bars on either side).

### Step 2: Dynamic Reset
The moment the algorithm detects a new market structure pivot, it **resets** its internal accumulators.
- `current_cum_pv` (Price × Volume) resets to 0.
- `current_cum_vol` (Volume) resets to 0.

### Step 3: Volume-Weighted Average
It then begins calculating the VWAP from that new anchor point forward. It tells you the "Volume Fair Value" of the **current price move** since the last major turning point.

---

## 2. What the "100% Match" Signifies

In the platform's Strategy Engine, the WillyAlgo returns a binary score:

- **100% Match (Bullish)**: This means the **Current Price is ABOVE the Dynamic Swing VWAP**.
    - *Significance*: The market is currently trading higher than the average price paid by all participants (weighted by volume) since the last significant pivot. Buyers are in control relative to the "fair value" of the current swing.
- **0% Match (Bearish)**: This means the **Current Price is BELOW the Dynamic Swing VWAP**.
    - *Significance*: Sellers are aggressive. Since the volume-weighted fair value is now higher than the market price, the fair-value is acting as **resistance** rather than support.

---

## 3. How to use it for BUY/SELL Decisions

The WillyAlgo is best used as a **Trend Confirmation** and **Risk Management** tool.

### The BUY Decision (Long)
- **The Signal**: Look for the price crossing **above** the Orange Willy VWAP line. 
- **The Logic**: If the price is above the line, it means everyone who bought since the last pivot is, on average, "in the green" (profitable). This reduces selling pressure and invites momentum.
- **Decision**: You enter a BUY when the WillyAlgo turns 100% and stays consistently above the line.

### The SELL Decision (Exit / Short)
- **The Signal**: The price crosses **below** the Orange Willy VWAP line.
- **The Logic**: The "floor" has broken. Since the volume-weighted fair value is now higher than the market price, participants who bought recently are now underwater. They are more likely to sell to cut losses, creating a downward spiral.
- **Decision**: You SELL/EXIT your position if the indicator drops to 0%.

### As a "Trailing Stop"
Professional traders often use the Willy VWAP line as a dynamic stop-loss. As long as the price stays above the orange line, they hold the stock. The moment it closes below the line, they exit for a profit or a small controlled loss.
