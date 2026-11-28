'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Briefcase,
  DollarSign,
  Loader2,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface AccountSummary {
  total_net_equity: number;
  cash_available: number;
  cash_pct: number;
  invested_capital: number;
  invested_pct: number;
  holdings_count: number;
  open_at_cost: number;
  unrealized_pnl: number;
  since_start_pnl: number;
  since_start_pct: number;
}

interface PerformanceMetrics {
  realized_pnl: number;
  realized_pnl_pct: number;
  closed_cost_basis: number;
  win_rate_pct: number;
  winning_sells: number;
  losing_sells: number;
  breakeven_sells: number;
  orders_filled: number;
  buys_count: number;
  sells_count: number;
  volume_traded: number;
}

interface PnlOverTimePoint {
  step: number;
  date_label: string;
  timestamp: string;
  symbol: string;
  qty: number;
  sell_price: number;
  cost_basis: number;
  proceeds: number;
  trade_pnl: number;
  trade_pnl_pct: number;
  cumulative_pnl: number;
}

interface PnlBySymbolItem {
  symbol: string;
  realized_pnl: number;
  pnl_pct: number;
  cost_basis: number;
  proceeds: number;
  sell_count: number;
  win_count: number;
  win_rate_pct: number;
}

interface DashboardPayload {
  success: boolean;
  environment: string;
  account_id: string;
  starting_cash: number;
  account_summary: AccountSummary;
  performance: PerformanceMetrics;
  realized_pnl_over_time: PnlOverTimePoint[];
  realized_pnl_by_symbol: PnlBySymbolItem[];
  timestamp: string;
}

