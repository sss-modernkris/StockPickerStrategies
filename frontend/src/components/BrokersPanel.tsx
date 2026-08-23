import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Lock, RefreshCcw, Unlock, Database, DollarSign, Briefcase, 
  TrendingUp, Cpu, Sliders, Play, Pause, PlayCircle, Shield, 
  ArrowUpRight, Landmark, Badge, CheckCircle2, AlertTriangle, ToggleLeft,
  Bot, Sparkles, Clock, ArrowRight, FileSpreadsheet, Layers, Activity, Check, Loader2, Zap
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { logger } from '@/lib/logger';
import { IBOrder, IBData } from '@/lib/types';

// Custom Robinhood interfaces
interface RHConfig {
  is_connected: boolean;
  mcp_url: string;
  is_simulated: boolean;
  paused: boolean;
  budget_limit: number;
}

interface RHData {
  unrealized_pnl: number;
  realized_pnl: number;
  buying_power: number;
  cash_available: number;
  invested_capital: number;
  total_equity: number;
  holdings: Array<{
    symbol: string;
    total_quantity: number;
    avg_buy_price: number;
    current_price: number;
    total_value: number;
    unrealized_pnl: number;
  }>;
  option_positions?: Array<{
    position_id: string;
    symbol: string;
    option_type: string;
    strike: number;
    expiry_date: string;
    contracts: number;
    entry_premium: number;
    current_premium: number;
    market_value: number;
    cost_basis: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
  }>;
  orders: IBOrder[];
}

export interface PipelineStatus {
  pipeline_active: boolean;
  is_running: boolean;
  scheduled_time_est: string;
  schedule_description: string;
  last_run_time: string | null;
  has_report: boolean;
  last_summary: string;
  agents: {
    backtester: { name: string; status: string; strategy: string };
    broker: { name: string; status: string; target_api: string };
  };
}

export interface PipelineReport {
  success: boolean;
  pipeline_name: string;
  execution_timestamp: string;
  total_duration_sec: number;
  schedule_target: string;
  stage_1_backtester: {
    agent: string;
    universe_scanned: number;
    total_qualified: number;
    ranked_recommendations: Array<{
      rank: number;
      symbol: string;
      strategy_value_1w: number;
      strategy_return_pct: number;
      current_price: number;
      willy_market: string;
      willy_vwap: number;
      macd_hist: number;
      macd_slope: number;
      rsi_14: number;
      stock_signal: { action: string; target_price: number; suggested_budget: number; suggested_shares: number };
      option_signal: { action: string; option_type: string; strike: number; expiry_date: string; estimated_premium: number; contracts: number; estimated_position_cost: number };
    }>;
  };
  stage_2_broker: {
    agent: string;
    environment: string;
    initial_cash: number;
    liquidation_proceeds: number;
    effective_buying_power: number;
    final_cash_remaining: number;
    total_portfolio_equity: number;
    execution_summary: string;
    actions: {
      sells: Array<{ symbol: string; action: string; quantity: number; price: number; proceeds: number; status: string; mcp_response: string }>;
      buys_stock: Array<{ symbol: string; action: string; quantity: number; price: number; total_cost: number; rank: number; status: string; mcp_response: string }>;
      buys_options: Array<{ symbol: string; option_type: string; strike: number; expiry_date: string; contracts: number; premium: number; total_cost: number; rank: number; status: string; mcp_response: string }>;
    };
  };
}

