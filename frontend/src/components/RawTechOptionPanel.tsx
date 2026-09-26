import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Grid, List, Sparkles, Layers, Download, Check, ArrowRight } from 'lucide-react';
import { TickerAnalysis, VolatilityCalculationResponse } from '@/lib/types';
import { API_BASE_URL } from '@/lib/api';

interface RawTechOptionPanelProps {
    currentData: TickerAnalysis;
    analysisData?: Record<string, TickerAnalysis> | TickerAnalysis[];
    selectedTicker: string;
    tickers: string[];
    onSelectTicker: (ticker: string) => void;
}

const STRATEGY_NAMES = [
    "CAN SLIM",
    "FCF Yield",
    "GARP",
    "Low Volatility & Quality",
    "Pure Growth",
    "Fundamental Technical",
    "Sentiment Quant",
    "Earnings Momentum",
    "Dividend Value",
    "Willy Algo (VWAP)"
];

const getColorClass = (val: number) => {
    if (val >= 75) return 'text-emerald-400 font-bold';
    if (val >= 40) return 'text-amber-400 font-semibold';
    return 'text-rose-400';
};

export function RawTechOptionPanel({
    currentData,
    analysisData,
    selectedTicker,
    tickers,
    onSelectTicker
}: RawTechOptionPanelProps) {
    const [metricsViewMode, setMetricsViewMode] = useState<'array' | 'categorized'>('array');
    const [metricSearch, setMetricSearch] = useState('');
    const [rawSearch, setRawSearch] = useState('');
    const [copied, setCopied] = useState(false);

    // Find full analysis record for active selected ticker
    const activeRecord = useMemo(() => {
        if (!analysisData) return currentData;
        if (Array.isArray(analysisData)) {
            return analysisData.find(d => d.symbol === selectedTicker) || currentData;
        }
        return analysisData[selectedTicker] || currentData;
    }, [analysisData, selectedTicker, currentData]);

    const rawData = activeRecord?.raw_data || {};

    // Helper to format raw yfinance values nicely
    const formatRawValue = (key: string, value: unknown) => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') {
            if (Math.abs(value) > 1e9) return `${(value / 1e9).toFixed(2)}B`;
            if (Math.abs(value) > 1e6) return `${(value / 1e6).toFixed(2)}M`;
            if (Math.abs(value) < 100 && value % 1 !== 0) return value.toFixed(2);
            return value.toLocaleString();
        }
        return String(value);
    };

    // Calculate all 38 metrics summary for Section 1
    const allMetricsArray = useMemo(() => {
        if (!activeRecord) return [];

        let strats: Record<string, number> = {};
        if (Array.isArray(activeRecord.strategies)) {
            activeRecord.strategies.forEach(s => {
                strats[s.strategy_name] = s.match_percentage;
            });
        } else if (activeRecord.strategies) {
            strats = activeRecord.strategies as unknown as Record<string, number>;
        }

        const stratValues = Object.values(strats);
        const stratAvg = stratValues.length > 0 ? (stratValues.reduce((a, b) => a + b, 0) / stratValues.length) : 0;
        const ranking = stratValues.filter(v => v >= 70).length;
        const rec = ranking >= 7 ? 'Strong Buy' : ranking >= 4 ? 'Buy' : ranking >= 2 ? 'Hold' : 'Sell';

        const priceHistory = activeRecord.price_history || [];
        const currentPrice = (activeRecord as any).current_price ?? (priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].close : null);

        let closeSlopeStr = "N/A";
        let closeSlopeRaw = 0;
        if (priceHistory.length >= 2) {
            const pFirst = priceHistory[0].close;
            const pLast = priceHistory[priceHistory.length - 1].close;
            closeSlopeRaw = pLast - pFirst;
            closeSlopeStr = closeSlopeRaw >= 0 ? "+" : "-";
        }

        const willyMarket = (activeRecord as any).willy_market || (closeSlopeRaw >= 0 ? 'Bull' : 'Bear');

        let willyVwapRatio: number | null = null;
        if (priceHistory.length > 0 && currentPrice) {
            const lastRow = priceHistory[priceHistory.length - 1];
            if (lastRow.willy_vwap) willyVwapRatio = currentPrice / lastRow.willy_vwap;
        }

        const ti = (activeRecord.technical_indicators || {}) as any;
        const macdHist = ti.macd_hist ?? (ti.macd_line && ti.macd_signal ? ti.macd_line - ti.macd_signal : null);
        const macdSlope = ti.macd_slope ?? null;
        const macdRel = ti.macd_rel ?? null;
        const rsi = ti.rsi_14 ?? ti.rsi ?? null;
        const rsiSlope = ti.rsi_slope ?? null;

        const optAnalytics: VolatilityCalculationResponse | undefined = activeRecord.option_analytics;
        const callDelta = optAnalytics?.greeks?.call_delta ?? null;
        const gamma = optAnalytics?.greeks?.gamma ?? null;
        const callTheta = optAnalytics?.greeks?.call_theta ?? null;
        const vega = optAnalytics?.greeks?.vega ?? null;
        const volSpread = optAnalytics?.volatility_spread ?? null;
        const liquidityRating = optAnalytics?.liquidity_rating ?? null;
        const openInterest = optAnalytics?.open_interest ?? null;
        const greeksBullishScore = optAnalytics?.greeks_bullish_score ?? 0;
        const greeksBullishPct = optAnalytics?.greeks_bullish_pct ?? 0;
        const deltaThetaRatio = optAnalytics?.delta_theta_ratio ?? null;
        const thetaDeltaRatio = optAnalytics?.theta_delta_ratio ?? ((callTheta !== null && callDelta !== null && callDelta > 0) ? (callTheta / callDelta) : (deltaThetaRatio && deltaThetaRatio > 0 ? (1 / deltaThetaRatio) : null));
        const dailyThetaPct = optAnalytics?.daily_theta_pct ?? null;
        const reqDailyStockRise = optAnalytics?.req_daily_stock_rise ?? null;

        const alphaProb = activeRecord.alpha_probability ?? 0;

        return [
            { index: 1, key: "Ticker Symbol", value: activeRecord.symbol, category: "Core Signals", badgeColor: "text-foreground font-bold" },
            { index: 2, key: "ML Alpha Proba", value: `${alphaProb.toFixed(1)}%`, category: "Core Signals", badgeColor: alphaProb >= 75 ? "text-emerald-400 font-bold" : alphaProb >= 40 ? "text-amber-400" : "text-rose-400" },
            { index: 3, key: "Strat Avg Score", value: `${stratAvg.toFixed(1)}%`, category: "Core Signals", badgeColor: stratAvg >= 75 ? "text-emerald-400 font-bold" : stratAvg >= 40 ? "text-amber-400" : "text-rose-400" },
            { index: 4, key: "Ranking Score", value: `${ranking}/8`, category: "Core Signals", badgeColor: "text-amber-400 font-bold" },
            { index: 5, key: "Action Recommendation", value: rec, category: "Core Signals", badgeColor: rec === 'Strong Buy' || rec === 'Buy' ? "text-emerald-400 font-bold" : rec === 'Hold' ? "text-amber-400 font-bold" : "text-rose-400 font-bold" },
            { index: 6, key: "Options Alpha Rank", value: `${greeksBullishScore}/15 (${greeksBullishPct}%)`, category: "Core Signals", badgeColor: greeksBullishScore >= 12 ? "text-emerald-400 font-bold" : greeksBullishScore >= 9 ? "text-amber-400 font-bold" : "text-rose-400 font-bold" },

            { index: 7, key: "Willy Market State", value: willyMarket === 'Bull' ? '🟢 Bull' : '🔴 Bear', category: "Performance & Technicals", badgeColor: willyMarket === 'Bull' ? "text-emerald-400 font-bold" : "text-rose-400 font-bold" },
            { index: 8, key: "Close Price ($)", value: currentPrice != null ? `$${currentPrice.toFixed(2)}` : "N/A", category: "Performance & Technicals", badgeColor: "text-foreground font-semibold" },
            { index: 9, key: "Close Slope", value: closeSlopeStr, category: "Performance & Technicals", badgeColor: closeSlopeStr === '+' ? "text-emerald-400 font-bold" : "text-rose-400 font-bold" },
            { index: 10, key: "Price / Willy VWAP", value: willyVwapRatio != null ? willyVwapRatio.toFixed(3) : "N/A", category: "Performance & Technicals", badgeColor: (willyVwapRatio ?? 0) >= 1.0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold" },
            { index: 11, key: "MACD Hist", value: macdHist != null ? (macdHist > 0 ? `+${macdHist.toFixed(2)}` : macdHist.toFixed(2)) : "N/A", category: "Performance & Technicals", badgeColor: (macdHist ?? 0) > 0 ? "text-emerald-400" : "text-rose-400" },
            { index: 12, key: "MACD Slope", value: macdSlope != null ? (macdSlope > 0 ? `+${macdSlope.toFixed(3)}` : macdSlope.toFixed(3)) : "N/A", category: "Performance & Technicals", badgeColor: (macdSlope ?? 0) > 0 ? "text-emerald-400" : "text-rose-400" },
            { index: 13, key: "MACD Rel Ratio", value: macdRel != null ? (macdRel > 0 ? `+${macdRel.toFixed(3)}` : macdRel.toFixed(3)) : "N/A", category: "Performance & Technicals", badgeColor: (macdRel ?? 0) > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold" },
            { index: 14, key: "RSI (14)", value: rsi != null ? rsi.toFixed(1) : "N/A", category: "Performance & Technicals", badgeColor: (rsi ?? 0) > 70 ? "text-rose-400 font-bold" : (rsi ?? 0) < 30 ? "text-emerald-400 font-bold" : "text-foreground" },
            { index: 15, key: "RSI Slope", value: rsiSlope != null ? (rsiSlope > 0 ? `+${rsiSlope.toFixed(2)}` : rsiSlope.toFixed(2)) : "N/A", category: "Performance & Technicals", badgeColor: (rsiSlope ?? 0) > 0 ? "text-emerald-400" : "text-rose-400" },

            { index: 16, key: "Call Delta (Δ)", value: callDelta != null ? callDelta.toFixed(2) : "N/A", category: "Option Greeks & Volatility", badgeColor: "text-purple-400 font-bold" },
            { index: 17, key: "Gamma (Γ)", value: gamma != null ? gamma.toFixed(4) : "N/A", category: "Option Greeks & Volatility", badgeColor: "text-purple-300 font-semibold" },
            { index: 18, key: "Call Theta (Θ)", value: callTheta != null ? `-$${Math.abs(callTheta).toFixed(2)}/d` : "N/A", category: "Option Greeks & Volatility", badgeColor: "text-rose-400 font-semibold" },
            { index: 19, key: "Vega (V)", value: vega != null ? `$${vega.toFixed(2)}` : "N/A", category: "Option Greeks & Volatility", badgeColor: "text-emerald-400 font-semibold" },
            { index: 20, key: "Δ / |Θ| Ratio", value: deltaThetaRatio != null ? `${deltaThetaRatio.toFixed(2)}x` : "N/A", category: "Option Greeks & Volatility", badgeColor: (deltaThetaRatio ?? 0) >= 5.0 ? "text-emerald-400 font-bold" : "text-amber-300" },
            { index: 21, key: "|Θ| / Δ Ratio", value: thetaDeltaRatio != null ? thetaDeltaRatio.toFixed(4) : "N/A", category: "Option Greeks & Volatility", badgeColor: (thetaDeltaRatio ?? 1) <= 0.20 ? "text-emerald-400 font-bold" : "text-amber-300" },
            { index: 22, key: "Daily Theta Decay %", value: dailyThetaPct != null ? `${dailyThetaPct.toFixed(2)}%/d` : "N/A", category: "Option Greeks & Volatility", badgeColor: "text-amber-400" },
            { index: 23, key: "Req Daily Stock Rise", value: reqDailyStockRise != null ? `$${reqDailyStockRise.toFixed(2)}/d` : "N/A", category: "Option Greeks & Volatility", badgeColor: "text-amber-300" },
            { index: 24, key: "Vol Spread (IV - HV)", value: volSpread != null ? `${volSpread >= 0 ? '+' : ''}${(volSpread * 100).toFixed(1)}%` : "N/A", category: "Option Greeks & Volatility", badgeColor: (volSpread ?? 0) > 0.05 ? "text-amber-400" : "text-emerald-400" },
            { index: 25, key: "Option Liquidity & OI", value: liquidityRating ? `${liquidityRating} (${openInterest ?? 'N/A'} OI)` : "N/A", category: "Option Greeks & Volatility", badgeColor: "text-blue-400" },

            ...STRATEGY_NAMES.map((name, i) => ({
                index: 26 + i,
                key: name,
                value: `${(strats[name] || 0).toFixed(1)}%`,
                category: "10 Core Strategy Match Scores",
                badgeColor: getColorClass(strats[name] || 0)
            }))
        ];
    }, [activeRecord]);

    // Filter metrics by search query
    const filteredMetrics = useMemo(() => {
        if (!metricSearch.trim()) return allMetricsArray;
        const q = metricSearch.toLowerCase();
        return allMetricsArray.filter(m =>
            m.key.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q) ||
            m.value.toLowerCase().includes(q)
        );
    }, [allMetricsArray, metricSearch]);

    // Categorized grouping for Section 1
    const categorizedMetrics = useMemo(() => {
        const catMap: Record<string, typeof allMetricsArray> = {};
        filteredMetrics.forEach(m => {
            if (!catMap[m.category]) catMap[m.category] = [];
            catMap[m.category].push(m);
        });
        return catMap;
    }, [filteredMetrics]);

    // Groups for Section 2 Raw Fundamental Data
    const rawDataGroups = useMemo(() => {
        const groups: Record<string, string[]> = {
            "Company Profile": [
                "shortName", "longName", "sector", "industry", "exchange", "country", "website", "employees"
            ],
            "Valuation Metrics": [
                "marketCap", "enterpriseValue", "trailingPE", "forwardPE", "pegRatio", "priceToBook", "priceToSalesTrailing12Months", "enterpriseToRevenue", "enterpriseToEbitda"
            ],
            "Financial Highlights": [
                "totalRevenue", "revenueGrowth", "grossMargins", "ebitda", "ebitdaMargins", "operatingMargins", "profitMargins", "returnOnAssets", "returnOnEquity", "freeCashflow", "totalDebt", "debtToEquity"
            ],
            "Trading Information": [
                "currentPrice", "regularMarketPrice", "previousClose", "open", "dayLow", "dayHigh", "fiftyTwoWeekLow", "fiftyTwoWeekHigh", "volume", "averageVolume", "beta", "dividendYield", "trailingAnnualDividendRate"
            ]
        };

        // If user enters search query, also include any un-categorized raw keys matching search
        if (rawSearch.trim()) {
            const q = rawSearch.toLowerCase();
            const matchedKeys = Object.keys(rawData).filter(k => k.toLowerCase().includes(q));
            groups["Search Results"] = matchedKeys;
        }

        return groups;
    }, [rawData, rawSearch]);

    const handleExportSummary = async () => {
        const exportObj = {
            ticker: selectedTicker,
            date: new Date().toISOString(),
            metrics_summary: allMetricsArray,
            raw_fundamental_data: rawData
        };
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTicker}_Raw_Tech_Option_Summary.json`;
        a.click();
        URL.revokeObjectURL(url);

        try {
            await fetch(`${API_BASE_URL}/api/save-raw-tech-option`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: selectedTicker,
                    data: exportObj
                })
            });
        } catch (err) {
            console.error("Failed to save to project directory:", err);
        }

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* TOP HEADER: TICKER SELECTOR & QUICK BAR */}
            <Card className="border border-amber-500/40 bg-card shadow-xl overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-black text-2xl px-3.5 py-1 rounded-xl">
                                {selectedTicker}
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    {rawData.longName ? String(rawData.longName) : selectedTicker}
                                    <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                                        Raw / Tech / Option Master Dashboard
                                    </span>
                                </CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {rawData.sector ? `${rawData.sector} • ${rawData.industry || ''}` : 'Unified Technical & Fundamental Intelligence View'}
                                </p>
                            </div>
                        </div>

                        {/* TICKER QUICK SWITCHER */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold uppercase text-muted-foreground">Switch Ticker:</span>
                            <select
                                className="flex h-9 w-36 rounded-md border border-input bg-background px-3 py-1 text-xs font-mono font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all cursor-pointer text-foreground"
                                value={selectedTicker}
                                onChange={(e) => onSelectTicker(e.target.value)}
                            >
                                {tickers.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                onClick={handleExportSummary}
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                                {copied ? 'Exported!' : 'Export JSON'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* SECTION 1: ALL COLUMN METRIC SUMMARY (TOP TICKERS TAB DATA) */}
            <Card className="border border-border/80 bg-card shadow-lg">
                <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-amber-400" />
                            <CardTitle className="text-lg font-bold">
                                Section 1: Top Tickers All-Column Metric Summary ({allMetricsArray.length} Metrics)
                            </CardTitle>
                        </div>

                        {/* CONTROLS: SEARCH & DUAL VIEW MODE TOGGLES */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-56">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                <Input
                                    placeholder="Filter metrics..."
                                    value={metricSearch}
                                    onChange={(e) => setMetricSearch(e.target.value)}
                                    className="h-8 pl-8 text-xs bg-background"
                                />
                            </div>

                            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/60">
                                <Button
                                    variant={metricsViewMode === 'array' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="h-7 text-xs px-2.5 gap-1"
                                    onClick={() => setMetricsViewMode('array')}
                                >
                                    <List className="w-3.5 h-3.5 text-amber-400" /> Array List View
                                </Button>
                                <Button
                                    variant={metricsViewMode === 'categorized' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="h-7 text-xs px-2.5 gap-1"
                                    onClick={() => setMetricsViewMode('categorized')}
                                >
                                    <Grid className="w-3.5 h-3.5 text-emerald-400" /> Categorized View
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                    {/* DUAL VIEW MODE RENDERING */}
                    {metricsViewMode === 'array' ? (
                        /* MODE 1: ARRAY / KEY-VALUE LIST VIEW (4-COLUMN GRID #01 to #35) */
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {filteredMetrics.map((item) => (
                                <div
                                    key={item.index}
                                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <span className="text-[10px] font-mono font-bold text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                                            #{String(item.index).padStart(2, '0')}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate font-medium" title={item.key}>
                                            {item.key}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-mono shrink-0 ${item.badgeColor}`}>
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* MODE 2: CATEGORIZED GRID VIEW */
                        <div className="space-y-4">
                            {Object.entries(categorizedMetrics).map(([catName, items]) => (
                                <div key={catName} className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{catName}</h4>
                                        <span className="text-[10px] text-muted-foreground font-mono">({items.length} metrics)</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {items.map(item => (
                                            <div key={item.index} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-muted/20">
                                                <span className="text-xs text-muted-foreground font-medium truncate pr-2">{item.key}</span>
                                                <span className={`text-xs font-mono shrink-0 ${item.badgeColor}`}>{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SECTION 2: RAW FUNDAMENTAL DATA (RAW DATA TAB DATA) */}
            <Card className="border border-border/80 bg-card shadow-lg">
                <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                Section 2: Raw Fundamental Data (yfinance 150+ Key-Value Payload)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Complete unfiltered company financials, valuation ratios, and balance sheet metrics directly from yfinance
                            </p>
                        </div>

                        {/* SEARCH FILTER FOR RAW DATA */}
                        <div className="relative w-64">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                            <Input
                                placeholder="Search raw fundamental keys..."
                                value={rawSearch}
                                onChange={(e) => setRawSearch(e.target.value)}
                                className="h-8 pl-8 text-xs bg-background"
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-4">
                    {Object.keys(rawData).length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                            No raw fundamental data loaded for {selectedTicker}. Select a ticker from sidebar or dropdown.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.entries(rawDataGroups).map(([groupName, keys]) => {
                                // Filter keys if matching search
                                const displayKeys = keys.filter(k => {
                                    if (!rawSearch.trim()) return true;
                                    return k.toLowerCase().includes(rawSearch.toLowerCase()) || String(rawData[k] || '').toLowerCase().includes(rawSearch.toLowerCase());
                                });

                                if (displayKeys.length === 0) return null;

                                return (
                                    <Card key={groupName} className="flex flex-col h-full bg-muted/20 border border-border/60">
                                        <CardHeader className="py-2.5 px-4 border-b border-border/40 bg-muted/40">
                                            <CardTitle className="text-sm font-bold text-foreground">{groupName}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-3 text-xs space-y-1.5 flex-grow">
                                            {displayKeys.map((key) => {
                                                const val = rawData[key];
                                                if (val === undefined || val === null) return null;
                                                const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                                                return (
                                                    <div key={key} className="flex justify-between items-center py-1 border-b border-border/10 last:border-0 gap-2">
                                                        <span className="text-muted-foreground font-medium truncate shrink-0 max-w-[140px]" title={displayKey}>
                                                            {displayKey}:
                                                        </span>
                                                        <span className="font-mono font-semibold text-right truncate text-foreground">
                                                            {formatRawValue(key, val)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