function formatMoney(val: number | undefined | null): string {
  const num = Number(val ?? 0);
  if (Number.isNaN(num)) return '$0.00';
  const abs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-$${abs}` : `$${abs}`;
}

function formatSignedMoney(val: number | undefined | null): string {
  const num = Number(val ?? 0);
  if (Number.isNaN(num)) return '$0.00';
  const abs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (num > 0) return `+$${abs}`;
  if (num < 0) return `-$${abs}`;
  return `$${abs}`;
}

function formatSignedPct(val: number | undefined | null): string {
  const num = Number(val ?? 0);
  if (Number.isNaN(num)) return '0.0%';
  if (num > 0) return `+${num.toFixed(1)}%`;
  return `${num.toFixed(1)}%`;
}

function maskAccountId(acct?: string): string {
  if (!acct) return '';
  const s = String(acct).trim();
  if (s.startsWith('RH-SIM')) return s;
  return s.length > 4 ? `••••${s.slice(-4)}` : s;
}

export function AgenticActivityDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [startingCashInput, setStartingCashInput] = useState<string>('500');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [hoveredSymbol, setHoveredSymbol] = useState<PnlBySymbolItem | null>(null);

  const fetchDashboard = async (startCashOverride?: number, isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const parsedStart = startCashOverride ?? (parseFloat(startingCashInput) || 500);
      const res = await fetch(
        `${API_BASE_URL}/api/rh/activity-dashboard?starting_cash=${encodeURIComponent(parsedStart)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Server returned HTTP ${res.status}`);
      }
      const payload: DashboardPayload = await res.json();
      setData(payload);
      setLastSynced(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message || 'Failed to load Agentic Activity Dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard(500, false);
  }, []);

  const stepChartData = useMemo(() => {
    if (!data?.realized_pnl_over_time?.length) return [];
    const pts = data.realized_pnl_over_time;
    const basePoints: Array<Record<string, any>> = [
      {
        step: 0,
        date_label: pts[0]?.date_label || 'Start',
        timestamp: 'Initial ($0.00)',
        symbol: 'START',
        qty: 0,
        sell_price: 0,
        cost_basis: 0,
        proceeds: 0,
        trade_pnl: 0,
        trade_pnl_pct: 0,
        cumulative_pnl: 0,
        green0: null,
        green1: null,
        green2: null,
        red0: null,
        red1: null,
        red2: null,
      },
      ...pts.map((pt) => ({
        ...pt,
        green0: null,
        green1: null,
        green2: null,
        red0: null,
        red1: null,
        red2: null,
      })),
    ];

    // Assign each step segment (i-1 -> i) to a mod-3 slot so green (+ve sale return)
    // and red (-ve sale return) segments never bridge across adjacent trades.
    for (let i = 1; i < basePoints.length; i++) {
      const isPositiveReturn = Number(basePoints[i].trade_pnl ?? 0) >= 0;
      const slot = i % 3;
      const key = `${isPositiveReturn ? 'green' : 'red'}${slot}`;
      basePoints[i - 1][key] = basePoints[i - 1].cumulative_pnl;
      basePoints[i][key] = basePoints[i].cumulative_pnl;
    }

    return basePoints;
  }, [data]);

  const maxAbsSymbolPnl = useMemo(() => {
    if (!data?.realized_pnl_by_symbol?.length) return 1;
    const maxVal = Math.max(
      ...data.realized_pnl_by_symbol.map((item) => Math.abs(item.realized_pnl)),
      0.01
    );
    return maxVal;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-medium">Loading Agentic Activity Ledger &amp; Computing Realized P/L...</p>
      </div>
    );
  }

  const acct = data?.account_summary;
  const perf = data?.performance;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5">
          <Activity className="w-5 h-5 text-emerald-400" />
          <span className="text-base font-bold text-white">Agentic Activity Dashboard</span>
          {data?.environment && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {data.environment}
            </span>
          )}
          {data?.account_id && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10">
              Account: {maskAccountId(data.account_id)}
            </span>
          )}
          {lastSynced && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10">
              Last synced: {lastSynced}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-md px-2.5 h-9">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Start Cash ($)
            </span>
            <Input
              type="number"
              step="10"
              value={startingCashInput}
              onChange={(e) => setStartingCashInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchDashboard(parseFloat(startingCashInput) || 500, true);
                }
              }}
              className="w-20 h-7 bg-transparent border-0 text-xs font-mono text-white text-right p-0 focus-visible:ring-0"
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fetchDashboard(parseFloat(startingCashInput) || 500, true)}
            disabled={refreshing}
            className="h-9 px-3.5 text-xs font-semibold bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-200 flex items-center gap-1.5"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Dashboard'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3.5 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && acct && perf && (
        <>
          {/* Section 1: Account Now + Allocation Bar */}
          <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-white">Account now</CardTitle>
              <CardDescription className="text-xs">
                Started with <span className="font-mono font-semibold text-white">{formatMoney(data.starting_cash)}</span> in cash. Live balances and active holdings synced from your Agentic account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Net Equity */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Total Net Equity</div>
                  <div className="text-3xl font-bold font-mono text-white tracking-tight">
                    {formatMoney(acct.total_net_equity)}
                  </div>
                  <div
                    className={`text-xs font-mono font-semibold ${
                      acct.since_start_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {formatSignedMoney(acct.since_start_pnl)} ({formatSignedPct(acct.since_start_pct)}) since the start
                  </div>
                </div>

                {/* Cash Available */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-500" />
                    Cash Available
                  </div>
                  <div className="text-3xl font-bold font-mono text-white tracking-tight">
                    {formatMoney(acct.cash_available)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono text-white/80">{acct.cash_pct.toFixed(1)}%</span> of the account, uninvested
                  </div>
                </div>

                {/* Invested Capital */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
                    Invested Capital
                  </div>
                  <div className="text-3xl font-bold font-mono text-white tracking-tight">
                    {formatMoney(acct.invested_capital)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono text-white/80">{acct.invested_pct.toFixed(1)}%</span> of the account, in{' '}
                    <span className="font-mono font-semibold text-white">{acct.holdings_count}</span>{' '}
                    {acct.holdings_count === 1 ? 'stock' : 'stocks'}
                  </div>
                </div>
              </div>

              {/* Allocation Progress Bar (Blue Invested vs Orange Cash) */}
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, acct.invested_pct))}%` }}
                  title={`Invested Capital: ${acct.invested_pct.toFixed(1)}% (${formatMoney(acct.invested_capital)})`}
                />
                <div
                  className="bg-orange-500 h-full transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, acct.cash_pct))}%` }}
                  title={`Cash Available: ${acct.cash_pct.toFixed(1)}% (${formatMoney(acct.cash_available)})`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: 5 Performance KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Realized P/L */}
            <Card className="bg-card/40 border-white/10 shadow-lg">
              <CardContent className="p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Realized P/L</span>
                  {perf.realized_pnl >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div
                  className={`text-2xl font-bold font-mono ${
                    perf.realized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatSignedMoney(perf.realized_pnl)}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {formatSignedPct(perf.realized_pnl_pct)} on closed cost
                </div>
              </CardContent>
            </Card>

            {/* Winning Percentage */}
            <Card className="bg-card/40 border-white/10 shadow-lg">
              <CardContent className="p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Winning Percentage</span>
                  <Trophy className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {perf.win_rate_pct.toFixed(1)}%
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {perf.winning_sells} of {perf.sells_count} sell orders above cost
                </div>
              </CardContent>
            </Card>

            {/* Open at Cost */}
            <Card className="bg-card/40 border-white/10 shadow-lg">
              <CardContent className="p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Open at Cost</span>
                  <Briefcase className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {formatMoney(acct.open_at_cost)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {acct.holdings_count} {acct.holdings_count === 1 ? 'position' : 'positions'} not yet sold
                </div>
              </CardContent>
            </Card>

            {/* Orders Filled */}
            <Card className="bg-card/40 border-white/10 shadow-lg">
              <CardContent className="p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Orders Filled</span>
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {perf.orders_filled}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {perf.buys_count} buys · {perf.sells_count} sells
                </div>
              </CardContent>
            </Card>

            {/* Volume Traded */}
            <Card className="bg-card/40 border-white/10 shadow-lg">
              <CardContent className="p-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Volume Traded</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white">
                  {formatMoney(perf.volume_traded)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  buys plus sells, at fill price
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 3: Realized P/L Over Time (Step-Line Chart) */}
          <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-xl">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-white">Realized P/L over time</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Running total after each sell order, spaced evenly in the order they filled. Ended at{' '}
                    <span
                      className={`font-mono font-bold ${
                        perf.realized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatSignedMoney(perf.realized_pnl)}
                    </span>
                    .
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      +ve Sale Return
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                      -ve Sale Return
                    </span>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold border w-fit ${
                      perf.realized_pnl >= 0
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-red-500/15 text-red-300 border-red-500/30'
                    }`}
                  >
                    Ending P/L: {formatSignedMoney(perf.realized_pnl)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {stepChartData.length <= 1 ? (
                <div className="h-64 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg">
                  No closed sell orders found in the Agentic Activity Ledger yet.
                </div>
              ) : (
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stepChartData} margin={{ top: 16, right: 28, left: 8, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="date_label"
                        stroke="#94a3b8"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        minTickGap={24}
                        axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickFormatter={(v) => formatMoney(v)}
                        axisLine={false}
                        tickLine={false}
                        width={68}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const pt = payload[0].payload as PnlOverTimePoint;
                          if (pt.step === 0) {
                            return (
                              <div className="bg-slate-950/95 border border-white/15 rounded-lg p-3 text-xs shadow-2xl">
                                <div className="font-bold text-white">Start Baseline</div>
                                <div className="text-muted-foreground font-mono">Cumulative P/L: $0.00</div>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-slate-950/95 border border-white/15 rounded-lg p-3 text-xs shadow-2xl space-y-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-bold text-white">
                                  Sell #{pt.step} — {pt.symbol}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">{pt.date_label}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">{pt.timestamp}</div>
                              <div className="border-t border-white/10 pt-1.5 space-y-0.5 font-mono">
                                <div>
                                  Trade P/L:{' '}
                                  <span className={pt.trade_pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                    {formatSignedMoney(pt.trade_pnl)} ({formatSignedPct(pt.trade_pnl_pct)})
                                  </span>
                                </div>
                                <div>
                                  Cumulative P/L:{' '}
                                  <span className={pt.cumulative_pnl >= 0 ? 'text-emerald-300 font-bold' : 'text-red-300 font-bold'}>
                                    {formatSignedMoney(pt.cumulative_pnl)}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Proceeds {formatMoney(pt.proceeds)} vs Cost {formatMoney(pt.cost_basis)}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      {/* Per-trade colored step segments: Green for +ve sale return, Red for -ve sale return */}
                      <Line type="stepAfter" dataKey="green0" stroke="#10b981" strokeWidth={2.4} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="green1" stroke="#10b981" strokeWidth={2.4} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="green2" stroke="#10b981" strokeWidth={2.4} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="red0" stroke="#ef4444" strokeWidth={2.4} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="red1" stroke="#ef4444" strokeWidth={2.4} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="red2" stroke="#ef4444" strokeWidth={2.4} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />

                      {/* Driver line for per-sell colored markers and interactive tooltip */}
                      <Line
                        type="stepAfter"
                        dataKey="cumulative_pnl"
                        stroke="transparent"
                        strokeWidth={0}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          if (payload?.step === 0 || cx == null || cy == null) return <g key={`dot-empty-${payload?.step}`} />;
                          const ptColor = Number(payload?.trade_pnl ?? 0) >= 0 ? '#10b981' : '#ef4444';
                          return (
                            <circle
                              key={`dot-${payload.step}`}
                              cx={cx}
                              cy={cy}
                              r={4.2}
                              fill={ptColor}
                              stroke="#0f172a"
                              strokeWidth={1.5}
                            />
                          );
                        }}
                        activeDot={(props: any) => {
                          const { cx, cy, payload } = props;
                          if (cx == null || cy == null) return <g />;
                          const ptColor = Number(payload?.trade_pnl ?? 0) >= 0 ? '#10b981' : '#ef4444';
                          return <circle cx={cx} cy={cy} r={6} fill={ptColor} stroke="#ffffff" strokeWidth={2} />;
                        }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Realized P/L by Symbol (Diverging Horizontal Bar Chart) */}
          <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-white">Realized P/L by symbol</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    For every stock sold: proceeds minus what those shares cost (FIFO). Sorted from largest loss to largest gain.
                  </CardDescription>
                </div>
                {hoveredSymbol && (
                  <div className="text-[11px] font-mono bg-black/45 border border-white/10 rounded-md px-3 py-1.5 text-white/90">
                    <span className="font-bold text-white">{hoveredSymbol.symbol}</span>: Proceeds{' '}
                    {formatMoney(hoveredSymbol.proceeds)} − Cost {formatMoney(hoveredSymbol.cost_basis)} ({hoveredSymbol.sell_count}{' '}
                    {hoveredSymbol.sell_count === 1 ? 'sell' : 'sells'}, {hoveredSymbol.win_rate_pct.toFixed(0)}% win)
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {data.realized_pnl_by_symbol.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg">
                  No realized per-symbol P/L recorded yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {data.realized_pnl_by_symbol.map((item) => {
                    const isGain = item.realized_pnl >= 0;
                    const widthPct = Math.max(
                      1.5,
                      Math.min(100, (Math.abs(item.realized_pnl) / maxAbsSymbolPnl) * 100)
                    );
                    const labelText = `${formatSignedMoney(item.realized_pnl)} (${formatSignedPct(item.pnl_pct)})`;

                    return (
                      <div
                        key={item.symbol}
                        onMouseEnter={() => setHoveredSymbol(item)}
                        onMouseLeave={() => setHoveredSymbol(null)}
                        className="grid grid-cols-[64px_1fr] items-center gap-3 py-1 px-2 rounded-md hover:bg-white/5 transition-colors"
                      >
                        <div className="text-xs font-mono font-bold text-white tracking-wide">
                          {item.symbol}
                        </div>

                        {/* Diverging Bar Track Centered on $0 */}
                        <div className="grid grid-cols-2 items-center relative">
                          {/* Left Half (Losses) */}
                          <div className="flex items-center justify-end pr-0 border-r border-white/25 min-h-[24px]">
                            {!isGain && (
                              <div className="flex items-center justify-end gap-2 w-full">
                                <span className="text-[11px] font-mono text-red-300 whitespace-nowrap">
                                  {labelText}
                                </span>
                                <div
                                  className="h-5 rounded-l-sm bg-red-600/90 hover:bg-red-500 transition-all"
                                  style={{ width: `${widthPct * 0.65}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Right Half (Gains) */}
                          <div className="flex items-center justify-start pl-0 min-h-[24px]">
                            {isGain && (
                              <div className="flex items-center justify-start gap-2 w-full">
                                <div
                                  className="h-5 rounded-r-sm bg-emerald-600/90 hover:bg-emerald-500 transition-all"
                                  style={{ width: `${widthPct * 0.65}%` }}
                                />
                                <span className="text-[11px] font-mono text-emerald-300 whitespace-nowrap">
                                  {labelText}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

