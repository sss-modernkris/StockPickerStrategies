import React, { useState } from 'react';
import { PricePoint } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ComposedChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Info, Calendar, Zap } from 'lucide-react';

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
        </div>
    );
}
