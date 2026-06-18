"use client";

import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { TickerAnalysis } from '@/lib/types';
import { ComparisonTable } from './ComparisonTable';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Info } from 'lucide-react';

interface TopTickersPanelProps {
  analysisData: Record<string, TickerAnalysis>;
  onUpdateAnalysisData: React.Dispatch<React.SetStateAction<Record<string, TickerAnalysis>>>;
}

const INDEXES = [
  { name: 'Dow 30', filename: 'DOW100.csv', displayName: 'Dow Jones 30' },
  { name: 'Nasdaq 100', filename: 'Nasdaq100.csv', displayName: 'Nasdaq 100' },
  { name: 'S&P 100', filename: 'SP100.csv', displayName: 'S&P 100' }
];

export function TopTickersPanel({ analysisData, onUpdateAnalysisData }: TopTickersPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string>('DOW100.csv');
  const [indexTickers, setIndexTickers] = useState<string[]>([]);
  const [loadingTickers, setLoadingTickers] = useState<boolean>(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Use a ref to keep track of the active request file to prevent race conditions/overlapping states
  const activeFileRef = useRef<string>(selectedFile);

  // 1. Load the list of tickers for the selected index
  useEffect(() => {
    activeFileRef.current = selectedFile;
    setIndexTickers([]);
    setLoadingTickers(true);
    setLoadingAnalysis(false);
    setError(null);
    setProgress({ current: 0, total: 0 });

    const fetchIndexTickers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/portfolio?filename=${selectedFile}`);
        if (!res.ok) {
          throw new Error(`Failed to load index portfolio file: ${selectedFile}`);
        }
        const data = await res.json();
        
        // Ensure we only process if this is still the active file
        if (activeFileRef.current !== selectedFile) return;

        if (data.tickers && data.tickers.length > 0) {
          const uniqueTickers = Array.from(new Set(data.tickers as string[]));
          setIndexTickers(uniqueTickers);
        } else {
          setIndexTickers([]);
          setLoadingTickers(false);
        }
      } catch (err: any) {
        if (activeFileRef.current !== selectedFile) return;
        setError(err.message || "Failed to load index tickers.");
        setLoadingTickers(false);
      }
    };

    fetchIndexTickers();
  }, [selectedFile]);

  // 2. Fetch analysis data in small chunks (e.g., 10 tickers) to avoid server timeout and heavy loads
  useEffect(() => {
    if (indexTickers.length === 0) return;

    const unfetched = indexTickers.filter(t => !analysisData[t]);
    const totalCount = indexTickers.length;
    const fetchedCount = totalCount - unfetched.length;

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
        if (!isSubscribed || activeFileRef.current !== selectedFile) break;

        try {
          const tickersParam = chunk.join(',');
          const res = await fetch(`${API_BASE_URL}/api/analyze-batch?tickers=${tickersParam}`);
          if (!res.ok) {
            throw new Error(`Batch analysis failed (Status ${res.status})`);
          }
          const data = await res.json();

          if (!isSubscribed || activeFileRef.current !== selectedFile) break;

          onUpdateAnalysisData(prev => ({
            ...prev,
            ...data
          }));

          currentProgress += chunk.length;
          setProgress({ current: currentProgress, total: totalCount });
        } catch (err: any) {
          console.error("Error fetching chunk:", err);
          // Don't completely halt, but record the error state if major
          if (isSubscribed && activeFileRef.current === selectedFile) {
            setError(`Warning: Some tickers failed to analyze. Details: ${err.message}`);
          }
        }
      }

      if (isSubscribed && activeFileRef.current === selectedFile) {
        setLoadingTickers(false);
        setLoadingAnalysis(false);
      }
    };

    fetchInChunks();

    return () => {
      isSubscribed = false;
    };
  }, [indexTickers, selectedFile, onUpdateAnalysisData, analysisData]);

  // Filter global analysisData to only show tickers belonging to the selected index
  const filteredData = indexTickers.reduce((acc, ticker) => {
    if (analysisData[ticker]) {
      acc[ticker] = analysisData[ticker];
    }
    return acc;
  }, {} as Record<string, TickerAnalysis>);

  const activeIndex = INDEXES.find(idx => idx.filename === selectedFile);

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
            Select a benchmark index to run comparative quantitative analyses on all components.
          </p>
        </div>

        <div className="flex bg-muted/60 p-1 rounded-lg border w-fit">
          {INDEXES.map((idx) => (
            <Button
              key={idx.filename}
              variant={selectedFile === idx.filename ? 'secondary' : 'ghost'}
              onClick={() => setSelectedFile(idx.filename)}
              size="sm"
              className="rounded-md font-medium px-4"
            >
              {idx.name}
            </Button>
          ))}
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
              Analyzing {activeIndex?.displayName}...
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
            Stocks are analyzed in consecutive batch chunks to prevent server time-outs. Existing cache is automatically reused.
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
          No tickers available to display.
        </div>
      )}
    </div>
  );
}
