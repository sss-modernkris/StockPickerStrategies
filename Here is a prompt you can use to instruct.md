Here is a prompt you can use to instruct Antigravity (or any data-analysis agent) to compute the present-day value of this specific backtesting strategy 
**Prompt for Antigravity:**

> **Task:** Compute the present-day portfolio value of a specific backtested trading strategy for each of Ticker and show it in the comparison page in comparison table as the final value column. Also show the comparison of strategy vs buy-and-hold in the comparison page, including the buy and sell log and the total percentage return of this strategy compared to a simple "Buy and Hold" strategy over the exact same timeframe.
> **Timeframe:**
> * **Start Date:** January 31, 2026 (4 months prior to current day)
> * **End Date:** May 31, 2026 (Present Day)
> 
> 
> **Initial Conditions:**
> * Assume an initial starting capital of $10,000 for each Ticker.
> * Execute an initial BUY order for each ticker on the Start Date (January 31, 2026) at the daily closing price.
> 
> 
> **Indicators Required:**
> * Daily Close Price for each ticker.
> * Daily "Willy VWAP" (Volume Weighted Average Price) for each ticker.
> 
> 
> **Strategy / Execution Rules:**
> * **Sell Condition:** If currently holding the stock and the Daily Close Price falls *below* the Willy VWAP, execute a SELL of the entire position at the close.
> * **Buy Condition:** If currently holding cash and the Daily Close Price crosses *above* the Willy VWAP, execute a BUY with the entire cash balance at the close.
> * Assume zero transaction fees or slippage for this calculation.
> 
> 
> **Output Requirements:**
> 1. Calculate the final portfolio value (cash + equity) as of May 31, 2026.
> 2. Provide a chronological log of all Buy and Sell transactions executed during this 4-month window, including the date, action, execution price, and the portfolio's running balance.
> 3. Calculate the total percentage return of this strategy compared to a simple "Buy and Hold" strategy over the exact same timeframe.
> 
>