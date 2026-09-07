# WillyAlgo Dynamic Swing VWAP Algorithm

The **Dynamic Swing VWAP** is a proprietary technical indicator used by the Strategic Alpha Dashboard to identify optimal entry and exit points. Unlike a standard Volume Weighted Average Price (VWAP) which typically resets every day or session, the Dynamic Swing VWAP anchors itself to significant market structure points (Swing Highs and Swing Lows).

---

## 1. Pivot Identification Logic

The algorithm first identifies "Pivots" to determine where the market sentiment has potentially shifted.

### The Window Method
We use a **Centered Rolling Window** of size `2N + 1` (where `N` is the `window` parameter, default = 5).
- **Pivot High**: A bar is a Pivot High if its High price is the absolute maximum within the window (5 bars before and 5 bars after).
- **Pivot Low**: A bar is a Pivot Low if its Low price is the absolute minimum within the window.

> [!NOTE]
> This method looks 5 bars into the "future" relative to the current point to confirm a pivot. In real-time trading, the most recent pivots are confirmed with a 5-bar lag.

---

## 2. Pivot Point Changes (The Reset Trigger)

The core strength of the algorithm is its ability to "forget" stale price data when a new swing structure forms.

**The calculation resets (Pivot Change) when:**
- A confirmed **Pivot High** is detected.
- A confirmed **Pivot Low** is detected.

**When a Pivot Change occurs:**
1. The **Cumulative Price-Volume (PV)** is reset to `0`.
2. The **Cumulative Volume** is reset to `0`.
3. The VWAP begins recalculating from that specific timestamp (the "Anchor Point").

---

## 3. Mathematical Formula

For every bar `i` after the most recent pivot:

### Step A: Typical Price
The algorithm uses the average of the day's range:
$$Typical Price_i = \frac{High_i + Low_i + Close_i}{3}$$

### Step B: Weighting
$$PV_i = Typical Price_i \times Volume_i$$

### Step C: Accumulation
$$Cumulative PV = \sum_{j=anchor}^{i} PV_j$$
$$Cumulative Volume = \sum_{j=anchor}^{i} Volume_j$$

### Step D: Result
$$Willy VWAP_i = \frac{Cumulative PV}{Cumulative Volume}$$

---

## 4. Strategy Evaluation (Scoring)

The backend `evaluate_willy_algo` function translates this value into a matching percentage:

| Condition | Score | Justification |
| :--- | :--- | :--- |
| **Price > VWAP** | **100%** | Bullish: Price is trending above the volume-weighted baseline. |
| **Price <= VWAP** | **0%** | Bearish: Price is trading below the volume-weighted baseline. |
| **Insufficient Data** | **0%** | Error: Not enough bars to find at least two pivots. |

---

## 5. VWAP ATR Bands

As an extension, the system calculates **Volatility Bands** around the VWAP using the 14-day Average True Range (ATR):
- **Upper Band**: $VWAP + (ATR_{14} \times 2.0)$
- **Lower Band**: $VWAP - (ATR_{14} \times 2.0)$

These bands help identify overbought/oversold conditions relative to the volume-weighted mean.
