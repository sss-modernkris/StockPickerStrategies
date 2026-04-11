import React, { useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { TickerAnalysis } from '@/lib/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { ArrowUpDown, ArrowDown, ArrowUp, Download, CheckCircle2 } from 'lucide-react';

interface ComparisonTableProps {
    analysisData: Record<string, TickerAnalysis>;
}

type SortKey = 'ticker' | 'ml_alpha' | string;
type SortDirection = 'asc' | 'desc';

export function ComparisonTable({ analysisData }: ComparisonTableProps) {
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>('desc');
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    const dataList = Object.values(analysisData);

    // Helper to color strings like "75%"
    const getColorClass = (perc: number) => {
        if (perc >= 75) return "text-green-500 font-medium";
        if (perc >= 40) return "text-yellow-500 font-medium";
        return "text-red-500 font-medium";
    };

    const STRATEGY_NAMES = [
        "WillyAlgo Indicator",
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

        const macdSlope = data.technical_indicators?.macd_slope ?? null;

        const rsi = data.technical_indicators?.rsi_14 ?? null;
        const rsiSlope = data.technical_indicators?.rsi_slope ?? null;

        const priceHistory = data.price_history;
        const currentPrice = priceHistory && priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].close : null;
        const prevPrice = priceHistory && priceHistory.length > 1 ? priceHistory[priceHistory.length - 2].close : null;
        
        let closeSlopeRaw = null;
        let closeSlopeStr: '+' | '-' | '0' | 'N/A' = 'N/A';
        if (currentPrice !== null && prevPrice !== null) {
            closeSlopeRaw = currentPrice - prevPrice;
            if (closeSlopeRaw > 0) closeSlopeStr = '+';
            else if (closeSlopeRaw < 0) closeSlopeStr = '-';
            else closeSlopeStr = '0';
        }

        const willyVwap = data.technical_indicators?.willy_vwap ?? null;

        const willyScore = stratMap['WillyAlgo Indicator'] || 0;
        let ranking = 0;
        if (willyScore > 50) ranking++;
        if (rsi !== null && rsi > 30) ranking++;
        if (rsiSlope !== null && rsiSlope > 0) ranking++;
        if (macdHist !== null && macdHist < 0.1) ranking++;
        if (macdHist !== null && macdHist > 0) ranking++;
        if (macdSlope !== null && macdSlope > 0) ranking++;
        if (stratAvg > 50) ranking++;
        if (closeSlopeRaw !== null && closeSlopeRaw > 0) ranking++;

        let rec = "N/A";
        if (currentPrice !== null && willyVwap !== null && closeSlopeRaw !== null) {
            rec = (currentPrice > willyVwap && closeSlopeRaw > 0) ? 'Hold' : 'Sell';
        }

        return {
            symbol: data.symbol,
            ml_alpha: alphaProb,
            strat_avg: stratAvg,
            ranking: ranking,
            rec: rec,
            close_price: currentPrice,
            close_slope: closeSlopeStr,
            close_slope_raw: closeSlopeRaw,
            macd_hist: macdHist,
            macd_slope: macdSlope,
            macd_rel: macdRel,
            rsi: rsi,
            rsi_slope: rsiSlope,
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
        } else if (sortKey === 'ranking') {
            valA = a.ranking;
            valB = b.ranking;
        } else if (sortKey === 'rec') {
            valA = a.rec;
            valB = b.rec;
        } else if (sortKey === 'close_price') {
            valA = a.close_price ?? -99999;
            valB = b.close_price ?? -99999;
        } else if (sortKey === 'close_slope') {
            valA = a.close_slope_raw ?? -99999;
            valB = b.close_slope_raw ?? -99999;
        } else if (sortKey === 'macd_hist') {
            valA = a.macd_hist ?? -99999;
            valB = b.macd_hist ?? -99999;
        } else if (sortKey === 'macd_slope') {
            valA = a.macd_slope ?? -99999;
            valB = b.macd_slope ?? -99999;
        } else if (sortKey === 'macd_rel') {
            valA = a.macd_rel ?? -99999;
            valB = b.macd_rel ?? -99999;
        } else if (sortKey === 'rsi') {
            valA = a.rsi ?? -99999;
            valB = b.rsi ?? -99999;
        } else if (sortKey === 'rsi_slope') {
            valA = a.rsi_slope ?? -99999;
            valB = b.rsi_slope ?? -99999;
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

    const handleExportCsv = async () => {
        setIsExporting(true);
        const headers = [
            "Ticker", "ML Alpha", "Strat Avg", "Ranking", "Rec", "Close Price", "Close Slope",
            "MACD Hist", "MACD Slope", "MACD Rel", "RSI", "RSI Slope", ...STRATEGY_NAMES
        ];

        const rows = sortedData.map(row => {
            const r = [
                row.symbol,
                row.ml_alpha.toFixed(1),
                row.strat_avg.toFixed(1),
                row.ranking,
                row.rec,
                row.close_price !== null ? row.close_price.toFixed(2) : "N/A",
                row.close_slope,
                row.macd_hist !== null ? row.macd_hist.toFixed(2) : "N/A",
                row.macd_slope !== null ? row.macd_slope.toFixed(2) : "N/A",
                row.macd_rel !== null ? row.macd_rel.toFixed(2) : "N/A",
                row.rsi !== null ? row.rsi.toFixed(2) : "N/A",
                row.rsi_slope !== null ? row.rsi_slope.toFixed(2) : "N/A",
                ...STRATEGY_NAMES.map(name => row.strats[name]?.toFixed(1) || "0.0")
            ];
            return r.map(v => `"${v}"`).join(",");
        });

        const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n");
        const date = new Date();
        const dateStamp = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        const fileName = `CompTable_${dateStamp}.csv`;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/save_csv`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: fileName, content: csvContent })
            });

            if (response.ok) {
                setExportSuccess(true);
                setTimeout(() => setExportSuccess(false), 3000);
            }
        } catch (error) {
            console.error("Failed to save CSV:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 w-full h-full">
            <div className="flex justify-end pr-2">
                <Button 
                    onClick={handleExportCsv} 
                    variant={exportSuccess ? "default" : "outline"} 
                    size="sm" 
                    className={`gap-2 h-8 text-xs font-medium transition-all ${exportSuccess ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : ''}`}
                    disabled={isExporting}
                >
                    {exportSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} 
                    {isExporting ? "Saving..." : exportSuccess ? "Saved to Project Folder!" : "Export CSV"}
                </Button>
            </div>
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
                            className="font-bold text-amber-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center"
                            onClick={() => handleSort('ranking')}
                        >
                            Ranking {renderSortIcon("ranking")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-fuchsia-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center"
                            onClick={() => handleSort('rec')}
                        >
                            Rec {renderSortIcon("rec")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-cyan-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('close_price')}
                        >
                            Close Price {renderSortIcon("close_price")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-cyan-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('close_slope')}
                        >
                            Close Slope {renderSortIcon("close_slope")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-teal-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('macd_hist')}
                        >
                            MACD Hist {renderSortIcon("macd_hist")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-teal-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('macd_slope')}
                        >
                            MACD Slope {renderSortIcon("macd_slope")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-emerald-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center"
                            onClick={() => handleSort('macd_rel')}
                        >
                            MACD Rel {renderSortIcon("macd_rel")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-indigo-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center"
                            onClick={() => handleSort('rsi')}
                        >
                            RSI {renderSortIcon("rsi")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-indigo-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center"
                            onClick={() => handleSort('rsi_slope')}
                        >
                            RSI Slope {renderSortIcon("rsi_slope")}
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
                                    <TableCell className="text-center font-bold text-amber-500">
                                        {row.ranking}/8
                                    </TableCell>
                                    <TableCell className={`text-center font-bold ${row.rec === 'Hold' ? 'text-green-500' : row.rec === 'Sell' ? 'text-red-500' : 'text-muted-foreground'}`}>
                                        {row.rec}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[90px]">
                                        {row.close_price != null ? (
                                            <span className="text-foreground font-semibold">
                                                ${row.close_price.toFixed(2)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xl max-w-[90px]">
                                        {row.close_slope !== 'N/A' ? (
                                            <span className={row.close_slope === '+' ? "text-green-500 font-bold" : row.close_slope === '-' ? "text-red-500 font-bold" : "text-foreground font-bold"}>
                                                {row.close_slope}
                                            </span>
                                        ) : <span className="text-muted-foreground text-sm">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[90px]">
                                        {row.macd_hist != null ? (
                                            <span className={row.macd_hist > 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                                                {row.macd_hist > 0 ? '+' : ''}{row.macd_hist.toFixed(2)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[90px]">
                                        {row.macd_slope != null ? (
                                            <span className={row.macd_slope > 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                                                {row.macd_slope > 0 ? '+' : ''}{row.macd_slope.toFixed(3)}
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
                                    <TableCell className="text-center font-mono text-sm max-w-[80px]">
                                        {row.rsi != null ? (
                                            <span className={row.rsi > 70 ? "text-red-500 font-bold" : row.rsi < 30 ? "text-green-500 font-bold" : "text-foreground"}>
                                                {row.rsi.toFixed(1)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-sm max-w-[80px]">
                                        {row.rsi_slope != null ? (
                                            <span className={row.rsi_slope > 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                                                {row.rsi_slope > 0 ? '+' : ''}{row.rsi_slope.toFixed(2)}
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
        </div>
    );
}
