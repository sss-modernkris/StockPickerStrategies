"use client";

import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { TickerAnalysis } from '@/lib/types';
import { ComparisonTable } from './ComparisonTable';
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

  // Use a ref to keep track of the active request combination key to prevent race conditions/overlapping states
  const activeFilesKeyRef = useRef<string>(selectedFiles.sort().join(','));

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/40 backdrop-blur-md shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Index Selection
          </h2>
          <p className="text-sm text-muted-foreground">
            Select one or more benchmark indexes to run comparative quantitative analyses on all combined components.
          </p>
        </div>

        <div className="flex bg-muted/60 p-1.5 rounded-lg border w-fit gap-1.5">
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
                className={`rounded-md font-semibold px-4 transition-all flex items-center gap-1.5 ${
                  isSelected 
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
      </div>

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
