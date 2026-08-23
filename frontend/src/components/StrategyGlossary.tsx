import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    BookOpen,
    TrendingUp,
    Wallet,
    Scale,
    ShieldAlert,
    Zap,
    LineChart,
    BrainCircuit,
    Activity,
    Gauge,
    Search,
    Bot
} from 'lucide-react';

export function StrategyGlossary() {
    const [searchQuery, setSearchQuery] = useState('');
    const glossaryItems = [
        {
            id: "can-slim",
            icon: <TrendingUp className="w-5 h-5 text-blue-500" />,
            title: "1. CAN SLIM (The Momentum Growth Model)",
            badge: "High-Pass Filter",
            description: "Developed by William O'Neil, this is a \"filtered\" growth strategy. In this program, it acts as a high-pass filter to find stocks in a \"breakout\" phase.",
            bullets: [
                { label: "Quarterly EPS Growth (C)", text: "Look for current quarterly earnings per share (EPS) up at least 25% year-over-year." },
                { label: "Annual Earnings Growth (A)", text: "Require annual compounded growth of 25%+ over the last 3 years." },
                { label: "Volume Trends (S)", text: "When a stock breaks out of a price pattern, the daily volume should be at least 40% to 50% above its 50-day average." },
                { label: "RS (Relative Strength) Rating", text: "Percentile rank (1-99). Target stocks with an RS score of 80 or higher (outperforming 80% of the market)." },
            ]
        },
        {
            id: "fcf-yield",
            icon: <Wallet className="w-5 h-5 text-emerald-500" />,
            title: "2. FCF Yield + Momentum (The \"Real Cash\" Value)",
            badge: "Value Confirmation",
            description: "Free Cash Flow (FCF) is harder to \"fake\" than Net Income because it accounts for actual capital expenditures.",
            formula: "FCF Yield = (Cash from Operations - Capital Expenditures) / Enterprise Value",
            bullets: [
                { label: "12-Month Momentum", text: "Filter for stocks where the FCF yield is in the top quartile, but the 12-month return is positive to prevent 'value traps' (dying companies)." }
            ]
        },
        {
            id: "garp",
            icon: <Scale className="w-5 h-5 text-purple-500" />,
            title: "3. GARP (Growth at a Reasonable Price)",
            badge: "Balanced Valuations",
            description: "Popularized by Peter Lynch, this strategy prevents you from overpaying for hype.",
            formula: "PEG Ratio = (P/E Ratio) / (Earnings Growth Rate)",
            bullets: [
                { label: "The Threshold", text: "Target 0.5 < PEG < 1.2. Below 0.5 may be unsustainable; above 1.5 is priced for perfection. 1.0 is considered fairly valued." }
            ]
        },
        {
            id: "low-vol",
            icon: <ShieldAlert className="w-5 h-5 text-orange-500" />,
            title: "4. Low-Volatility & Quality (The Defensive Alpha)",
            badge: "Risk-Adjusted Target",
            description: "Relies on the 'Low-Vol Anomaly'—stable stocks often provide better risk-adjusted returns than high-beta stocks.",
            bullets: [
                { label: "Volatility", text: "Calculate Standard Deviation of daily returns over the last 252 trading days." },
                { label: "Debt-to-Equity (Quality)", text: "Should be below the industry median (targeting < 0.5 for stability)." },
                { label: "ROE (Quality)", text: "Measures efficiency. Target > 15%." }
            ]
        },
        {
            id: "pure-growth",
            icon: <Zap className="w-5 h-5 text-yellow-500" />,
            title: "5. Pure Growth vs. Pure Value",
            badge: "Spectrum Analysis",
            description: "The two ends of the investment spectrum.",
            bullets: [
                { label: "Pure Growth", text: "Focuses on Revenue CAGR. Looking for top-line explosions (e.g. sales growing > 30% annually), often ignoring P/E." },
                { label: "Pure Value", text: "Uses P/B and P/E. Looking for stocks trading at discounts to historical averages or sector peers (e.g., P/E < 15)." }
            ]
        },
        {
            id: "fundamental-tech",
            icon: <LineChart className="w-5 h-5 text-cyan-500" />,
            title: "6. Fundamental vs. Technical (The \"Hybrid\" Approach)",
            badge: "Timing Optimization",
            description: "Compares what a company is worth vs. how it is currently trading.",
            formula: "Intrinsic Value (DCF) = Sum(CF / (1 + r)^t)",
            bullets: [
                { label: "Fundamental (DCF)", text: "Calculates Intrinsic Value by discounting future cash flows." },
                { label: "Technical: MACD", text: "Identifies momentum/trend reversals." },
                { label: "Technical: RSI", text: "Identifies overbought (>70) or oversold (<30) conditions." },
                { label: "Moving Averages", text: "Tracks long term trends like the 'Golden Cross' (50-day crossing above 200-day)." }
            ]
        },
        {
            id: "sentiment",
            icon: <BookOpen className="w-5 h-5 text-pink-500" />,
            title: "7. Sentiment & Quant (The Psychological Edge)",
            badge: "Contrarian Indicators",
            description: "Uses external 'crowd' data to find extremes.",
            bullets: [
                { label: "VIX", text: "When VIX is high (>30), fear is high (potential buy). Low (<15), complacency is high (sell)." },
                { label: "Put/Call Ratio", text: "> 1.0 means buying protection (bearish sentiment), contrarian buy signal." }
            ]
        },
        {
            id: "macd",
            icon: <Activity className="w-5 h-5 text-teal-500" />,
            title: "8. MACD (Moving Average Convergence Divergence)",
            badge: "Momentum Indicator",
            description: "A versatile trend-following momentum indicator that shows the relationship between two different moving averages of a stock’s price. It is used by traders to identify whether a trend is strengthening, weakening, or about to reverse.",
            customContent: (
                <div className="space-y-4 mt-4 text-sm">
                    <div>
                        <h4 className="font-semibold text-foreground">1. The Three Components of MACD</h4>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-1">
                            <li><span className="font-medium text-foreground">The MACD Line:</span> Calculated by subtracting the 26-period EMA from the 12-period EMA.</li>
                            <li><span className="font-medium text-foreground">The Signal Line:</span> A 9-period EMA of the MACD line itself. Acts as a trigger for buy and sell signals.</li>
                            <li><span className="font-medium text-foreground">The Histogram:</span> Represents the distance between the MACD line and the Signal line. When bars are above zero and growing, upward momentum is increasing.</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">2. How to Read MACD Signals</h4>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-2">
                            <li>
                                <span className="font-medium text-foreground">A. Signal Line Crossovers:</span>
                                <ul className="list-[circle] list-inside ml-4 mt-1 space-y-1">
                                    <li><span className="font-medium">Bullish:</span> MACD crosses above Signal line (upside momentum).</li>
                                    <li><span className="font-medium">Bearish:</span> MACD crosses below Signal line (downward momentum).</li>
                                </ul>
                            </li>
                            <li>
                                <span className="font-medium text-foreground">B. Zero Line Crossovers:</span>
                                <ul className="list-[circle] list-inside ml-4 mt-1 space-y-1">
                                    <li><span className="font-medium">Bullish:</span> MACD moves from negative to positive (uptrend).</li>
                                    <li><span className="font-medium">Bearish:</span> MACD moves from positive to negative (downtrend).</li>
                                </ul>
                            </li>
                            <li>
                                <span className="font-medium text-foreground">C. Divergence:</span>
                                <ul className="list-[circle] list-inside ml-4 mt-1 space-y-1">
                                    <li><span className="font-medium">Bullish Divergence:</span> Stock makes a lower low, MACD makes a higher low (reversal up).</li>
                                    <li><span className="font-medium">Bearish Divergence:</span> Stock makes a higher high, MACD makes a lower high (reversal down).</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">3. Application in Stock Analysis</h4>
                        <p className="text-muted-foreground mt-1 leading-relaxed">
                            In a strategy like the Fundamental/Technical model we discussed for $MSFT$, the MACD serves as a &quot;confirmation&quot; tool. For example, if a stock is fundamentally undervalued (like a DCF analysis of $615.23 vs. $410.68), a Bullish MACD Cross provides the technical &quot;green light&quot; that the market is finally beginning to recognize that value and move higher.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: "rsi",
            icon: <Gauge className="w-5 h-5 text-indigo-500" />,
            title: "9. RSI (Relative Strength Index)",
            badge: "Momentum Oscillator",
            description: "A widely used momentum oscillator developed by J. Welles Wilder in 1978. It quantifies the speed and change of price movements on a scale of 0 to 100, helping traders identify when a security is \"stretched\" too far in one direction.",
            customContent: (
                <div className="space-y-4 mt-4 text-sm">
                    <div>
                        <h4 className="font-semibold text-foreground">1. The Core Logic: How It’s Calculated</h4>
                        <p className="text-muted-foreground mt-1 leading-relaxed">
                            The RSI doesn&apos;t just look at the price; it compares the strength of the &quot;up days&quot; to the &quot;down days&quot; over a specific period (typically 14 days). The calculation follows this two-step process:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                            <li><span className="font-medium text-foreground">Relative Strength (RS):</span> The average gain of &quot;up&quot; periods divided by the average loss of &quot;down&quot; periods during the timeframe.</li>
                        </ul>
                        <div className="bg-muted p-2 rounded-md font-mono text-xs my-2 border text-center">
                            RS = Average Gain / Average Loss
                        </div>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                            <li><span className="font-medium text-foreground">RSI Formula:</span> This ratio is then &quot;indexed&quot; to fit between 0 and 100.</li>
                        </ul>
                        <div className="bg-muted p-2 rounded-md font-mono text-xs my-2 border text-center">
                            RSI = 100 - [ 100 / (1 + RS) ]
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">2. Interpreting the Thresholds</h4>
                        <p className="text-muted-foreground mt-1 leading-relaxed">
                            The primary use of RSI is identifying extreme market conditions:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-2">
                            <li>
                                <span className="font-medium text-foreground">Overbought (&gt;70):</span> Suggests that the asset has experienced a rapid increase in price and may be due for a pullback or reversal. It indicates that buying pressure might be reaching a point of exhaustion.
                            </li>
                            <li>
                                <span className="font-medium text-foreground">Oversold (&lt;30):</span> Suggests that the asset has been sold heavily and may be due for a rebound. This implies that selling pressure is potentially overextended.
                            </li>
                            <li>
                                <span className="font-medium text-foreground">The Centerline (50):</span> Often used to identify the general trend. An RSI consistently above 50 indicates a bullish trend, while an RSI below 50 indicates a bearish trend.
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">3. Advanced Signals: Beyond the 70/30 Rule</h4>
                        <p className="text-muted-foreground mt-1 leading-relaxed">
                            Sophisticated traders use RSI for more than just simple overbought/oversold levels:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-2">
                            <li>
                                <span className="font-medium text-foreground">A. RSI Divergence:</span> Divergence occurs when the price moves in the opposite direction of the RSI.
                                <ul className="list-[circle] list-inside ml-4 mt-1 space-y-1">
                                    <li><span className="font-medium">Bullish Divergence:</span> Price makes a lower low, but RSI makes a higher low. This suggests that even though the price is falling, the selling momentum is actually weakening.</li>
                                    <li><span className="font-medium">Bearish Divergence:</span> Price makes a higher high, but RSI makes a lower high. This indicates that the uptrend is losing steam.</li>
                                </ul>
                            </li>
                            <li>
                                <span className="font-medium text-foreground">B. Failure Swings:</span> Wilder considered &quot;Failure Swings&quot; to be the most reliable reversal signals. They are independent of price action and occur entirely within the RSI window.
                                <ul className="list-[circle] list-inside ml-4 mt-1 space-y-1">
                                    <li><span className="font-medium">Top Failure Swing:</span> Occurs when RSI goes above 70, drops below a previous swing low (the &quot;fail point&quot;), and then fails to reach a new high above 70 on its next bounce.</li>
                                    <li><span className="font-medium">Bottom Failure Swing:</span> Occurs when RSI drops below 30, bounces, drops again but stays above 30, and then breaks above its previous swing high.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">4. Important Context: Trending vs. Ranging</h4>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-2">
                            <li>
                                <span className="font-medium text-foreground">Ranging Markets:</span> Standard 70/30 levels work best here as the price oscillates between support and resistance.
                            </li>
                            <li>
                                <span className="font-medium text-foreground">Strong Trends:</span> In a powerful uptrend (like $NVDA$ in 2025), the RSI can stay &quot;overbought&quot; (&gt;70) for weeks while the price continues to climb. Selling purely because the RSI is at 70 during a strong trend is a common mistake; some traders adjust their levels to 80/20 in these environments to filter out noise.
                            </li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: "xgboost",
            icon: <BrainCircuit className="w-5 h-5 text-primary" />,
            title: "Dynamic Factor (XGBoost)",
            badge: "Quantitative Machine Learning",
            description: "Use an XGBoost Classifier to predict the probability of a stock achieving an 'Alpha' return (Top 20th percentile) over a 30-day horizon.",
            customContent: (
                <div className="space-y-4 mt-4">
                    <div>
                        <h4 className="font-semibold text-foreground">1. Feature Engineering (The Factors)</h4>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-1">
                            <li><span className="font-medium text-foreground">Value Factor:</span> Z-score(P/E Ratio, P/B Ratio)</li>
                            <li><span className="font-medium text-foreground">Quality Factor:</span> Z-score(ROE, Debt-to-Equity)</li>
                            <li><span className="font-medium text-foreground">Momentum Factor:</span> 12-month Return - 1-month Return (Smooth Momentum)</li>
                            <li><span className="font-medium text-foreground">Volatility Factor:</span> 252-day Rolling Volatility</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">2. Target Variable (y)</h4>
                        <div className="bg-muted p-3 rounded-md font-mono text-xs my-2 border">
                            y_i = 1 if R_i {'>'} Median(R) else 0<br />
                            <span className="text-muted-foreground">{'// Where R_i is the forward 30-day log return'}</span>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">3. Model Training Logic</h4>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-1">
                            <li><span className="font-medium text-foreground">Algorithm:</span> XGBClassifier with n_estimators=100 and max_depth=3 (prevents small N overfitting)</li>
                            <li><span className="font-medium text-foreground">Cross-Validation:</span> TimeSeriesSplit ensures no look-ahead bias</li>
                            <li><span className="font-medium text-foreground">Factor Importance:</span> Uses feature_importances_ to identify the current market driver</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">4. Dashboard Output</h4>
                        <ul className="list-disc list-inside text-muted-foreground ml-2 mt-1 space-y-1">
                            <li><span className="font-medium text-foreground">Probability Score:</span> Display Alpha Probability (0.0 to 1.0)</li>
                            <li><span className="font-medium text-foreground">Factor Attribution:</span> Tracks which factor contributed most to the high ML score</li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: "willy-vwap",
            icon: <Activity className="w-5 h-5 text-orange-500" />,
            title: "10. WillyAlgo Dynamic Swing VWAP",
            badge: "Dynamic Anchoring",
            description: "A specialized volume-weighted average price (VWAP) that automatically re-anchors to market structure swing pivots (pivots highs and lows).",
            formula: "VWAP = Sum(Price * Volume) / Sum(Volume) [Resets at Swing High/Low]",
            bullets: [
                { label: "Pivot Logic", text: "Identifies swing points using a rolling window of 5 periods. A pivot high is a point higher than 5 points before and after it." },
                { label: "Bullish Signal", text: "The strategy returns a 100% match if the current price is trading above the most recent Swing VWAP, indicating positive momentum relative to the volume-fair-value of the recent swing." },
                { label: "Bearish Signal", text: "Returns a 0% match if the current price is below the Swing VWAP, suggesting that the recent volume-weighted average is acting as resistance." },
                { label: "ATR Volatility Bands", text: "Includes Upper and Lower exhaustion bands calculated using a 14-day ATR with a 2.0 multiplier applied to the VWAP baseline. These identify volatility-adjusted extreme levels." }
            ]
        },
        {
            id: "willy-market-state",
            icon: <Activity className="w-5 h-5 text-orange-500" />,
            title: "Willy Market State (Bull vs. Bear)",
            badge: "Market Phase Classification",
            description: "Determines whether a security is in a Bull or Bear market phase by evaluating the current close price relative to the dynamic self-anchoring Willy VWAP baseline.",
            bullets: [
                { label: "🟢 Bull Market (Price > Willy VWAP)", text: "The security trades above the volume-weighted average price paid since the last market structure pivot, indicating that buyers are in control and the VWAP is acting as dynamic support." },
                { label: "🔴 Bear Market (Price <= Willy VWAP)", text: "The price has broken below its volume-weighted fair value, turning the baseline into dynamic overhead resistance as recent buyers hold losing positions." }
            ]
        },
        {
            id: "ranking-score",
            icon: <Gauge className="w-5 h-5 text-amber-500" />,
            title: "Composite Ranking Score",
            badge: "Dashboard Metric",
            description: "A custom 8-point ranking score used on the Comparison page to quickly identify stocks that meet a specific confluence of momentum, technical, and quantitative criteria.",
            bullets: [
                { label: "WillyAlgo > 50%", text: "Requires the WillyAlgo Indicator match percentage to be greater than 50%." },
                { label: "RSI > 30", text: "Ensures the stock is not in a deeply oversold structural collapse." },
                { label: "RSI Slope > 0", text: "Requires positive short-term momentum (the RSI indicator is currently rising)." },
                { label: "MACD Hist < 0.1", text: "Focuses on early momentum shifts or contained histogram expansion." },
                { label: "MACD Hist > 0", text: "Requires the MACD histogram to be positive (bullish momentum)." },
                { label: "MACD Slope > 0", text: "Requires the MACD line itself to have a positive, rising trajectory." },
                { label: "Strat Avg > 50%", text: "Requires the overall average score across all core quantitative strategies to be above 50%." },
                { label: "Close Slope > 0", text: "Requires the short-term price trend (last 2 days) to be positive." }
            ]
        },
        {
            id: "buy-screener",
            icon: <Scale className="w-5 h-5 text-emerald-500" />,
            title: "Top Tickers Buy Screener",
            badge: "Screening Methodology",
            description: "A strict 5-layer quantitative filtering logic applied to index constituents on the Top Tickers page to identify high-probability buy candidates, outputting matches to Top_Tickers_to_buy.csv.",
            bullets: [
                { label: "Willy Market = Bull", text: "Requires the security close price to be trading above its dynamic self-anchoring Willy VWAP baseline." },
                { label: "Strategy Value > 10,000 (1-Wk)", text: "Simulates a 1-week backtest starting with $10,000. Requires the final strategy value to be greater than $10,000 (positive net return)." },
                { label: "MACD Hist between -0.5 and 0.5", text: "Requires the MACD line to be in close proximity to the Signal line (indicating tight consolidation or an imminent/recent crossover)." },
                { label: "MACD Slope > 0", text: "Ensures that the trajectory of the MACD line is positive and rising, verifying upward momentum." },
                { label: "RSI between 30 and 70", text: "Requires stable, non-extreme relative strength levels, excluding both oversold structural collapses (<30) and overbought market tops (>70)." }
            ]
        },
        {
            id: "backtest-30d",
            icon: <Activity className="w-5 h-5 text-violet-500" />,
            title: "30-Day Strategy 1 Backtesting",
            badge: "Historical Simulation",
            description: "Runs a daily historical simulation looking back exactly 30 calendar days to evaluate the buy screener logic, trade execution, and cumulative ROI.",
            bullets: [
                { label: "Step 1: Universe Selection", text: "Fetches the universe of stocks comprising the Dow 30, Nasdaq 100, and S&P 500 from the Top Tickers page (~170 tickers)." },
                { label: "Step 2: Filter Universe", text: "For each trading day, filters down the universe to candidates matching the 5-point Top Tickers Buy Screener indicators." },
                { label: "Step 3: Rank & Select Top 5", text: "Ranks the screened candidates by their 1-Wk Willy Backtest final value, selecting the top 5 candidates for trade execution." },
                { label: "Step 4: Trade Execution (Entry & Exit)", text: "Simulates entering positions at 3:00 PM on T+1 with $2,000 per position (max $10,000 daily budget). Liquidates all positions at 11:00 AM on T+2." },
                { label: "Step 5: ROI Calculation", text: "Accumulates daily gains/losses across the 30-day window to calculate Total Profit and ROI relative to the $10,000 max daily capital allocation." }
            ]
        },
        {
            id: "backtest-30d-strategy2",
            icon: <Activity className="w-5 h-5 text-indigo-500" />,
            title: "30-Day Strategy 2 Backtesting",
            badge: "Historical Simulation (Aggressive)",
            description: "Runs a daily historical simulation looking back exactly 30 calendar days to evaluate the Strategy 2 logic, trade execution, and cumulative ROI.",
            bullets: [
                { label: "Step 1: Universe Selection", text: "Fetches the universe of stocks comprising the Dow 30, Nasdaq 100, and S&P 500 from the Top Tickers page (~170 tickers)." },
                { label: "Step 2: Signal Filtering & Ranking", text: "Filters down the universe to only include tickers where Willy Market == 'Bull' (price > Willy VWAP). The remaining candidates are ranked by their 1-Wk Strategy Value in descending order, selecting the top 5." },
                { label: "Step 3: Trade Execution (Entry & Exit)", text: "Simulates entering positions at 3:00 PM on T+1 with $2,000 per position (max $10,000 daily budget). Liquidates all positions at 11:00 AM on T+2." },
                { label: "Step 4: ROI Calculation", text: "Accumulates daily gains/losses across the 30-day window to calculate Total Profit and ROI relative to the $10,000 max daily capital allocation." }
            ]
        },
        {
            id: "backtest-30d-strategy3",
            icon: <Activity className="w-5 h-5 text-teal-500" />,
            title: "30-Day Strategy 3 Backtesting",
            badge: "Historical Simulation (Timeline Shift)",
            description: "Runs a daily historical simulation looking back exactly 30 calendar days using Strategy 1 filters but with a custom timeline exit shift.",
            bullets: [
                { label: "Step 1: Universe Selection", text: "Fetches the universe of stocks comprising the Dow 30, Nasdaq 100, and S&P 500 from the Top Tickers page (~170 tickers)." },
                { label: "Step 2: Signal Filtering & Ranking", text: "Applies the exact same 10-indicator screener logic as Strategy 1 to filter down candidates, then ranks by 1-Wk Strategy Value to select the top 5." },
                { label: "Step 3: Trade Execution (Entry & Exit)", text: "Simulates entering positions at 3:00 PM on T+1 with $2,000 per position (max $10,000 daily budget). Liquidates all positions at 2:50 PM on T+2 (holding for nearly 24 hours)." },
                { label: "Step 4: ROI Calculation", text: "Accumulates daily gains/losses across the 30-day window to calculate Total Profit and ROI relative to the $10,000 max daily capital allocation." }
            ]
        },
        {
            id: "options-backtest",
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            title: "Options Strategy Backtesting & P&L Analytics",
            badge: "Synthetic Black-Scholes Engine",
            description: "Simulates buying At-The-Money (ATM) Call options on top-ranked screener candidates (Strategy 1) using a synthetic Black-Scholes pricing model with historical volatility, supporting multiple intraday holding horizons vs. a 'Hold to Expiry' baseline.",
            formula: "Call Premium = S · N(d1) - K · e^(-r·T) · N(d2) | d1 = [ln(S/K) + (r + σ²/2)T] / [σ√T]",
            bullets: [
                { label: "1. Screening & Candidate Selection", text: "Screens the entire universe on day T using the 5-layer Strategy 1 criteria (Willy Bull, 1-Wk Value > $10k, MACD Hist, MACD Slope > 0, RSI 30-70). Ranks candidates by 1-week momentum and selects the top 5." },
                { label: "2. Trade Entry & Pricing (T+1 3:00 PM)", text: "Simulates purchasing ATM Call options at 3:00 PM NY time. Strike K is rounded to standard ATM increments. Contracts are sized with $2,000 allocated per position (max $10,000 daily budget). Premium is computed via Black-Scholes using 30-day annualized realized volatility (σ) and 5.0% risk-free rate (r)." },
                { label: "3. Exit Strategies Supported", text: "• Intraday Exits (T+2, T+3, T+5, T+7, T+10, T+12, T+14, T+21): Positions exit at 11:00 AM NY time on T+N and are dynamically repriced via Black-Scholes with the updated underlying stock price and remaining time to expiry (T_rem).\n• Hold to Expiry: Positions are held until weekly expiry (~7 calendar days) and settled strictly at intrinsic value: max(S_exit - K, 0)." },
                { label: "4. Baseline Comparison & Relative Denominator", text: "For any selected lookback period, the engine concurrently evaluates the 'Hold to Expiry' baseline. Relative performance is calculated as: Relative % = [(Strategy P&L - Hold P&L) / |Hold P&L|] × 100%. This isolates the alpha generated by active holding-period optimization vs. passive expiration holding." },
                { label: "5. How to Analyze Results & P&L Dashboard", text: "• Options P&L ($ & %): Total dollar profit and cumulative ROI on capital.\n• Hold : [Hold to Expiry P&L]%: Baseline benchmark measuring theta decay drag vs. gamma capture.\n• S&P 500 Benchmark: Quantifies excess market alpha generated over passive equity index hold.\n• Leverage Multiple in Ledger: Evaluates the asymmetric payoff (often 2x–10x underlying move) vs. premium at risk." }
            ]
        },
        {
            id: "ai-agents-pipeline",
            icon: <Bot className="w-5 h-5 text-emerald-400" />,
            title: "Specialized AI Agents & Robinhood MCP Pipeline",
            badge: "Autonomous Sandbox Trading",
            description: "A linear two-agent pipeline that automates daily market screening and simulated execution in the Robinhood MCP sandbox with strict 0% capital-risk guardrails.",
            formula: "Buying Power = Current Cash + ∑(Liquidated Displaced Holdings Proceeds)",
            bullets: [
                { label: "1. Backtester Agent (Trigger: 2:00 PM EST)", text: "Automatically scans ~170 tickers across the Dow 30, Nasdaq 100, and S&P 500 every trading day at 2:00 PM EST. Applies Strategy 1 (1-Week lookback) quantitative filters (Bull Willy VWAP, 1-Wk Value > $10k, MACD Hist/Slope, RSI 30-70) and outputs a ranked recommendations payload with stock & ATM Call options signals." },
                { label: "2. Broker Agent (Portfolio Comparative Analysis)", text: "Ingests the Backtester recommendations and queries the active Robinhood Sandbox account (RH-SIM-SANDBOX-001). Compares existing holdings vs. incoming top opportunities to determine which non-strategy positions to liquidate." },
                { label: "3. Dynamic Buying Power & Trade Sizing", text: "Calculates total effective buying power as available cash plus proceeds from sell liquidations. Allocates capital across top-ranked stock positions and ATM Call options (sized to available budget)." },
                { label: "4. MCP Sandbox Execution & Guardrails", text: "Dispatches sell orders first to release capital, then dispatches stock and option buy orders strictly via the Robinhood Model Context Protocol (MCP) server. Live-capital execution is blocked by design." }
            ]
        }
    ];

    const filteredItems = glossaryItems.filter(item => {
        const query = searchQuery.toLowerCase();
        return (
            item.title.toLowerCase().includes(query) ||
            item.badge?.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            (item.bullets && item.bullets.some(b => b.label.toLowerCase().includes(query) || b.text.toLowerCase().includes(query))) ||
            (item.formula && item.formula.toLowerCase().includes(query)) ||
            (item.id === 'xgboost' && "Dynamic Factor (XGBoost) Quantitative Machine Learning Predict Alpha".toLowerCase().includes(query)) ||
            (item.id === 'macd' && "MACD Moving Average Convergence Divergence Momentum Indicator".toLowerCase().includes(query)) ||
            (item.id === 'rsi' && "RSI Relative Strength Index Momentum Oscillator".toLowerCase().includes(query)) ||
            (item.id === 'willy-vwap' && "WillyAlgo Indicator Dynamic Swing VWAP Volume Weighted Average Price".toLowerCase().includes(query)) ||
            (item.id === 'willy-market-state' && "Willy Market State Bull Bear VWAP Phase Classification".toLowerCase().includes(query)) ||
            (item.id === 'ranking-score' && "Ranking Score Composite Comparison Metric".toLowerCase().includes(query)) ||
            (item.id === 'buy-screener' && "Buy Screener Top Tickers Filtering Selection Logic Metrics".toLowerCase().includes(query)) ||
            (item.id === 'backtest-30d' && "30-Day Strategy 1 Backtesting Model Historical Simulation Universe Selection Trades ROI".toLowerCase().includes(query)) ||
            (item.id === 'backtest-30d-strategy2' && "30-Day Strategy 2 Backtesting Model Historical Simulation Universe Selection Trades ROI Aggressive Bull Market".toLowerCase().includes(query)) ||
            (item.id === 'backtest-30d-strategy3' && "30-Day Strategy 3 Backtesting Model Historical Simulation Universe Selection Trades ROI Timeline Shift 2:50 PM".toLowerCase().includes(query)) ||
            (item.id === 'options-backtest' && "Options Strategy Backtesting Black-Scholes Call Premium Strike Expiry Intraday Relative Hold Baseline P&L Leverage Theta Volatility".toLowerCase().includes(query)) ||
            (item.id === 'ai-agents-pipeline' && "Backtester Agent Broker Agent Robinhood MCP Model Context Protocol Sandbox Automated 2:00 PM EST Rebalance Stock Option Calls".toLowerCase().includes(query))
        );
    });

    return (
        <div className="space-y-8 animate-in fade-in pb-12 w-full max-w-5xl mx-auto mt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 pt-2">
                    <h2 className="text-3xl font-bold tracking-tight">Strategy Glossary</h2>
                    <p className="text-muted-foreground">Detailed methodology definitions, formulas, and ML logic driving the Strategic Alpha dashboard.</p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search strategy..."
                        className="w-full pl-9 bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card/50">
                    No strategy found matching &quot;{searchQuery}&quot;.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredItems.map((item) => (
                        <Card key={item.id} className={`flex flex-col h-full ${item.id === 'xgboost' ? 'md:col-span-2 shadow-md border-primary/50 bg-primary/5' : 'bg-card'}`}>
                            <CardHeader className="pb-3 border-b border-border/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {item.icon}
                                        <CardTitle className="text-lg">{item.title}</CardTitle>
                                    </div>
                                    {item.badge && <Badge variant={item.id === 'xgboost' ? 'default' : 'secondary'}>{item.badge}</Badge>}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-grow text-sm space-y-4">
                                <p className="text-muted-foreground leading-relaxed">{item.description}</p>

                                {item.formula && (
                                    <div className="bg-muted px-4 py-3 rounded-md border text-center font-mono opacity-90 text-xs text-foreground font-medium tracking-wide">
                                        {item.formula}
                                    </div>
                                )}

                                {item.bullets && item.bullets.length > 0 && (
                                    <ul className="space-y-3">
                                        {item.bullets.map((bullet, idx) => (
                                            <li key={idx} className="flex gap-2">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                                                <div>
                                                    <span className="font-semibold text-foreground block">{bullet.label}</span>
                                                    <span className="text-muted-foreground block leading-relaxed">{bullet.text}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {item.customContent}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
