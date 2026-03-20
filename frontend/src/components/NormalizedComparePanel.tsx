import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, AlertCircle, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TickerHistory, TickerAnalysis } from '@/lib/types';

interface NormalizedComparePanelProps {
    availableTickers: string[];
    selectedTickers: string[];
    onSelectTickers: (tickers: string[]) => void;
    period: string;
    onPeriodChange: (period: string) => void;
    analysisData: Record<string, TickerAnalysis>;
}

const PERIODS = [
    { label: '1W', value: '1wk' },
    { label: '2W', value: '2wk' },
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
    { label: '5Y', value: '5y' }
];

// Curated colors for standard clear charting
const CHART_COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#14b8a6', // teal-500
    '#6366f1', // indigo-500
    '#d946ef', // fuchsia-500
    '#eab308'  // yellow-500
];

export function NormalizedComparePanel({ availableTickers, selectedTickers, onSelectTickers, period, onPeriodChange, analysisData }: NormalizedComparePanelProps) {
    const [historyData, setHistoryData] = useState<TickerHistory[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Initialize selected tickers when available tickers change (only if we haven't selected any yet)
    useEffect(() => {
        if (selectedTickers.length === 0 && availableTickers.length > 0) {
            // Select up to 5 tickers by default to avoid clutter
            onSelectTickers(availableTickers.slice(0, 5));
        }
    }, [availableTickers, selectedTickers.length]);

    // Fetch data when period or selected tickers change
    useEffect(() => {
        if (selectedTickers.length === 0) {
            setHistoryData([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const tickersParam = selectedTickers.join(',');
                const res = await fetch(`http://localhost:8001/api/history?tickers=${tickersParam}&period=${period}`);

                if (!res.ok) {
                    throw new Error(`Failed to fetch history (Status ${res.status})`);
                }

                const data = await res.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                setHistoryData(data.data);
            } catch (err: unknown) {
                console.error("Historical fetch error:", err);
                const message = err instanceof Error ? err.message : 'An error occurred while fetching historical data.';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        // Debounce to prevent multiple rapid requests if user is clicking toggles quickly
        const timeoutId = setTimeout(() => {
            fetchData();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [selectedTickers, period]);

    const toggleTicker = (ticker: string) => {
        onSelectTickers(
            selectedTickers.includes(ticker)
                ? selectedTickers.filter(t => t !== ticker)
                : [...selectedTickers, ticker]
        );
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = (columnKey: string) => {
        if (!sortConfig || sortConfig.key !== columnKey) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100" />;
        }
        return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
    };

    const computedTableData = useMemo(() => {
        const rowData = selectedTickers.map(ticker => {
            const tData = analysisData[ticker];

            // Default raw numerical values for sorting (null if missing)
            let mlAlpha: number | null = null;
            let stratAvg: number | null = null;
            let macdHist: number | null = null;
            let macdRel: number | null = null;
            let rsi: number | null = null;

            // Formatted string representations for UI
            let mlAlphaStr = 'N/A';
            let stratAvgStr = 'N/A';
            let macdHistStr = 'N/A';
            let macdRelStr = 'N/A';
            let rsiStr = 'N/A';

            if (tData) {
                if (tData.alpha_probability !== undefined && tData.alpha_probability !== null) {
                    mlAlpha = tData.alpha_probability;
                    mlAlphaStr = `${(mlAlpha * 100).toFixed(1)}%`;
                }

                if (tData.strategies && tData.strategies.length > 0) {
                    const sum = tData.strategies.reduce((acc, strat) => acc + strat.match_percentage, 0);
                    stratAvg = sum / tData.strategies.length;
                    stratAvgStr = `${stratAvg.toFixed(1)}%`;
                }

                if (tData.price_history && tData.price_history.length > 0) {
                    const latestPoint = tData.price_history[tData.price_history.length - 1];
                    if (latestPoint.macd_hist !== undefined && latestPoint.macd_hist !== null) {
                        macdHist = latestPoint.macd_hist;
                        macdHistStr = macdHist.toFixed(2);
                    }
                    if (latestPoint.macd_signal !== undefined && latestPoint.macd_signal !== null && latestPoint.macd_signal !== 0 && macdHist !== null) {
                        macdRel = macdHist / latestPoint.macd_signal;
                        macdRelStr = macdRel.toFixed(3);
                    }
                    if (latestPoint.rsi_14 !== undefined && latestPoint.rsi_14 !== null) {
                        rsi = latestPoint.rsi_14;
                        rsiStr = rsi.toFixed(2);
                    }
                }
            }

            return {
                ticker,
                mlAlpha,
                mlAlphaStr,
                stratAvg,
                stratAvgStr,
                macdHist,
                macdHistStr,
                macdRel,
                macdRelStr,
                rsi,
                rsiStr
            };
        });

        if (sortConfig !== null) {
            rowData.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof typeof a];
                const bValue = b[sortConfig.key as keyof typeof b];

                // Handle nulls (push them to bottom relatively)
                if (aValue === null && bValue === null) return 0;
                if (aValue === null) return sortConfig.direction === 'asc' ? 1 : -1;
                if (bValue === null) return sortConfig.direction === 'asc' ? -1 : 1;

                // Compare values
                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return rowData;
    }, [selectedTickers, analysisData, sortConfig]);

    // Transform data for Recharts into a normalized format
    const chartData = useMemo(() => {
        if (!historyData || historyData.length === 0) return [];

        // 1. Collect all unique dates across all tickers to align them
        const dateSet = new Set<string>();
        historyData.forEach(tickerData => {
            tickerData.history.forEach((point) => dateSet.add(point.date));
        });

        const sortedDates = Array.from(dateSet).sort();

        // 2. Find the initial price for each ticker to use as the base (100)
        // We find the earliest valid price.
        const initialPrices: Record<string, number> = {};
        historyData.forEach(tickerData => {
            if (tickerData.history.length > 0) {
                // Sort by date just in case
                const sortedHistory = [...tickerData.history].sort((a, b) => a.date.localeCompare(b.date));
                initialPrices[tickerData.symbol] = sortedHistory[0].close;
            }
        });

        // 3. Build the chart array. Each object represents one date and holds the normalized price of each ticker.
        const formattedData = sortedDates.map(date => {
            const dataPoint: Record<string, string | number> = { date };

            historyData.forEach(tickerData => {
                const dayMatch = tickerData.history.find(p => p.date === date);
                if (dayMatch && initialPrices[tickerData.symbol]) {
                    // Normalize: (current / initial) * 100
                    const normalizedValue = (dayMatch.close / initialPrices[tickerData.symbol]) * 100;
                    // Round to 2 decimals for cleaner tooltips
                    dataPoint[tickerData.symbol] = Math.round(normalizedValue * 100) / 100;
                }
            });

            return dataPoint;
        });

        return formattedData;
    }, [historyData]);

    const formatYAxis = (value: number) => {
        return value.toFixed(0);
    };

    const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: { value: number; color: string; name: string }[], label?: string }) => {
        if (active && payload && payload.length) {
            // Sort tooltip items by value desc
            const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

            return (
                <div className="bg-background/95 border p-3 rounded-lg shadow-xl backdrop-blur-sm z-50">
                    <p className="font-semibold mb-2 text-foreground">{label}</p>
                    <div className="space-y-1">
                        {sortedPayload.map((entry: { value: number; color: string; name: string }, index: number) => {
                            const isPositive = entry.value >= 100;
                            const diff = Math.abs(entry.value - 100).toFixed(2);
                            return (
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
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono">{entry.value.toFixed(2)}</span>
                                        <span className={`text-xs ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {isPositive ? '+' : '-'}{diff}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

    // Stable color hash for tickers
    const getTickerColor = (ticker: string) => {
        let hash = 0;
        for (let i = 0; i < ticker.length; i++) {
            hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
        }
        return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
    };

    return (
        <Card className="col-span-1 shadow-md border-border/40 animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <TrendingUp className="w-6 h-6 text-primary" />
                            Normalized Performance Matrix
                        </CardTitle>
                        <CardDescription className="mt-1 text-base">
                            Compare relative growth. All stocks start at a baseline of 100.
                        </CardDescription>
                    </div>

                    <div className="flex bg-muted/50 p-1.5 rounded-xl border">
                        {PERIODS.map(p => (
                            <Button
                                key={p.value}
                                variant={period === p.value ? "default" : "ghost"}
                                size="sm"
                                onClick={() => onPeriodChange(p.value)}
                                className={`rounded-lg px-4 transition-all duration-200 ${period === p.value ? 'shadow-md font-bold scale-105 ring-2 ring-primary/20' : 'font-medium text-muted-foreground hover:text-foreground'}`}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-6 flex flex-wrap gap-2">
                    {availableTickers.map(ticker => {
                        const isSelected = selectedTickers.includes(ticker);
                        const color = isSelected ? getTickerColor(ticker) : 'transparent';

                        return (
                            <Button
                                key={ticker}
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleTicker(ticker)}
                                className={`rounded-full transition-all ${isSelected ? 'opacity-100 hover:opacity-90' : 'opacity-60 hover:opacity-100'}`}
                                style={isSelected ? { backgroundColor: color, color: '#fff', borderColor: color } : {}}
                            >
                                {ticker}
                            </Button>
                        );
                    })}
                </div>

                <div className="h-[500px] w-full mt-4 border rounded-xl bg-card/50 p-4 relative flex flex-col">
                    {loading && (
                        <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
                            <div className="flex flex-col items-center gap-3 text-primary">
                                <Loader2 className="w-10 h-10 animate-spin" />
                                <p className="font-medium animate-pulse">Syncing historical market data...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                            <div className="flex flex-col items-center gap-3 text-destructive max-w-md text-center p-6 bg-destructive/10 border border-destructive/20 rounded-xl">
                                <AlertCircle className="w-10 h-10" />
                                <p className="font-semibold">{error}</p>
                                <Button variant="outline" size="sm" onClick={() => onPeriodChange(period)} className="mt-2">
                                    Retry
                                </Button>
                            </div>
                        </div>
                    )}

                    {!loading && chartData.length === 0 && !error && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center text-muted-foreground">
                            <p>Select at least one ticker to view comparison.</p>
                        </div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                tickMargin={10}
                                minTickGap={30}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => {
                                    if (!val) return '';
                                    const date = new Date(val);
                                    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
                                }}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tickFormatter={formatYAxis}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                tickMargin={10}
                                axisLine={false}
                                tickLine={false}
                                orientation="right"
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="top"
                                height={36}
                                iconType="circle"
                                wrapperStyle={{ paddingBottom: '20px' }}
                                // @ts-expect-error Recharts types incorrectly omit payload
                                payload={
                                    selectedTickers.map((ticker) => ({
                                        id: ticker,
                                        type: 'circle' as const,
                                        value: ticker,
                                        color: getTickerColor(ticker)
                                    }))
                                }
                            />
                            {/* Horizontal line at 100 reference point */}
                            {chartData.length > 0 && (
                                <line
                                    x1="0"
                                    y1={0} // Handled dynamically by recharts
                                    x2="100%"
                                    y2={0}
                                    stroke="hsl(var(--muted-foreground))"
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                    opacity={0.5}
                                />
                            )}

                            {selectedTickers.map((ticker) => (
                                <Line
                                    key={ticker}
                                    type="monotone"
                                    dataKey={ticker}
                                    stroke={getTickerColor(ticker)}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                    isAnimationActive={true}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Compare Data Table */}
                {selectedTickers.length > 0 && (
                    <div className="mt-8 border rounded-xl bg-card overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-semibold w-[120px]">
                                        <Button variant="ghost" onClick={() => handleSort('ticker')} className="px-0 hover:bg-transparent -ml-2 h-8 font-semibold">
                                            Ticker
                                            {SortIcon('ticker')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-right">
                                        <Button variant="ghost" onClick={() => handleSort('mlAlpha')} className="px-0 hover:bg-transparent justify-end w-full h-8 font-semibold">
                                            ML Alpha Proba
                                            {SortIcon('mlAlpha')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-right">
                                        <Button variant="ghost" onClick={() => handleSort('stratAvg')} className="px-0 hover:bg-transparent justify-end w-full h-8 font-semibold">
                                            Strategy Avg
                                            {SortIcon('stratAvg')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-right">
                                        <Button variant="ghost" onClick={() => handleSort('macdHist')} className="px-0 hover:bg-transparent justify-end w-full h-8 font-semibold">
                                            MACD Hist
                                            {SortIcon('macdHist')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-right">
                                        <Button variant="ghost" onClick={() => handleSort('macdRel')} className="px-0 hover:bg-transparent justify-end w-full h-8 font-semibold">
                                            MACD Rel
                                            {SortIcon('macdRel')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-right">
                                        <Button variant="ghost" onClick={() => handleSort('rsi')} className="px-0 hover:bg-transparent justify-end w-full h-8 font-semibold">
                                            RSI (14)
                                            {SortIcon('rsi')}
                                        </Button>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {computedTableData.map((row) => (
                                    <TableRow key={row.ticker}>
                                        <TableCell className="font-bold flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: getTickerColor(row.ticker) }}
                                            />
                                            {row.ticker}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{row.mlAlphaStr}</TableCell>
                                        <TableCell className="text-right font-mono">{row.stratAvgStr}</TableCell>
                                        <TableCell className={`text-right font-mono ${row.macdHist !== null && row.macdHist > 0 ? 'text-emerald-500' : row.macdHist !== null && row.macdHist < 0 ? 'text-red-500' : ''}`}>
                                            {row.macdHistStr}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${row.macdRel !== null && row.macdRel > 0 ? 'text-emerald-500 font-bold' : row.macdRel !== null && row.macdRel < 0 ? 'text-red-400 font-bold' : ''}`}>
                                            {row.macdRelStr}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${row.rsi !== null && row.rsi > 70 ? 'text-red-500' : row.rsi !== null && row.rsi < 30 ? 'text-emerald-500' : ''}`}>
                                            {row.rsiStr}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
