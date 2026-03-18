"use client";

import React, { useState, useEffect } from 'react';
import { TickerSidebar } from '@/components/TickerSidebar';
import { StrategyScorecards } from '@/components/StrategyScorecards';
import { JustificationEngine } from '@/components/JustificationEngine';
import { StrategyCharts } from '@/components/StrategyCharts';
import { ComparisonTable } from '@/components/ComparisonTable';
import { RawDataPanel } from '@/components/RawDataPanel';
import { StrategyGlossary } from '@/components/StrategyGlossary';
import { TechnicalIndicatorsCard } from '@/components/TechnicalIndicatorsCard';
import { NormalizedComparePanel } from '@/components/NormalizedComparePanel';
import { AdvancedChartsPanel } from '@/components/AdvancedChartsPanel';
import { TickerAnalysis } from '@/lib/types';
import { Loader2, LayoutGrid, TableProperties, Database, BookOpen, LineChart, TrendingUp, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<Record<string, TickerAnalysis>>({});
  const [viewMode, setViewMode] = useState<'dashboard' | 'table' | 'technical' | 'raw-data' | 'glossary' | 'normalized-compare' | 'advanced-charts'>('dashboard');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Lifted state for Compare Charts to persist across tab changes
  const [compareSelectedTickers, setCompareSelectedTickers] = useState<string[]>([]);
  const [comparePeriod, setComparePeriod] = useState<string>('1y');

  // 1. Fetch initial portfolio tickers on mount
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const res = await fetch(`http://localhost:8001/api/portfolio`);
        if (res.ok) {
          const data = await res.json();
          if (data.tickers && data.tickers.length > 0) {
            // Take up to 100 unique tickers
            const uniqueTickers = Array.from(new Set(data.tickers as string[])).slice(0, 100);
            setTickers(uniqueTickers);
            setSelectedTicker(uniqueTickers[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch portfolio tickers", err);
      }
    };
    fetchPortfolio();
  }, []);

  // 2. Fetch all analysis data in a single batch as soon as tickers are loaded
  useEffect(() => {
    // Only run if we have tickers and haven't fetched them yet
    const unfetchedTickers = tickers.filter(t => !analysisData[t]);
    if (unfetchedTickers.length === 0) return;

    const fetchBatchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const tickersParam = unfetchedTickers.join(',');
        const res = await fetch(`http://localhost:8001/api/analyze-batch?tickers=${tickersParam}`);
        if (!res.ok) {
          throw new Error(`Failed to batch fetch from backend (Status ${res.status})`);
        }

        const data: Record<string, TickerAnalysis> = await res.json();

        // Merge the new batch data into our existing dictionary
        setAnalysisData(prev => ({ ...prev, ...data }));

      } catch (err: unknown) {
        console.error("Batch fetch error:", err);
        const message = err instanceof Error ? err.message : "An unexpected error occurred during batch fetch.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchBatchAnalysis();
  }, [tickers, analysisData]);

  const handleAddTicker = (ticker: string) => {
    if (!tickers.includes(ticker)) {
      setTickers([...tickers, ticker]);
      setSelectedTicker(ticker); // Auto select added
    }
  };

  const handleRemoveTicker = (ticker: string) => {
    const newTickers = tickers.filter(t => t !== ticker);
    setTickers(newTickers);
    if (selectedTicker === ticker) {
      setSelectedTicker(newTickers.length > 0 ? newTickers[0] : null);
    }
    // Also remove from compare charts if present
    setCompareSelectedTickers(prev => prev.filter(t => t !== ticker));
  };

  const currentData = selectedTicker ? analysisData[selectedTicker] : null;

  const filteredAnalysisData = Object.keys(analysisData)
    .filter(ticker => tickers.includes(ticker))
    .reduce((obj, ticker) => {
      obj[ticker] = analysisData[ticker];
      return obj;
    }, {} as Record<string, TickerAnalysis>);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <TickerSidebar
        tickers={tickers}
        selectedTicker={selectedTicker}
        onAddTicker={handleAddTicker}
        onRemoveTicker={handleRemoveTicker}
        onSelectTicker={setSelectedTicker}
      />

      <main className="flex-1 p-6 overflow-y-auto w-full">
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6 font-medium">
            Error: {error}
          </div>
        )}

        {!selectedTicker ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <h2 className="text-2xl font-semibold mb-2 text-foreground">Welcome to Strategic Alpha</h2>
            <p>Add and select a ticker from the sidebar to view quant analysis.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-primary">
            <Loader2 className="w-12 h-12 animate-spin" />
            <p className="font-medium animate-pulse">Running Batch Quant Models for {tickers.length} stocks...</p>
            <p className="text-sm text-muted-foreground">This performs deep calculations and may take up to 30 seconds.</p>
          </div>
        ) : currentData ? (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {viewMode === 'dashboard' && currentData.symbol}
                  {viewMode === 'table' && 'Comparison Table'}
                  {viewMode === 'normalized-compare' && 'Relative Performance Analytics'}
                  {viewMode === 'technical' && `${currentData.symbol} Technical Indicators`}
                  {viewMode === 'advanced-charts' && `${currentData.symbol} Advanced Charts`}
                  {viewMode === 'raw-data' && `${currentData.symbol} Raw Data`}
                  {viewMode === 'glossary' && 'Methodology & Glossary'}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {viewMode === 'dashboard' && 'Comprehensive Strategy Breakdown & AI Analysis'}
                  {viewMode === 'table' && 'Compare quant metrics across all loaded stocks'}
                  {viewMode === 'normalized-compare' && 'Visualize relative growth on a level playing field, indexing all selected assets to a baseline of 100.'}
                  {viewMode === 'technical' && 'Price action, momentum, moving averages, and volume data'}
                  {viewMode === 'advanced-charts' && 'Deep dive into MACD, Relative Strength, and trend alignment across varying moving averages.'}
                  {viewMode === 'raw-data' && 'Unfiltered metrics and detailed company statistics'}
                  {viewMode === 'glossary' && 'Learn how the 10 quantitative strategies and ML engine operate'}
                </p>
              </div>
              <div className="flex bg-muted/50 p-1 rounded-lg border">
                <Button variant={viewMode === 'dashboard' ? 'secondary' : 'ghost'} onClick={() => setViewMode('dashboard')} size="sm" className="rounded-md">
                  <LayoutGrid className="w-4 h-4 mr-2" /> Dashboard
                </Button>
                <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} onClick={() => setViewMode('table')} size="sm" className="rounded-md">
                  <TableProperties className="w-4 h-4 mr-2" /> Comparison
                </Button>
                <Button variant={viewMode === 'normalized-compare' ? 'secondary' : 'ghost'} onClick={() => setViewMode('normalized-compare')} size="sm" className="rounded-md">
                  <TrendingUp className="w-4 h-4 mr-2" /> Compare Charts
                </Button>
                <Button variant={viewMode === 'technical' ? 'secondary' : 'ghost'} onClick={() => setViewMode('technical')} size="sm" className="rounded-md">
                  <LineChart className="w-4 h-4 mr-2" /> Technicals
                </Button>
                <Button variant={viewMode === 'advanced-charts' ? 'secondary' : 'ghost'} onClick={() => setViewMode('advanced-charts')} size="sm" className="rounded-md">
                  <BarChart2 className="w-4 h-4 mr-2" /> Adv. Charts
                </Button>
                <Button variant={viewMode === 'raw-data' ? 'secondary' : 'ghost'} onClick={() => setViewMode('raw-data')} size="sm" className="rounded-md">
                  <Database className="w-4 h-4 mr-2" /> Raw Data
                </Button>
                <Button variant={viewMode === 'glossary' ? 'secondary' : 'ghost'} onClick={() => setViewMode('glossary')} size="sm" className="rounded-md">
                  <BookOpen className="w-4 h-4 mr-2" /> Glossary
                </Button>
              </div>
            </div>

            {viewMode === 'table' && (
              <div className="h-[800px] mt-2">
                <ComparisonTable analysisData={filteredAnalysisData} />
              </div>
            )}

            {viewMode === 'normalized-compare' && (
              <div className="mt-2">
                <NormalizedComparePanel
                  availableTickers={tickers}
                  selectedTickers={compareSelectedTickers}
                  onSelectTickers={setCompareSelectedTickers}
                  period={comparePeriod}
                  onPeriodChange={setComparePeriod}
                  analysisData={analysisData}
                />
              </div>
            )}

            {viewMode === 'dashboard' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-2">
                <div className="xl:col-span-2 space-y-6">
                  <StrategyScorecards
                    strategies={currentData.strategies}
                    alphaProbability={currentData.alpha_probability}
                    topFactor={currentData.top_factor}
                  />
                  <div className="h-[400px]">
                    <StrategyCharts
                      priceHistory={currentData.price_history}
                      symbol={currentData.symbol}
                    />
                  </div>
                </div>

                <div className="xl:col-span-1 h-[800px] xl:h-auto">
                  <JustificationEngine strategies={currentData.strategies} />
                </div>
              </div>
            )}

            {viewMode === 'technical' && (
              <div className="mt-2">
                <TechnicalIndicatorsCard data={currentData.technical_indicators} />
              </div>
            )}

            {viewMode === 'advanced-charts' && (
              <div className="mt-2">
                <AdvancedChartsPanel data={currentData.price_history || []} symbol={currentData.symbol} />
              </div>
            )}

            {viewMode === 'raw-data' && currentData.raw_data && (
              <div className="mt-2">
                <RawDataPanel rawData={currentData.raw_data} />
              </div>
            )}

            {viewMode === 'raw-data' && !currentData.raw_data && (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground mt-2 border rounded-lg bg-card border-dashed">
                Loading or no raw data available for this ticker.
              </div>
            )}

            {viewMode === 'glossary' && (
              <StrategyGlossary />
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
