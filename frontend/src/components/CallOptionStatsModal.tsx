import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Check, Loader2, Download, Search, Filter, HelpCircle, ShieldCheck, Flame } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { TickerCallStats, CallOptionStatsResponse } from '@/lib/types';

interface CallOptionStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const INDICATOR_KEYS = [
  { key: 'stock_trend', label: '1. Trend', title: 'Stock Trend: Price > 20 EMA > 50 SMA (Rising)' },
  { key: 'support_resistance', label: '2. Sup/Res', title: 'Support & Resistance: Breakout or Room >= 2x ATR' },
  { key: 'volume_momentum', label: '3. Volume', title: 'Trading Volume: Volume > 20d Avg on Price Increase' },
  { key: 'rsi', label: '4. RSI', title: 'RSI(14): Bullish momentum range 50 to 75' },
  { key: 'macd', label: '5. MACD', title: 'MACD: Line above Signal or Positive Histogram' },
  { key: 'atr_move', label: '6. ATR', title: 'ATR Realism: Daily Range >= 1.2% supporting option move' },
  { key: 'relative_strength', label: '7. RS vs SPY', title: 'Relative Strength: Stock 1M Return > SPY 1M Return' },
  { key: 'bid_ask_spread', label: '8. Spread', title: 'Bid-Ask Spread: Tight option spread <= $0.25 / 10%' },
  { key: 'option_volume_oi', label: '9. Opt Vol/OI', title: 'Option Vol/OI: Active chain with open interest' },
  { key: 'iv_percentile', label: '10. IV Level', title: 'Implied Volatility: Reasonable IV <= 50% / IV/HV <= 1.30' },
  { key: 'delta', label: '11. Delta', title: 'Call Delta: Balanced directional exposure 0.30 - 0.70' },
  { key: 'theta_decay', label: '12. Theta', title: 'Theta Decay: Manageable daily time loss <= 5% of premium' },
  { key: 'earnings_event', label: '13. Earnings', title: 'Earnings Calendar: Clear of immediate IV crush events (>7d)' },
  { key: 'expected_move', label: '14. Exp Move', title: 'Expected Move: Breakeven rise <= Market Expected Move' },
];

