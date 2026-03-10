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
    Search
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
            (item.id === 'rsi' && "RSI Relative Strength Index Momentum Oscillator".toLowerCase().includes(query))
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
