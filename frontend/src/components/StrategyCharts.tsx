import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';

interface StrategyChartsProps {
    priceHistory?: { date: string; close: number }[];
    symbol: string | null;
}

export function StrategyCharts({ priceHistory, symbol }: StrategyChartsProps) {
    if (!symbol) {
        return (
            <Card className="h-full flex items-center justify-center text-muted-foreground p-6">
                Select a ticker to view technical trends.
            </Card>
        );
    }

    if (!priceHistory || priceHistory.length === 0) {
        return (
            <Card className="h-full flex items-center justify-center text-muted-foreground p-6">
                No price history available for {symbol}.
            </Card>
        );
    }

    // Format dates for display
    const data = priceHistory.map(p => ({
        ...p,
        shortDate: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }));

    const minPrice = Math.min(...priceHistory.map(d => d.close));
    const maxPrice = Math.max(...priceHistory.map(d => d.close));

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-0 border-b">
                <CardTitle className="text-lg flex items-center gap-2 pb-4">
                    <LineChartIcon className="w-5 h-5 text-primary" />
                    {symbol} 6-Month Price Trend
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pt-6 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                        <XAxis
                            dataKey="shortDate"
                            tick={{ fontSize: 12, fill: '#e2e8f0' }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={[minPrice * 0.95, maxPrice * 1.05]}
                            tick={{ fontSize: 12, fill: '#e2e8f0' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value.toFixed(0)}`}
                            width={50}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: '8px',
                                color: 'hsl(var(--foreground))'
                            }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                            labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="close"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorClose)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
