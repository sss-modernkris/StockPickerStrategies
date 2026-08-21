import React, { useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { TickerAnalysis, PricePoint } from '@/lib/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LineChart, Line, AreaChart, Area, XAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, YAxis, ComposedChart, ReferenceArea } from 'recharts';
import { ArrowUpDown, ArrowDown, ArrowUp, Download, CheckCircle2, TrendingUp } from 'lucide-react';

interface ComparisonTableProps {
    analysisData: Record<string, TickerAnalysis>;
}

export interface BacktestResult {
    finalValue: number;
    totalReturn: number;
    buyAndHoldReturn: number;
    buyAndHoldValue: number;
    transactions: {
        date: string;
        action: 'BUY' | 'SELL';
        price: number;
        shares: number;
        cash: number;
        value: number;
    }[];
    chartData: {
        date: string;
        strategyValue: number;
        bhValue: number;
        closePrice: number;
        willyVwap: number;
    }[];
    startDateStr: string;
    endDateStr: string;
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    // Use the Date object with the T00:00:00 suffix to ensure local timezone parsing without shifts
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function runWillyBacktest(
    priceHistory?: PricePoint[],
    initialCapital: number = 10000,
    backtestPeriod: number | string = 4,
    customStartDate?: string
): BacktestResult {
    const defaultResult: BacktestResult = {
        finalValue: initialCapital,
        totalReturn: 0,
        buyAndHoldReturn: 0,
        buyAndHoldValue: initialCapital,
        transactions: [],
        chartData: [],
        startDateStr: '',
        endDateStr: ''
    };

    if (!priceHistory || priceHistory.length === 0) {
        return defaultResult;
    }

    // Determine the latest available date in the price history (current date of the data)
    const dates = priceHistory.map(p => p.date).filter(Boolean);
    if (dates.length === 0) return defaultResult;

    const latestDateStr = dates.reduce((max, d) => d > max ? d : max, '');
    const endDate = new Date(latestDateStr + 'T00:00:00');
    
    let startDateStr = '';
    if (customStartDate) {
        startDateStr = customStartDate;
    } else {
        const startDate = new Date(endDate);
        if (typeof backtestPeriod === 'number') {
            startDate.setMonth(startDate.getMonth() - backtestPeriod);
            startDateStr = startDate.toISOString().split('T')[0];
        } else if (typeof backtestPeriod === 'string') {
            const match = backtestPeriod.match(/^(\d+)([dwm])$/);
            if (match) {
                const value = parseInt(match[1], 10);
                const unit = match[2];
                if (unit === 'd') {
                    if (priceHistory && priceHistory.length > value) {
                        startDateStr = priceHistory[priceHistory.length - 1 - value].date;
                    } else {
                        startDate.setDate(startDate.getDate() - value);
                        startDateStr = startDate.toISOString().split('T')[0];
                    }
                } else if (unit === 'w') {
                    startDate.setDate(startDate.getDate() - value * 7);
                    startDateStr = startDate.toISOString().split('T')[0];
                } else if (unit === 'm') {
                    startDate.setMonth(startDate.getMonth() - value);
                    startDateStr = startDate.toISOString().split('T')[0];
                }
            } else {
                const parsed = parseInt(backtestPeriod, 10);
                if (!isNaN(parsed)) {
                    startDate.setMonth(startDate.getMonth() - parsed);
                } else {
                    startDate.setMonth(startDate.getMonth() - 4);
                }
                startDateStr = startDate.toISOString().split('T')[0];
            }
        } else {
            startDate.setMonth(startDate.getMonth() - 4);
            startDateStr = startDate.toISOString().split('T')[0];
        }
    }
    const endDateStr = latestDateStr;

    // Filter price history for the duration
    const filtered = priceHistory.filter(
        p => p.date >= startDateStr && p.date <= endDateStr
    );

    if (filtered.length === 0) {
        return {
            ...defaultResult,
            startDateStr,
            endDateStr
        };
    }

    const firstDay = filtered[0];
    const startClose = firstDay.close;
    if (!startClose || startClose <= 0) {
        return {
            ...defaultResult,
            startDateStr,
            endDateStr
        };
    }

    let cash = 0;
    let shares = initialCapital / startClose;
    let isHolding = true;

    const transactions: BacktestResult['transactions'] = [];

    // Initial BUY transaction on the Start Date (first available trading day)
    transactions.push({
        date: firstDay.date,
        action: 'BUY',
        price: startClose,
        shares: shares,
        cash: 0,
        value: initialCapital
    });

    const chartData: BacktestResult['chartData'] = [];

    chartData.push({
        date: firstDay.date,
        strategyValue: initialCapital,
        bhValue: initialCapital,
        closePrice: startClose,
        willyVwap: firstDay.willy_vwap ?? startClose
    });

    for (let i = 1; i < filtered.length; i++) {
        const day = filtered[i];
        const prevDay = filtered[i - 1];
        const close = day.close;
        const willyVwap = day.willy_vwap;
        const prevClose = prevDay.close;
        const prevWillyVwap = prevDay.willy_vwap;

        if (close === null || close === undefined || close <= 0) {
            continue;
        }

        let action: 'BUY' | 'SELL' | null = null;

        if (isHolding) {
            // Sell Condition: Close falls below Willy VWAP
            if (willyVwap !== null && willyVwap !== undefined && close < willyVwap) {
                action = 'SELL';
                cash = shares * close;
                shares = 0;
                isHolding = false;
            }
        } else {
            // Buy Condition: Close crosses above Willy VWAP
            const prevWasBelow = prevWillyVwap === null || prevWillyVwap === undefined || prevClose <= prevWillyVwap;
            const currIsAbove = willyVwap !== null && willyVwap !== undefined && close > willyVwap;

            if (currIsAbove && prevWasBelow) {
                action = 'BUY';
                shares = cash / close;
                cash = 0;
                isHolding = true;
            }
        }

        const currentValue = isHolding ? (shares * close) : cash;
        const bhValue = (initialCapital / startClose) * close;

        if (action) {
            transactions.push({
                date: day.date,
                action: action,
                price: close,
                shares: action === 'BUY' ? shares : 0,
                cash: cash,
                value: currentValue
            });
        }

        chartData.push({
            date: day.date,
            strategyValue: currentValue,
            bhValue: bhValue,
            closePrice: close,
            willyVwap: willyVwap ?? close
        });
    }

    const lastDay = filtered[filtered.length - 1];
    const lastClose = lastDay.close;
    const finalValue = isHolding ? (shares * lastClose) : cash;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    const buyAndHoldValue = (initialCapital / startClose) * lastClose;
    const buyAndHoldReturn = ((buyAndHoldValue - initialCapital) / initialCapital) * 100;

    return {
        finalValue,
        totalReturn,
        buyAndHoldReturn,
        buyAndHoldValue,
        transactions,
        chartData,
        startDateStr,
        endDateStr
    };
}

type SortKey = 'ticker' | 'ml_alpha' | 'strat_avg' | 'ranking' | 'rec' | 'close_price' | 'close_slope' | 'willy_vwap_ratio' | 'macd_hist' | 'macd_slope' | 'macd_rel' | 'rsi' | 'rsi_slope' | 'strategy_value' | 'strategy_return' | string;
type SortDirection = 'asc' | 'desc';

export function ComparisonTable({ analysisData }: ComparisonTableProps) {
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>('desc');
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [selectedRowTicker, setSelectedRowTicker] = useState<string | null>(null);
    const [backtestPeriod, setBacktestPeriod] = useState<string | number>('4m');
    const [initialCapital, setInitialCapital] = useState<number>(10000);
    const [capitalInput, setCapitalInput] = useState<string>("10,000");
    const [rangeMode, setRangeMode] = useState<'period' | 'date'>('period');
    const [customStartDate, setCustomStartDate] = useState<string>('');

    const topScrollRef = React.useRef<HTMLDivElement>(null);
    const tableScrollRef = React.useRef<HTMLDivElement>(null);

    const handleTopScroll = () => {
        if (topScrollRef.current && tableScrollRef.current) {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
    };

    const handleTableScroll = () => {
        if (topScrollRef.current && tableScrollRef.current) {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }
    };

    const dataList = Object.values(analysisData);

    // Scan all tickers for overall min/max date
    let overallMinDate = '';
    let overallMaxDate = '';
    dataList.forEach(data => {
        const hist = data.price_history;
        if (hist && hist.length > 0) {
            const dMin = hist[0].date;
            const dMax = hist[hist.length - 1].date;
            if (!overallMinDate || dMin < overallMinDate) overallMinDate = dMin;
            if (!overallMaxDate || dMax > overallMaxDate) overallMaxDate = dMax;
        }
    });

    // Initialize customStartDate with a default if it hasn't been set yet
    React.useEffect(() => {
        if (!customStartDate && overallMaxDate) {
            const maxDateObj = new Date(overallMaxDate + 'T00:00:00');
            const defaultStart = new Date(maxDateObj);
            defaultStart.setMonth(defaultStart.getMonth() - 4);
            setCustomStartDate(defaultStart.toISOString().split('T')[0]);
        }
    }, [overallMaxDate, customStartDate]);

    // Toggles for Chart Series Visibility
    const [showStrategyValue, setShowStrategyValue] = useState<boolean>(true);
    const [showBhValue, setShowBhValue] = useState<boolean>(true);
    const [showClosePrice, setShowClosePrice] = useState<boolean>(true);
    const [showWillyVwap, setShowWillyVwap] = useState<boolean>(true);

    // Zooming Area states
    const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
    const [leftAxisDomain, setLeftAxisDomain] = useState<any[]>(['auto', 'auto']);
    const [rightAxisDomain, setRightAxisDomain] = useState<any[]>(['auto', 'auto']);
    const [xAxisDomain, setXAxisDomain] = useState<any[] | null>(null);

    // Reset zoom when selected ticker or settings change
    React.useEffect(() => {
        setXAxisDomain(null);
        setLeftAxisDomain(['auto', 'auto']);
        setRightAxisDomain(['auto', 'auto']);
    }, [selectedRowTicker, backtestPeriod, initialCapital, rangeMode, customStartDate]);

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
        const willyVwap = data.technical_indicators?.willy_vwap ?? null;
        if (currentPrice !== null && willyVwap !== null && closeSlopeRaw !== null) {
            rec = (currentPrice > willyVwap && closeSlopeRaw > 0) ? 'Hold' : 'Sell';
        }

        let willyMarket = "N/A";
        if (currentPrice !== null && willyVwap !== null) {
            willyMarket = currentPrice > willyVwap ? 'Bull' : 'Bear';
        }

        let willyVwapRatio = data.technical_indicators?.willy_vwap_ratio ?? null;
        if (willyVwapRatio === null && currentPrice !== null && willyVwap !== null && willyVwap !== 0) {
            willyVwapRatio = currentPrice / willyVwap;
        }

        const backtest = runWillyBacktest(
            priceHistory,
            initialCapital,
            backtestPeriod,
            rangeMode === 'date' ? customStartDate : undefined
        );

        return {
            symbol: data.symbol,
            ml_alpha: alphaProb,
            strat_avg: stratAvg,
            ranking: ranking,
            rec: rec,
            willy_market: willyMarket,
            close_price: currentPrice,
            close_slope: closeSlopeStr,
            close_slope_raw: closeSlopeRaw,
            willy_vwap_ratio: willyVwapRatio,
            macd_hist: macdHist,
            macd_slope: macdSlope,
            macd_rel: macdRel,
            rsi: rsi,
            rsi_slope: rsiSlope,
            strats: stratMap,
            strategy_value: backtest.finalValue,
            strategy_return: backtest.totalReturn,
            bh_return: backtest.buyAndHoldReturn,
            backtest_data: backtest,
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
        } else if (sortKey === 'willy_market') {
            valA = a.willy_market;
            valB = b.willy_market;
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
        } else if (sortKey === 'willy_vwap_ratio') {
            valA = a.willy_vwap_ratio ?? -99999;
            valB = b.willy_vwap_ratio ?? -99999;
        } else if (sortKey === 'strategy_value') {
            valA = a.strategy_value;
            valB = b.strategy_value;
        } else if (sortKey === 'strategy_return') {
            valA = a.strategy_return;
            valB = b.strategy_return;
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
            "Ticker", "ML Alpha", "Strat Avg", "Ranking", "Rec", "Willy Market", "Strategy Value ($)", "Strategy Return (%)", "Buy & Hold Return (%)", "Close Price", "Close Slope",
            "Price/Willy VWAP", "MACD Hist", "MACD Slope", "MACD Rel", "RSI", "RSI Slope", ...STRATEGY_NAMES
        ];

        const rows = sortedData.map(row => {
            const r = [
                row.symbol,
                row.ml_alpha.toFixed(1),
                row.strat_avg.toFixed(1),
                row.ranking,
                row.rec,
                row.willy_market,
                row.strategy_value.toFixed(2),
                row.strategy_return.toFixed(2),
                row.bh_return.toFixed(2),
                row.close_price !== null ? row.close_price.toFixed(2) : "N/A",
                row.close_slope,
                row.willy_vwap_ratio !== null ? row.willy_vwap_ratio.toFixed(3) : "N/A",
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

    const selectedData = flatData.find(d => d.symbol === selectedRowTicker);
    const backtest = selectedData ? selectedData.backtest_data : null;

    return (
        <div className="flex flex-col gap-4 w-full h-full overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 pr-2 shrink-0 bg-muted/20 p-3 rounded-lg border border-muted-foreground/10">
                {/* Backtest Configuration Controls */}
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Willy VWAP Backtest Settings:
                    </span>

                    {/* Range Mode Segmented Control Toggle */}
                    <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-muted-foreground/5">
                        <button
                            type="button"
                            onClick={() => setRangeMode('period')}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-sm transition-all cursor-pointer ${
                                rangeMode === 'period'
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Period
                        </button>
                        <button
                            type="button"
                            onClick={() => setRangeMode('date')}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-sm transition-all cursor-pointer ${
                                rangeMode === 'date'
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Specific Date
                        </button>
                    </div>
                    
                    {/* Period Dropdown Selector */}
                    {rangeMode === 'period' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                            <label className="text-xs font-medium text-muted-foreground">Period:</label>
                            <select
                                value={backtestPeriod}
                                onChange={(e) => setBacktestPeriod(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer hover:bg-muted/55 transition-colors"
                            >
                                <option value="1d">1 Day</option>
                                <option value="2d">2 Days</option>
                                <option value="1w">1 Week</option>
                                <option value="2w">2 Weeks</option>
                                <option value="1m">1 Month</option>
                                <option value="3m">3 Months</option>
                                <option value="4m">4 Months (Default)</option>
                                <option value="6m">6 Months</option>
                                <option value="12m">12 Months</option>
                            </select>
                        </div>
                    )}

                    {/* Date Picker Selector */}
                    {rangeMode === 'date' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                            <label className="text-xs font-medium text-muted-foreground">Start Date:</label>
                            <input
                                type="date"
                                value={customStartDate}
                                min={overallMinDate}
                                max={overallMaxDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer hover:bg-muted/55 transition-colors"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground">Initial Capital:</label>
                        <div className="relative flex items-center">
                            <span className="absolute left-2.5 text-xs text-muted-foreground font-mono">$</span>
                            <input
                                type="text"
                                value={capitalInput}
                                onChange={(e) => {
                                    const rawVal = e.target.value;
                                    setCapitalInput(rawVal);
                                    const parsed = parseFloat(rawVal.replace(/[^0-9.]/g, ''));
                                    if (!isNaN(parsed) && parsed >= 0) {
                                        setInitialCapital(parsed);
                                    }
                                }}
                                onBlur={() => {
                                    const parsed = parseFloat(capitalInput.replace(/[^0-9.]/g, ''));
                                    if (!isNaN(parsed) && parsed > 0) {
                                        setCapitalInput(parsed.toLocaleString(undefined, { maximumFractionDigits: 0 }));
                                        setInitialCapital(parsed);
                                    } else {
                                        setCapitalInput("10,000");
                                        setInitialCapital(10000);
                                    }
                                }}
                                className="h-8 w-24 rounded-md border border-input bg-background pl-5 pr-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono font-semibold"
                                placeholder="10,000"
                            />
                        </div>
                    </div>
                </div>

                <Button 
                    onClick={handleExportCsv} 
                    variant={exportSuccess ? "default" : "outline"} 
                    size="sm" 
                    className={`gap-2 h-8 text-xs font-medium transition-all ${exportSuccess ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : ''}`}
                    disabled={isExporting}
                >
                    {exportSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} 
                </Button>
            </div>

            {/* TOP HORIZONTAL SCROLLBAR */}
            <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="overflow-x-auto bg-amber-500/15 border border-b-0 border-amber-500/30 p-1 flex items-center shrink-0 z-30 rounded-t-lg"
                style={{ overflowY: 'hidden' }}
            >
                <div className="h-2.5 min-w-[2800px] bg-amber-500/30 rounded-full" />
            </div>

            <div
                ref={tableScrollRef}
                onScroll={handleTableScroll}
                className={`w-full bg-card text-card-foreground border rounded-b-lg shadow-sm overflow-auto relative transition-all duration-300 ${selectedRowTicker ? 'h-[480px] shrink-0' : 'flex-1'}`}
            >
                <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-[2800px]">
                <TableHeader className="sticky top-0 z-30 bg-card">
                    <TableRow>
                        <TableHead
                            className="w-[100px] font-bold cursor-pointer hover:bg-muted bg-card sticky left-0 top-0 z-50 shadow-[0_1px_0_0_hsl(var(--border)),1px_0_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('ticker')}
                        >
                            Ticker {renderSortIcon("ticker")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-primary cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('ml_alpha')}
                        >
                            ML Alpha {renderSortIcon("ml_alpha")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-blue-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('strat_avg')}
                        >
                            Strat Avg {renderSortIcon("strat_avg")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-amber-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('ranking')}
                        >
                            Ranking {renderSortIcon("ranking")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-fuchsia-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('rec')}
                        >
                            Rec {renderSortIcon("rec")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-orange-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[110px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('willy_market')}
                        >
                            Willy Market {renderSortIcon("willy_market")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-amber-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[110px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('strategy_value')}
                        >
                            Strategy Value ($) {renderSortIcon("strategy_value")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-emerald-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[125px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('strategy_return')}
                        >
                            Strat vs B&H (%) {renderSortIcon("strategy_return")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-cyan-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('close_price')}
                        >
                            Close Price {renderSortIcon("close_price")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-cyan-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('close_slope')}
                        >
                            Close Slope {renderSortIcon("close_slope")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-cyan-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('willy_vwap_ratio')}
                        >
                            Price/Willy VWAP {renderSortIcon("willy_vwap_ratio")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-teal-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('macd_hist')}
                        >
                            MACD Hist {renderSortIcon("macd_hist")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-teal-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('macd_slope')}
                        >
                            MACD Slope {renderSortIcon("macd_slope")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-emerald-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[90px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('macd_rel')}
                        >
                            MACD Rel {renderSortIcon("macd_rel")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-indigo-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('rsi')}
                        >
                            RSI {renderSortIcon("rsi")}
                        </TableHead>
                        <TableHead
                            className="font-bold text-indigo-500 cursor-pointer hover:bg-muted/50 whitespace-normal min-w-[80px] text-center sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                            onClick={() => handleSort('rsi_slope')}
                        >
                            RSI Slope {renderSortIcon("rsi_slope")}
                        </TableHead>
                        {STRATEGY_NAMES.map(name => (
                            <TableHead
                                key={name}
                                className="text-xs whitespace-normal min-w-[100px] text-center align-bottom cursor-pointer hover:bg-muted/50 sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]"
                                onClick={() => handleSort(name)}
                            >
                                {name} {renderSortIcon(name)}
                            </TableHead>
                        ))}
                        <TableHead className="w-[150px] text-right font-bold pr-4 sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">6M Trend</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={STRATEGY_NAMES.length + 16} className="text-center py-10 text-muted-foreground">
                                No data loaded yet. Select stocks from the sidebar.
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedData.map((row) => {
                            const data = row.original;
                            const isSelected = selectedRowTicker === row.symbol;

                            return (
                                <TableRow 
                                    key={row.symbol}
                                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-muted/50 border-l-4 border-l-amber-500 font-semibold shadow-[inset_4px_0_0_0_#f59e0b]' : 'hover:bg-muted/30'}`}
                                    onClick={() => setSelectedRowTicker(isSelected ? null : row.symbol)}
                                >
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
                                    <TableCell className="text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${row.willy_market === 'Bull' ? 'bg-green-500/15 text-green-500 border border-green-500/30' : row.willy_market === 'Bear' ? 'bg-red-500/15 text-red-500 border border-red-500/30' : 'bg-muted text-muted-foreground'}`}>
                                            {row.willy_market === 'Bull' ? '🟢 Bull' : row.willy_market === 'Bear' ? '🔴 Bear' : 'N/A'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center font-mono font-bold text-amber-500 bg-amber-500/5">
                                        ${row.strategy_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center bg-emerald-500/5">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className={`font-bold font-mono text-sm ${row.strategy_return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {row.strategy_return >= 0 ? '+' : ''}{row.strategy_return.toFixed(1)}%
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-semibold">
                                                B&H: {row.bh_return >= 0 ? '+' : ''}{row.bh_return.toFixed(1)}%
                                            </span>
                                        </div>
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
                                        {row.willy_vwap_ratio != null ? (
                                            <span className={row.willy_vwap_ratio >= 1.0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                                                {row.willy_vwap_ratio.toFixed(3)}
                                            </span>
                                        ) : <span className="text-muted-foreground">N/A</span>}
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
            </table>
        </div>

        {/* Willy VWAP Backtest Dashboard Panel */}
        {selectedRowTicker && selectedData && backtest && (() => {
            const txMap = new Map<string, 'BUY' | 'SELL'>();
            backtest.transactions.forEach(tx => {
                txMap.set(tx.date, tx.action);
            });

            const renderCustomDot = (props: any) => {
                const { cx, cy, payload } = props;
                const tx = txMap.get(payload.date);
                if (!tx) return null;
                
                return (
                    <g key={`${payload.date}-${tx}`}>
                        <circle 
                            cx={cx} 
                            cy={cy} 
                            r={7} 
                            fill={tx === 'BUY' ? '#10b981' : '#ef4444'} 
                            stroke="#fff" 
                            strokeWidth={1.5}
                        />
                        <text 
                            x={cx} 
                            y={cy + 3} 
                            textAnchor="middle" 
                            fill="#fff" 
                            fontSize="9px" 
                            fontWeight="bold"
                            fontFamily="sans-serif"
                        >
                            {tx === 'BUY' ? 'B' : 'S'}
                        </text>
                    </g>
                );
            };

            const handleMouseDown = (e: any) => {
                if (e && e.activeLabel) {
                    setRefAreaLeft(e.activeLabel);
                }
            };

            const handleMouseMove = (e: any) => {
                if (refAreaLeft && e && e.activeLabel) {
                    setRefAreaRight(e.activeLabel);
                }
            };

            const handleMouseUp = () => {
                if (refAreaLeft && refAreaRight) {
                    let left = refAreaLeft;
                    let right = refAreaRight;
                    if (left > right) {
                        [left, right] = [right, left];
                    }

                    if (left !== right) {
                        setXAxisDomain([left, right]);
                        
                        const selectedPoints = backtest.chartData.filter(
                            (d: any) => d.date >= left && d.date <= right
                        );
                        
                        if (selectedPoints.length > 0) {
                            let minLeft = Infinity;
                            let maxLeft = -Infinity;
                            let minRight = Infinity;
                            let maxRight = -Infinity;
                            
                            selectedPoints.forEach((d: any) => {
                                if (showStrategyValue && d.strategyValue != null) {
                                    minLeft = Math.min(minLeft, d.strategyValue);
                                    maxLeft = Math.max(maxLeft, d.strategyValue);
                                }
                                if (showBhValue && d.bhValue != null) {
                                    minLeft = Math.min(minLeft, d.bhValue);
                                    maxLeft = Math.max(maxLeft, d.bhValue);
                                }
                                if (showClosePrice && d.closePrice != null) {
                                    minRight = Math.min(minRight, d.closePrice);
                                    maxRight = Math.max(maxRight, d.closePrice);
                                }
                                if (showWillyVwap && d.willyVwap != null) {
                                    minRight = Math.min(minRight, d.willyVwap);
                                    maxRight = Math.max(maxRight, d.willyVwap);
                                }
                            });

                            if (minLeft !== Infinity && maxLeft !== -Infinity) {
                                const rangeLeft = maxLeft - minLeft;
                                const buffer = rangeLeft * 0.05 || 10;
                                setLeftAxisDomain([minLeft - buffer, maxLeft + buffer]);
                            } else {
                                setLeftAxisDomain(['auto', 'auto']);
                            }
                            if (minRight !== Infinity && maxRight !== -Infinity) {
                                const rangeRight = maxRight - minRight;
                                const buffer = rangeRight * 0.05 || 1;
                                setRightAxisDomain([minRight - buffer, maxRight + buffer]);
                            } else {
                                setRightAxisDomain(['auto', 'auto']);
                            }
                        }
                    }
                }
                setRefAreaLeft(null);
                setRefAreaRight(null);
            };

            const handleResetZoom = () => {
                setXAxisDomain(null);
                setLeftAxisDomain(['auto', 'auto']);
                setRightAxisDomain(['auto', 'auto']);
            };

            return (
                <div className="w-full bg-card text-card-foreground border rounded-lg shadow-md p-6 transition-all duration-300 ease-in-out border-amber-500/30 shrink-0">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <span className="text-amber-500 font-extrabold">{selectedData.symbol}</span> 
                            <span>Willy VWAP Backtest Dashboard</span>
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Backtesting period: {formatDate(backtest.startDateStr)} - {formatDate(backtest.endDateStr)} | Initial Capital: ${initialCapital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedRowTicker(null)}
                        className="text-xs h-8 text-muted-foreground hover:text-foreground animate-pulse"
                    >
                        ✕ Close
                    </Button>
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-muted/30 border rounded-lg p-4 flex flex-col gap-1 relative overflow-hidden">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Willy Strategy Ending Value</span>
                        <span className="text-2xl font-extrabold font-mono text-amber-500 mt-1">
                            ${backtest.finalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-bold mt-1 flex items-center gap-1 ${backtest.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {backtest.totalReturn >= 0 ? '▲' : '▼'} {backtest.totalReturn.toFixed(2)}% Return
                        </span>
                        <div className="absolute right-3 top-3 opacity-10">
                            <TrendingUp className="w-12 h-12 text-amber-500" />
                        </div>
                    </div>

                    <div className="bg-muted/30 border rounded-lg p-4 flex flex-col gap-1 relative overflow-hidden">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buy & Hold Ending Value</span>
                        <span className="text-2xl font-extrabold font-mono text-cyan-500 mt-1">
                            ${backtest.buyAndHoldValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-bold mt-1 flex items-center gap-1 ${backtest.buyAndHoldReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {backtest.buyAndHoldReturn >= 0 ? '▲' : '▼'} {backtest.buyAndHoldReturn.toFixed(2)}% Return
                        </span>
                        <div className="absolute right-3 top-3 opacity-10">
                            <TrendingUp className="w-12 h-12 text-cyan-500" />
                        </div>
                    </div>

                    {/* Outperformance Card */}
                    {(() => {
                        const outperf = backtest.totalReturn - backtest.buyAndHoldReturn;
                        const isBeating = outperf > 0;
                        return (
                            <div className={`border rounded-lg p-4 flex flex-col gap-1 relative overflow-hidden transition-colors ${isBeating ? 'bg-green-500/5 border-green-500/30 font-bold' : 'bg-red-500/5 border-red-500/30'}`}>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alpha (Outperformance)</span>
                                <span className={`text-2xl font-extrabold font-mono mt-1 ${isBeating ? 'text-green-500' : 'text-red-500'}`}>
                                    {isBeating ? '+' : ''}{outperf.toFixed(2)}%
                                </span>
                                <span className={`text-xs font-bold mt-1 ${isBeating ? 'text-green-400' : 'text-red-400'}`}>
                                    {isBeating ? '👑 Strategy Outperformed!' : '⚠️ Strategy Underperformed'}
                                </span>
                                <div className="absolute right-3 top-3 opacity-15">
                                    <CheckCircle2 className={`w-12 h-12 ${isBeating ? 'text-green-500' : 'text-red-500'}`} />
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Recharts Area Chart */}
                    {/* Recharts Area Chart */}
                    <div className="lg:col-span-7 bg-muted/20 border rounded-lg p-4 flex flex-col select-none">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground">Portfolio Growth & Price Comparison</h3>
                                {xAxisDomain && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleResetZoom}
                                        className="h-6 text-[10px] text-amber-500 border-amber-500/40 hover:bg-amber-500/10 font-bold px-2 py-0 animate-pulse"
                                    >
                                        Reset Zoom
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs bg-muted/30 p-1.5 rounded-md border border-muted-foreground/5">
                                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#eab308] hover:opacity-80 select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={showStrategyValue} 
                                        onChange={(e) => setShowStrategyValue(e.target.checked)}
                                        className="rounded border-input text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    Strategy Value
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#3b82f6] hover:opacity-80 select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={showBhValue} 
                                        onChange={(e) => setShowBhValue(e.target.checked)}
                                        className="rounded border-input text-blue-500 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    Buy & Hold
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#a855f7] hover:opacity-80 select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={showClosePrice} 
                                        onChange={(e) => setShowClosePrice(e.target.checked)}
                                        className="rounded border-input text-purple-500 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    Close Price
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#f97316] hover:opacity-80 select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={showWillyVwap} 
                                        onChange={(e) => setShowWillyVwap(e.target.checked)}
                                        className="rounded border-input text-orange-500 focus:ring-orange-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    Willy VWAP
                                </label>
                            </div>
                        </div>
                        <div className="w-full h-[380px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart 
                                    data={backtest.chartData}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    style={{ cursor: 'crosshair' }}
                                >
                                    <defs>
                                        <linearGradient id="colorStrategy" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorBH" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis 
                                        dataKey="date" 
                                        domain={xAxisDomain ? [xAxisDomain[0], xAxisDomain[1]] : undefined}
                                        allowDataOverflow
                                        tickFormatter={(dateStr) => {
                                            const d = new Date(dateStr);
                                            return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                        }}
                                        tick={{ fontSize: 10 }}
                                        stroke="#6b7280"
                                    />
                                    <YAxis 
                                        yAxisId="left"
                                        domain={leftAxisDomain}
                                        allowDataOverflow
                                        hide={!showStrategyValue && !showBhValue}
                                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                                        tick={{ fontSize: 10 }}
                                        stroke="#eab308"
                                    />
                                    <YAxis 
                                        yAxisId="right"
                                        orientation="right"
                                        domain={rightAxisDomain}
                                        allowDataOverflow
                                        hide={!showClosePrice && !showWillyVwap}
                                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                                        tick={{ fontSize: 10 }}
                                        stroke="#a855f7"
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        labelFormatter={(label) => `Date: ${label}`}
                                        formatter={(value: any, name: any) => [
                                            `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
                                            name
                                        ]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    {showStrategyValue && (
                                        <Area yAxisId="left" type="monotone" name="Willy VWAP Strategy" dataKey="strategyValue" stroke="#eab308" strokeWidth={2.5} fillOpacity={1} fill="url(#colorStrategy)" />
                                    )}
                                    {showBhValue && (
                                        <Area yAxisId="left" type="monotone" name="Buy & Hold" dataKey="bhValue" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBH)" strokeDasharray="3 3" />
                                    )}
                                    {showClosePrice && (
                                        <Line yAxisId="right" type="monotone" name="Close Price" dataKey="closePrice" stroke="#a855f7" strokeWidth={2} dot={renderCustomDot} activeDot={{ r: 6 }} />
                                    )}
                                    {showWillyVwap && (
                                        <Line yAxisId="right" type="monotone" name="Willy VWAP" dataKey="willyVwap" stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                                    )}
                                    {refAreaLeft && refAreaRight && (
                                        <ReferenceArea 
                                            yAxisId="left" 
                                            x1={refAreaLeft} 
                                            x2={refAreaRight} 
                                            strokeOpacity={0.3} 
                                            fill="#f59e0b" 
                                            fillOpacity={0.15} 
                                        />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 text-center select-none italic">
                            💡 Tip: Click and drag horizontally over the chart area to zoom in on a specific period.
                        </p>
                    </div>

                    {/* Trade Log Table */}
                    <div className="lg:col-span-5 bg-muted/20 border rounded-lg p-4 flex flex-col">
                        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center justify-between">
                            <span>Chronological Trade Log</span>
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono">
                                {backtest.transactions.length} Trades
                            </span>
                        </h3>
                        <div className="w-full flex-1 overflow-auto max-h-[350px] border rounded text-xs">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-muted/50 sticky top-0 font-bold border-b text-muted-foreground">
                                    <tr>
                                        <th className="p-2">Date</th>
                                        <th className="p-2 text-center">Action</th>
                                        <th className="p-2 text-right">Price</th>
                                        <th className="p-2 text-right">Shares</th>
                                        <th className="p-2 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y font-mono">
                                    {backtest.transactions.map((tx, idx) => (
                                        <tr key={idx} className="hover:bg-muted/30">
                                            <td className="p-2 font-sans font-medium text-foreground">{tx.date}</td>
                                            <td className="p-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tx.action === 'BUY' ? 'bg-green-500/10 text-green-500 border border-green-500/20 animate-pulse' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                    {tx.action}
                                                </span>
                                            </td>
                                            <td className="p-2 text-right text-foreground font-semibold">${tx.price.toFixed(2)}</td>
                                            <td className="p-2 text-right text-muted-foreground">{tx.shares > 0 ? tx.shares.toFixed(2) : '-'}</td>
                                            <td className="p-2 text-right text-foreground font-semibold">
                                                ${tx.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                            Note: The backtest initiates a full BUY of ${initialCapital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} on the start date (or first available trading day) at the close. BUY and SELL signals execute at the close when the close price crosses the Willy VWAP boundary. Zero transaction fees and slippage are assumed.
                        </p>
                    </div>
                </div>
            </div>
        )})()}
    </div>
    );
}
