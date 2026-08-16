"use client";

import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { TickerAnalysis } from '@/lib/types';
import { ComparisonTable, runWillyBacktest } from './ComparisonTable';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Info, Check } from 'lucide-react';

interface TopTickersPanelProps {
  analysisData: Record<string, TickerAnalysis>;
  onUpdateAnalysisData: React.Dispatch<React.SetStateAction<Record<string, TickerAnalysis>>>;
}

const INDEXES = [
  { name: 'Dow 30', filename: 'DOW100.csv', displayName: 'Dow Jones 30' },
  { name: 'Nasdaq 100', filename: 'Nasdaq100.csv', displayName: 'Nasdaq 100' },
  { name: 'S&P 500', filename: 'SP100.csv', displayName: 'S&P 500' }
];

export function TopTickersPanel({ analysisData, onUpdateAnalysisData }: TopTickersPanelProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>(['DOW100.csv']);
  const [indexTickers, setIndexTickers] = useState<string[]>([]);
  const [loadingTickers, setLoadingTickers] = useState<boolean>(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Screen/Filtering state variables
  const [screenedTickers, setScreenedTickers] = useState<string[]>([]);
  const [screenRun, setScreenRun] = useState<boolean>(false);
  const [screenSaveStatus, setScreenSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Backtesting state variables
  const [backtestPeriod, setBacktestPeriod] = useState<'1w' | '1m' | '3m' | '6m' | '1y'>('1m');
  const [backtestLoading, setBacktestLoading] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [showLedger, setShowLedger] = useState<boolean>(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [csvSaving, setCsvSaving] = useState<boolean>(false);
  const [csvSaveSuccess, setCsvSaveSuccess] = useState<boolean>(false);

  // Strategy 2 State variables
  const [backtest2Loading, setBacktest2Loading] = useState<boolean>(false);
  const [backtest2Result, setBacktest2Result] = useState<any>(null);
  const [showLedger2, setShowLedger2] = useState<boolean>(false);
  const [backtest2Error, setBacktest2Error] = useState<string | null>(null);
  const [csvSaving2, setCsvSaving2] = useState<boolean>(false);
  const [csvSaveSuccess2, setCsvSaveSuccess2] = useState<boolean>(false);

  // Strategy 3 State variables
  const [backtest3Loading, setBacktest3Loading] = useState<boolean>(false);
  const [backtest3Result, setBacktest3Result] = useState<any>(null);
  const [showLedger3, setShowLedger3] = useState<boolean>(false);
  const [backtest3Error, setBacktest3Error] = useState<string | null>(null);
  const [csvSaving3, setCsvSaving3] = useState<boolean>(false);
  const [csvSaveSuccess3, setCsvSaveSuccess3] = useState<boolean>(false);

  // Options Strategy State variables
  const [backtestOptionsLoading, setBacktestOptionsLoading] = useState<boolean>(false);
  const [backtestOptionsResult, setBacktestOptionsResult] = useState<any>(null);
  const [showOptionsLedger, setShowOptionsLedger] = useState<boolean>(false);
  const [backtestOptionsError, setBacktestOptionsError] = useState<string | null>(null);
  const [csvSavingOptions, setCsvSavingOptions] = useState<boolean>(false);
  const [csvSaveSuccessOptions, setCsvSaveSuccessOptions] = useState<boolean>(false);
  const [optionsExitMode, setOptionsExitMode] = useState<'intraday' | 'expiry'>('intraday');

  // Use a ref to keep track of the active request combination key to prevent race conditions/overlapping states
  const activeFilesKeyRef = useRef<string>(selectedFiles.sort().join(','));

  const run30DayBacktest = async () => {
    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/backtest-30d?period=${backtestPeriod}`);
      if (!res.ok) {
        throw new Error(`Backtest failed (Status ${res.status})`);
      }
      const data = await res.json();
      setBacktestResult(data);
      setShowLedger(true);
    } catch (err: any) {
      console.error(err);
      setBacktestError(err.message || "Failed to run backtest.");
    } finally {
      setBacktestLoading(false);
    }
  };

  // 1. Load the consolidated list of tickers for all selected indices
  useEffect(() => {
    const sortedFilesKey = [...selectedFiles].sort().join(',');
    activeFilesKeyRef.current = sortedFilesKey;

    if (selectedFiles.length === 0) {
      setIndexTickers([]);
      setLoadingTickers(false);
      setLoadingAnalysis(false);
      return;
    }

    setIndexTickers([]);
    setLoadingTickers(true);
    setLoadingAnalysis(false);
    setError(null);
    setProgress({ current: 0, total: 0 });

    const fetchAllIndexTickers = async () => {
      try {
        const promises = selectedFiles.map(async (file) => {
          const res = await fetch(`${API_BASE_URL}/api/portfolio?filename=${file}`);
          if (!res.ok) {
            throw new Error(`Failed to load index portfolio file: ${file}`);
          }
          const data = await res.json();
          return data.tickers || [];
        });

        const results = await Promise.all(promises);

        // Ensure we only process if this is still the active combination
        if (activeFilesKeyRef.current !== sortedFilesKey) return;

        const allSymbols = new Set<string>();
        results.forEach((tickers) => {
          tickers.forEach((t: string) => {
            if (t) {
              allSymbols.add(t.trim().toUpperCase());
            }
          });
        });

        const uniqueTickers = Array.from(allSymbols).sort();
        setIndexTickers(uniqueTickers);
      } catch (err: any) {
        if (activeFilesKeyRef.current !== sortedFilesKey) return;
        setError(err.message || "Failed to load index tickers.");
        setLoadingTickers(false);
      }
    };

    fetchAllIndexTickers();
  }, [selectedFiles]);

  // 2. Fetch analysis data in small chunks (e.g., 10 tickers) to avoid server timeout and heavy loads
  useEffect(() => {
    if (indexTickers.length === 0) return;

    const unfetched = indexTickers.filter(t => !analysisData[t]);
    const totalCount = indexTickers.length;
    const fetchedCount = totalCount - unfetched.length;
    const sortedFilesKey = [...selectedFiles].sort().join(',');

    setProgress({ current: fetchedCount, total: totalCount });

    if (unfetched.length === 0) {
      setLoadingTickers(false);
      setLoadingAnalysis(false);
      return;
    }

    setLoadingAnalysis(true);
    let isSubscribed = true;

    const fetchInChunks = async () => {
      const chunkSize = 10;
      const chunks: string[][] = [];
      for (let i = 0; i < unfetched.length; i += chunkSize) {
        chunks.push(unfetched.slice(i, i + chunkSize));
      }

      let currentProgress = fetchedCount;

      for (const chunk of chunks) {
        if (!isSubscribed || activeFilesKeyRef.current !== sortedFilesKey) break;

        try {
          const tickersParam = chunk.join(',');
          const res = await fetch(`${API_BASE_URL}/api/analyze-batch?tickers=${tickersParam}`);
          if (!res.ok) {
            throw new Error(`Batch analysis failed (Status ${res.status})`);
          }
          const data = await res.json();

          if (!isSubscribed || activeFilesKeyRef.current !== sortedFilesKey) break;

          onUpdateAnalysisData(prev => ({
            ...prev,
            ...data
          }));

          currentProgress += chunk.length;
          setProgress({ current: currentProgress, total: totalCount });
        } catch (err: any) {
          console.error("Error fetching chunk:", err);
          if (isSubscribed && activeFilesKeyRef.current === sortedFilesKey) {
            setError(`Warning: Some tickers failed to analyze. Details: ${err.message}`);
          }
        }
      }

      if (isSubscribed && activeFilesKeyRef.current === sortedFilesKey) {
        setLoadingTickers(false);
        setLoadingAnalysis(false);
      }
    };

    fetchInChunks();

    return () => {
      isSubscribed = false;
    };
  }, [indexTickers, selectedFiles, onUpdateAnalysisData, analysisData]);

  // Reset screen outputs when index selections or tickers change
  useEffect(() => {
    setScreenRun(false);
    setScreenedTickers([]);
    setScreenSaveStatus('idle');
  }, [selectedFiles, indexTickers]);

  const runScreen = () => {
    setError(null);
    setScreenSaveStatus('idle');

    const results: string[] = [];

    indexTickers.forEach(ticker => {
      const data = analysisData[ticker];
      if (!data || data.error) return;

      const priceHistory = data.price_history;
      if (!priceHistory || priceHistory.length === 0) return;

      const currentPrice = priceHistory[priceHistory.length - 1].close;
      const willyVwap = data.technical_indicators?.willy_vwap ?? null;
      if (currentPrice === null || currentPrice === undefined || willyVwap === null) return;

      // 1. Willy Market = Bull (Price > Willy VWAP)
      const isBull = currentPrice > willyVwap;
      if (!isBull) return;

      // 2. Strategy Value > 10000 (using 1-week backtest)
      const backtest = runWillyBacktest(priceHistory, 10000, '1w');
      const isProfitable = backtest.finalValue > 10000;
      if (!isProfitable) return;

      // 3. MACD Hist > -0.5 and < 0.5 (MACD Hist = Line - Signal)
      const macdLine = data.technical_indicators?.macd_line ?? null;
      const macdSignal = data.technical_indicators?.macd_signal ?? null;
      if (macdLine === null || macdSignal === null) return;
      const macdHist = macdLine - macdSignal;
      if (macdHist <= -0.5 || macdHist >= 0.5) return;

      // 4. MACD Slope > 0
      const macdSlope = data.technical_indicators?.macd_slope ?? null;
      if (macdSlope === null || macdSlope <= 0) return;

      // 5. RSI > 30 and < 70 (RSI 14)
      const rsi = data.technical_indicators?.rsi_14 ?? null;
      if (rsi === null || rsi <= 30 || rsi >= 70) return;

      results.push(ticker);
    });

    setScreenedTickers(results);
    setScreenRun(true);
  };

  const saveScreenedTickers = async () => {
    if (screenedTickers.length === 0) return;

    setScreenSaveStatus('saving');
    try {
      const csvContent = "Symbol\n" + screenedTickers.join("\n") + "\n";

      const res = await fetch(`${API_BASE_URL}/api/save_csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'Top_Tickers_to_buy.csv',
          content: csvContent
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to save CSV (Status ${res.status})`);
      }

      setScreenSaveStatus('saved');
    } catch (err: any) {
      console.error("Save screen error:", err);
      setError(`Failed to save buy list: ${err.message}`);
      setScreenSaveStatus('error');
    }
  };

  const saveBacktestLedgerCsv = async () => {
    if (!backtestResult || !backtestResult.trades || backtestResult.trades.length === 0) return;

    setCsvSaving(true);
    try {
      const headers = [
        "Screen Date",
        "Buy Date",
        "Sell Date",
        "Ticker",
        "Buy Price",
        "Sell Price",
        "Shares",
        "Profit",
        "Dow Return (%)",
        "S&P Return (%)",
        "Nasdaq Return (%)",
        "Daily Profit ($)",
        "Daily Profit (%)"
      ];

      const rows: string[] = [];
      backtestResult.trades.forEach((day: any) => {
        const dowRet = (day.dow_return ?? 0.0).toFixed(2);
        const spRet = (day.sp_return ?? 0.0).toFixed(2);
        const ndxRet = (day.nasdaq_return ?? 0.0).toFixed(2);
        const dailyProfitPct = ((day.daily_profit / 10000.0) * 100.0).toFixed(2);

        if (!day.tickers || day.tickers.length === 0) {
          rows.push([
            day.screen_date,
            day.buy_date,
            day.sell_date,
            "N/A",
            "0",
            "0",
            "0",
            "0",
            dowRet,
            spRet,
            ndxRet,
            day.daily_profit.toFixed(2),
            dailyProfitPct
          ].map(v => `"${v}"`).join(","));
        } else {
          day.tickers.forEach((t: any) => {
            rows.push([
              day.screen_date,
              day.buy_date,
              day.sell_date,
              t.ticker,
              t.buy_price.toFixed(2),
              t.sell_price.toFixed(2),
              t.shares.toFixed(2),
              t.profit.toFixed(2),
              dowRet,
              spRet,
              ndxRet,
              day.daily_profit.toFixed(2),
              dailyProfitPct
            ].map(v => `"${v}"`).join(","));
          });
        }
      });

      const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n") + "\n";

      const res = await fetch(`${API_BASE_URL}/api/save_csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'Backtest_Ledger.csv',
          content: csvContent
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to save CSV (Status ${res.status})`);
      }

      setCsvSaveSuccess(true);
      setTimeout(() => setCsvSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save backtest ledger CSV: ${err.message}`);
    } finally {
      setCsvSaving(false);
    }
  };

  const run30DayBacktest2 = async () => {
    setBacktest2Loading(true);
    setBacktest2Error(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/backtest-30d/strategy2?period=${backtestPeriod}`);
      if (!res.ok) {
        throw new Error(`Backtest Strategy 2 failed (Status ${res.status})`);
      }
      const data = await res.json();
      setBacktest2Result(data);
      setShowLedger2(true);
    } catch (err: any) {
      console.error(err);
      setBacktest2Error(err.message || "Failed to run Strategy 2 backtest.");
    } finally {
      setBacktest2Loading(false);
    }
  };

  const saveBacktestLedgerCsv2 = async () => {
    if (!backtest2Result || !backtest2Result.trades || backtest2Result.trades.length === 0) return;

    setCsvSaving2(true);
    try {
      const headers = [
        "Screen Date",
        "Buy Date",
        "Sell Date",
        "Ticker",
        "Buy Price",
        "Sell Price",
        "Shares",
        "Profit",
        "Dow Return (%)",
        "S&P Return (%)",
        "Nasdaq Return (%)",
        "Daily Profit ($)",
        "Daily Profit (%)"
      ];

      const rows: string[] = [];
      backtest2Result.trades.forEach((day: any) => {
        const dowRet = (day.dow_return ?? 0.0).toFixed(2);
        const spRet = (day.sp_return ?? 0.0).toFixed(2);
        const ndxRet = (day.nasdaq_return ?? 0.0).toFixed(2);
        const dailyProfitPct = ((day.daily_profit / 10000.0) * 100.0).toFixed(2);

        if (!day.tickers || day.tickers.length === 0) {
          rows.push([
            day.screen_date,
            day.buy_date,
            day.sell_date,
            "N/A",
            "0",
            "0",
            "0",
            "0",
            dowRet,
            spRet,
            ndxRet,
            day.daily_profit.toFixed(2),
            dailyProfitPct
          ].map(v => `"${v}"`).join(","));
        } else {
          day.tickers.forEach((t: any) => {
            rows.push([
              day.screen_date,
              day.buy_date,
              day.sell_date,
              t.ticker,
              t.buy_price.toFixed(2),
              t.sell_price.toFixed(2),
              t.shares.toFixed(2),
              t.profit.toFixed(2),
              dowRet,
              spRet,
              ndxRet,
              day.daily_profit.toFixed(2),
              dailyProfitPct
            ].map(v => `"${v}"`).join(","));
          });
        }
      });

      const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n") + "\n";

      const res = await fetch(`${API_BASE_URL}/api/save_csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'Backtest_Ledger_Strategy2.csv',
          content: csvContent
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to save CSV (Status ${res.status})`);
      }

      setCsvSaveSuccess2(true);
      setTimeout(() => setCsvSaveSuccess2(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save Strategy 2 backtest ledger CSV: ${err.message}`);
    } finally {
      setCsvSaving2(false);
    }
  };

  const run30DayBacktest3 = async () => {
    setBacktest3Loading(true);
    setBacktest3Error(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/backtest-30d/strategy3?period=${backtestPeriod}`);
      if (!res.ok) {
        throw new Error(`Backtest Strategy 3 failed (Status ${res.status})`);
      }
      const data = await res.json();
      setBacktest3Result(data);
      setShowLedger3(true);
    } catch (err: any) {
      console.error(err);
      setBacktest3Error(err.message || "Failed to run Strategy 3 backtest.");
    } finally {
      setBacktest3Loading(false);
    }
  };

  const runOptionsBacktest = async () => {
    setBacktestOptionsLoading(true);
    setBacktestOptionsError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/backtest-30d/options?period=${backtestPeriod}&exit_mode=${optionsExitMode}`);
      if (!res.ok) {
        throw new Error(`Options Backtest failed (Status ${res.status})`);
      }
      const data = await res.json();
      setBacktestOptionsResult(data);
      setShowOptionsLedger(true);
    } catch (err: any) {
      console.error(err);
      setBacktestOptionsError(err.message || "Failed to run Options backtest.");
    } finally {
      setBacktestOptionsLoading(false);
    }
  };

  const saveBacktestLedgerCsv3 = async () => {
    if (!backtest3Result || !backtest3Result.trades || backtest3Result.trades.length === 0) return;

    setCsvSaving3(true);
    try {
      const headers = [
        "Screen Date",
        "Buy Date",
        "Sell Date",
        "Ticker",
        "Buy Price",
        "Sell Price",
        "Shares",
        "Profit",
        "Dow Return (%)",
        "S&P Return (%)",
        "Nasdaq Return (%)",
        "Daily Profit ($)",
        "Daily Profit (%)"
      ];

      const rows: string[] = [];
      backtest3Result.trades.forEach((day: any) => {
        const dowRet = (day.dow_return ?? 0.0).toFixed(2);
        const spRet = (day.sp_return ?? 0.0).toFixed(2);
        const ndxRet = (day.nasdaq_return ?? 0.0).toFixed(2);
        const dailyProfitPct = ((day.daily_profit / 10000.0) * 100.0).toFixed(2);

        if (!day.tickers || day.tickers.length === 0) {
          rows.push([
            day.screen_date,
            day.buy_date,
            day.sell_date,
            "N/A",
            "0",
            "0",
            "0",
            "0",
            dowRet,
            spRet,
            ndxRet,
            day.daily_profit.toFixed(2),
            dailyProfitPct
          ].map(v => `"${v}"`).join(","));
        } else {
          day.tickers.forEach((t: any) => {
            rows.push([
              day.screen_date,
              day.buy_date,
              day.sell_date,
              t.ticker,
              t.buy_price.toFixed(2),
              t.sell_price.toFixed(2),
              t.shares.toFixed(2),
              t.profit.toFixed(2),
              dowRet,
              spRet,
              ndxRet,
              day.daily_profit.toFixed(2),
              dailyProfitPct
            ].map(v => `"${v}"`).join(","));
          });
        }
      });

      const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n") + "\n";

      const res = await fetch(`${API_BASE_URL}/api/save_csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: 'Backtest_Ledger_Strategy3.csv',
          content: csvContent
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to save CSV (Status ${res.status})`);
      }

      setCsvSaveSuccess3(true);
      setTimeout(() => setCsvSaveSuccess3(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save Strategy 3 backtest ledger CSV: ${err.message}`);
    } finally {
      setCsvSaving3(false);
    }
  };

  const saveOptionsBacktestCsv = async () => {
    if (!backtestOptionsResult || !backtestOptionsResult.trades || backtestOptionsResult.trades.length === 0) return;

    setCsvSavingOptions(true);
    try {
      const headers = [
        "Screen Date",
        "Buy Date",
        "Sell Date",
        "Ticker",
        "Strike",
        "Expiry Date",
        "Underlying Entry",
        "Underlying Exit",
        "Underlying Move (%)",
        "Entry Premium",
        "Exit Premium",
        "Contracts",
        "Cost of Position",
        "Exit Value",
        "Option P&L ($)",
        "Leverage Multiple",
        "IV Used",
        "Dow Return (%)",
        "S&P Return (%)",
        "Nasdaq Return (%)",
        "Daily P&L ($)",
        "Daily P&L (%)"
      ];

      const rows: string[] = [];
      backtestOptionsResult.trades.forEach((day: any) => {
        const dowRet = (day.dow_return ?? 0.0).toFixed(2);
        const spRet = (day.sp_return ?? 0.0).toFixed(2);
        const ndxRet = (day.nasdaq_return ?? 0.0).toFixed(2);
        const dailyProfitPct = ((day.daily_profit / 10000.0) * 100.0).toFixed(2);

        if (!day.tickers || day.tickers.length === 0) {
          rows.push([
            day.screen_date, day.buy_date, day.sell_date,
            "N/A", "0", "N/A", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
            dowRet, spRet, ndxRet, day.daily_profit.toFixed(2), dailyProfitPct
          ].map(v => `"${v}"`).join(","));
        } else {
          day.tickers.forEach((t: any) => {
            rows.push([
              day.screen_date,
              day.buy_date,
              day.sell_date,
              t.ticker,
              t.strike.toFixed(2),
              t.expiry_date,
              t.underlying_entry.toFixed(2),
              t.underlying_exit.toFixed(2),
              t.underlying_pct_change.toFixed(2),
              t.entry_premium.toFixed(4),
              t.exit_premium.toFixed(4),
              t.contracts,
              t.cost_of_position.toFixed(2),
              t.exit_value.toFixed(2),
              t.profit.toFixed(2),
              t.leverage_multiple.toFixed(4),
              (t.iv_used * 100).toFixed(1) + "%",
              dowRet,
              spRet,
              ndxRet,
              day.daily_profit.toFixed(2),
              dailyProfitPct
            ].map(v => `"${v}"`).join(","));
          });
        }
      });

      const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\n") + "\n";

      const res = await fetch(`${API_BASE_URL}/api/save_csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'Backtest_Ledger_Options.csv', content: csvContent })
      });

      if (!res.ok) throw new Error(`Failed to save CSV (Status ${res.status})`);

      setCsvSaveSuccessOptions(true);
      setTimeout(() => setCsvSaveSuccessOptions(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save Options backtest ledger CSV: ${err.message}`);
    } finally {
      setCsvSavingOptions(false);
    }
  };

  // Filter global analysisData to only show tickers belonging to the selected indexes
  const filteredData = indexTickers.reduce((acc, ticker) => {
    if (analysisData[ticker]) {
      acc[ticker] = analysisData[ticker];
    }
    return acc;
  }, {} as Record<string, TickerAnalysis>);

  const activeIndexNames = selectedFiles
    .map(file => INDEXES.find(idx => idx.filename === file)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      {/* Index Selector Header */}
      <div className="flex flex-col gap-4 p-4 rounded-xl border bg-card/40 backdrop-blur-md shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Index Selection
            </h2>
            <p className="text-sm text-muted-foreground">
              Select one or more benchmark indexes to run comparative quantitative analyses on all combined components.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-fit">
            <div className="flex bg-muted/60 p-1.5 rounded-lg border gap-1.5">
              {INDEXES.map((idx) => {
                const isSelected = selectedFiles.includes(idx.filename);
                return (
                  <Button
                    key={idx.filename}
                    variant={isSelected ? 'secondary' : 'ghost'}
                    onClick={() => {
                      setSelectedFiles(prev => {
                        if (prev.includes(idx.filename)) {
                          // Keep at least one selected to avoid empty views
                          if (prev.length === 1) return prev;
                          return prev.filter(f => f !== idx.filename);
                        } else {
                          return [...prev, idx.filename];
                        }
                      });
                    }}
                    size="sm"
                    className={`rounded-md font-semibold px-4 transition-all flex items-center gap-1.5 ${isSelected
                        ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm hover:bg-primary/30'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    {idx.name}
                  </Button>
                );
              })}
            </div>

            {!loadingTickers && !loadingAnalysis && indexTickers.length > 0 && (
              <Button
                onClick={runScreen}
                size="sm"
                variant="outline"
                className="rounded-md border-primary/30 hover:bg-primary/10 text-primary font-bold px-4 shadow-sm"
              >
                Run Buy Screen
              </Button>
            )}
          </div>
        </div>

        {/* Strategy Backtesting Controls */}
        {indexTickers.length > 0 && (
          <div className="border-t pt-3 mt-1 border-muted-foreground/10 space-y-3">
            {/* Timeframe Selector */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/30 p-2 rounded-lg border border-muted-foreground/10">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Strategy Backtest Timeframe:
              </span>
              <div className="flex bg-muted/80 p-1 rounded-md border gap-1">
                {[
                  { label: '1 Wk', value: '1w' },
                  { label: '1 Mo', value: '1m' },
                  { label: '3 Mo', value: '3m' },
                  { label: '6 Mo', value: '6m' },
                  { label: '1 Yr', value: '1y' }
                ].map((tf) => (
                  <Button
                    key={tf.value}
                    variant={backtestPeriod === tf.value ? 'secondary' : 'ghost'}
                    onClick={() => setBacktestPeriod(tf.value as any)}
                    size="sm"
                    className={`h-7 px-3 text-xs font-bold rounded-sm transition-all ${backtestPeriod === tf.value
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {tf.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Strategy 1 Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={run30DayBacktest}
                  disabled={backtestLoading}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-sm w-full sm:w-auto"
                >
                  {backtestLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {backtestLoading ? "Running Backtest..." : `Run ${backtestPeriod.toUpperCase()} Strategy 1 Backtest`}
                </Button>
                <span className="text-sm font-semibold text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                  <span>
                    Total Profit:{" "}
                    <span className={backtestResult ? (backtestResult.total_profit >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                      ${backtestResult ? backtestResult.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </span>{" "}
                    (
                    <span className={backtestResult ? (backtestResult.roi_pct >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                      {backtestResult ? backtestResult.roi_pct.toFixed(2) : "0.00"}%
                    </span>
                    )
                  </span>
                  {backtestResult && backtestResult.sp500_pct_change !== undefined && (
                    <span className="text-xs border-l pl-2 border-muted-foreground/30 font-normal">
                      S&P 500:{" "}
                      <span className={backtestResult.sp500_pct_change >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                        {backtestResult.sp500_pct_change >= 0 ? "+" : ""}{backtestResult.sp500_pct_change.toFixed(2)}%
                      </span>
                    </span>
                  )}
                </span>
              </div>
              {backtestResult && (
                <Button
                  variant="ghost"
                  onClick={() => setShowLedger(!showLedger)}
                  size="sm"
                  className="rounded-md font-semibold text-primary hover:bg-primary/10 self-end sm:self-auto"
                >
                  {showLedger ? "Hide Trade Ledger" : "Show Trade Ledger"}
                </Button>
              )}
            </div>

            {/* Strategy 2 Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-muted-foreground/5">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={run30DayBacktest2}
                  disabled={backtest2Loading}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-sm w-full sm:w-auto"
                >
                  {backtest2Loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {backtest2Loading ? "Running Backtest..." : `Run ${backtestPeriod.toUpperCase()} Strategy 2 Backtest`}
                </Button>
                <span className="text-sm font-semibold text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                  <span>
                    ROI:{" "}
                    <span className={backtest2Result ? (backtest2Result.total_profit >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                      {backtest2Result ? (backtest2Result.total_profit >= 0 ? "+" : "-") : ""}${backtest2Result ? Math.abs(backtest2Result.total_profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </span>{" "}
                    (
                    <span className={backtest2Result ? (backtest2Result.roi_pct >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                      {backtest2Result ? (backtest2Result.roi_pct >= 0 ? "+" : "-") : ""}{backtest2Result ? Math.abs(backtest2Result.roi_pct).toFixed(1) : "0.0"}%
                    </span>
                    )
                  </span>
                  {backtest2Result && backtest2Result.sp500_pct_change !== undefined && (
                    <span className="text-xs border-l pl-2 border-muted-foreground/30 font-normal">
                      S&P 500:{" "}
                      <span className={backtest2Result.sp500_pct_change >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                        {backtest2Result.sp500_pct_change >= 0 ? "+" : ""}{backtest2Result.sp500_pct_change.toFixed(2)}%
                      </span>
                    </span>
                  )}
                </span>
              </div>
              {backtest2Result && (
                <Button
                  variant="ghost"
                  onClick={() => setShowLedger2(!showLedger2)}
                  size="sm"
                  className="rounded-md font-semibold text-primary hover:bg-primary/10 self-end sm:self-auto"
                >
                  {showLedger2 ? "Hide Trade Ledger" : "Show Trade Ledger"}
                </Button>
              )}
            </div>

            {/* Strategy 3 Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-muted-foreground/5">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={run30DayBacktest3}
                  disabled={backtest3Loading}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-sm w-full sm:w-auto"
                >
                  {backtest3Loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {backtest3Loading ? "Running Backtest..." : `Run ${backtestPeriod.toUpperCase()} Strategy 3 Backtest`}
                </Button>
                <span className="text-sm font-semibold text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                  <span>
                    ROI:{" "}
                    <span className={backtest3Result ? (backtest3Result.total_profit >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                      {backtest3Result ? (backtest3Result.total_profit >= 0 ? "+" : "-") : ""}${backtest3Result ? Math.abs(backtest3Result.total_profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </span>{" "}
                    (
                    <span className={backtest3Result ? (backtest3Result.roi_pct >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                      {backtest3Result ? (backtest3Result.roi_pct >= 0 ? "+" : "-") : ""}{backtest3Result ? Math.abs(backtest3Result.roi_pct).toFixed(1) : "0.0"}%
                    </span>
                    )
                  </span>
                  {backtest3Result && backtest3Result.sp500_pct_change !== undefined && (
                    <span className="text-xs border-l pl-2 border-muted-foreground/30 font-normal">
                      S&P 500:{" "}
                      <span className={backtest3Result.sp500_pct_change >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                        {backtest3Result.sp500_pct_change >= 0 ? "+" : ""}{backtest3Result.sp500_pct_change.toFixed(2)}%
                      </span>
                    </span>
                  )}
                </span>
              </div>
              {backtest3Result && (
                <Button
                  variant="ghost"
                  onClick={() => setShowLedger3(!showLedger3)}
                  size="sm"
                  className="rounded-md font-semibold text-primary hover:bg-primary/10 self-end sm:self-auto"
                >
                  {showLedger3 ? "Hide Trade Ledger" : "Show Trade Ledger"}
                </Button>
              )}
            </div>

            {/* Options Strategy Row */}
            <div className="flex flex-col gap-2 pt-3 border-t-2 border-amber-500/20 mt-1">
              {/* Exit Mode Toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500/80 font-mono">Options Exit:</span>
                <div className="flex bg-muted/80 p-0.5 rounded-md border gap-0.5">
                  {[{ label: 'T+2 Intraday (BS)', value: 'intraday' }, { label: 'Hold to Expiry', value: 'expiry' }].map((mode) => (
                    <Button
                      key={mode.value}
                      variant={optionsExitMode === mode.value ? 'secondary' : 'ghost'}
                      onClick={() => setOptionsExitMode(mode.value as 'intraday' | 'expiry')}
                      size="sm"
                      className={`h-6 px-2.5 text-xs font-bold rounded-sm transition-all ${
                        optionsExitMode === mode.value
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode.label}
                    </Button>
                  ))}
                </div>
              </div>
              {/* Options run row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={runOptionsBacktest}
                    disabled={backtestOptionsLoading}
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-md shadow-sm w-full sm:w-auto"
                  >
                    {backtestOptionsLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    {backtestOptionsLoading ? "Running Options..." : `Run ${backtestPeriod.toUpperCase()} Options Backtest (Calls)`}
                  </Button>
                  <span className="text-sm font-semibold text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                    <span>
                      Options P&L:{" "}
                      <span className={backtestOptionsResult ? (backtestOptionsResult.total_profit >= 0 ? "text-amber-400 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                        {backtestOptionsResult ? (backtestOptionsResult.total_profit >= 0 ? "+" : "-") : ""}${backtestOptionsResult ? Math.abs(backtestOptionsResult.total_profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      </span>{" "}
                      (
                      <span className={backtestOptionsResult ? (backtestOptionsResult.roi_pct >= 0 ? "text-amber-400 font-bold" : "text-red-500 font-bold") : "text-muted-foreground"}>
                        {backtestOptionsResult ? (backtestOptionsResult.roi_pct >= 0 ? "+" : "-") : ""}{backtestOptionsResult ? Math.abs(backtestOptionsResult.roi_pct).toFixed(1) : "0.0"}%
                      </span>
                      )
                    </span>
                    {backtestOptionsResult && backtestOptionsResult.sp500_pct_change !== undefined && (
                      <span className="text-xs border-l pl-2 border-muted-foreground/30 font-normal">
                        S&P 500:{" "}
                        <span className={backtestOptionsResult.sp500_pct_change >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                          {backtestOptionsResult.sp500_pct_change >= 0 ? "+" : ""}{backtestOptionsResult.sp500_pct_change.toFixed(2)}%
                        </span>
                      </span>
                    )}
                    {backtestOptionsResult && (
                      <span className="text-xs border-l pl-2 border-muted-foreground/30 font-normal text-amber-500/80">
                        Mode: {backtestOptionsResult.exit_mode === 'expiry' ? 'Hold to Expiry' : 'T+2 Intraday'}
                      </span>
                    )}
                  </span>
                </div>
                {backtestOptionsResult && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowOptionsLedger(!showOptionsLedger)}
                    size="sm"
                    className="rounded-md font-semibold text-amber-500 hover:bg-amber-500/10 self-end sm:self-auto"
                  >
                    {showOptionsLedger ? "Hide Options Ledger" : "Show Options Ledger"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {backtestError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">{backtestError}</div>
        </div>
      )}

      {showLedger && backtestResult && (
        <div className="p-5 rounded-xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b pb-3 border-muted-foreground/10">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                30-Day Strategy 1 Backtest Trade Ledger
              </h3>
              <p className="text-xs text-muted-foreground">
                Chronological ledger of executed entries and exits based on the 10-Indicator Buy Screen (Top 5 Tickers ranked by 1-Wk Strategy Value).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={saveBacktestLedgerCsv}
                disabled={csvSaving}
                size="sm"
                className={`font-bold rounded-md shadow-sm transition-all duration-300 ${csvSaveSuccess
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
              >
                {csvSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {csvSaveSuccess ? 'Saved successfully!' : 'Save to Backtest_Ledger.csv'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowLedger(false)}
                size="sm"
                className="rounded-md"
              >
                Dismiss
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/70 sticky top-0 z-10 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 font-semibold border-b">Screen Date</th>
                  <th className="p-3 font-semibold border-b">Entry Date (3:00 PM)</th>
                  <th className="p-3 font-semibold border-b">Exit Date (11:00 AM)</th>
                  <th className="p-3 font-semibold border-b">Tickers Traded & Details</th>
                  <th className="p-3 font-semibold border-b text-right">Dow Jones 30</th>
                  <th className="p-3 font-semibold border-b text-right">S&P 500</th>
                  <th className="p-3 font-semibold border-b text-right">Nasdaq 100</th>
                  <th className="p-3 font-semibold border-b text-right">Daily Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backtestResult.trades.map((day: any, dIdx: number) => (
                  <tr key={dIdx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium font-mono">{day.screen_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.buy_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.sell_date}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {day.tickers.map((t: any, tIdx: number) => (
                          <div
                            key={tIdx}
                            className="text-xs p-2 rounded-md border bg-card/50 flex flex-col gap-0.5 shadow-xs"
                          >
                            <span className="font-bold text-primary">{t.ticker}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Buy: ${t.buy_price.toFixed(2)} | Sell: ${t.sell_price.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Shares: {t.shares.toFixed(2)}
                            </span>
                            <span className={`font-semibold font-mono ${t.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {day.tickers.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">No tickers matched screens on this day</span>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-right font-mono ${day.dow_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.dow_return >= 0 ? "+" : ""}{day.dow_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${day.sp_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.sp_return >= 0 ? "+" : ""}{day.sp_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${day.nasdaq_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.nasdaq_return >= 0 ? "+" : ""}{day.nasdaq_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${day.daily_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.daily_profit >= 0 ? "+" : ""}${day.daily_profit.toFixed(2)} ({day.daily_profit >= 0 ? "+" : ""}{((day.daily_profit / 10000.0) * 100.0).toFixed(2)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {backtest2Error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3 mt-4">
          <Info className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">{backtest2Error}</div>
        </div>
      )}

      {showLedger2 && backtest2Result && (
        <div className="p-5 rounded-xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b pb-3 border-muted-foreground/10">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                30-Day Strategy 2 Backtest Trade Ledger
              </h3>
              <p className="text-xs text-muted-foreground">
                Chronological ledger of executed entries and exits based on Strategy 2 (Willy Market == Bull, ranked by 1-Wk Strategy Value).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={saveBacktestLedgerCsv2}
                disabled={csvSaving2}
                size="sm"
                className={`font-bold rounded-md shadow-sm transition-all duration-300 ${csvSaveSuccess2
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
              >
                {csvSaving2 && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {csvSaveSuccess2 ? 'Saved successfully!' : 'Save to Backtest_Ledger.csv'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowLedger2(false)}
                size="sm"
                className="rounded-md"
              >
                Dismiss
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/70 sticky top-0 z-10 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 font-semibold border-b">Screen Date</th>
                  <th className="p-3 font-semibold border-b">Entry Date (3:00 PM)</th>
                  <th className="p-3 font-semibold border-b">Exit Date (11:00 AM)</th>
                  <th className="p-3 font-semibold border-b">Tickers Traded & Details</th>
                  <th className="p-3 font-semibold border-b text-right">Dow Jones 30</th>
                  <th className="p-3 font-semibold border-b text-right">S&P 500</th>
                  <th className="p-3 font-semibold border-b text-right">Nasdaq 100</th>
                  <th className="p-3 font-semibold border-b text-right">Daily Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backtest2Result.trades.map((day: any, dIdx: number) => (
                  <tr key={dIdx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium font-mono">{day.screen_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.buy_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.sell_date}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {day.tickers.map((t: any, tIdx: number) => (
                          <div
                            key={tIdx}
                            className="text-xs p-2 rounded-md border bg-card/50 flex flex-col gap-0.5 shadow-xs"
                          >
                            <span className="font-bold text-primary">{t.ticker}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Buy: ${t.buy_price.toFixed(2)} | Sell: ${t.sell_price.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Shares: {t.shares.toFixed(2)}
                            </span>
                            <span className={`font-semibold font-mono ${t.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {day.tickers.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">No tickers matched screens on this day</span>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-right font-mono ${day.dow_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.dow_return >= 0 ? "+" : ""}{day.dow_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${day.sp_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.sp_return >= 0 ? "+" : ""}{day.sp_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${day.nasdaq_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.nasdaq_return >= 0 ? "+" : ""}{day.nasdaq_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${day.daily_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.daily_profit >= 0 ? "+" : ""}${day.daily_profit.toFixed(2)} ({day.daily_profit >= 0 ? "+" : ""}{((day.daily_profit / 10000.0) * 100.0).toFixed(2)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {backtest3Error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3 mt-4">
          <Info className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">{backtest3Error}</div>
        </div>
      )}

      {showLedger3 && backtest3Result && (
        <div className="p-5 rounded-xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b pb-3 border-muted-foreground/10">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                30-Day Strategy 3 Backtest Trade Ledger
              </h3>
              <p className="text-xs text-muted-foreground">
                Chronological ledger of executed entries and exits based on Strategy 3 (Strategy 1 filters, exit at 2:50 PM on T+2).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={saveBacktestLedgerCsv3}
                disabled={csvSaving3}
                size="sm"
                className={`font-bold rounded-md shadow-sm transition-all duration-300 ${csvSaveSuccess3
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
              >
                {csvSaving3 && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {csvSaveSuccess3 ? 'Saved successfully!' : 'Save to Backtest_Ledger_Strategy3.csv'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowLedger3(false)}
                size="sm"
                className="rounded-md"
              >
                Dismiss
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/70 sticky top-0 z-10 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 font-semibold border-b">Screen Date</th>
                  <th className="p-3 font-semibold border-b">Entry Date (3:00 PM)</th>
                  <th className="p-3 font-semibold border-b">Exit Date (2:50 PM)</th>
                  <th className="p-3 font-semibold border-b">Tickers Traded & Details</th>
                  <th className="p-3 font-semibold border-b text-right">Dow Jones 30</th>
                  <th className="p-3 font-semibold border-b text-right">S&P 500</th>
                  <th className="p-3 font-semibold border-b text-right">Nasdaq 100</th>
                  <th className="p-3 font-semibold border-b text-right">Daily Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backtest3Result.trades.map((day: any, dIdx: number) => (
                  <tr key={dIdx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium font-mono">{day.screen_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.buy_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.sell_date}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {day.tickers.map((t: any, tIdx: number) => (
                          <div
                            key={tIdx}
                            className="text-xs p-2 rounded-md border bg-card/50 flex flex-col gap-0.5 shadow-xs"
                          >
                            <span className="font-bold text-primary">{t.ticker}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Buy: ${t.buy_price.toFixed(2)} | Sell: ${t.sell_price.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Shares: {t.shares.toFixed(2)}
                            </span>
                            <span className={`font-semibold font-mono ${t.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {t.profit >= 0 ? "+" : ""}${t.profit.toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {day.tickers.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">No tickers matched screens on this day</span>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-right font-mono ${day.dow_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.dow_return >= 0 ? "+" : ""}{day.dow_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${day.sp_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.sp_return >= 0 ? "+" : ""}{day.sp_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${day.nasdaq_return >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.nasdaq_return >= 0 ? "+" : ""}{day.nasdaq_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${day.daily_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {day.daily_profit >= 0 ? "+" : ""}${day.daily_profit.toFixed(2)} ({day.daily_profit >= 0 ? "+" : ""}{((day.daily_profit / 10000.0) * 100.0).toFixed(2)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {backtestOptionsError && (
        <div className="bg-amber-500/10 text-amber-400 border border-amber-500/20 p-4 rounded-lg flex items-start gap-3 mt-4">
          <Info className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">{backtestOptionsError}</div>
        </div>
      )}

      {showOptionsLedger && backtestOptionsResult && (
        <div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md shadow-sm space-y-4 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b pb-3 border-amber-500/20">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2 text-amber-400">
                <Check className="w-5 h-5 text-amber-400" />
                Options Backtest Ledger — ATM Weekly Calls
              </h3>
              <p className="text-xs text-muted-foreground">
                Black-Scholes synthetic pricing. Same Strategy 1 screening (5 filters). $2,000/position. Exit mode:{" "}
                <span className="font-bold text-amber-500">
                  {backtestOptionsResult.exit_mode === 'expiry' ? 'Hold to weekly expiry (intrinsic value at T+7)' : 'Intraday T+2 11:00 AM (BS re-priced)'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={saveOptionsBacktestCsv}
                disabled={csvSavingOptions}
                size="sm"
                className={`font-bold rounded-md shadow-sm transition-all duration-300 ${
                  csvSaveSuccessOptions
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                {csvSavingOptions && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {csvSaveSuccessOptions ? 'Saved!' : 'Save to Backtest_Ledger_Options.csv'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowOptionsLedger(false)}
                size="sm"
                className="rounded-md"
              >
                Dismiss
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-lg border border-amber-500/20">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-amber-500/10 sticky top-0 z-10 text-xs uppercase text-amber-400/80">
                <tr>
                  <th className="p-3 font-semibold border-b border-amber-500/20">Screen Date</th>
                  <th className="p-3 font-semibold border-b border-amber-500/20">Entry Date</th>
                  <th className="p-3 font-semibold border-b border-amber-500/20">Exit Date</th>
                  <th className="p-3 font-semibold border-b border-amber-500/20">Options Traded</th>
                  <th className="p-3 font-semibold border-b border-amber-500/20 text-right">Dow</th>
                  <th className="p-3 font-semibold border-b border-amber-500/20 text-right">S&P</th>
                  <th className="p-3 font-semibold border-b border-amber-500/20 text-right">Nasdaq</th>
                  <th className="p-3 font-semibold border-b border-amber-500/20 text-right">Daily P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backtestOptionsResult.trades.map((day: any, dIdx: number) => (
                  <tr key={dIdx} className="hover:bg-amber-500/5 transition-colors">
                    <td className="p-3 font-medium font-mono">{day.screen_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.buy_date}</td>
                    <td className="p-3 font-mono text-muted-foreground">{day.sell_date}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {day.tickers && day.tickers.map((t: any, tIdx: number) => (
                          <div
                            key={tIdx}
                            className="text-xs p-2 rounded-md border border-amber-500/20 bg-amber-500/5 flex flex-col gap-0.5 shadow-xs min-w-[120px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-amber-400">{t.ticker}</span>
                              <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded font-mono">
                                ${t.strike} C
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Exp: {t.expiry_date}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Prem: ${t.entry_premium.toFixed(2)} → ${t.exit_premium.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t.contracts}x contracts · IV: {(t.iv_used * 100).toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Stock: {t.underlying_pct_change >= 0 ? '+' : ''}{t.underlying_pct_change.toFixed(2)}%
                            </span>
                            <span className={`font-semibold font-mono text-xs ${
                              t.profit >= 0 ? 'text-amber-400' : 'text-red-500'
                            }`}>
                              {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                              {' '}({t.leverage_multiple >= 0 ? '+' : ''}{(t.leverage_multiple * 100).toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                        {(!day.tickers || day.tickers.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">No options traded on this day</span>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-right font-mono ${
                      day.dow_return >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {day.dow_return >= 0 ? '+' : ''}{day.dow_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${
                      day.sp_return >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {day.sp_return >= 0 ? '+' : ''}{day.sp_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono ${
                      day.nasdaq_return >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {day.nasdaq_return >= 0 ? '+' : ''}{day.nasdaq_return.toFixed(2)}%
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${
                      day.daily_profit >= 0 ? 'text-amber-400' : 'text-red-500'
                    }`}>
                      {day.daily_profit >= 0 ? '+' : ''}${day.daily_profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {screenRun && (
        <div className="p-5 rounded-xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                Buy Screen Results
              </h3>
              <p className="text-xs text-muted-foreground">
                Screened {indexTickers.length} tickers using Willy Bull, 1-wk Backtest &gt; $10k, MACD Hist |0.5|, MACD Slope &gt; 0, and RSI (30-70).
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                onClick={saveScreenedTickers}
                disabled={screenedTickers.length === 0 || screenSaveStatus === 'saving'}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-md shadow-sm"
              >
                {screenSaveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {screenSaveStatus === 'saved' ? 'Saved successfully!' : 'Save to Top_Tickers_to_buy.csv'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setScreenRun(false);
                  setScreenSaveStatus('idle');
                }}
                size="sm"
                className="rounded-md"
              >
                Dismiss
              </Button>
            </div>
          </div>

          {screenedTickers.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {screenedTickers.map(ticker => (
                <span
                  key={ticker}
                  className="px-2.5 py-1 rounded-md text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20"
                >
                  {ticker}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic pt-1">
              No tickers matched all 5 quantitative screen criteria.
            </p>
          )}

          {screenSaveStatus === 'saved' && (
            <div className="text-xs font-semibold text-green-500 flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 p-2.5 rounded-lg w-fit">
              <Check className="w-4 h-4" />
              Saved to Top_Tickers_to_buy.csv & dispatched email to modernkris@gmail.com!
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Loading Progress State */}
      {(loadingTickers || loadingAnalysis) && (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-card/25 backdrop-blur-sm space-y-4 min-h-[400px]">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-lg">
              Analyzing Combined Indexes ({activeIndexNames})...
            </h3>
            <p className="text-sm text-muted-foreground">
              Processed {progress.current} of {progress.total} tickers
            </p>
          </div>
          <div className="w-64 bg-muted h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 ease-out"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground max-w-sm text-center">
            Stocks are analyzed in consecutive batch chunks to prevent server timeouts. Existing cache is automatically reused.
          </span>
        </div>
      )}

      {/* Comparison Grid */}
      {!loadingTickers && !loadingAnalysis && Object.keys(filteredData).length > 0 && (
        <div className="h-[calc(100vh-250px)] min-h-[950px]">
          <ComparisonTable analysisData={filteredData} />
        </div>
      )}

      {!loadingTickers && !loadingAnalysis && Object.keys(filteredData).length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-card/25 backdrop-blur-sm min-h-[300px] text-muted-foreground">
          No tickers available to display. Please select at least one index above.
        </div>
      )}
    </div>
  );
}