const formatMoney = (val: number | null | undefined) => {
  if (val == null) return '--';
  return val < 0
    ? `-$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function BrokersPanel() {
  const [activeTab, setActiveTab] = useState<'rh' | 'ib'>('rh'); // Default to Robinhood to show new setup

  // --- Interactive Brokers State ---
  const [ibConfig, setIbConfig] = useState<{ is_configured: boolean; is_connected: boolean } | null>(null);
  const [ibData, setIbData] = useState<IBData | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [ibUsername, setIbUsername] = useState('');
  const [ibPassword, setIbPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- Robinhood Agentic AI State ---
  const [rhConfig, setRhConfig] = useState<RHConfig | null>(null);
  const [rhData, setRhData] = useState<RHData | null>(null);
  const [rhMcpUrl, setRhMcpUrl] = useState('https://agent.robinhood.com/mcp/trading');
  const [rhSimulate, setRhSimulate] = useState(true);
  const [rhLoading, setRhLoading] = useState(false);
  
  // --- Automated AI Pipeline State ---
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState<boolean>(false);
  const [pipelineReport, setPipelineReport] = useState<PipelineReport | null>(null);

  // Controls & Manual Orders State
  const [rhBudgetInput, setRhBudgetInput] = useState('50000');
  const [tradeTicker, setTradeTicker] = useState('NVDA');
  const [tradeAction, setTradeAction] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeQty, setTradeQty] = useState('10');
  const [tradePrice, setTradePrice] = useState('125.00');
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  // Global messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Fetching & Configuration logic ---

  // IB Config Checks
  const checkIbConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ib/config`);
      if (res.ok) {
        const data = await res.json();
        setIbConfig(data);
        if (data.is_connected) {
          fetchIbData();
        } else if (data.is_configured) {
          handleIbLogin("", "");
        }
      }
    } catch (err) {
      logger.error("Failed to check IB config", err);
    }
  };

  const handleIbLogin = async (username?: string, password?: string) => {
    try {
      setLoginLoading(true);
      setModalError(null);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/ib/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username || "", password: password || "" })
      });

      if (res.ok) {
        setIbConfig((prev) =>
          prev ? { ...prev, is_connected: true } : { is_configured: true, is_connected: true }
        );
        setShowLoginModal(false);
        fetchIbData();
        setSuccessMsg("Successfully connected to Interactive Brokers!");
      } else {
        const errData = await res.json();
        const msg = errData.detail || "Failed to login to Interactive Brokers.";
        setModalError(msg);
        setError(msg);
      }
    } catch (err) {
      const msg = "An error occurred during IB login.";
      setModalError(msg);
      setError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchIbData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ib/data`);
      if (res.ok) {
        const data = await res.json();
        setIbData(data);
      }
    } catch (err) {
      logger.error("Failed to fetch IB data", err);
    }
  };

  // Robinhood Config & Data Checks
  const checkRhConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rh/config`);
      if (res.ok) {
        const data = await res.json();
        setRhConfig(data);
        setRhMcpUrl(data.mcp_url);
        setRhBudgetInput(data.budget_limit.toString());
        if (data.is_connected) {
          fetchRhData();
        }
      }
    } catch (err) {
      logger.error("Failed to check Robinhood config", err);
    }
  };

  const handleRhConnect = async () => {
    try {
      setRhLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/rh/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcp_url: rhMcpUrl, simulate: rhSimulate })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.message);
        checkRhConfig();
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to connect to Robinhood Agentic server.");
      }
    } catch (err) {
      setError("Error connecting to Robinhood Agentic server.");
    } finally {
      setRhLoading(false);
    }
  };

  const handleRhDisconnect = async () => {
    try {
      setRhLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/rh/disconnect`, { method: 'POST' });
      if (res.ok) {
        setRhData(null);
        setRhConfig(null);
        setSuccessMsg("Disconnected from Robinhood Agentic AI.");
      } else {
        setError("Failed to disconnect.");
      }
    } catch (err) {
      setError("Error disconnecting.");
    } finally {
      setRhLoading(false);
    }
  };

  const fetchRhData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rh/data`);
      if (res.ok) {
        const data = await res.json();
        setRhData(data);
      }
    } catch (err) {
      logger.error("Failed to fetch Robinhood portfolio data", err);
    }
  };

  const handleRhControlUpdate = async (pausedStatus: boolean | null, budgetVal: number | null) => {
    try {
      const payload: { paused?: boolean; budget_limit?: number } = {};
      if (pausedStatus !== null) payload.paused = pausedStatus;
      if (budgetVal !== null) payload.budget_limit = budgetVal;

      const res = await fetch(`${API_BASE_URL}/api/rh/controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        checkRhConfig();
      }
    } catch (err) {
      logger.error("Failed to update Robinhood controls", err);
    }
  };

  const handleRhTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTradeError(null);
    setTradeSuccess(null);

    const qty = parseFloat(tradeQty);
    const price = parseFloat(tradePrice);
    if (isNaN(qty) || qty <= 0) {
      setTradeError("Please enter a valid positive quantity.");
      return;
    }
    if (isNaN(price) || price <= 0) {
      setTradeError("Please enter a valid positive price.");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/rh/order?ticker=${tradeTicker}&action=${tradeAction}&quantity=${qty}&price=${price}`,
        { method: 'POST' }
      );

      if (res.ok) {
        const result = await res.json();
        setTradeSuccess(result.message);
        fetchRhData();
      } else {
        const errData = await res.json();
        setTradeError(errData.detail || "Trade failed.");
      }
    } catch (err) {
      setTradeError("An error occurred executing the trade.");
    }
  };

  const fetchPipelineStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agents/pipeline/status`);
      if (res.ok) {
        const data: PipelineStatus = await res.json();
        setPipelineStatus(data);
      }
    } catch (err) {
      logger.error("Failed to fetch pipeline status", err);
    }
  };

  const handleRunPipeline = async () => {
    try {
      setPipelineLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/agents/pipeline/run`, { method: 'POST' });
      if (res.ok) {
        const report: PipelineReport = await res.json();
        setPipelineReport(report);
        setSuccessMsg("Automated Daily Pipeline executed successfully in Robinhood MCP Sandbox!");
        fetchRhData();
        fetchPipelineStatus();
      } else {
        const errData = await res.json();
        setError(errData.detail || "Pipeline execution failed.");
      }
    } catch (err) {
      setError("Network error occurred during pipeline execution.");
    } finally {
      setPipelineLoading(false);
    }
  };

  useEffect(() => {
    checkIbConfig();
    checkRhConfig();
    fetchPipelineStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Selector & Global Alert messages */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/40 backdrop-blur-md p-4 rounded-xl border border-white/5 shadow-lg">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Broker Connections</h2>
          <p className="text-xs text-muted-foreground">Link and manage your brokerage platforms & AI trading agents</p>
        </div>
        <div className="flex items-center gap-2 bg-black/45 p-1 rounded-lg border border-white/5">
          <Button
            variant={activeTab === 'rh' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('rh')}
            className={`flex items-center gap-2 rounded-md font-semibold text-xs transition-all ${
              activeTab === 'rh' 
                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shadow-md hover:bg-emerald-500/20' 
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Robinhood Agentic AI
          </Button>
          <Button
            variant={activeTab === 'ib' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('ib')}
            className={`flex items-center gap-2 rounded-md font-semibold text-xs transition-all ${
              activeTab === 'ib' 
                ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30 shadow-md hover:bg-blue-500/20' 
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            Interactive Brokers
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-4 rounded-lg font-medium flex items-center gap-2 shadow-inner">
          <CheckCircle2 className="w-4 h-4" /> {successMsg}
        </div>
      )}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-lg font-medium flex items-center gap-2 shadow-inner">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* -------------------- ROBINHOOD AGENTIC TAB -------------------- */}
      {activeTab === 'rh' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* ========================================================================= */}
          {/* SPECIALIZED AI AGENTS & ROBINHOOD MCP SANDBOX AUTOMATED PIPELINE */}
          {/* ========================================================================= */}
          <Card className="bg-gradient-to-br from-emerald-950/30 via-black/50 to-indigo-950/30 backdrop-blur-md border-emerald-500/20 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <CardHeader className="pb-4 border-b border-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <Bot className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                        Specialized AI Agents & Robinhood MCP Sandbox Pipeline
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          v2.0 Sandbox
                        </span>
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Automated daily screening (Backtester Agent) and portfolio rebalancing (Broker Agent) via Model Context Protocol.
                      </CardDescription>
                    </div>
                  </div>
                </div>

                {/* Status and Trigger Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-muted-foreground text-[11px]">Trigger:</span>
                    <span className="font-semibold text-white text-[11px]">2:00 PM EST (Trading Days)</span>
                  </div>

                  <Button
                    onClick={handleRunPipeline}
                    disabled={pipelineLoading}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider px-5 h-9 rounded-md shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    {pipelineLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Running Pipeline...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-black" />
                        Run Daily Pipeline Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {/* Dual Agent Architectures Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Agent 1: Backtester */}
                <div className="p-4 rounded-xl bg-black/35 border border-white/5 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-bold text-white">1. Backtester Agent</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Strategy 1 (1-Wk)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Scans constituents across <strong className="text-white">Dow 30, Nasdaq 100, and S&P 500</strong> (~170 tickers). Applies 5-layer quant filters (Willy Bull, 1-Wk Value &gt; $10k, MACD Hist/Slope, RSI 30-70) and generates ranked stock/option signals.
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-white/5">
                    <span className="text-emerald-400 font-mono font-medium">Output:</span> Ranked signals &amp; ATM Call option sizing payload
                  </div>
                </div>

                {/* Agent 2: Broker */}
                <div className="p-4 rounded-xl bg-black/35 border border-white/5 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-white">2. Broker Agent</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Robinhood MCP Sandbox
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Compares current portfolio holdings against incoming recommendations. Liquidates non-strategy positions to create cash, then sizes and executes stock &amp; ATM Call buy orders in sandbox.
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t border-white/5">
                    <span className="text-indigo-400 font-mono font-medium">Target:</span> Account <span className="font-mono text-white">RH-SIM-SANDBOX-001</span> (0% capital risk)
                  </div>
                </div>
              </div>

              {/* Pipeline Run Results Display */}
              {pipelineReport && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Pipeline executed in {pipelineReport.total_duration_sec}s at {pipelineReport.execution_timestamp}
                    </div>
                    <div className="text-muted-foreground text-[11px] mt-1 md:mt-0">
                      {pipelineReport.stage_2_broker.execution_summary}
                    </div>
                  </div>

                  {/* Stage 1 Recommendations Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Stage 1: Backtester Recommended Candidates ({pipelineReport.stage_1_backtester.total_qualified} Qualified)
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Universe: {pipelineReport.stage_1_backtester.universe_scanned} tickers
                      </span>
                    </div>

                    <div className="rounded-lg border border-white/10 overflow-x-auto bg-black/40">
                      <Table>
                        <TableHeader className="bg-black/60">
                          <TableRow className="border-white/10">
                            <TableHead className="text-xs text-white">Rank</TableHead>
                            <TableHead className="text-xs text-white">Symbol</TableHead>
                            <TableHead className="text-xs text-right text-white">Price</TableHead>
                            <TableHead className="text-xs text-right text-white">1-Wk Strategy Value</TableHead>
                            <TableHead className="text-xs text-right text-white">1-Wk Return</TableHead>
                            <TableHead className="text-xs text-white">Willy Market</TableHead>
                            <TableHead className="text-xs text-white">Stock Target</TableHead>
                            <TableHead className="text-xs text-white">ATM Call Option Target</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pipelineReport.stage_1_backtester.ranked_recommendations.map((rec) => (
                            <TableRow key={rec.rank} className="border-white/5 hover:bg-white/5">
                              <TableCell className="font-bold text-amber-400">#{rec.rank}</TableCell>
                              <TableCell className="font-bold text-white text-sm">{rec.symbol}</TableCell>
                              <TableCell className="text-right font-medium text-emerald-400">{formatMoney(rec.current_price)}</TableCell>
                              <TableCell className="text-right font-mono text-white">{formatMoney(rec.strategy_value_1w)}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-400">+{rec.strategy_return_pct}%</TableCell>
                              <TableCell>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {rec.willy_market}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-white/90">
                                BUY {rec.stock_signal.suggested_shares} shs (~${rec.stock_signal.suggested_budget})
                              </TableCell>
                              <TableCell className="text-xs text-indigo-300 font-mono">
                                {rec.option_signal.contracts}x ${rec.option_signal.strike} CALL exp {rec.option_signal.expiry_date} @ ${rec.option_signal.estimated_premium}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Stage 2 Broker Execution Summary */}
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                      Stage 2: Broker Rebalancing Actions &amp; Sandbox Fills
                    </div>

                    {/* Capital Flow Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Initial Cash</div>
                        <div className="text-sm font-bold text-white font-mono">{formatMoney(pipelineReport.stage_2_broker.initial_cash)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Sell Proceeds (Liquidated)</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono">+{formatMoney(pipelineReport.stage_2_broker.liquidation_proceeds)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Effective Buying Power</div>
                        <div className="text-sm font-bold text-indigo-400 font-mono">{formatMoney(pipelineReport.stage_2_broker.effective_buying_power)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Final Cash Remaining</div>
                        <div className="text-sm font-bold text-white font-mono">{formatMoney(pipelineReport.stage_2_broker.final_cash_remaining)}</div>
                      </div>
                    </div>

                    {/* Action Logs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Sells */}
                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2">
                        <div className="font-bold text-destructive flex items-center gap-1.5">
                          <span>Liquidated Positions ({pipelineReport.stage_2_broker.actions.sells.length})</span>
                        </div>
                        {pipelineReport.stage_2_broker.actions.sells.length === 0 ? (
                          <div className="text-muted-foreground text-[11px]">No holdings required liquidation.</div>
                        ) : (
                          <div className="space-y-1 font-mono text-[11px]">
                            {pipelineReport.stage_2_broker.actions.sells.map((s, i) => (
                              <div key={i} className="flex justify-between items-center text-muted-foreground">
                                <span>SELL {s.quantity} {s.symbol} @ {formatMoney(s.price)}</span>
                                <span className="text-emerald-400">+{formatMoney(s.proceeds)} ({s.status})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Buys (Stocks & Options) */}
                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2">
                        <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                          <span>Purchased Stocks &amp; Options ({pipelineReport.stage_2_broker.actions.buys_stock.length + pipelineReport.stage_2_broker.actions.buys_options.length})</span>
                        </div>
                        <div className="space-y-1 font-mono text-[11px]">
                          {pipelineReport.stage_2_broker.actions.buys_stock.map((b, i) => (
                            <div key={`stk-${i}`} className="flex justify-between items-center text-muted-foreground">
                              <span>BUY {b.quantity} shs {b.symbol}</span>
                              <span className="text-white">{formatMoney(b.total_cost)} ({b.status})</span>
                            </div>
                          ))}
                          {pipelineReport.stage_2_broker.actions.buys_options.map((o, i) => (
                            <div key={`opt-${i}`} className="flex justify-between items-center text-indigo-300">
                              <span>BUY {o.contracts}x {o.symbol} ${o.strike} CALL</span>
                              <span className="text-white">{formatMoney(o.total_cost)} ({o.status})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account PNL Summary Metric Cards */}
          {rhData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-bottom-3 duration-300">
              <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-white/5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 opacity-10"><DollarSign className="w-12 h-12 text-emerald-400" /></div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white font-mono">{formatMoney(rhData.cash_available)}</div>
                  <p className="text-[10px] text-muted-foreground">Sandbox Buying Power (RH-SIM-SANDBOX-001)</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-500/5 to-transparent border-white/5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 opacity-10"><Briefcase className="w-12 h-12 text-indigo-400" /></div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invested Capital</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white font-mono">{formatMoney(rhData.invested_capital)}</div>
                  <p className="text-[10px] text-muted-foreground">Market value of active stock &amp; option holdings</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/5 to-transparent border-white/5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 opacity-10"><TrendingUp className="w-12 h-12 text-purple-400" /></div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Net Equity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white font-mono">{formatMoney(rhData.total_equity)}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-bold flex items-center ${rhData.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {rhData.unrealized_pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : null}
                      P&L: {formatMoney(rhData.unrealized_pnl)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 border rounded-xl bg-card/25 border-dashed border-white/10 text-muted-foreground backdrop-blur-md">
              <Cpu className="w-10 h-10 mx-auto mb-3 text-emerald-400 animate-pulse" />
              <div className="font-semibold text-sm text-white/90">Robinhood MCP Sandbox Active</div>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                Ready for autonomous daily execution. Click &quot;Run Daily Pipeline Now&quot; above to rebalance.
              </p>
            </div>
          )}

          {/* Holdings: Stocks & Option Positions */}
          {rhData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Stock Holdings Table */}
              <Card className="lg:col-span-2 bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-white text-base">Active Sandbox Stock Holdings</CardTitle>
                      <CardDescription>Equities controlled by the AI Broker Agent rebalancing policy</CardDescription>
                    </div>
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      {rhData.holdings.length} Stocks
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {rhData.holdings.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5 text-xs">
                      No active stock positions. Run the AI Pipeline to seed this portfolio.
                    </div>
                  ) : (
                    <div className="rounded-md border border-white/5 overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-black/35">
                          <TableRow className="border-white/5">
                            <TableHead className="text-xs text-white">Ticker</TableHead>
                            <TableHead className="text-xs text-right text-white">Quantity</TableHead>
                            <TableHead className="text-xs text-right text-white">Avg Cost</TableHead>
                            <TableHead className="text-xs text-right text-white">Last Price</TableHead>
                            <TableHead className="text-xs text-right text-white">Market Value</TableHead>
                            <TableHead className="text-xs text-right text-white">Unrealized P&L</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rhData.holdings.map((h, idx) => (
                            <TableRow key={idx} className="border-white/5 hover:bg-white/5">
                              <TableCell className="font-bold text-white">{h.symbol}</TableCell>
                              <TableCell className="text-right text-white/95">{h.total_quantity}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatMoney(h.avg_buy_price)}</TableCell>
                              <TableCell className="text-right font-medium text-emerald-400">{formatMoney(h.current_price)}</TableCell>
                              <TableCell className="text-right font-semibold text-white">{formatMoney(h.total_value)}</TableCell>
                              <TableCell className={`text-right font-bold ${h.unrealized_pnl < 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                                {h.unrealized_pnl > 0 ? '+' : ''}{formatMoney(h.unrealized_pnl)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Active Option Positions Sub-Table */}
                  {rhData.option_positions && rhData.option_positions.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          Active Option Contracts ({rhData.option_positions.length})
                        </div>
                      </div>
                      <div className="rounded-md border border-white/5 overflow-x-auto bg-black/20">
                        <Table>
                          <TableHeader className="bg-black/40">
                            <TableRow className="border-white/5">
                              <TableHead className="text-xs text-white">Contract</TableHead>
                              <TableHead className="text-xs text-white">Expiry</TableHead>
                              <TableHead className="text-xs text-right text-white">Contracts</TableHead>
                              <TableHead className="text-xs text-right text-white">Entry Prem</TableHead>
                              <TableHead className="text-xs text-right text-white">Market Value</TableHead>
                              <TableHead className="text-xs text-right text-white">Unrealized P&L</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rhData.option_positions.map((opt, idx) => (
                              <TableRow key={idx} className="border-white/5 hover:bg-white/5">
                                <TableCell className="font-bold text-indigo-300">
                                  {opt.symbol} ${opt.strike} {opt.option_type}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">{opt.expiry_date}</TableCell>
                                <TableCell className="text-right text-white font-mono">{opt.contracts}x</TableCell>
                                <TableCell className="text-right text-muted-foreground">{formatMoney(opt.entry_premium)}</TableCell>
                                <TableCell className="text-right font-semibold text-white">{formatMoney(opt.market_value)}</TableCell>
                                <TableCell className={`text-right font-bold ${opt.unrealized_pnl < 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                                  {opt.unrealized_pnl > 0 ? '+' : ''}{formatMoney(opt.unrealized_pnl)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Manual Execution Playground Tool */}
              <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-base">Execution Playground</CardTitle>
                  <CardDescription>Push ad-hoc test orders directly to the Robinhood Sandbox</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRhTradeSubmit} className="space-y-4">
                    {tradeError && (
                      <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-md font-medium">
                        {tradeError}
                      </div>
                    )}
                    {tradeSuccess && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-md font-medium">
                        {tradeSuccess}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ticker Symbol</label>
                      <select 
                        value={tradeTicker}
                        onChange={(e) => setTradeTicker(e.target.value)}
                        className="w-full bg-black/45 border-white/10 rounded-md h-9 text-xs text-white px-2 focus:border-emerald-500/50"
                      >
                        <option value="NVDA">NVDA (NVIDIA)</option>
                        <option value="TSLA">TSLA (Tesla)</option>
                        <option value="AVGO">AVGO (Broadcom)</option>
                        <option value="BMY">BMY (Bristol-Myers)</option>
                        <option value="DOW">DOW (Dow Inc)</option>
                        <option value="NOW">NOW (ServiceNow)</option>
                        <option value="DXCM">DXCM (DexCom)</option>
                        <option value="VZ">VZ (Verizon)</option>
                        <option value="F">F (Ford)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={tradeAction === 'BUY' ? 'default' : 'ghost'}
                        onClick={() => setTradeAction('BUY')}
                        className={`h-9 text-xs font-semibold rounded-md ${
                          tradeAction === 'BUY' 
                            ? 'bg-emerald-500 text-black hover:bg-emerald-400' 
                            : 'bg-black/25 text-white border border-white/10 hover:bg-white/5'
                        }`}
                      >
                        BUY
                      </Button>
                      <Button
                        type="button"
                        variant={tradeAction === 'SELL' ? 'default' : 'ghost'}
                        onClick={() => setTradeAction('SELL')}
                        className={`h-9 text-xs font-semibold rounded-md ${
                          tradeAction === 'SELL' 
                            ? 'bg-destructive text-white hover:bg-destructive/90' 
                            : 'bg-black/25 text-white border border-white/10 hover:bg-white/5'
                        }`}
                      >
                        SELL
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantity</label>
                        <Input
                          type="number"
                          placeholder="10"
                          value={tradeQty}
                          onChange={(e) => setTradeQty(e.target.value)}
                          className="bg-black/45 border-white/10 rounded-md text-white h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Limit Price ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="125.00"
                          value={tradePrice}
                          onChange={(e) => setTradePrice(e.target.value)}
                          className="bg-black/45 border-white/10 rounded-md text-white h-9 text-xs"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-emerald-500 text-black hover:bg-emerald-400 rounded-md font-bold text-xs h-9 uppercase tracking-wider shadow-md"
                    >
                      Execute Sandbox Order
                    </Button>
                  </form>
                </CardContent>
              </Card>

            </div>
          )}

          {/* Robinhood Agentic Activity Ledger */}
          {rhData && (
            <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl animate-in fade-in duration-300">
              <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Agentic Activity Ledger
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {rhData.orders.length} Executed Orders
                      </span>
                    </CardTitle>
                    <CardDescription>Live audit log of simulated stock and option orders executed via Robinhood MCP</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchRhData} className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-white">
                    <RefreshCcw className="w-3.5 h-3.5" /> Refresh Ledger
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {rhData.orders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5 text-xs">
                    No orders registered yet in this session. Execute the pipeline to populate the ledger.
                  </div>
                ) : (
                  <div className="rounded-md border border-white/5 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-black/35">
                        <TableRow className="border-white/5">
                          <TableHead className="text-xs text-white">Date &amp; Time</TableHead>
                          <TableHead className="text-xs text-white">Symbol / Contract</TableHead>
                          <TableHead className="text-xs text-white">Action</TableHead>
                          <TableHead className="text-xs text-right text-white">Amount (Filled/Total)</TableHead>
                          <TableHead className="text-xs text-right text-white">Price / Premium</TableHead>
                          <TableHead className="text-xs text-white">Status</TableHead>
                          <TableHead className="text-xs text-white">Order ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rhData.orders.map((ord, idx) => (
                          <TableRow key={ord.order_id || idx} className="border-white/5 hover:bg-white/5">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">{ord.last_update || (ord as any).timestamp}</TableCell>
                            <TableCell className="font-bold text-white">
                              {(ord as any).asset_type === 'option' ? (
                                <span className="text-indigo-300 font-mono text-xs">
                                  {ord.ticker || ord.symbol} ${(ord as any).strike} {(ord as any).option_type}
                                </span>
                              ) : (
                                <span>{ord.ticker || ord.symbol}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ord.action === 'BUY' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-destructive/15 text-destructive border border-destructive/30'
                              }`}>
                                {ord.action}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-white font-mono">
                              <span className="font-semibold">{ord.filled || (ord as any).filled_quantity}</span>
                              <span className="text-muted-foreground text-xs"> / {ord.total_quantity || (ord as any).quantity}</span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-400 font-mono">{formatMoney(ord.price)}</TableCell>
                            <TableCell>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {ord.status || 'FILLED'}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{ord.order_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {/* -------------------- INTERACTIVE BROKERS TAB -------------------- */}
      {activeTab === 'ib' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center bg-card/20 p-4 rounded-xl border border-white/5 shadow-md">
            <div className="flex items-center gap-4">
              <Button
                variant={ibConfig?.is_connected ? "secondary" : "default"}
                disabled={ibConfig?.is_connected || loginLoading}
                onClick={() => setShowLoginModal(true)}
                className={`flex items-center gap-2 rounded-md font-bold text-xs uppercase tracking-wider ${
                  ibConfig?.is_connected 
                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20' 
                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-md'
                }`}
              >
                {ibConfig?.is_connected ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-blue-400" /> Linked to IB Gateway
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Connect IB Gateway
                  </>
                )}
              </Button>
              {ibConfig?.is_connected && (
                <Button variant="ghost" size="sm" onClick={fetchIbData} className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCcw className="w-3.5 h-3.5" /> Sync Data
                </Button>
              )}
            </div>

            {ibConfig?.is_configured && ibConfig?.is_connected && (
              <div className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Auto-login active via env variables
              </div>
            )}
          </div>

          {ibData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Available</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white font-mono">{formatMoney(ibData.cash_available)}</div>
                    <p className="text-[10px] text-muted-foreground">Real-time IB Balance</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invested Capital</CardTitle>
                    <Briefcase className="h-4 w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white font-mono">{formatMoney(ibData.invested_capital)}</div>
                    <p className="text-[10px] text-muted-foreground">IB Market Value</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Equity</CardTitle>
                    <TrendingUp className="h-4 w-4 text-indigo-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white font-mono">{formatMoney(ibData.total_equity)}</div>
                    <p className="text-[10px] text-muted-foreground">IB Account Net Liquidation</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-emerald-500/5 border-emerald-500/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Unrealized P&L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-bold font-mono ${ibData.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                      {formatMoney(ibData.unrealized_pnl)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-blue-500/5 border-blue-500/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Realized P&L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-bold font-mono ${ibData.realized_pnl >= 0 ? 'text-blue-400' : 'text-destructive'}`}>
                      {formatMoney(ibData.realized_pnl)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-indigo-500/5 border-indigo-500/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Buying Power</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-indigo-400 font-mono">
                      {formatMoney(ibData.buying_power)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="text-center py-16 border rounded-xl bg-card/25 border-dashed border-white/10 text-muted-foreground backdrop-blur-md">
              <Landmark className="w-10 h-10 mx-auto mb-3 text-muted-foreground/35" />
              <div className="font-semibold text-sm text-white/90">Interactive Brokers is disconnected</div>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                Connect to your local Interactive Brokers TWS or IB Gateway instance (typically port 4002) to sync real-time portfolio holdings.
              </p>
            </div>
          )}

          {/* IB Active Holdings Table */}
          {ibData && (
            <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-base">Active Positions</CardTitle>
                <CardDescription>Real-time positions and performance from your IB account</CardDescription>
              </CardHeader>
              <CardContent>
                {!ibData.holdings || ibData.holdings.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5">
                    No active positions found in this account.
                  </div>
                ) : (
                  <div className="rounded-md border border-white/5 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-black/35">
                        <TableRow className="border-white/5">
                          <TableHead className="text-xs text-white">Ticker</TableHead>
                          <TableHead className="text-xs text-right text-white">Quantity</TableHead>
                          <TableHead className="text-xs text-right text-white">Avg Cost</TableHead>
                          <TableHead className="text-xs text-right text-white">Market Price</TableHead>
                          <TableHead className="text-xs text-right text-white">Position Value</TableHead>
                          <TableHead className="text-xs text-right text-white">Unrealized P&L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ibData.holdings.map((h, idx) => (
                          <TableRow key={idx} className="border-white/5 hover:bg-white/5">
                            <TableCell className="font-bold text-white">{h.symbol}</TableCell>
                            <TableCell className="text-right text-white/95">{h.total_quantity}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatMoney(h.avg_buy_price)}</TableCell>
                            <TableCell className="text-right font-medium text-blue-400">{formatMoney(h.current_price)}</TableCell>
                            <TableCell className="text-right font-semibold text-white">{formatMoney(h.total_value)}</TableCell>
                            <TableCell className={`text-right font-bold ${h.unrealized_pnl < 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                              {h.unrealized_pnl > 0 ? '+' : ''}{formatMoney(h.unrealized_pnl)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* IB Order History */}
          {ibData && (
            <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-base">Execution Log</CardTitle>
                <CardDescription>Real-time order status and execution details from your IB account</CardDescription>
              </CardHeader>
              <CardContent>
                {!ibData.orders || ibData.orders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5">
                    No recent order executions found.
                  </div>
                ) : (
                  <div className="rounded-md border border-white/5 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-black/35">
                        <TableRow className="border-white/5">
                          <TableHead className="text-xs text-white">Date & Timestamp</TableHead>
                          <TableHead className="text-xs text-white">Ticker</TableHead>
                          <TableHead className="text-xs text-white">Status</TableHead>
                          <TableHead className="text-xs text-white">Action</TableHead>
                          <TableHead className="text-xs text-right text-white">Qty (Filled/Total)</TableHead>
                          <TableHead className="text-xs text-right text-white">Price</TableHead>
                          <TableHead className="text-xs text-white">Order ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ibData.orders.map((ord: IBOrder) => (
                          <TableRow key={ord.order_id} className="border-white/5 hover:bg-white/5">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{ord.last_update || "Pending..."}</TableCell>
                            <TableCell className="font-bold text-white">{ord.symbol}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                ord.status === 'Filled' ? 'bg-emerald-500/10 text-emerald-400' : 
                                ord.status === 'Cancelled' ? 'bg-destructive/10 text-destructive' : 
                                'bg-blue-500/10 text-blue-400'
                              }`}>
                                {ord.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ord.action === 'BUY' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                {ord.action}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-white">
                              <span className="font-semibold">{ord.filled}</span>
                              <span className="text-muted-foreground text-xs"> / {ord.total_quantity}</span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-400">
                              {ord.avg_fill_price > 0 ? formatMoney(ord.avg_fill_price) : formatMoney(ord.price)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{ord.order_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* IB Login Modal */}
          {showLoginModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <Card className="w-full max-w-md shadow-2xl border-white/5 bg-card/65 animate-in zoom-in-95 duration-200">
                <CardHeader>
                  <CardTitle className="text-white">Interactive Brokers Login</CardTitle>
                  <CardDescription>Enter your TWS/Gateway credentials to link your dashboard.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {modalError && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-md font-medium">
                      {modalError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
                    <Input
                      placeholder="IB Username"
                      value={ibUsername}
                      onChange={(e) => setIbUsername(e.target.value)}
                      className="bg-black/35 border-white/10 text-white rounded-md h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                    <Input
                      type="password"
                      placeholder="IB Password"
                      value={ibPassword}
                      onChange={(e) => setIbPassword(e.target.value)}
                      className="bg-black/35 border-white/10 text-white rounded-md h-9 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <Button variant="ghost" onClick={() => setShowLoginModal(false)} className="text-xs rounded-md text-white hover:bg-white/5">Cancel</Button>
                    <Button
                      onClick={() => handleIbLogin(ibUsername, ibPassword)}
                      disabled={loginLoading || !ibUsername || !ibPassword}
                      className="px-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                    >
                      {loginLoading ? "Connecting..." : "Login"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
