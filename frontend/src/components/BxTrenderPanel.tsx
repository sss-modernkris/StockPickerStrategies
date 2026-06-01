import React, { useState } from 'react';
import { PricePoint } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ComposedChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { 
    TrendingUp, 
    TrendingDown, 
    Activity, 
    AlertCircle, 
    Info, 
    Calendar, 
    Zap, 
    CheckCircle2, 
    XCircle, 
    BookOpen, 
    ShieldAlert, 
    ChevronRight, 
    HelpCircle,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';

interface BxTrenderPanelProps {
    priceHistory: PricePoint[];
    symbol: string;
}

interface CrossoverSignal {
    date: string;
    description: string;
    action: 'BUY' | 'SELL' | 'ACCUMULATE' | 'CAUTION';
    badgeClass: string;
    icon: React.ReactNode;
}

export function BxTrenderPanel({ priceHistory, symbol }: BxTrenderPanelProps) {
    const [timeRange, setTimeRange] = useState<'3M' | '6M' | '12M'>('12M');
    const [activeGuideTab, setActiveGuideTab] = useState<'signals' | 'checklist' | 'math' | 'risk'>('signals');

    if (!priceHistory || priceHistory.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] border border-dashed rounded-lg bg-card text-muted-foreground">
                <AlertCircle className="w-12 h-12 text-muted-foreground animate-bounce mb-3" />
                <p className="font-semibold">No historical price data loaded for {symbol}.</p>
                <p className="text-xs">Ensure yfinance data is successfully retrieved.</p>
            </div>
        );
    }

    // 1. Process full data for calculations and signals
    const fullChartData = priceHistory.map((p, idx) => {
        const openPrice = p.open ?? p.close;
        const highPrice = p.high ?? p.close;
        const lowPrice = p.low ?? p.close;
        const isBullish = p.close >= openPrice;
        
        return {
            date: p.date,
            open: openPrice,
            high: highPrice,
            low: lowPrice,
            close: p.close,
            wick: [lowPrice, highPrice],
            body: isBullish ? [openPrice, p.close] : [p.close, openPrice],
            color: isBullish ? '#22c55e' : '#ef4444', // green-500 / red-500
            bx_short: p.bx_short ?? 0,
            bx_long: p.bx_long ?? 0
        };
    });

    // 2. Compute chronological crossover signals
    const signals: CrossoverSignal[] = [];
    for (let i = 1; i < fullChartData.length; i++) {
        const curr = fullChartData[i];
        const prev = fullChartData[i - 1];

        const currShort = curr.bx_short;
        const prevShort = prev.bx_short;
        const currLong = curr.bx_long;
        const prevLong = prev.bx_long;

        // Zero Crossovers
        if (prevShort <= 0 && currShort > 0) {
            signals.push({
                date: curr.date,
                description: 'Short-Term Xtrender crossed above Zero-Line',
                action: 'BUY',
                badgeClass: 'bg-green-500/10 text-green-500 border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.1)]',
                icon: <TrendingUp className="w-3.5 h-3.5" />
            });
        } else if (prevShort >= 0 && currShort < 0) {
            signals.push({
                date: curr.date,
                description: 'Short-Term Xtrender crossed below Zero-Line',
                action: 'SELL',
                badgeClass: 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.1)]',
                icon: <TrendingDown className="w-3.5 h-3.5" />
            });
        }

        // Short / Long Crossovers
        if (prevShort <= prevLong && currShort > currLong) {
            signals.push({
                date: curr.date,
                description: 'Short-Term crossed above Long-Term Xtrender',
                action: 'ACCUMULATE',
                badgeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />
            });
        } else if (prevShort >= prevLong && currShort < currLong) {
            signals.push({
                date: curr.date,
                description: 'Short-Term crossed below Long-Term Xtrender',
                action: 'CAUTION',
                badgeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            });
        }
    }

    // Sort signals to show the most recent first
    const reversedSignals = [...signals].reverse();

    // 3. Apply time range filtering for chart rendering
    let dataPointsToDisplay = 252; // 12M by default
    if (timeRange === '3M') dataPointsToDisplay = 63;
    else if (timeRange === '6M') dataPointsToDisplay = 126;

    const chartDisplayData = fullChartData.slice(-dataPointsToDisplay);

    return (
        <div className="flex flex-col gap-6 w-full h-full overflow-y-auto pb-8">
            {/* Header / Info Panel */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border rounded-lg p-5 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <span className="text-primary font-extrabold">{symbol}</span>
                        <span>BX Trender Analytics</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                        The BX Trender calculates short-term spreading momentum (RSI of 5/20 EMA spreads) layered over a long-term structural baseline (RSI of EMA 200). 
                        It is ideal for identifying trend exhaustion and capture breakouts.
                    </p>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-lg border shrink-0">
                    <Button 
                        variant={timeRange === '3M' ? 'secondary' : 'ghost'} 
                        onClick={() => setTimeRange('3M')} 
                        size="sm" 
                        className="h-8 text-xs font-semibold px-3"
                    >
                        3 Months
                    </Button>
                    <Button 
                        variant={timeRange === '6M' ? 'secondary' : 'ghost'} 
                        onClick={() => setTimeRange('6M')} 
                        size="sm" 
                        className="h-8 text-xs font-semibold px-3"
                    >
                        6 Months
                    </Button>
                    <Button 
                        variant={timeRange === '12M' ? 'secondary' : 'ghost'} 
                        onClick={() => setTimeRange('12M')} 
                        size="sm" 
                        className="h-8 text-xs font-semibold px-3"
                    >
                        12 Months (Full)
                    </Button>
                </div>
            </div>

            {/* Core Visualization charts */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                
                {/* Main Candlestick Chart (7 Columns) */}
                <div className="xl:col-span-7 bg-card border rounded-lg p-5 shadow-sm flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>Daily Price Action (Candlesticks)</span>
                    </h3>
                    <div className="w-full h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartDisplayData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(dateStr) => {
                                        const d = new Date(dateStr);
                                        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                    }}
                                    tick={{ fontSize: 10 }}
                                    stroke="#6b7280"
                                />
                                <YAxis 
                                    domain={['auto', 'auto']}
                                    tickFormatter={(val) => `$${val.toFixed(2)}`}
                                    tick={{ fontSize: 10 }}
                                    stroke="#6b7280"
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    labelFormatter={(label) => `Date: ${label}`}
                                    formatter={(value: any, name?: string) => {
                                        if (!name || name === 'wick' || name === 'body') return null;
                                        return [`$${parseFloat(value).toFixed(2)}`, name.toUpperCase()];
                                    }}
                                />
                                {/* Candlestick Wick (Low to High) */}
                                <Bar dataKey="wick" fill="#6b7280" barSize={1.5} opacity={0.7} name="wick" />
                                {/* Candlestick Body (Open to Close) */}
                                <Bar dataKey="body" barSize={10} name="body">
                                    {chartDisplayData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* BX Trender Sub-Chart (5 Columns) */}
                <div className="xl:col-span-5 bg-card border rounded-lg p-5 shadow-sm flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                        <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span>BX Trender Momentum Oscillator</span>
                    </h3>
                    <div className="w-full h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartDisplayData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(dateStr) => {
                                        const d = new Date(dateStr);
                                        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                    }}
                                    tick={{ fontSize: 10 }}
                                    stroke="#6b7280"
                                />
                                <YAxis 
                                    domain={[-55, 55]}
                                    tick={{ fontSize: 10 }}
                                    stroke="#6b7280"
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    labelFormatter={(label) => `Date: ${label}`}
                                    formatter={(value: any, name?: string) => {
                                        const labelName = name === 'bx_short' ? 'Short-Term' : 'Long-Term';
                                        return [`${parseFloat(value).toFixed(2)}`, labelName];
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'Zero Line', fill: '#6b7280', fontSize: 9, position: 'insideTopLeft' }} />
                                
                                {/* Background Long-Term Xtrender Histogram */}
                                <Bar dataKey="bx_long" barSize={8} name="bx_long">
                                    {chartDisplayData.map((entry, index) => {
                                        const fillCol = entry.bx_long >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                                        return <Cell key={`cell-long-${index}`} fill={fillCol} />;
                                    })}
                                </Bar>
                                
                                {/* Solid Short-Term Xtrender Oscillating Line */}
                                <Line 
                                    type="monotone" 
                                    name="bx_short" 
                                    dataKey="bx_short" 
                                    stroke="#f59e0b" 
                                    strokeWidth={2} 
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Chronological Signals Table */}
            <div className="bg-card border rounded-lg p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center justify-between border-b pb-2 shrink-0">
                    <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-500 animate-pulse" />
                        <span>Proprietary BX Crossover Signal Logs</span>
                    </span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono font-semibold">
                        {reversedSignals.length} Events Logged
                    </span>
                </h3>
                <div className="w-full flex-1 overflow-auto max-h-[300px] border rounded text-xs">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-muted/50 sticky top-0 font-bold border-b text-muted-foreground">
                            <tr>
                                <th className="p-3">Trigger Date</th>
                                <th className="p-3">Calculation Details / Signal Event</th>
                                <th className="p-3 text-center w-[150px]">Trigger Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y font-mono">
                            {reversedSignals.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-muted-foreground font-sans">
                                        No crossover triggers logged in the last 12 months.
                                    </td>
                                </tr>
                            ) : (
                                reversedSignals.map((sig, idx) => (
                                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-3 font-sans font-medium text-foreground">{sig.date}</td>
                                        <td className="p-3 font-sans text-muted-foreground">{sig.description}</td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${sig.badgeClass}`}>
                                                {sig.icon}
                                                {sig.action}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Note: Signals are generated dynamically by scanning the historical daily price coordinates chronologically. A zero-crossing triggers a **BUY** or **SELL** alert, whereas a baseline spread crossover marks **ACCUMULATE** or **CAUTION** alerts.
                </p>
            </div>

            {/* BX Trender Strategic Trading & Decision Guide */}
            <div className="bg-card border rounded-lg p-6 shadow-md flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
                    <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-primary" />
                            <span>BX Trender Trading Guide & Decision Hub</span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            A highly detailed breakdown of the mathematical properties, signal definitions, and advanced execution rules of the proprietary dual-momentum BX Trender strategy.
                        </p>
                    </div>

                    {/* Interactive Tab Selectors */}
                    <div className="flex flex-wrap gap-1.5 bg-muted/30 p-1 rounded-lg border">
                        <button
                            onClick={() => setActiveGuideTab('signals')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                                activeGuideTab === 'signals'
                                    ? 'bg-secondary text-secondary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5" />
                            Core Decision Signals
                        </button>
                        <button
                            onClick={() => setActiveGuideTab('checklist')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                                activeGuideTab === 'checklist'
                                    ? 'bg-secondary text-secondary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Trader's Audit Flow
                        </button>
                        <button
                            onClick={() => setActiveGuideTab('math')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                                activeGuideTab === 'math'
                                    ? 'bg-secondary text-secondary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                        >
                            <Activity className="w-3.5 h-3.5" />
                            Mathematical Framework
                        </button>
                        <button
                            onClick={() => setActiveGuideTab('risk')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                                activeGuideTab === 'risk'
                                    ? 'bg-secondary text-secondary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Risk & Invalidation
                        </button>
                    </div>
                </div>

                {/* Tab content renderer */}
                <div className="min-h-[220px]">
                    {activeGuideTab === 'signals' && (
                        <div className="space-y-6">
                            <p className="text-xs text-muted-foreground max-w-4xl">
                                The BX Trender uses a dual-momentum regime to classify four distinct stages in an asset's cycle. 
                                Always confirm short-term triggers with the primary trend (Long-Term background histogram) before making final buy/sell decisions.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Card 1: Strong Buy */}
                                <div className="bg-muted/20 border border-green-500/20 rounded-lg p-4 flex flex-col justify-between hover:bg-muted/30 transition-all shadow-[0_0_12px_rgba(34,197,94,0.02)]">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded uppercase">
                                                <ArrowUpRight className="w-3 h-3" /> Strong Buy
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">Confluent Breakout</span>
                                        </div>
                                        <h4 className="font-bold text-foreground text-sm">Dual Bullish Confluence</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Short-Term Xtrender is <strong className="text-green-500">&gt; 0</strong> (crossing zero upwards) while the Long-Term background histogram is <strong className="text-emerald-500">Green (&gt; 0)</strong>.
                                        </p>
                                    </div>
                                    <div className="border-t border-muted/50 mt-3 pt-3 text-[11px] text-muted-foreground">
                                        <span className="font-semibold text-foreground">Action:</span> Initiate full long exposure or buy call options. High probability of immediate momentum expansion.
                                    </div>
                                </div>

                                {/* Card 2: Accumulate */}
                                <div className="bg-muted/20 border border-emerald-500/20 rounded-lg p-4 flex flex-col justify-between hover:bg-muted/30 transition-all shadow-[0_0_12px_rgba(16,185,129,0.02)]">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
                                                <Zap className="w-3 h-3 text-emerald-400" /> Accumulate
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">Pullback Resolution</span>
                                        </div>
                                        <h4 className="font-bold text-foreground text-sm">Secondary Dip Buying</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Short-Term Xtrender crosses <strong className="text-emerald-400">above the Long-Term baseline</strong> while the macro histogram is already positive (<strong className="text-green-500">Green</strong>).
                                        </p>
                                    </div>
                                    <div className="border-t border-muted/50 mt-3 pt-3 text-[11px] text-muted-foreground">
                                        <span className="font-semibold text-foreground">Action:</span> Add to existing positions on dips. Suggests intermediate-term profit taking has settled and primary uptrend is resuming.
                                    </div>
                                </div>

                                {/* Card 3: Caution */}
                                <div className="bg-muted/20 border border-amber-500/20 rounded-lg p-4 flex flex-col justify-between hover:bg-muted/30 transition-all shadow-[0_0_12px_rgba(245,158,11,0.02)]">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                                                <AlertCircle className="w-3 h-3 text-amber-500" /> Caution
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">Early Exhaustion</span>
                                        </div>
                                        <h4 className="font-bold text-foreground text-sm">Trend Fatigue Signal</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Short-Term Xtrender crosses <strong className="text-amber-500">below the Long-Term baseline</strong>. Indicates buying momentum is starting to decay relative to the macro mean.
                                        </p>
                                    </div>
                                    <div className="border-t border-muted/50 mt-3 pt-3 text-[11px] text-muted-foreground">
                                        <span className="font-semibold text-foreground">Action:</span> Tighten trailing stop-losses, avoid adding new shares, take partial profits. Precedes full bearish crossings.
                                    </div>
                                </div>

                                {/* Card 4: Strong Sell */}
                                <div className="bg-muted/20 border border-red-500/20 rounded-lg p-4 flex flex-col justify-between hover:bg-muted/30 transition-all shadow-[0_0_12px_rgba(239,68,68,0.02)]">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded uppercase">
                                                <ArrowDownRight className="w-3 h-3 text-red-500" /> Strong Sell
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">Confluent Breakdown</span>
                                        </div>
                                        <h4 className="font-bold text-foreground text-sm">Dual Bearish Confluence</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Short-Term Xtrender is <strong className="text-red-500">&lt; 0</strong> (crossing zero downwards) while the Long-Term background histogram is <strong className="text-red-500">Red (&lt; 0)</strong>.
                                        </p>
                                    </div>
                                    <div className="border-t border-muted/50 mt-3 pt-3 text-[11px] text-muted-foreground">
                                        <span className="font-semibold text-foreground">Action:</span> Exit long holdings completely, hedge exposure, or purchase protective puts. Heavy downside acceleration risk.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeGuideTab === 'checklist' && (
                        <div className="space-y-5">
                            <p className="text-xs text-muted-foreground max-w-4xl font-sans">
                                Follow this rigorous step-by-step trading audit workflow to assess a stock ticker systematically before executing buy or sell transactions:
                            </p>
                            <div className="relative border-l border-muted pl-6 ml-4 space-y-6">
                                {/* Step 1 */}
                                <div className="relative">
                                    <span className="absolute -left-[33px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-4 border-background">
                                        1
                                    </span>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                                            Assess the Primary Regime (Background Histogram)
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Check if the background bar is <strong className="text-green-500">Green</strong> or <strong className="text-red-500">Red</strong>. 
                                            Green signifies a bullish environment where buy signals represent highly profitable breakouts. Red indicates a bearish regime where capital should be primarily in cash, or focused on hedging.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="relative">
                                    <span className="absolute -left-[33px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-4 border-background">
                                        2
                                    </span>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                                            Identify Crossover Trigger Events
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Consult the <strong className="text-foreground">Crossover Signal Logs</strong> table. 
                                            Has the orange line recently crossed above the 0 mark (creating a BUY signal) or below the 0 mark (creating a SELL signal)? 
                                            Or has it crossed the long-term baseline (ACCUMULATE / CAUTION)? Recent crossover occurrences represent entry and exit windows.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="relative">
                                    <span className="absolute -left-[33px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-4 border-background">
                                        3
                                    </span>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                                            Measure Momentum Velocity and Fatigue
                                            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono font-normal text-muted-foreground">Short-Term Amplitude</span>
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Observe the absolute height/depth of the Short-Term line (orange). 
                                            If the orange line is in extreme zones (above <strong className="text-foreground">+40</strong> or below <strong className="text-foreground">-40</strong>), the current move is highly mature. 
                                            A downward hook from $+45$ is highly indicative of trend fatigue, even in a strong macro bull market.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 4 */}
                                <div className="relative">
                                    <span className="absolute -left-[33px] top-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-4 border-background">
                                        4
                                    </span>
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                                            Verify Stop-Loss and Exit Alignment
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Establish the invalidation parameters before entering a trade. 
                                            If buying, your strict stop-loss should trigger if the Short-Term line closes back below the Zero Line or the baseline. 
                                            Adhering to these indicators protects portfolio equity during whipsaw periods.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeGuideTab === 'math' && (
                        <div className="space-y-6">
                            <p className="text-xs text-muted-foreground max-w-4xl font-sans">
                                The BX Trender acts as a double-normalized momentum oscillator, translating raw price rates of change into stable, bounded ranges.
                                This allows for robust visual alignment and reliable comparison across different asset classes and stock tickers.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Formula 1 */}
                                <div className="bg-muted/10 border border-muted/50 rounded-lg p-4 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground text-xs tracking-wide uppercase border-b pb-2 mb-3 text-amber-500">
                                            1. Short-Term Spread
                                        </h4>
                                        <div className="bg-card border rounded p-3 font-mono text-center text-xs text-foreground font-semibold shadow-sm my-2">
                                            Spread = EMA(Close, 5) - EMA(Close, 20)
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                            Calculates the differential between the fast 5-period and medium 20-period Exponential Moving Averages. 
                                            This captures intermediate shifting price momentum before it affects primary trend structures.
                                        </p>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground border-t border-muted/50 pt-2 mt-4">
                                        Tracks high-velocity trend changes.
                                    </div>
                                </div>

                                {/* Formula 2 */}
                                <div className="bg-muted/10 border border-muted/50 rounded-lg p-4 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground text-xs tracking-wide uppercase border-b pb-2 mb-3 text-amber-400">
                                            2. Short-Term Normalization
                                        </h4>
                                        <div className="bg-card border rounded p-3 font-mono text-center text-xs text-foreground font-semibold shadow-sm my-2">
                                            ShortTerm = RSI(Spread, 14) - 50
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                            Feeds the raw EMA Spread into a 14-period Relative Strength Index (RSI). 
                                            Subtracting 50 centers the bounds precisely from <strong className="text-foreground">-50</strong> to <strong className="text-foreground">+50</strong>. 
                                            This isolates high-probability breakout momentum while neutralizing the price scale of the stock.
                                        </p>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground border-t border-muted/50 pt-2 mt-4">
                                        Bounded momentum removes stock price bias.
                                    </div>
                                </div>

                                {/* Formula 3 */}
                                <div className="bg-muted/10 border border-muted/50 rounded-lg p-4 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground text-xs tracking-wide uppercase border-b pb-2 mb-3 text-green-500">
                                            3. Long-Term Baseline
                                        </h4>
                                        <div className="bg-card border rounded p-3 font-mono text-center text-xs text-foreground font-semibold shadow-sm my-2">
                                            LongTerm = RSI(EMA(Close, 200), 14) - 50
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                            Calculates a 14-period RSI directly over the major 200-period Exponential Moving Average (EMA 200). 
                                            Subtracting 50 centers the output. 
                                            This creates a macro structural regime filter, which determines if the primary market trend is positive or negative.
                                        </p>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground border-t border-muted/50 pt-2 mt-4">
                                        Determines primary long-term market regime.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeGuideTab === 'risk' && (
                        <div className="space-y-6">
                            <p className="text-xs text-muted-foreground max-w-4xl font-sans">
                                Even the most precise quantitative oscillators generate false breakout signals in choppy markets. 
                                Apply these systematic risk management rules to preserve capital and ensure high-probability trades.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
                                <div className="space-y-3">
                                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                                        <ShieldAlert className="w-4 h-4 text-primary" />
                                        <span>Position Sizing Guidelines</span>
                                    </h4>
                                    <ul className="space-y-2.5 pl-4 list-disc text-muted-foreground">
                                        <li>
                                            <strong className="text-foreground">Confluent Trades (100% Size)</strong>: Allocate normal, full capital parameters when executing a BUY signal that is supported by a <span className="text-green-500 font-semibold">Green Long-Term Histogram</span>.
                                        </li>
                                        <li>
                                            <strong className="text-foreground">Counter-Trend Scalps (50% Size)</strong>: If taking a buy signal when the background histogram is <span className="text-red-500 font-semibold">Red</span>, reduce your trade capital allocation by at least 50%. Counter-trend trades are highly prone to sudden failure.
                                        </li>
                                        <li>
                                            <strong className="text-foreground">The Whipsaw Trap</strong>: If the Short-Term line (orange) is oscillating tightly between <strong className="text-foreground">-10</strong> and <strong className="text-foreground">+10</strong>, the stock is in a low-liquidity consolidation range. Avoid entry entirely and keep capital in cash until a high-velocity breakout is registered.
                                        </li>
                                    </ul>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                                        <XCircle className="w-4 h-4 text-red-500" />
                                        <span>Trade Invalidation & Stop-Loss Placement</span>
                                    </h4>
                                    <ul className="space-y-2.5 pl-4 list-disc text-muted-foreground">
                                        <li>
                                            <strong className="text-foreground">Zero Line Invalidation</strong>: If long on a BUY trigger, the ultimate structural invalidation occurs when the Short-Term line closes back below <strong className="text-red-500">0</strong>. Exit immediately; do not hope for a recovery.
                                        </li>
                                        <li>
                                            <strong className="text-foreground">EMA-Based Stops</strong>: Set hard stop-loss targets at the 20-period EMA price level on your chart. A physical daily close beneath the EMA 20 confirms the breakdown of short-term velocity.
                                        </li>
                                        <li>
                                            <strong className="text-foreground">Trailing Profit Protection</strong>: When the Short-Term line climbs above <strong className="text-foreground">+40</strong> and begins to curl downwards, scale out of 50% of the position. This secures profits at peak velocity, before trend exhaustion manifests.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Warning banner */}
                <div className="mt-2 p-3.5 bg-muted/40 border border-amber-500/20 rounded-lg border-l-4 border-l-amber-500 flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h5 className="font-semibold text-foreground text-xs">Risk Disclosure & Execution Rationale</h5>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            BX Trender analytics should never be used in a vacuum. Combining these signals with volume indicators (e.g. Volume Spikes, VWAP boundaries) and macroeconomic factors provides the highest rate of success. All quantitative strategies are subject to market conditions, and stop-loss enforcement remains the single most important factor in portfolio longevity.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
}
