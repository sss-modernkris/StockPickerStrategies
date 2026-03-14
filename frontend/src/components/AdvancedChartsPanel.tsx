import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PricePoint } from '@/lib/types';
import { Activity, TrendingUp, BarChart2 } from 'lucide-react';

interface AdvancedChartsPanelProps {
    data: PricePoint[];
    symbol: string;
}

export function AdvancedChartsPanel({ data, symbol }: AdvancedChartsPanelProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground border rounded-xl bg-card">
                No historical data available for advanced charting.
            </div>
        );
    }

    // Format tooltip numbers cleanly
    const formatValue = (val: number | undefined | null) => {
        if (val === undefined || val === null) return 'N/A';
        return val.toFixed(2);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background/95 border p-3 rounded-lg shadow-xl backdrop-blur-sm z-50">
                    <p className="font-semibold mb-2 text-foreground">{label}</p>
                    <div className="space-y-1">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="font-medium" style={{ color: entry.color }}>
                                        {entry.name}
                                    </span>
                                </div>
                                <span className="font-mono">{formatValue(entry.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Price & Moving Averages Chart */}
            <Card className="shadow-md border-border/40 animate-in fade-in zoom-in-95 duration-300">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        {symbol} Price Action & Moving Averages
                    </CardTitle>
                    <CardDescription>Daily Close with SMA (9, 12, 26, 50, 200)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full mt-4 border rounded-xl bg-card/50 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickMargin={10} minTickGap={30} axisLine={false} tickLine={false} />
                                <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `$${v.toFixed(0)}`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} orientation="right" />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" height={36} iconType="circle" />

                                <Line type="monotone" dataKey="close" name="Close Price" stroke="#ffffff" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                <Line type="monotone" dataKey="sma_9" name="SMA 9" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="sma_12" name="SMA 12" stroke="#0ea5e9" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                                <Line type="monotone" dataKey="sma_26" name="SMA 26" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="sma_50" name="SMA 50" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="sma_200" name="SMA 200" stroke="#ef4444" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* MACD Chart */}
                <Card className="shadow-md border-border/40 animate-in fade-in zoom-in-95 duration-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart2 className="w-5 h-5 text-indigo-500" />
                            MACD
                        </CardTitle>
                        <CardDescription>Moving Average Convergence Divergence</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full mt-4 border rounded-xl bg-card/50 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                {/* Using BarChart as the base to map the histogram, then overlaying lines via ComposedChart isn't strictly necessary if we use LineChart with a Bar child? Recharts 2 is picky. We will use ComposedChart implicitly or stick to separate Bar/Line layers. Actually, Recharts ComposedChart is best for mixed types. I'll import it. Oh wait, I didn't import ComposedChart. Let's stick to Area for Histogram or just accept LineChart can't technically render <Bar> natively without being a ComposedChart. Let's use LineChart for MACD Line/Signal, and a separate tiny BarChart below it? No, ComposedChart is best, I'll update imports dynamically if needed, or use Area to simulate histogram. Let's use Area for simplicity, or just plot MACD Hist as a Bar in a ComposedChart. Let's use ComposedChart by rewriting the import. */}
                                {/* Wait, I have LineChart and BarChart imported. I'll just use BarChart and trick it, or use standard Recharts ComposedChart. */}
                                {/* I'll use LineChart for the Lines, and a separate BarChart for Histogram, stacked visually using Recharts SyncId. That looks professional. */}
                                <div className="h-full flex flex-col space-y-2">
                                    <ResponsiveContainer width="100%" height="70%">
                                        <LineChart data={data} syncId="techSync" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                                            <XAxis dataKey="date" hide={true} />
                                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} orientation="right" />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                                            <Line type="monotone" dataKey="macd" name="MACD" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="macd_signal" name="Signal" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    <ResponsiveContainer width="100%" height="30%">
                                        <BarChart data={data} syncId="techSync" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickMargin={5} minTickGap={30} axisLine={false} tickLine={false} />
                                            <YAxis hide={true} domain={['auto', 'auto']} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="macd_hist" name="Histogram">
                                                {
                                                    data.map((entry, index) => {
                                                        const color = (entry.macd_hist || 0) >= 0 ? '#10b981' : '#ef4444';
                                                        return <rect key={`cell-${index}`} fill={color} opacity={0.8} />
                                                    })
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* RSI Chart */}
                <Card className="shadow-md border-border/40 animate-in fade-in zoom-in-95 duration-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Activity className="w-5 h-5 text-emerald-500" />
                            Relative Strength Index (14)
                        </CardTitle>
                        <CardDescription>Momentum Oscillator (Overbought &gt; 70, Oversold &lt; 30)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full mt-4 border rounded-xl bg-card/50 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data} syncId="techSync" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickMargin={10} minTickGap={30} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} orientation="right" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} opacity={0.6} />
                                    <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} opacity={0.6} />
                                    <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" strokeWidth={1} opacity={0.3} />
                                    <Line type="monotone" dataKey="rsi_14" name="RSI (14)" stroke="#14b8a6" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