export function CallOptionStatsModal({ isOpen, onClose }: CallOptionStatsModalProps) {
  const [data, setData] = useState<TickerCallStats[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<string>('All');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [sortField, setSortField] = useState<string>('positive_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [csvSaving, setCsvSaving] = useState<boolean>(false);
  const [csvSuccess, setCsvSuccess] = useState<boolean>(false);

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

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/call-option-stats`);
      if (!res.ok) {
        throw new Error(`Failed to fetch Call Option Stats (Status ${res.status})`);
      }
      const json: CallOptionStatsResponse = await res.json();
      setData(json.items || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Call Option Stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter tickers
  const filteredData = data.filter(item => {
    const matchesSearch = item.symbol.toLowerCase().includes(search.toLowerCase());
    const matchesIndex = selectedIndex === 'All' || item.index_source.includes(selectedIndex);
    const matchesScore = item.positive_count >= minScoreFilter;
    return matchesSearch && matchesIndex && matchesScore;
  });

  // Sort tickers
  const sortedData = [...filteredData].sort((a, b) => {
    let valA: any = a.positive_count;
    let valB: any = b.positive_count;

    if (sortField === 'symbol') {
      valA = a.symbol;
      valB = b.symbol;
    } else if (sortField === 'stock_price') {
      valA = a.stock_price;
      valB = b.stock_price;
    } else if (['slope_1w', 'std_1w', 'slope_2w', 'slope_2w_pct', 'std_2w', 'std_2w_pct', 'slope_4w', 'std_4w'].includes(sortField)) {
      valA = (a as any)[sortField] ?? -999999;
      valB = (b as any)[sortField] ?? -999999;
    } else if (sortField === 'score_pct') {
      valA = a.score_pct;
      valB = b.score_pct;
    } else if (sortField.startsWith('ind_')) {
      const indKey = sortField.replace('ind_', '');
      valA = a.indicators[indKey]?.positive ? 1 : 0;
      valB = b.indicators[indKey]?.positive ? 1 : 0;
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const exportCsv = async () => {
    if (!sortedData || sortedData.length === 0) return;
    setCsvSaving(true);
    try {
      const headers = [
        "+ve Indicators",
        "Total Indicators",
        "Score (%)",
        "Ticker",
        "Index Source",
        "Stock Price ($)",
        "2W Slope %",
        "2W Std %",
        "1W Slope",
        "1W Std",
        "2W Slope",
        "2W Std",
        "4W Slope",
        "4W Std",
        ...INDICATOR_KEYS.map(i => i.label)
      ];

      const rows: string[] = [];
      sortedData.forEach(item => {
        const indCols = INDICATOR_KEYS.map(ik => {
          const detail = item.indicators[ik.key];
          return detail ? `${detail.positive ? 'TRUE' : 'FALSE'} (${detail.value_str})` : 'N/A';
        });

        rows.push([
          item.positive_count,
          item.total_indicators,
          `${item.score_pct}%`,
          item.symbol,
          item.index_source,
          item.stock_price.toFixed(2),
          item.slope_2w_pct !== undefined && item.slope_2w_pct !== null ? (item.slope_2w_pct >= 0 ? `+${item.slope_2w_pct.toFixed(2)}%` : `${item.slope_2w_pct.toFixed(2)}%`) : 'N/A',
          item.std_2w_pct !== undefined && item.std_2w_pct !== null ? `${item.std_2w_pct.toFixed(2)}%` : 'N/A',
          item.slope_1w !== undefined && item.slope_1w !== null ? (item.slope_1w >= 0 ? `+${item.slope_1w.toFixed(4)}` : item.slope_1w.toFixed(4)) : 'N/A',
          item.std_1w !== undefined && item.std_1w !== null ? item.std_1w.toFixed(2) : 'N/A',
          item.slope_2w !== undefined && item.slope_2w !== null ? (item.slope_2w >= 0 ? `+${item.slope_2w.toFixed(4)}` : item.slope_2w.toFixed(4)) : 'N/A',
          item.std_2w !== undefined && item.std_2w !== null ? item.std_2w.toFixed(2) : 'N/A',
          item.slope_4w !== undefined && item.slope_4w !== null ? (item.slope_4w >= 0 ? `+${item.slope_4w.toFixed(4)}` : item.slope_4w.toFixed(4)) : 'N/A',
          item.std_4w !== undefined && item.std_4w !== null ? item.std_4w.toFixed(2) : 'N/A',
          ...indCols
        ].map(v => `"${v}"`).join(','));
      });

      const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n') + '\n';

      const res = await fetch(`${API_BASE_URL}/api/save_csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'Call_Option_Stats.csv', content: csvContent })
      });

      if (!res.ok) throw new Error(`CSV export failed with status ${res.status}`);

      setCsvSuccess(true);
      setTimeout(() => setCsvSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save Call_Option_Stats.csv: ${err.message}`);
    } finally {
      setCsvSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-[95vw] xl:max-w-[92vw] h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Call Option Stats Matrix (14 Indicators + 1W/2W/4W Linear Fit Metrics)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Evaluates 14 quantitative call option checklist indicators and 1W, 2W, and 4W closing price slopes (slope m) &amp; linear fit standard deviations (std) across Dow 30, Nasdaq 100, and S&amp;P 500 constituents.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Button
              onClick={exportCsv}
              disabled={csvSaving || sortedData.length === 0}
              size="sm"
              className={`font-bold rounded-md shadow-sm transition-all flex items-center gap-1.5 ${
                csvSuccess ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {csvSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {csvSuccess ? 'Saved to Call_Option_Stats.csv!' : 'Export CSV'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-muted"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Filters & Control Bar */}
        <div className="p-4 bg-muted/40 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mr-1">Index Filter:</span>
            {['All', 'Dow 30', 'Nasdaq 100', 'S&P 500'].map(idxName => (
              <Button
                key={idxName}
                variant={selectedIndex === idxName ? 'secondary' : 'ghost'}
                onClick={() => setSelectedIndex(idxName)}
                size="sm"
                className={`h-7 px-3 text-xs font-semibold rounded-md ${
                  selectedIndex === idxName ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-muted-foreground'
                }`}
              >
                {idxName}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="flex items-center gap-2 bg-background border rounded-md px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-mono">Min +ve Score:</span>
              <select
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                className="bg-transparent font-bold cursor-pointer outline-none text-foreground"
              >
                <option value={0} className="bg-card">All (0+)</option>
                <option value={8} className="bg-card">Moderate (8+)</option>
                <option value={10} className="bg-card">Strong (10+)</option>
                <option value={12} className="bg-card">Elite (12+)</option>
              </select>
            </div>

            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search ticker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-background uppercase font-mono"
              />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-amber-500">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="font-semibold text-sm animate-pulse">Evaluating 14 Call Option Indicators for 170+ Tickers...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm font-medium">
              {error}
            </div>
          ) : sortedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/40" />
              <p>No tickers match the selected search &amp; filter criteria.</p>
            </div>
          ) : (
            <div className="flex flex-col border border-border rounded-lg overflow-hidden shadow-xs">
              {/* TOP HORIZONTAL SCROLLBAR */}
              <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="overflow-x-auto bg-amber-500/15 border-b border-amber-500/30 p-1 flex items-center shrink-0 z-30"
                style={{ overflowY: 'hidden' }}
              >
                <div className="h-2.5 min-w-[2550px] bg-amber-500/30 rounded-full" />
              </div>

              <div
                ref={tableScrollRef}
                onScroll={handleTableScroll}
                className="overflow-x-auto max-h-[calc(90vh-250px)] overflow-y-auto"
              >
                <table className="w-full text-xs text-left border-collapse min-w-[2550px]">
                  <thead className="bg-muted/90 sticky top-0 z-40 text-[11px] font-mono uppercase text-muted-foreground backdrop-blur-md">
                    <tr>
                      {/* FIRST COLUMN: How many indicators are +ve for call options (Sticky Left) */}
                      <th
                        onClick={() => handleSort('positive_count')}
                        className="p-3 font-bold border-b border-r border-amber-500/30 text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors text-center w-28 bg-card sticky left-0 z-50 shadow-sm"
                        title="Column 1: Total number of positive (+ve) Call Option indicators out of 14"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>+ve Indicators</span>
                          {sortField === 'positive_count' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      {/* SECOND COLUMN: Ticker & Index (Sticky Left) */}
                      <th
                        onClick={() => handleSort('symbol')}
                        className="p-3 font-bold border-b border-r cursor-pointer hover:bg-muted/70 transition-colors sticky left-28 z-50 bg-card shadow-sm w-36"
                      >
                        Ticker &amp; Index
                      </th>

                      <th
                        onClick={() => handleSort('stock_price')}
                        className="p-3 font-bold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-24"
                      >
                        Price ($)
                      </th>

                      <th
                        onClick={() => handleSort('slope_2w_pct')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-24 text-amber-400/90"
                        title="2-Week Closing Price Slope Percentage (slope_2w * 100 / Price)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>2W Slope %</span>
                          {sortField === 'slope_2w_pct' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('std_2w_pct')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-24 text-amber-400/90"
                        title="2-Week Standard Deviation Percentage (std_2w * 100 / Price)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>2W Std %</span>
                          {sortField === 'std_2w_pct' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      {/* 1W, 2W, 4W SLOPE & STD DEV METRICS */}
                      <th
                        onClick={() => handleSort('slope_1w')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-24"
                        title="1-Week Closing Price Slope (5 trading days)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>1W Slope</span>
                          {sortField === 'slope_1w' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('std_1w')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-20"
                        title="1-Week Linear Fit Standard Deviation (5 trading days)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>1W Std</span>
                          {sortField === 'std_1w' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('slope_2w')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-24"
                        title="2-Week Closing Price Slope (10 trading days)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>2W Slope</span>
                          {sortField === 'slope_2w' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('std_2w')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-20"
                        title="2-Week Linear Fit Standard Deviation (10 trading days)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>2W Std</span>
                          {sortField === 'std_2w' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('slope_4w')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-24"
                        title="4-Week Closing Price Slope (20 trading days)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>4W Slope</span>
                          {sortField === 'slope_4w' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      <th
                        onClick={() => handleSort('std_4w')}
                        className="p-2.5 font-semibold border-b border-r text-right cursor-pointer hover:bg-muted/70 transition-colors w-20"
                        title="4-Week Linear Fit Standard Deviation (20 trading days)"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>4W Std</span>
                          {sortField === 'std_4w' && (sortDir === 'desc' ? '▼' : '▲')}
                        </div>
                      </th>

                      {INDICATOR_KEYS.map(ik => (
                        <th
                          key={ik.key}
                          onClick={() => handleSort(`ind_${ik.key}`)}
                          className="p-2.5 font-semibold border-b border-r text-center cursor-pointer hover:bg-muted/70 transition-colors min-w-[105px]"
                          title={ik.title}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{ik.label}</span>
                            {sortField === `ind_${ik.key}` && (sortDir === 'desc' ? '▼' : '▲')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedData.map((row) => {
                      const isHighScorer = row.positive_count >= 10;
                      const isModerate = row.positive_count >= 7 && row.positive_count < 10;

                      return (
                        <tr key={row.symbol} className="hover:bg-muted/30 transition-colors">
                          
                          {/* COLUMN 1: +ve Indicators Score Badge (Sticky Left) */}
                          <td className="p-3 border-r border-amber-500/20 text-center font-mono font-bold text-sm bg-card sticky left-0 z-30 shadow-sm">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold shadow-xs ${
                                isHighScorer
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isModerate
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-destructive/20 text-destructive border border-destructive/30'
                              }`}
                            >
                              {row.positive_count} / {row.total_indicators}
                            </span>
                          </td>

                          {/* Ticker & Index (Sticky Left) */}
                          <td className="p-3 border-r font-mono bg-card sticky left-28 z-30 shadow-sm">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground">{row.symbol}</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                                {row.index_source}
                              </span>
                            </div>
                          </td>

                          {/* Stock Price */}
                          <td className="p-3 border-r text-right font-mono font-semibold text-foreground">
                            ${row.stock_price.toFixed(2)}
                          </td>

                          {/* 2W Slope % */}
                          <td className={`p-2.5 border-r text-right font-mono font-semibold ${row.slope_2w_pct !== undefined && row.slope_2w_pct !== null && row.slope_2w_pct > 0 ? 'text-emerald-400' : row.slope_2w_pct !== undefined && row.slope_2w_pct !== null && row.slope_2w_pct < 0 ? 'text-red-400' : ''}`}>
                            {row.slope_2w_pct !== undefined && row.slope_2w_pct !== null ? (row.slope_2w_pct >= 0 ? `+${row.slope_2w_pct.toFixed(2)}%` : `${row.slope_2w_pct.toFixed(2)}%`) : '-'}
                          </td>

                          {/* 2W Std % */}
                          <td className="p-2.5 border-r text-right font-mono font-semibold text-muted-foreground">
                            {row.std_2w_pct !== undefined && row.std_2w_pct !== null ? `${row.std_2w_pct.toFixed(2)}%` : '-'}
                          </td>

                          {/* 1W, 2W, 4W SLOPE & STD DEV VALUES */}
                          <td className={`p-2.5 border-r text-right font-mono font-semibold ${row.slope_1w !== undefined && row.slope_1w !== null && row.slope_1w > 0 ? 'text-emerald-400' : row.slope_1w !== undefined && row.slope_1w !== null && row.slope_1w < 0 ? 'text-red-400' : ''}`}>
                            {row.slope_1w !== undefined && row.slope_1w !== null ? (row.slope_1w >= 0 ? `+${row.slope_1w.toFixed(4)}` : row.slope_1w.toFixed(4)) : '-'}
                          </td>
                          <td className="p-2.5 border-r text-right font-mono text-muted-foreground">
                            {row.std_1w !== undefined && row.std_1w !== null ? row.std_1w.toFixed(2) : '-'}
                          </td>

                          <td className={`p-2.5 border-r text-right font-mono font-semibold ${row.slope_2w !== undefined && row.slope_2w !== null && row.slope_2w > 0 ? 'text-emerald-400' : row.slope_2w !== undefined && row.slope_2w !== null && row.slope_2w < 0 ? 'text-red-400' : ''}`}>
                            {row.slope_2w !== undefined && row.slope_2w !== null ? (row.slope_2w >= 0 ? `+${row.slope_2w.toFixed(4)}` : row.slope_2w.toFixed(4)) : '-'}
                          </td>
                          <td className="p-2.5 border-r text-right font-mono text-muted-foreground">
                            {row.std_2w !== undefined && row.std_2w !== null ? row.std_2w.toFixed(2) : '-'}
                          </td>

                          <td className={`p-2.5 border-r text-right font-mono font-semibold ${row.slope_4w !== undefined && row.slope_4w !== null && row.slope_4w > 0 ? 'text-emerald-400' : row.slope_4w !== undefined && row.slope_4w !== null && row.slope_4w < 0 ? 'text-red-400' : ''}`}>
                            {row.slope_4w !== undefined && row.slope_4w !== null ? (row.slope_4w >= 0 ? `+${row.slope_4w.toFixed(4)}` : row.slope_4w.toFixed(4)) : '-'}
                          </td>
                          <td className="p-2.5 border-r text-right font-mono text-muted-foreground">
                            {row.std_4w !== undefined && row.std_4w !== null ? row.std_4w.toFixed(2) : '-'}
                          </td>

                          {/* 14 Indicators */}
                          {INDICATOR_KEYS.map(ik => {
                            const detail = row.indicators[ik.key];
                            if (!detail) {
                              return <td key={ik.key} className="p-2 border-r text-center text-muted-foreground">-</td>;
                            }

                            return (
                              <td
                                key={ik.key}
                                className="p-2 border-r text-center relative group cursor-help"
                                title={`${ik.label}: ${detail.value_str}\n\n${detail.details}`}
                              >
                                {detail.positive ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-destructive/15 text-destructive/80 border border-destructive/20 text-xs font-bold">
                                    ✕
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border bg-card/80 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Showing {sortedData.length} of {data.length} Total Constituents</span>
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            Hover over indicator cells to view exact metric values & descriptions.
          </span>
        </div>

      </div>
    </div>
  );
}
