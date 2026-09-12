"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VolatilityCalculationResponse } from '@/lib/types';
import { API_BASE_URL } from '@/lib/api';
import { Activity, Percent, TrendingUp, HelpCircle, ShieldAlert, Sparkles, RefreshCw, Calculator, DollarSign, Calendar, ArrowRightLeft, CheckCircle2, BarChart2, Layers, Droplets } from 'lucide-react';

interface Props {
  selectedTicker?: string | null;
  availableTickers?: string[];
}

export function VolatilityCalculatorPanel({ selectedTicker = 'SNDK', availableTickers = [] }: Props) {
  // Input States
  const [symbol, setSymbol] = useState<string>(selectedTicker || 'SNDK');
  const [stockPrice, setStockPrice] = useState<string>('1770');
  const [strikePrice, setStrikePrice] = useState<string>('1780');
  const [daysToExpiration, setDaysToExpiration] = useState<string>('30');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [inputMode, setInputMode] = useState<'single' | 'spread'>('spread');
  const [optionPremium, setOptionPremium] = useState<string>('89.08');
  const [bidPrice, setBidPrice] = useState<string>('87.00');
  const [askPrice, setAskPrice] = useState<string>('91.16');
  const [riskFreeRate, setRiskFreeRate] = useState<string>('4.0');
  const [dividendYield, setDividendYield] = useState<string>('0.0');
  const [optionVolume, setOptionVolume] = useState<string>('1450');
  const [openInterest, setOpenInterest] = useState<string>('8200');
  const [stockVolume, setStockVolume] = useState<string>('12500000');

  // Result States
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VolatilityCalculationResponse | null>(null);

  // Sync selected ticker when changed from sidebar
  useEffect(() => {
    if (selectedTicker) {
      setSymbol(selectedTicker.toUpperCase());
      fetchLiveTickerData(selectedTicker.toUpperCase());
    }
  }, [selectedTicker]);

  // Auto-calculate midpoint when bid or ask change in spread mode
  useEffect(() => {
    if (inputMode === 'spread') {
      const b = parseFloat(bidPrice);
      const a = parseFloat(askPrice);
      if (!isNaN(b) && !isNaN(a) && b > 0 && a > 0) {
        const mid = (b + a) / 2;
        setOptionPremium(mid.toFixed(2));
      }
    }
  }, [bidPrice, askPrice, inputMode]);

  const fetchLiveTickerData = async (targetSymbol: string) => {
    setLoading(true);
    setError(null);
    setOptionVolume('...');
    setOpenInterest('...');
    setStockVolume('...');
    try {
      const cleanSym = targetSymbol.trim().toUpperCase();
      const daysParam = parseInt(daysToExpiration) || 30;
      const res = await fetch(`${API_BASE_URL}/api/volatility-calculator/${cleanSym}?days_to_expiration=${daysParam}`);
      if (res.ok) {
        const data: VolatilityCalculationResponse = await res.json();
        setSymbol(data.symbol);
        if (data.stock_price) setStockPrice(data.stock_price.toFixed(2));
        if (data.strike_price) setStrikePrice(data.strike_price.toFixed(2));
        if (data.days_to_expiration) setDaysToExpiration(data.days_to_expiration.toString());
        if (data.bid_price !== null && data.bid_price !== undefined) {
          setBidPrice(data.bid_price.toFixed(2));
        }
        if (data.ask_price !== null && data.ask_price !== undefined) {
          setAskPrice(data.ask_price.toFixed(2));
        }
        if (data.option_premium) setOptionPremium(data.option_premium.toFixed(2));
        setOptionVolume(data.option_volume !== null && data.option_volume !== undefined ? data.option_volume.toString() : '0');
        setOpenInterest(data.open_interest !== null && data.open_interest !== undefined ? data.open_interest.toString() : '0');
        setStockVolume(data.stock_volume !== null && data.stock_volume !== undefined ? data.stock_volume.toString() : '0');
        setResult(data);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to fetch ticker volatility analytics');
      }
    } catch (err: unknown) {
      console.error('Fetch live ticker data error:', err);
      const msg = err instanceof Error ? err.message : 'Error fetching live ticker analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = parseFloat(stockPrice) || 100;
      const k = parseFloat(strikePrice) || s;
      const prem = parseFloat(optionPremium) || 5;
      const bid = inputMode === 'spread' ? (parseFloat(bidPrice) || null) : null;
      const ask = inputMode === 'spread' ? (parseFloat(askPrice) || null) : null;
      const days = parseInt(daysToExpiration) || 30;
      const r = (parseFloat(riskFreeRate) || 4.0) / 100.0;
      const q = (parseFloat(dividendYield) || 0.0) / 100.0;
      const optVol = parseInt(optionVolume) || null;
      const oiVal = parseInt(openInterest) || null;
      const stkVol = parseInt(stockVolume) || null;

      const payload = {
        symbol: symbol.toUpperCase(),
        stock_price: s,
        strike_price: k,
        option_premium: prem,
        bid_price: bid,
        ask_price: ask,
        expiration_date: expirationDate || null,
        days_to_expiration: days,
        risk_free_rate: r,
        dividend_yield: q,
        option_volume: optVol,
        open_interest: oiVal,
        stock_volume: stkVol,
      };

      const res = await fetch(`${API_BASE_URL}/api/volatility-calculator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to calculate volatility');
      }

      const data: VolatilityCalculationResponse = await res.json();
      setResult(data);
    } catch (err: unknown) {
      console.error('Volatility calculation error:', err);
      const msg = err instanceof Error ? err.message : 'Calculation error occurred.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTickerData(selectedTicker || 'SNDK');
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-background to-purple-950/30 p-6 rounded-xl border border-border/60 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-6 h-6 text-blue-400 animate-pulse" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              20-Day Historical & Call Option Implied Volatility (IV) Calculator
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Invert Black-Scholes backward from market option premiums to extract exact Implied Volatility (IV), compute 20-day realized Historical Volatility (HV), evaluate Volatility Spread (IV - HV), and review Option Greeks.
          </p>
        </div>
        <Button onClick={handleCalculate} disabled={loading} className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md">
          {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
          Calculate IV & HV
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/15 border border-destructive/50 text-destructive p-4 rounded-lg font-medium text-sm flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Input Parameters Panel */}
      <Card className="bg-card/70 backdrop-blur-md border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Option Market & Volatility Inputs
            </CardTitle>
            <div className="flex items-center gap-2 bg-muted p-1 rounded-md text-xs">
              <button
                type="button"
                onClick={() => setInputMode('spread')}
                className={`px-3 py-1 rounded-sm font-medium transition-colors ${inputMode === 'spread' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
              >
                Bid / Ask Midpoint
              </button>
              <button
                type="button"
                onClick={() => setInputMode('single')}
                className={`px-3 py-1 rounded-sm font-medium transition-colors ${inputMode === 'single' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
              >
                Single Premium
              </button>
            </div>
          </div>
          <CardDescription className="text-xs">
            Enter stock price, call option premium (or bid/ask midpoint), strike price, and expiration parameters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ticker & Stock Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Stock Ticker</span>
                {availableTickers.length > 0 && <span className="text-[10px] text-blue-400 font-medium">Live Option Sync</span>}
              </label>
              <div className="flex gap-2">
                {availableTickers.length > 0 ? (
                  <select
                    value={symbol}
                    onChange={(e) => {
                      const sym = e.target.value.toUpperCase();
                      setSymbol(sym);
                      fetchLiveTickerData(sym);
                    }}
                    className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {!availableTickers.includes(symbol) && <option value={symbol}>{symbol}</option>}
                    {availableTickers.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchLiveTickerData(symbol);
                      }
                    }}
                    className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. SNDK"
                  />
                )}
                <Button variant="outline" size="sm" onClick={() => fetchLiveTickerData(symbol)} title="Fetch live stock & option prices">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Current Stock Price S */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Current Stock Price (S)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  step="any"
                  value={stockPrice}
                  onChange={(e) => setStockPrice(e.target.value)}
                  className="w-full bg-background border border-input rounded-md pl-7 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="1770.00"
                />
              </div>
            </div>

            {/* Strike Price K */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Strike Price (K)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  step="any"
                  value={strikePrice}
                  onChange={(e) => setStrikePrice(e.target.value)}
                  className="w-full bg-background border border-input rounded-md pl-7 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="1780.00"
                />
              </div>
            </div>

            {/* Days to Expiration T */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Expiration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="1095"
                value={daysToExpiration}
                onChange={(e) => setDaysToExpiration(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="30"
              />
            </div>

            {/* Option Premium Inputs */}
            {inputMode === 'spread' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Call Bid Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="any"
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      className="w-full bg-background border border-input rounded-md pl-7 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="87.00"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Call Ask Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="any"
                      value={askPrice}
                      onChange={(e) => setAskPrice(e.target.value)}
                      className="w-full bg-background border border-input rounded-md pl-7 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="91.16"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Midpoint Premium</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Auto-Calculated</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="any"
                      readOnly
                      value={optionPremium}
                      className="w-full bg-muted/60 border border-input rounded-md pl-7 pr-3 py-1.5 text-sm font-mono font-bold text-emerald-400"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Call Option Premium (C_market)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="any"
                    value={optionPremium}
                    onChange={(e) => setOptionPremium(e.target.value)}
                    className="w-full bg-background border border-input rounded-md pl-7 pr-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="89.08"
                  />
                </div>
              </div>
            )}

            {/* Rates */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Risk-Free Rate (r %)</label>
              <input
                type="number"
                step="0.1"
                value={riskFreeRate}
                onChange={(e) => setRiskFreeRate(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="4.0"
              />
            </div>

            {/* Option Volume */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5 text-blue-400" /> Option Volume
              </label>
              <input
                type="number"
                value={optionVolume}
                onChange={(e) => setOptionVolume(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="1450"
              />
            </div>

            {/* Open Interest (Option Liquidity) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Open Interest (OI)
              </label>
              <input
                type="number"
                value={openInterest}
                onChange={(e) => setOpenInterest(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="8200"
              />
            </div>

            {/* Stock 20D Avg Volume */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-emerald-400" /> Stock 20D Avg Volume
              </label>
              <input
                type="number"
                value={stockVolume}
                onChange={(e) => setStockVolume(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="12500000"
              />
            </div>

            {/* Liquidity Indicator Badge */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Option Liquidity</span>
                {result?.bid_ask_spread_pct != null && (
                  <span className="text-[10px] font-mono text-muted-foreground">Spread: {result.bid_ask_spread_pct}%</span>
                )}
              </label>
              <div className="flex items-center gap-2 bg-muted/50 border border-input rounded-md px-3 py-1.5 h-[34px]">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  result?.liquidity_rating?.includes('High') ? 'bg-emerald-400 animate-pulse' :
                  result?.liquidity_rating?.includes('Moderate') ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                <span className="text-xs font-medium font-mono truncate text-foreground">
                  {result?.liquidity_rating || 'Moderate Liquidity'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Results Grid */}
      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: 20-Day Historical Volatility */}
            <Card className="bg-card/70 backdrop-blur-md border-blue-500/30 shadow-md flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" /> Realized Price Action
                  </span>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                    20 Trading Days
                  </span>
                </div>
                <CardTitle className="text-lg mt-1">20-Day Historical Volatility</CardTitle>
                <CardDescription className="text-xs">Annualized standard deviation of daily log returns.</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-4xl font-extrabold font-mono text-blue-400 tracking-tight">
                  {(result.historical_volatility_20d * 100).toFixed(2)}%
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Daily Volatility (σ_daily):</span>
                    <span className="font-mono text-foreground font-semibold">
                      {((result.historical_volatility_20d / Math.sqrt(252)) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expected 20d Range (±1σ):</span>
                    <span className="font-mono text-foreground font-semibold">
                      ${(result.stock_price * (result.historical_volatility_20d * Math.sqrt(20/365))).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Black-Scholes Implied Volatility */}
            <Card className="bg-card/70 backdrop-blur-md border-emerald-500/30 shadow-md flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Option Market Premium
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                    Black-Scholes Inversion
                  </span>
                </div>
                <CardTitle className="text-lg mt-1">Implied Volatility (IV)</CardTitle>
                <CardDescription className="text-xs">Volatility priced into current call market premium.</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-4xl font-extrabold font-mono text-emerald-400 tracking-tight">
                  {(result.implied_volatility * 100).toFixed(2)}%
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 space-y-1.5 text-xs text-muted-foreground">
                  {result.implied_volatility_bid != null && result.implied_volatility_ask != null ? (
                    <>
                      <div className="flex justify-between">
                        <span>Bid IV (${result.bid_price?.toFixed(2)}):</span>
                        <span className="font-mono text-foreground font-semibold">
                          {(result.implied_volatility_bid * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ask IV (${result.ask_price?.toFixed(2)}):</span>
                        <span className="font-mono text-foreground font-semibold">
                          {(result.implied_volatility_ask * 100).toFixed(2)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>Call Premium Used:</span>
                      <span className="font-mono text-foreground font-semibold">${result.option_premium.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Volatility Spread (IV - HV) */}
            <Card className={`bg-card/70 backdrop-blur-md shadow-md flex flex-col justify-between ${
              result.volatility_spread > 0.05 ? 'border-amber-500/40' : result.volatility_spread >= -0.03 ? 'border-indigo-500/40' : 'border-emerald-500/40'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4" /> Market Expectations
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    result.volatility_spread > 0.05 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  }`}>
                    IV - HV
                  </span>
                </div>
                <CardTitle className="text-lg mt-1">Volatility Spread</CardTitle>
                <CardDescription className="text-xs">Premium expansion above realized stock volatility.</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className={`text-4xl font-extrabold font-mono tracking-tight ${
                  result.volatility_spread > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {result.volatility_spread > 0 ? '+' : ''}{(result.volatility_spread * 100).toFixed(2)}%
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 text-xs">
                  <p className="font-medium text-foreground leading-snug">{result.interpretation}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Breakeven & Position Return Targets */}
            <Card className="bg-card/70 backdrop-blur-md border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Breakeven & Return Thresholds
                </CardTitle>
                <CardDescription className="text-xs">
                  Required upside move in stock price to reach profitability by option expiration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-lg border border-border/50">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block">Breakeven Stock Price</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400">${result.breakeven_price.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground block">Required Stock Gain</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400">+{result.required_move_pct.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Current Stock Price (S)</span>
                    <span className="font-mono font-semibold">${result.stock_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Option Strike Price (K)</span>
                    <span className="font-mono font-semibold">${result.strike_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Option Premium Paid (C_market)</span>
                    <span className="font-mono font-semibold">${result.option_premium.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Holding Horizon (T)</span>
                    <span className="font-mono font-semibold">{result.days_to_expiration} Days ({ (result.days_to_expiration / 365).toFixed(3) } Yrs)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Option Greeks */}
            <Card className="bg-card/70 backdrop-blur-md border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" /> Black-Scholes Option Greeks (IV = {(result.implied_volatility * 100).toFixed(1)}%)
                </CardTitle>
                <CardDescription className="text-xs">
                  Sensitivity metrics for option price changes with respect to underlying stock movements and time decay.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-muted/30 p-3 rounded-md border border-border/40">
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span className="font-bold text-foreground">Call Delta (Δ)</span>
                      <span className="font-mono text-blue-400 font-bold">{result.greeks.call_delta}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Option price change per $1.00 move in stock price.</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-md border border-border/40">
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span className="font-bold text-foreground">Gamma (Γ)</span>
                      <span className="font-mono text-purple-400 font-bold">{result.greeks.gamma}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Rate of Delta change per $1.00 move in stock price.</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-md border border-border/40">
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span className="font-bold text-foreground">Call Theta (Θ)</span>
                      <span className="font-mono text-red-400 font-bold">${result.greeks.call_theta}/d</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Daily premium decay per day holding position.</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-md border border-border/40">
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span className="font-bold text-foreground">Vega (V)</span>
                      <span className="font-mono text-emerald-400 font-bold">${result.greeks.vega}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Option price change per +1% change in Implied Volatility.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Educational & Principles Guide */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" /> Methodology & Option Volatility Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 leading-relaxed">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-background/40 p-3 rounded-md border border-border/40 space-y-1">
                  <span className="font-semibold text-foreground block flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Backward IV Calculation
                  </span>
                  <p>
                    Implied Volatility (IV) cannot be derived from closing prices alone. It is computed backward by solving C_BS(σ) = C_market using Brent’s numerical optimization algorithm.
                  </p>
                </div>
                <div className="bg-background/40 p-3 rounded-md border border-border/40 space-y-1">
                  <span className="font-semibold text-foreground block flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Midpoint Estimation
                  </span>
                  <p>
                    Using the Bid-Ask midpoint ((Bid + Ask) / 2) avoids stale trade execution distortions. Wide spreads generate an IV range between Bid IV and Ask IV.
                  </p>
                </div>
                <div className="bg-background/40 p-3 rounded-md border border-border/40 space-y-1">
                  <span className="font-semibold text-foreground block flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Volatility Spread Interpretation
                  </span>
                  <p>
                    When IV &gt; HV, options market participants are pricing elevated expected movement (e.g. approaching earnings or catalyst events), making calls relatively expensive.
                  </p>
                </div>
                <div className="bg-background/40 p-3 rounded-md border border-border/40 space-y-1">
                  <span className="font-semibold text-foreground block flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> 20-Day Realized Volatility
                  </span>
                  <p>
                    20-Day Historical Volatility (HV) measures actual annualized daily price fluctuations (σ_hist = std(ln(St/St-1)) * sqrt(252)) over the past 20 trading sessions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
