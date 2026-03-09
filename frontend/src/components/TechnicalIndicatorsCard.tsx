import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TechnicalIndicators } from '@/lib/types';
import { Activity, TrendingUp, BarChart2, Waves, Gauge } from 'lucide-react';

interface Props {
    data?: TechnicalIndicators;
}

export function TechnicalIndicatorsCard({ data }: Props) {
    if (!data) {
        return (
            <Card className="w-full">
                <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
                    No technical indicator data available.
                </CardContent>
            </Card>
        );
    }

    const formatNum = (val?: number) => val != null ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A';
    const formatVol = (val?: number) => val != null ? val.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A';

    const indicators = [
        {
            title: "Moving Averages (SMA/EMA)",
            icon: <TrendingUp className="w-5 h-5 text-blue-500" />,
            desc: "Smooths out price data to identify the direction of the trend over a specific period.",
            metrics: [
                { label: "50-Day SMA", value: formatNum(data.sma_50) },
                { label: "200-Day SMA", value: formatNum(data.sma_200) },
                { label: "20-Day EMA", value: formatNum(data.ema_20) },
            ]
        },
        {
            title: "RSI (Relative Strength Index)",
            icon: <Gauge className="w-5 h-5 text-indigo-500" />,
            desc: "A momentum oscillator that measures the speed and change of price movements. Overbought (>70) or oversold (<30).",
            metrics: [
                {
                    label: "14-Day RSI",
                    value: formatNum(data.rsi_14),
                    color: data.rsi_14 && data.rsi_14 > 70 ? 'text-red-500' : data.rsi_14 && data.rsi_14 < 30 ? 'text-green-500' : 'text-foreground'
                }
            ]
        },
        {
            title: "MACD",
            icon: <Activity className="w-5 h-5 text-teal-500" />,
            desc: "A trend-following momentum indicator that shows the relationship between two moving averages.",
            metrics: [
                { label: "MACD Line", value: formatNum(data.macd_line) },
                { label: "Signal Line", value: formatNum(data.macd_signal) },
                {
                    label: "Histogram",
                    value: (data.macd_line != null && data.macd_signal != null) ? formatNum(data.macd_line - data.macd_signal) : 'N/A',
                    color: (data.macd_line != null && data.macd_signal != null && data.macd_line > data.macd_signal) ? 'text-green-500' : 'text-red-500'
                }
            ]
        },
        {
            title: "Bollinger Bands",
            icon: <Waves className="w-5 h-5 text-purple-500" />,
            desc: "Measures market volatility using a middle SMA and two outer bands representing standard deviations.",
            metrics: [
                { label: "Upper Band", value: formatNum(data.bollinger_upper) },
                { label: "Middle Band", value: formatNum(data.bollinger_middle) },
                { label: "Lower Band", value: formatNum(data.bollinger_lower) },
            ]
        },
        {
            title: "Volume",
            icon: <BarChart2 className="w-5 h-5 text-orange-500" />,
            desc: "The number of shares traded; high volume often validates the strength of a price trend.",
            metrics: [
                { label: "Latest Volume", value: formatVol(data.volume) },
                { label: "20-Day Avg Volume", value: formatVol(data.volume_avg_20) },
            ]
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {indicators.map((ind, idx) => (
                <Card key={idx} className="flex flex-col hover:border-primary/50 transition-colors bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-2 rounded-md bg-background border shadow-sm">
                                {ind.icon}
                            </div>
                            <CardTitle className="text-lg">{ind.title}</CardTitle>
                        </div>
                        <CardDescription className="text-xs mt-2 text-muted-foreground/80 leading-relaxed">{ind.desc}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-end mt-4">
                        <div className="space-y-3 pt-4 border-t border-border/50">
                            {ind.metrics.map((m, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
                                    <span className={`font-mono text-sm font-semibold ${m.color || 'text-foreground'}`}>{m.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
