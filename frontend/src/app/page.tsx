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
import { PaperStudyPanel } from '@/components/PaperStudyPanel';
import { BrokersPanel } from '@/components/BrokersPanel';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { BxTrenderPanel } from '@/components/BxTrenderPanel';
import { TickerAnalysis } from '@/lib/types';
import { Loader2, LayoutGrid, TableProperties, Database, BookOpen, LineChart, TrendingUp, BarChart2, ClipboardList, Landmark, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/api';

export default function Dashboard() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<Record<string, TickerAnalysis>>({});
  const [viewMode, setViewMode] = useState<'dashboard' | 'table' | 'technical' | 'raw-data' | 'glossary' | 'normalized-compare' | 'advanced-charts' | 'paper-study' | 'brokers' | 'analysis' | 'bx'>('dashboard');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Lifted state for Compare Charts to persist across tab changes
  const [compareSelectedTickers, setCompareSelectedTickers] = useState<string[]>([]);
  const [comparePeriod, setComparePeriod] = useState<string>('1y');
  const [portfolioFilename, setPortfolioFilename] = useState<string>('portfolio.csv');

  const loadPortfolioTickers = async (filename: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/portfolio?filename=${filename}`);
      if (res.ok) {
        const data = await res.json();
        if (data.tickers) {
          const uniqueTickers = Array.from(new Set(data.tickers as string[])).slice(0, 100);
          setTickers(uniqueTickers);
          if (uniqueTickers.length > 0) {
            setSelectedTicker(uniqueTickers[0]);
          } else {
            setSelectedTicker(null);
          }
          setPortfolioFilename(filename);
          localStorage.setItem('ag_portfolio_filename', filename);
        }
      } else {
        const errData = await res.json();
        setError(`Failed to load portfolio ${filename}: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Failed to fetch portfolio tickers", err);
      setError("Network error while loading portfolio.");
    } finally {
      setLoading(false);
    }
  };

  // 1. Fetch initial portfolio tickers on mount
  useEffect(() => {
    const savedFilename = localStorage.getItem('ag_portfolio_filename') || 'portfolio.csv';
    loadPortfolioTickers(savedFilename);
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
        const res = await fetch(`${API_BASE_URL}/api/analyze-batch?tickers=${tickersParam}`);
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
        portfolioFilename={portfolioFilename}
        onLoadPortfolio={loadPortfolioTickers}
      />

      <main className="flex-1 p-6 overflow-y-auto w-full">
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6 font-medium">
            Error: {error}
          </div>
        )}

        {!selectedTicker ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <h2 className="text-2xl font-semibold mb-2 text-foreground">Welcome to Strategic Alpha <span className="text-sm font-mono text-muted-foreground ml-2">v20260608</span></h2>
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
                  {viewMode === 'paper-study' && 'Paper Trading Log'}
                  {viewMode === 'brokers' && 'Broker Management'}
                  {viewMode === 'analysis' && 'Portfolio Technical Analysis'}
                  {viewMode === 'bx' && `${currentData.symbol} BX Trender Analysis`}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {viewMode === 'dashboard' && 'Comprehensive Strategy Breakdown & AI Analysis'}
                  {viewMode === 'table' && 'Compare quant metrics across all loaded stocks'}
                  {viewMode === 'normalized-compare' && 'Visualize relative growth on a level playing field, indexing all selected assets to a baseline of 100.'}
                  {viewMode === 'technical' && 'Price action, momentum, moving averages, and volume data'}
                  {viewMode === 'advanced-charts' && 'Deep dive into MACD, Relative Strength, and trend alignment across varying moving averages.'}
                  {viewMode === 'raw-data' && 'Unfiltered metrics and detailed company statistics'}
                  {viewMode === 'glossary' && 'Learn how the 10 quantitative strategies and ML engine operate'}
                  {viewMode === 'paper-study' && 'Log simulated stock transactions and review your trading history'}
                  {viewMode === 'brokers' && 'Manage Interactive Brokers connection and view real-time portfolio data'}
                  {viewMode === 'analysis' && 'Willy VWAP dynamics, 2.0 ATR volatility boundaries, and high-precision visual summaries.'}
                  {viewMode === 'bx' && 'Dual-momentum oscillator calculations, short-term spreads, long-term background histograms, and automated crossover logs.'}
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
                <Button variant={viewMode === 'paper-study' ? 'secondary' : 'ghost'} onClick={() => setViewMode('paper-study')} size="sm" className="rounded-md">
                  <ClipboardList className="w-4 h-4 mr-2" /> Paper Study
                </Button>
                <Button variant={viewMode === 'brokers' ? 'secondary' : 'ghost'} onClick={() => setViewMode('brokers')} size="sm" className="rounded-md">
                  <Landmark className="w-4 h-4 mr-2" /> Brokers
                </Button>
                <Button variant={viewMode === 'analysis' ? 'secondary' : 'ghost'} onClick={() => setViewMode('analysis')} size="sm" className="rounded-md">
                  <FileText className="w-4 h-4 mr-2" /> Analysis
                </Button>
                <Button variant={viewMode === 'bx' ? 'secondary' : 'ghost'} onClick={() => setViewMode('bx')} size="sm" className="rounded-md">
                  <TrendingUp className="w-4 h-4 mr-2" /> BX Trender
                </Button>
              </div>
            </div>

            {viewMode === 'table' && (
              <div className="h-[calc(100vh-190px)] min-h-[1050px] mt-2">
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

            {viewMode === 'paper-study' && (
              <div className="mt-2">
                <PaperStudyPanel />
              </div>
            )}

            {viewMode === 'brokers' && (
              <div className="mt-2">
                <BrokersPanel />
              </div>
            )}

            {viewMode === 'analysis' && (
              <div className="mt-2">
                <AnalysisPanel />
              </div>
            )}

            {viewMode === 'bx' && (
              <div className="mt-2">
                <BxTrenderPanel priceHistory={currentData.price_history || []} symbol={currentData.symbol} />
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
