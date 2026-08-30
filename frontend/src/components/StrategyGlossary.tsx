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
    Bot,
    Flame,
    Building2
} from 'lucide-react';

export function StrategyGlossary() {
    const [searchQuery, setSearchQuery] = useState('');
    const glossaryItems = [
        {
            id: "danaher-fundamental-data",
            icon: <Building2 className="w-5 h-5 text-sky-400" />,
            title: "Fundamental & Trading Data Guide (Danaher Benchmark)",
            badge: "Financial Data Guide",
            description: "This screen shows fundamental and trading data for Danaher Corporation (DHR) as a concrete benchmark for analyzing company metrics.",
            customContent: (
                <div className="space-y-6 mt-4 text-sm text-foreground">
                    {/* Key Notation */}
                    <div className="bg-muted/50 p-4 rounded-lg border border-border/50 text-xs space-y-2">
                        <p className="font-semibold text-foreground text-sm">Key Notation & Symbols:</p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                            <li><span className="font-bold text-foreground">B</span> = billion dollars</li>
                            <li><span className="font-bold text-foreground">M</span> = million shares</li>
                            <li>Decimal margins such as <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-semibold">0.59</code> mean <span className="font-bold text-foreground">59%</span></li>
                            <li><span className="font-bold text-foreground">TTM</span> or &ldquo;Trailing 12 Months&rdquo; means the most recently completed 12-month period</li>
                        </ul>
                    </div>

                    {/* Section 1: Company Profile */}
                    <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5">1. Company Profile</h4>
                        <div className="overflow-x-auto rounded-lg border border-border/40">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/40">
                                    <tr>
                                        <th className="p-3 w-1/4">Item</th>
                                        <th className="p-3 w-1/2">Meaning</th>
                                        <th className="p-3 w-1/4">Danaher Example</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Short Name</td>
                                        <td className="p-3 text-muted-foreground">Abbreviated company name displayed by financial websites.</td>
                                        <td className="p-3 font-medium">Danaher Corporation</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Long Name</td>
                                        <td className="p-3 text-muted-foreground">Company’s full official or commonly reported name.</td>
                                        <td className="p-3 font-medium">Danaher Corporation</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Sector</td>
                                        <td className="p-3 text-muted-foreground">Broad part of the economy in which the company operates.</td>
                                        <td className="p-3 font-medium">Healthcare</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Industry</td>
                                        <td className="p-3 text-muted-foreground">More specific business category within the sector.</td>
                                        <td className="p-3 font-medium">Diagnostics &amp; Research</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Exchange</td>
                                        <td className="p-3 text-muted-foreground">Stock exchange where the shares trade.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">NYQ</span> generally refers to the New York Stock Exchange</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Country</td>
                                        <td className="p-3 text-muted-foreground">Country where the company is based or incorporated, depending on the data source.</td>
                                        <td className="p-3 font-medium">United States</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Website</td>
                                        <td className="p-3 text-muted-foreground">Company’s official website.</td>
                                        <td className="p-3 font-medium text-sky-400">danaher.com</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                            The sector and industry are useful when comparing Danaher with similar healthcare and diagnostic companies.
                        </p>
                    </div>

                    {/* Section 2: Valuation Metrics */}
                    <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5">2. Valuation Metrics</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            These measurements indicate how expensive or inexpensive the stock appears relative to earnings, sales, assets, and cash-generating ability. A high ratio is not automatically bad: investors may pay more for a company expected to grow quickly or generate dependable profits.
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-border/40">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/40">
                                    <tr>
                                        <th className="p-3 w-1/4">Item</th>
                                        <th className="p-3 w-1/2">Meaning</th>
                                        <th className="p-3 w-1/4">Interpretation of Shown Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Market Cap</td>
                                        <td className="p-3 text-muted-foreground">Share price × total shares outstanding. It is the market value of the company’s equity.</td>
                                        <td className="p-3 font-bold text-foreground">$153.85B</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Enterprise Value</td>
                                        <td className="p-3 text-muted-foreground">Market cap + debt and certain other claims − cash. It approximates the cost of acquiring the entire operating business.</td>
                                        <td className="p-3 font-bold text-foreground">$177.37B</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Trailing P/E</td>
                                        <td className="p-3 text-muted-foreground">Current share price ÷ earnings per share during the past 12 months.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">39.08:</span> investors pay about $39.08 for every $1 of historical annual earnings.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Forward P/E</td>
                                        <td className="p-3 text-muted-foreground">Current share price ÷ estimated earnings per share for the coming year.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">23.54:</span> investors pay about $23.54 for every $1 of forecast earnings.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">PEG Ratio</td>
                                        <td className="p-3 text-muted-foreground">P/E ratio adjusted for expected earnings growth. Usually calculated as P/E ÷ earnings-growth rate.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">1.43:</span> the valuation is 1.43 times the stated growth measure.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Price-to-Book</td>
                                        <td className="p-3 text-muted-foreground">Market price per share ÷ book value per share. Book value is assets minus liabilities attributable to shareholders.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">2.93:</span> the market values Danaher at 2.93 times its accounting book value.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Price-to-Sales, TTM</td>
                                        <td className="p-3 text-muted-foreground">Market cap ÷ revenue during the past 12 months.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">6.13:</span> investors pay $6.13 for every $1 of annual sales.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Enterprise Value-to-Revenue</td>
                                        <td className="p-3 text-muted-foreground">Enterprise value ÷ annual revenue. It incorporates debt and cash, unlike price-to-sales.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">7.07:</span> total business value equals about 7.07 times revenue.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Enterprise Value-to-EBITDA</td>
                                        <td className="p-3 text-muted-foreground">Enterprise value ÷ EBITDA. Often used to compare businesses with different debt levels.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">22.09:</span> enterprise value is about 22.09 times annual EBITDA.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Sub-section: Why Forward P/E is Lower */}
                        <div className="bg-sky-500/10 border border-sky-500/30 p-4 rounded-lg text-xs space-y-1.5">
                            <h5 className="font-semibold text-sky-400 text-sm">Why forward P/E is lower than trailing P/E</h5>
                            <p className="text-muted-foreground leading-relaxed">
                                A forward P/E of <strong className="text-foreground">23.54</strong>, versus a trailing P/E of <strong className="text-foreground">39.08</strong>, suggests analysts expect future earnings to be higher than recent earnings. It could also reflect unusual items that reduced past earnings. Forecasts are uncertain, so this should be investigated rather than accepted automatically.
                            </p>
                        </div>
                    </div>

                    {/* Section 3: Financial Highlights */}
                    <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5">3. Financial Highlights</h4>
                        <div className="overflow-x-auto rounded-lg border border-border/40">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/40">
                                    <tr>
                                        <th className="p-3 w-1/4">Item</th>
                                        <th className="p-3 w-1/2">Meaning</th>
                                        <th className="p-3 w-1/4">Interpretation of Shown Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Total Revenue</td>
                                        <td className="p-3 text-muted-foreground">Money generated from selling products and services before expenses.</td>
                                        <td className="p-3 font-bold text-foreground">$25.11B</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Revenue Growth</td>
                                        <td className="p-3 text-muted-foreground">Percentage change in revenue versus the comparison period, normally the prior year.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">0.06</span> = approximately 6% growth</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Gross Margin</td>
                                        <td className="p-3 text-muted-foreground"><code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">(Revenue − cost of goods/services) ÷ revenue</code>. It shows what remains after direct production costs.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">0.59</span> = 59%</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">EBITDA</td>
                                        <td className="p-3 text-muted-foreground">Earnings before interest, taxes, depreciation and amortization. It approximates operating earnings before financing and major noncash expenses.</td>
                                        <td className="p-3 font-bold text-foreground">$8.03B</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">EBITDA Margin</td>
                                        <td className="p-3 text-muted-foreground">EBITDA ÷ revenue.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">0.32</span> = 32%</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Operating Margin</td>
                                        <td className="p-3 text-muted-foreground">Operating income ÷ revenue after operating expenses, depreciation and amortization.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">0.20</span> = 20%</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Profit Margin</td>
                                        <td className="p-3 text-muted-foreground">Net income ÷ revenue after operating expenses, interest and taxes.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">0.16</span> = 16%</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Return on Assets</td>
                                        <td className="p-3 text-muted-foreground">Net income relative to the company’s assets. It measures how effectively assets generate profit.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">0.04</span> = approximately 4%</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Return on Equity</td>
                                        <td className="p-3 text-muted-foreground">Net income relative to shareholders’ equity.</td>
                                        <td className="p-3 font-medium"><span className="font-bold text-foreground">0.08</span> = approximately 8%</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Free Cash Flow</td>
                                        <td className="p-3 text-muted-foreground">Operating cash flow minus capital expenditures. This cash may be used for acquisitions, debt repayment, dividends and share repurchases.</td>
                                        <td className="p-3 font-bold text-foreground">$4.33B</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Total Debt</td>
                                        <td className="p-3 text-muted-foreground">Interest-bearing short- and long-term borrowings.</td>
                                        <td className="p-3 font-bold text-foreground">$27.86B</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Debt-to-Equity</td>
                                        <td className="p-3 text-muted-foreground">Debt relative to shareholders’ equity. Yahoo/yfinance often supplies this figure on a percentage scale.</td>
                                        <td className="p-3 text-muted-foreground"><span className="font-bold text-foreground">52.97</span> generally means approximately 52.97%, or $0.53 of debt per $1 of equity—not 52.97 times.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Revenue Flow Breakdown */}
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg text-xs space-y-2">
                            <h5 className="font-semibold text-emerald-400 text-sm">How $100 of revenue approximately flows through the business</h5>
                            <p className="text-muted-foreground">Based on the displayed margins:</p>
                            <ul className="space-y-1 font-medium text-foreground">
                                <li>• Revenue: <span className="font-bold">$100</span></li>
                                <li>• After direct costs, gross profit: about <span className="font-bold">$59</span></li>
                                <li>• EBITDA: about <span className="font-bold">$32</span></li>
                                <li>• Operating profit: about <span className="font-bold">$20</span></li>
                                <li>• Final net profit: about <span className="font-bold">$16</span></li>
                            </ul>
                            <p className="text-xs text-muted-foreground italic pt-1 border-t border-emerald-500/20 mt-2">
                                These are simplified margin comparisons, not a complete income statement.
                            </p>
                        </div>
                    </div>

                    {/* Section 4: Trading Information */}
                    <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5">4. Trading Information</h4>
                        <div className="overflow-x-auto rounded-lg border border-border/40">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/40">
                                    <tr>
                                        <th className="p-3 w-1/4">Item</th>
                                        <th className="p-3 w-1/2">Meaning</th>
                                        <th className="p-3 w-1/4">Interpretation of Shown Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Current Price</td>
                                        <td className="p-3 text-muted-foreground">Latest available market price. It may be delayed.</td>
                                        <td className="p-3 font-bold text-foreground">$218.85</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Regular Market Price</td>
                                        <td className="p-3 text-muted-foreground">Latest price during regular exchange hours, generally excluding after-hours trading.</td>
                                        <td className="p-3 font-bold text-foreground">$218.85</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Previous Close</td>
                                        <td className="p-3 text-muted-foreground">Final regular-session price on the preceding trading day.</td>
                                        <td className="p-3 font-bold text-foreground">$215.91</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Open</td>
                                        <td className="p-3 text-muted-foreground">Price of the first trade in the current regular session.</td>
                                        <td className="p-3 font-bold text-foreground">$215.58</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Day Low</td>
                                        <td className="p-3 text-muted-foreground">Lowest price traded during the session.</td>
                                        <td className="p-3 font-bold text-foreground">$213.46</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Day High</td>
                                        <td className="p-3 text-muted-foreground">Highest price traded during the session.</td>
                                        <td className="p-3 font-bold text-foreground">$220.25</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">52-Week Low</td>
                                        <td className="p-3 text-muted-foreground">Lowest trading price during the previous 52 weeks.</td>
                                        <td className="p-3 font-bold text-foreground">$160.93</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">52-Week High</td>
                                        <td className="p-3 text-muted-foreground">Highest trading price during the previous 52 weeks.</td>
                                        <td className="p-3 font-bold text-foreground">$242.80</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Volume</td>
                                        <td className="p-3 text-muted-foreground">Shares traded during the current or most recently completed session.</td>
                                        <td className="p-3 font-bold text-foreground">4.00M shares</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Average Volume</td>
                                        <td className="p-3 text-muted-foreground">Average number of shares traded per session over the data provider’s chosen period.</td>
                                        <td className="p-3 font-bold text-foreground">4.90M shares</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Beta</td>
                                        <td className="p-3 text-muted-foreground">Measures historical stock-price sensitivity to overall market movements.</td>
                                        <td className="p-3"><span className="font-bold text-foreground">0.80:</span> historically, Danaher has tended to fluctuate less than the market.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Dividend Yield</td>
                                        <td className="p-3 text-muted-foreground">Annual dividend per share ÷ share price, expressed as a percentage.</td>
                                        <td className="p-3 text-muted-foreground"><span className="font-bold text-foreground">0.73</span> most likely means approximately 0.73%, not 73%.</td>
                                    </tr>
                                    <tr className="hover:bg-muted/20">
                                        <td className="p-3 font-semibold text-foreground">Trailing Annual Dividend Rate</td>
                                        <td className="p-3 text-muted-foreground">Total dividends paid per share during the past 12 months.</td>
                                        <td className="p-3 font-bold text-foreground">$1.44 per share</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Beta Explanation Box */}
                        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg text-xs space-y-2">
                            <h5 className="font-semibold text-amber-400 text-sm">Understanding beta</h5>
                            <p className="text-muted-foreground">A beta of:</p>
                            <ul className="space-y-1 text-muted-foreground ml-2">
                                <li>• <strong className="text-foreground">1.00</strong> means the stock historically moved about as much as the market.</li>
                                <li>• <strong className="text-foreground">Above 1.00</strong> means it was generally more volatile than the market.</li>
                                <li>• <strong className="text-foreground">Below 1.00</strong> means it was generally less volatile.</li>
                            </ul>
                            <p className="text-muted-foreground leading-relaxed pt-1">
                                Danaher’s <strong className="text-foreground">0.80 beta</strong> suggests that, historically, a 10% market movement corresponded to roughly an 8% movement in Danaher, on average. It does not predict the exact next movement.
                            </p>
                        </div>
                    </div>

                    {/* Section 5: Important Observations */}
                    <div className="bg-card border border-border p-4.5 rounded-lg space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5">Important observations</h4>
                        <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>Danaher appears to have <strong className="text-foreground">strong margins and positive free cash flow</strong>.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>Its valuation multiples—especially trailing P/E and EV/EBITDA—indicate that investors are assigning a relatively substantial value to its earnings.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>The lower forward P/E suggests expectations for improved future earnings, but those estimates can be wrong.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>The stock is below its displayed 52-week high but well above its 52-week low.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>Current volume of <strong className="text-foreground">4.00 million</strong> is below the <strong className="text-foreground">4.90 million</strong> average, suggesting slightly lighter-than-normal trading activity.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <span>The <strong className="text-foreground">dividend yield and debt-to-equity fields require careful unit handling</strong> because yfinance/Yahoo fields are not always displayed consistently across applications.</span>
                            </li>
                        </ul>
                        <p className="text-xs text-muted-foreground italic pt-2 border-t border-border/30">
                            These figures should be compared with Danaher’s history, direct competitors, recent SEC filings, and expected earnings growth before making an investment decision.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: "call-option-stats-matrix",
            icon: <Flame className="w-5 h-5 text-amber-500" />,
            title: "Call Option Stats Matrix (14 Indicators)",
            badge: "Options Checklist Matrix",
            description: "A 14-indicator quantitative checklist evaluating Call Option buying setups across Dow 30, Nasdaq 100, and S&P 500 constituents. Column 1 (+ve Indicators) sums the total number of positive criteria met out of 14.",
            customContent: (
                <div className="space-y-4 mt-4 text-sm">
                    <div>
                        <h4 className="font-semibold text-foreground">1. Column 1: Total Positive (+ve) Indicator Score</h4>
                        <p className="text-muted-foreground mt-1 leading-relaxed">
                            Ranks candidates from 0 to 14 positive criteria. High scores (&ge; 10/14 in green) signal strong confluence across trend, momentum, volatility, and option pricing metrics.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-foreground">2. Detailed Indicator Formulas & Rules</h4>
                        <ul className="space-y-3 mt-2">
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">1. Stock Trend:</span>
                                    <span className="text-muted-foreground block">Requires <code className="bg-muted px-1 rounded font-mono text-xs">Price &gt; 20 EMA &gt; 50 SMA</code> with both 20-day EMA and 50-day SMA slopes rising.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">2. Support &amp; Resistance:</span>
                                    <span className="text-muted-foreground block">Verifies confirmed breakout (<code className="bg-muted px-1 rounded font-mono text-xs">Price &ge; 98.5% of 20d High</code>) or upside headroom <code className="bg-muted px-1 rounded font-mono text-xs">&ge; 2x ATR(14)</code>.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">3. Trading Volume:</span>
                                    <span className="text-muted-foreground block">Requires <code className="bg-muted px-1 rounded font-mono text-xs">Volume / 20d Avg Vol &ge; 1.0</code> on a positive price close.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">4. RSI (14):</span>
                                    <span className="text-muted-foreground block">Requires RSI in the bullish momentum corridor (<code className="bg-muted px-1 rounded font-mono text-xs">50.0 &le; RSI &le; 75.0</code>).</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">5. MACD:</span>
                                    <span className="text-muted-foreground block">Requires <code className="bg-muted px-1 rounded font-mono text-xs">MACD Line &gt; Signal Line</code> or <code className="bg-muted px-1 rounded font-mono text-xs">MACD Histogram &gt; 0</code>.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">6. ATR Realism:</span>
                                    <span className="text-muted-foreground block">Requires daily price range <code className="bg-muted px-1 rounded font-mono text-xs">ATR(14) / Price &ge; 1.2%</code> to ensure option premium expansion.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">7. Relative Strength vs. SPY:</span>
                                    <span className="text-muted-foreground block">Requires 1-month stock return to outperform S&amp;P 500 benchmark (<code className="bg-muted px-1 rounded font-mono text-xs">Stock 1M Ret &gt; SPY 1M Ret</code>).</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">8. Bid-Ask Spread:</span>
                                    <span className="text-muted-foreground block">Ensures option liquidity with tight spread <code className="bg-muted px-1 rounded font-mono text-xs">&le; $0.25</code> or <code className="bg-muted px-1 rounded font-mono text-xs">Spread / Midpoint &le; 10%</code>.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">9. Option Volume &amp; OI:</span>
                                    <span className="text-muted-foreground block">Requires active liquid options chain (<code className="bg-muted px-1 rounded font-mono text-xs">Call Vol &gt; 0</code> and <code className="bg-muted px-1 rounded font-mono text-xs">Open Interest &gt; 100</code>).</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">10. Implied Volatility (IV):</span>
                                    <span className="text-muted-foreground block">Protects against IV crush: <code className="bg-muted px-1 rounded font-mono text-xs">IV &le; 50%</code> or ratio <code className="bg-muted px-1 rounded font-mono text-xs">IV / HV(30) &le; 1.30</code>.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">11. Delta:</span>
                                    <span className="text-muted-foreground block">Targets optimal directional sensitivity: <code className="bg-muted px-1 rounded font-mono text-xs">0.30 &le; Call Delta &le; 0.70</code>.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">12. Theta Decay:</span>
                                    <span className="text-muted-foreground block">Ensures daily time decay is manageable: <code className="bg-muted px-1 rounded font-mono text-xs">Daily Theta / Premium &le; 5.0%</code>.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">13. Earnings Risk:</span>
                                    <span className="text-muted-foreground block">Verifies no imminent earnings release within option expiration window to prevent earnings IV crush.</span>
                                </div>
                            </li>
                            <li className="flex gap-2">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">14. Breakeven vs. Expected Move:</span>
                                    <span className="text-muted-foreground block">Requires breakeven rise <code className="bg-muted px-1 rounded font-mono text-xs">&le; Expected Move</code> (<code className="bg-muted px-1 rounded font-mono text-xs">Price * IV * sqrt(Days/365)</code>).</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            )
        },
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
        },
        {
            id: "compare-charts-linear-fit",
            icon: <LineChart className="w-5 h-5 text-emerald-400" />,
            title: "Compare Matrix Metrics & Call Option Significance",
            badge: "Options Strategy & Metrics",
            description: "Detailed mathematical breakdown of Current Price, Linear Fit Slope, and Residual Standard Deviation computed in the Compare Charts tab, and their critical strategic significance for Call Option buyers.",
            customContent: (
                <div className="space-y-6 mt-4 text-sm text-foreground">
                    {/* Overview Box */}
                    <div className="bg-muted/50 p-4 rounded-lg border border-border/50 text-xs space-y-2">
                        <p className="font-semibold text-foreground text-sm">Compare Matrix Metrics Overview:</p>
                        <p className="text-muted-foreground leading-relaxed">
                            These three metrics evaluate price trajectory, trend velocity, and structural volatility over any chosen timeframe (1W to 5Y), providing options traders with quantitative precision for strike selection and timing.
                        </p>
                    </div>

                    {/* Section 1: Current Price */}
                    <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5 flex items-center justify-between">
                            <span>1. Current Price (S₀)</span>
                            <span className="text-xs font-mono font-normal text-muted-foreground">Latest Closing Price</span>
                        </h4>
                        <div className="bg-card border border-border/40 p-4 rounded-lg space-y-2 text-xs sm:text-sm">
                            <p className="text-muted-foreground leading-relaxed">
                                <strong className="text-foreground">Definition:</strong> The latest market closing price of the underlying equity for the selected observation window.
                            </p>
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-md space-y-1.5 text-xs">
                                <p className="font-semibold text-emerald-400">Significance for Call Options:</p>
                                <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                                    <li><strong className="text-foreground">Moneyness Determination:</strong> Dictates whether options are In-The-Money (ITM: S₀ &gt; K), At-The-Money (ATM: S₀ ≈ K), or Out-Of-The-Money (OTM: S₀ &lt; K).</li>
                                    <li><strong className="text-foreground">Intrinsic vs Extrinsic Value:</strong> Directly sets intrinsic value (max(S₀ − K, 0)). Higher current price relative to strike reduces extrinsic time-decay vulnerability.</li>
                                    <li><strong className="text-foreground">Delta (Δ) Acceleration:</strong> As S₀ increases past strike K, call Delta scales towards 1.0, capturing near 1:1 stock price gains.</li>
                                    <li><strong className="text-foreground">Breakeven Anchor:</strong> Essential anchor for calculating option breakeven price (Strike + Premium) and maximum downside risk (100% of premium paid).</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Linear Fit Slope */}
                    <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5 flex items-center justify-between">
                            <span>2. Linear Fit Slope (Slope, m)</span>
                            <span className="text-xs font-mono font-normal text-muted-foreground">m = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²</span>
                        </h4>
                        <div className="bg-card border border-border/40 p-4 rounded-lg space-y-2 text-xs sm:text-sm">
                            <p className="text-muted-foreground leading-relaxed">
                                <strong className="text-foreground">Definition:</strong> The Ordinary Least Squares (OLS) linear trend slope measuring average dollar price change per trading day over the chosen period range.
                            </p>
                            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-md space-y-1.5 text-xs">
                                <p className="font-semibold text-blue-400">Significance for Call Options:</p>
                                <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                                    <li><strong className="text-foreground">Directional Drift Velocity:</strong> Positive slope (m &gt; 0) confirms steady upward price momentum necessary to outpace daily Theta (Θ) time decay.</li>
                                    <li><strong className="text-foreground">Price Projection at Expiry:</strong> Enables estimating projected stock price by expiration date (S_exp ≈ S₀ + m · D_days) to verify if calls can reach breakeven before expiry.</li>
                                    <li><strong className="text-foreground">Delta/Gamma Expansion:</strong> Higher positive slope indicates strong price acceleration, maximizing rapid call premium expansion.</li>
                                    <li><strong className="text-foreground">Negative Slope Warning (m &lt; 0):</strong> Clear signal to avoid buying call options; downward trend velocity almost guarantees total option premium decay.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Residual Standard Deviation */}
                    <div className="space-y-3">
                        <h4 className="text-base font-semibold text-foreground border-b border-border/40 pb-1.5 flex items-center justify-between">
                            <span>3. Standard Deviation around Linear Fit (Std, σ_res)</span>
                            <span className="text-xs font-mono font-normal text-muted-foreground">Std = √(Σ(yᵢ − ŷᵢ)² / n)</span>
                        </h4>
                        <div className="bg-card border border-border/40 p-4 rounded-lg space-y-2 text-xs sm:text-sm">
                            <p className="text-muted-foreground leading-relaxed">
                                <strong className="text-foreground">Definition:</strong> The standard deviation of historical daily close prices relative to the linear regression trendline (ŷᵢ = m · xᵢ + c). It measures dispersion / noise around the core trend.
                            </p>
                            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-md space-y-1.5 text-xs">
                                <p className="font-semibold text-purple-400">Significance for Call Options:</p>
                                <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                                    <li><strong className="text-foreground">Regression Channel Bands:</strong> Prices oscillating within ±2·Std define a natural price channel. Buying calls when stock is near the lower -1·Std or -2·Std channel boundary provides optimal risk-reward entry.</li>
                                    <li><strong className="text-foreground">Implied Volatility (IV) Mispricing Check:</strong> High residual Std indicates high realized volatility. If Option IV is low relative to high residual Std, call premiums are cheap/underpriced.</li>
                                    <li><strong className="text-foreground">Strike Selection &amp; Probability of Profit:</strong> Choosing strikes within 1·Std of projected trend price maximizes overall probability of profit (POP).</li>
                                    <li><strong className="text-foreground">Objective Stop-Loss Trigger:</strong> If price breaks below -2·Std from the linear fit line, structural trend collapse is confirmed, serving as a disciplined exit rule for call positions.</li>
                                </ul>
                            </div>
                        </div>
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
            (item.id === 'danaher-fundamental-data' && "Danaher Corporation Fundamental Trading Data Company Profile Valuation Metrics Financial Highlights Trading Information Beta Forward P/E Market Cap Revenue FCF Margin Short Name Long Name Sector Industry Exchange Country Website Debt".toLowerCase().includes(query)) ||
            (item.id === 'call-option-stats-matrix' && "Call Option Stats Matrix 14 Indicators Checklist Trend Support Volume RSI MACD ATR RS SPY Spread Delta Theta Earnings Expected Move".toLowerCase().includes(query)) ||
            (item.id === 'compare-charts-linear-fit' && "Compare Matrix Indicators Call Option Significance Current Price Linear Fit Slope Standard Deviation Residual Volatility Strike Selection Delta Theta".toLowerCase().includes(query)) ||
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
                        <Card key={item.id} className={`flex flex-col h-full ${item.id === 'xgboost' || item.id === 'danaher-fundamental-data' || item.id === 'compare-charts-linear-fit' ? 'md:col-span-2 shadow-md border-primary/40 bg-card' : 'bg-card'}`}>
                            <CardHeader className="pb-3 border-b border-border/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {item.icon}
                                        <CardTitle className="text-lg">{item.title}</CardTitle>
                                    </div>
                                    {item.badge && <Badge variant={item.id === 'xgboost' || item.id === 'danaher-fundamental-data' ? 'default' : 'secondary'}>{item.badge}</Badge>}
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
