import React, { useState } from 'react';
import { TickerAnalysis } from '@/lib/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';

interface ComparisonTableProps {
    analysisData: Record<string, TickerAnalysis>;
}

type SortKey = 'ticker' | 'ml_alpha' | 'ranking' | 'macd_rel_slope' | string;
type SortDirection = 'asc' | 'desc';

export function ComparisonTable({ analysisData }: ComparisonTableProps) {
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    const dataList = Object.values(analysisData);

    // Helper to color strings like "75%"
    const getColorClass = (perc: number) => {
        if (perc >= 75) return "text-green-500 font-medium";
        if (perc >= 40) return "text-yellow-500 font-medium";
        return "text-red-500 font-medium";
    };

    const STRATEGY_NAMES = [
        "CAN SLIM",
        "FCF Yield",
        "GARP",
        "Low-Vol/Quality",
        "Pure Growth/Value",
        "Fundamental/Technical",
        "Sentiment/Quant",
        "Earnings Momentum",
        "Dividend Value",
    ];

    // Map to flat structure for easier sorting
    const flatData = dataList.map(data => {
        const alphaProb = data.alpha_probability !== undefined && data.alpha_probability !== null
            ? data.alpha_probability * 100
            : 0;

        const stratMap = data.strategies.reduce((acc, s) => {
            acc[s.strategy_name] = s.match_percentage;
            return acc;
        }, {} as Record<string, number>);

        let stratSum = 0;
        STRATEGY_NAMES.forEach(name => {
            stratSum += stratMap[name] || 0;
        });
        const stratAvg = STRATEGY_NAMES.length > 0 ? stratSum / STRATEGY_NAMES.length : 0;

        const macdSignal = data.technical_indicators?.macd_signal ?? null;
        const macdHist = data.technical_indicators?.macd_line != null && macdSignal != null
            ? data.technical_indicators.macd_line - macdSignal
            : null;

        const macdRel = macdHist != null && macdSignal != null && macdSignal !== 0
            ? macdHist / macdSignal
            : null;

        let slopeMacdRel: number | null = null;
        if (data.price_history && data.price_history.length >= 2) {
            const last = data.price_history[data.price_history.length - 1];
            const prev = data.price_history[data.price_history.length - 2];
            
            const lastRel = (last.macd_hist != null && last.macd_signal != null && last.macd_signal !== 0) ? last.macd_hist / last.macd_signal : null;
            const prevRel = (prev.macd_hist != null && prev.macd_signal != null && prev.macd_signal !== 0) ? prev.macd_hist / prev.macd_signal : null;
            
            if (lastRel != null && prevRel != null) {
                slopeMacdRel = lastRel - prevRel;
            }
        }

        let isTopPick = false;
        if (alphaProb > 60 && stratAvg > 60 && macdRel != null && Math.abs(macdRel) < 0.2 && slopeMacdRel != null && slopeMacdRel < 0) {
            isTopPick = true;
        }

        let rankScore = 0;
        if (alphaProb > 60) rankScore++;
        if (stratAvg > 60) rankScore++;
        if (macdRel != null && Math.abs(macdRel) < 0.2) rankScore++;
        if (slopeMacdRel != null && slopeMacdRel < 0) rankScore++;

        const rsi = data.technical_indicators?.rsi_14 ?? null;

        return {
            symbol: data.symbol,
            ml_alpha: alphaProb,
            strat_avg: stratAvg,
            macd_hist: macdHist,
            macd_rel: macdRel,
            macd_rel_slope: slopeMacdRel,
            rsi: rsi,
            ranking: rankScore,
            isTopPick: isTopPick,
            strats: stratMap,
            original: data
        };
    });

    // Sort logic
    const sortedData = [...flatData].sort((a, b) => {
        if (!sortKey) return 0;

        let valA: number | string;
        let valB: number | string;

        if (sortKey === 'ticker') {
            valA = a.symbol;
            valB = b.symbol;
        } else if (sortKey === 'ml_alpha') {
            valA = a.ml_alpha;
            valB = b.ml_alpha;
        } else if (sortKey === 'strat_avg') {
            valA = a.strat_avg;
            valB = b.strat_avg;
        } else if (sortKey === 'macd_hist') {
            valA = a.macd_hist ?? -99999;
            valB = b.macd_hist ?? -99999;
        } else if (sortKey === 'macd_rel') {
            valA = a.macd_rel ?? -99999;
            valB = b.macd_rel ?? -99999;
        } else if (sortKey === 'macd_rel_slope') {
            valA = a.macd_rel_slope ?? -99999;
            valB = b.macd_rel_slope ?? -99999;
        } else if (sortKey === 'ranking') {
            valA = a.ranking;
            valB = b.ranking;
        } else if (sortKey === 'rsi') {
            valA = a.rsi ?? -99999;
            valB = b.rsi ?? -99999;
        } else {
            valA = a.strats[sortKey] || 0;
            valB = b.strats[sortKey] || 0;
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc'); // Default to descending for metrics
        }
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 inline-block opacity-50" />;
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 inline-block" /> : <ArrowDown className="w-3 h-3 ml-1 inline-block" />;
    };

    return (
        <div className="w-full h-full bg-card text-card-foreground border rounded-lg shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead
                            className="w-[100px] font-bold cursor-pointer hover:bg-muted bg-card sticky left-0 z-20 shadow-[1px_0_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('ticker')}
                        >
                            Ticker {renderSortIcon("ticker")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-primary cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('ml_alpha')}
                        >
                            ML Alpha {renderSortIcon("ml_alpha")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-blue-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('strat_avg')}
                        >
                            Strat Avg {renderSortIcon("strat_avg")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-teal-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('macd_hist')}
                        >
                            MACD Hist {renderSortIcon("macd_hist")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-emerald-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('macd_rel')}
                        >
                            MACD Rel {renderSortIcon("macd_rel")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-teal-400 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('macd_rel_slope')}
                        >
                            MACD Slope {renderSortIcon("macd_rel_slope")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-amber-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('ranking')}
                        >
                            Ranking {renderSortIcon("ranking")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-indigo-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center"
                            onClick={() => handleSort('rsi')}
                        >
                            RSI {renderSortIcon("rsi")}
                        </TableHead>
                        {STRATEGY_NAMES.map(name => (
                            <TableHead
                                key={name}
                                className="text-xs whitespace-normal min-w-[100px] text-center align-bottom cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort(name)}
                            >
                                {name} {renderSortIcon(name)}
                            </TableHead>
                        ))}
                        <TableHead className="w-[150px] text-right font-bold pr-4">6M Trend</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={STRATEGY_NAMES.length + 6} className="text-center py-10 text-muted-foreground">
                                No data loaded yet. Select stocks from the sidebar.
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedData.map((row) => {
                            const data = row.original;

                            return (
                                <TableRow key={row.symbol}>
                                    <TableCell className="font-bold sticky left-0 z-20 bg-card shadow-[1px_0_0_0_hsl(var(--border))]">
                                        {row.symbol}
                                    </TableCell>
                                    <TableCell className={`${getColorClass(row.ml_alpha)} text-center`}>
                                        {row.ml_alpha.toFixed(1)}%
                                    </TableCell>
                                    <TableCell className={`${getColorClass(row.strat_avg)} text-center`}>
                                        {row.strat_avg.toFixed(1)}%
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[90px]">
                                        {row.macd_hist != null ? (
                                            <span className={row.macd_hist > 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                                                {row.macd_hist > 0 ? '+' : ''}{row.macd_hist.toFixed(2)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[90px]">
                                        {row.macd_rel != null ? (
                                            <span className={row.macd_rel > 0 ? "text-emerald-500 font-bold" : "text-red-400 font-bold"}>
                                                {row.macd_rel > 0 ? '+' : ''}{row.macd_rel.toFixed(3)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[90px]">
                                        {row.macd_rel_slope != null ? (
                                            <span className={row.macd_rel_slope > 0 ? "text-teal-500 font-bold" : "text-rose-400 font-bold"}>
                                                {row.macd_rel_slope > 0 ? '+' : ''}{row.macd_rel_slope.toFixed(3)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[90px]">
                                        <div className={`px-2 py-1 mx-auto max-w-[80px] rounded text-xs font-bold ${row.isTopPick ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-muted-foreground'}`}>
                                            {row.isTopPick ? '⭐ Pick' : `${row.ranking}/4`}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[80px]">
                                        {row.rsi != null ? (
                                            <span className={row.rsi > 70 ? "text-red-500 font-bold" : row.rsi < 30 ? "text-green-500 font-bold" : "text-foreground"}>
                                                {row.rsi.toFixed(1)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>

                                    {STRATEGY_NAMES.map(name => {
                                        const match = row.strats[name] || 0;
                                        return (
                                            <TableCell key={name} className={`${getColorClass(match)} text-center`}>
                                                {match}%
                                            </TableCell>
                                        );
                                    })}

                                    <TableCell className="text-right">
                                        <div className="w-[120px] h-[40px] ml-auto">
                                            {data.price_history && data.price_history.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={data.price_history}>
                                                        <YAxis domain={['auto', 'auto']} hide />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="close"
                                                            stroke="#3b82f6"
                                                            strokeWidth={2}
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">N/A</span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
