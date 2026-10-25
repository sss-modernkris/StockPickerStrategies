import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Lock, RefreshCcw, Unlock, Database, DollarSign, Briefcase, 
  TrendingUp, Cpu, Sliders, Play, Pause, PlayCircle, Shield, 
  ArrowUpRight, Landmark, Badge, CheckCircle2, AlertTriangle, ToggleLeft,
  Bot, Sparkles, Clock, ArrowRight, FileSpreadsheet, Layers, Activity, Check, Loader2, Zap, RotateCcw,
  Eye, AlertCircle, XCircle, X
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { logger } from '@/lib/logger';
import { IBOrder } from '@/lib/types';

// Custom Robinhood interfaces
interface RHConfig {
  is_connected: boolean;
  mcp_url: string;
  environment: string;
  trading_mode?: string;
  is_simulated: boolean;
  daily_spend_limit: number;
  today_spend_total: number;
  remaining_daily_budget: number;
  position_cap_pct: number;
  emergency_kill_switch: boolean;
  circuit_breaker?: {
    open: boolean;
    consecutive_failures: number;
    reason?: string | null;
  };
  require_hitl: boolean;
  paused: boolean;
  budget_limit: number;
  account_id: string;
  api_key_configured: boolean;
  api_key_status?: {
    valid: boolean;
    mode: string;
    message: string;
    account: string;
    api_key_masked?: string;
  };
  market_status?: {
    now_et: string;
    is_trading_day: boolean;
    session_open: string | null;
    session_close: string | null;
    market_open: boolean;
    broker_rest_window: boolean;
    calendar_source: string;
  };
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
  queued_orders?: Array<{
    order_id: string;
    symbol: string;
    ticker?: string;
    action: string;
    side?: string;
    quantity: number;
    total_quantity?: number;
    price: number;
    status: string;
    timestamp: string;
    created_at?: string;
  }>;
  orders?: any[];
}

export interface PipelineStatus {
  pipeline_active: boolean;
  is_running: boolean;
  scheduler_enabled?: boolean;
  scheduler_running?: boolean;
  scheduled_time_est: string;
  schedule_description: string;
  next_run_time_est?: string;
  last_run_time: string | null;
  last_trigger_source?: string | null;
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
      buys_stock: Array<{
        symbol: string;
        action: string;
        quantity: number;
        target_quantity?: number;
        price: number;
        total_cost: number;
        rank: number;
        status: string;
        partial_fill?: boolean;
        mcp_response: string;
      }>;
      buys_options: Array<{
        symbol: string;
        option_type: string;
        strike: number;
        expiry_date: string;
        contracts: number;
        target_contracts?: number;
        premium: number;
        total_cost: number;
        rank: number;
        status: string;
        partial_fill?: boolean;
        mcp_response: string;
      }>;
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
  const [activeTab] = useState<'rh'>('rh'); // Robinhood Agentic AI active (IB disabled per user request)

  // --- Robinhood Agentic AI State ---
  const [rhConfig, setRhConfig] = useState<RHConfig | null>(null);
  const [rhData, setRhData] = useState<RHData | null>(null);
  const [rhMcpUrl, setRhMcpUrl] = useState('https://agent.robinhood.com/mcp/trading');
  const [rhSimulate, setRhSimulate] = useState(true);
  const [rhLoading, setRhLoading] = useState(false);
  
  // Guardrail Controls State
  const [rhEnvironment, setRhEnvironment] = useState<string>('SANDBOX');
  const [rhDailyLimitInput, setRhDailyLimitInput] = useState('5000');
  const [rhPositionCapInput, setRhPositionCapInput] = useState('15');
  const [rhKillSwitch, setRhKillSwitch] = useState(false);
  const [rhRequireHitl, setRhRequireHitl] = useState(true);
  const [guardrailsSaving, setGuardrailsSaving] = useState(false);
  const isLive = rhEnvironment !== 'SANDBOX';

  // Live Trading, Approval & Ledger State
  const [pendingPlan, setPendingPlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planActionMsg, setPlanActionMsg] = useState<string | null>(null);
  const [planActionError, setPlanActionError] = useState<string | null>(null);
  const [liveLedgerRecords, setLiveLedgerRecords] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [autonomousConfirmOpen, setAutonomousConfirmOpen] = useState(false);
  const [autonomousInput, setAutonomousInput] = useState('');

  // --- Automated AI Pipeline State ---
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState<boolean>(false);
  const [pipelineReport, setPipelineReport] = useState<PipelineReport | null>(null);

  // Controls & Manual Orders State
  const [rhBudgetInput, setRhBudgetInput] = useState('5000');
  const [tradeTicker, setTradeTicker] = useState('NVDA');
  const [tradeAction, setTradeAction] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeQty, setTradeQty] = useState('10');
  const [tradePrice, setTradePrice] = useState('125.00');
  const [priceLoading, setPriceLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [tradePreviewing, setTradePreviewing] = useState<boolean>(false);
  const [tradePreviewData, setTradePreviewData] = useState<any>(null);

  // Global messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Fetching & Configuration logic ---

  // Robinhood Config & Data Checks
  const checkRhConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rh/config`);
      if (res.ok) {
        const data: RHConfig = await res.json();
        setRhConfig(data);
        setRhMcpUrl(data.mcp_url);
        setRhEnvironment(data.environment || 'SANDBOX');
        setRhDailyLimitInput((data.daily_spend_limit || 5000).toString());
        setRhPositionCapInput((data.position_cap_pct || 15).toString());
        setRhKillSwitch(Boolean(data.emergency_kill_switch || data.paused));
        setRhRequireHitl(Boolean(data.require_hitl));
        if (data.is_connected) {
          fetchRhData();
        }
      }
    } catch (err) {
      logger.error("Failed to check Robinhood config", err);
    }
  };

  const handleSaveGuardrails = async (overrides?: { environment?: 'SANDBOX' | 'LIVE'; emergency_kill_switch?: boolean }) => {
    try {
      setGuardrailsSaving(true);
      setError(null);
      setSuccessMsg(null);

      const targetEnv = overrides?.environment ?? rhEnvironment;
      const targetKill = overrides?.emergency_kill_switch ?? rhKillSwitch;
      const dailyLim = parseFloat(rhDailyLimitInput) || 5000;
      const posCap = parseFloat(rhPositionCapInput) || 15;

      const payload = {
        environment: targetEnv,
        daily_spend_limit: dailyLim,
        position_cap_pct: posCap,
        emergency_kill_switch: targetKill,
        require_hitl: rhRequireHitl,
        paused: targetKill
      };

      const res = await fetch(`${API_BASE_URL}/api/rh/controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(
          targetKill 
            ? "EMERGENCY KILL SWITCH ACTIVATED: Trading execution is halted!" 
            : `Guardrails updated: Environment=${targetEnv}, Daily Limit=$${dailyLim.toLocaleString()}, Position Cap=${posCap}%`
        );
        checkRhConfig();
        fetchRhData();
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to update guardrails.");
      }
    } catch (err) {
      setError("Error saving guardrail settings.");
    } finally {
      setGuardrailsSaving(false);
    }
  };

  const fetchPendingPlan = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agents/broker/pending-plan`);
      if (res.ok) {
        const data = await res.json();
        setPendingPlan(data.has_plan ? data : null);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleApprovePlan = async () => {
    try {
      setPlanLoading(true);
      setError(null);
      setPlanActionError(null);
      setPlanActionMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/agents/broker/approve`, { method: 'POST' });
      if (res.ok) {
        setPlanActionMsg("Plan approved! Live orders submitted through LiveExecutionGateway.");
        fetchPendingPlan();
        fetchRhData();
        fetchLiveLedger();
      } else {
        const err = await res.json();
        setPlanActionError(err.detail || "Failed to approve plan.");
      }
    } catch (e) {
      setPlanActionError("Network error approving plan.");
    } finally {
      setPlanLoading(false);
    }
  };

  const handleRejectPlan = async () => {
    try {
      setPlanLoading(true);
      setError(null);
      setPlanActionError(null);
      setPlanActionMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/agents/broker/reject`, { method: 'POST' });
      if (res.ok) {
        setPlanActionMsg("Plan rejected.");
        fetchPendingPlan();
        fetchLiveLedger();
      } else {
        const err = await res.json();
        setPlanActionError(err.detail || "Failed to reject plan.");
      }
    } catch (e) {
      setPlanActionError("Network error rejecting plan.");
    } finally {
      setPlanLoading(false);
    }
  };

  const fetchLiveLedger = async () => {
    try {
      setLedgerLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/trading/live/ledger?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setLiveLedgerRecords(data.records || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleSwitchMode = async (mode: string, confirmation?: string) => {
    try {
      setGuardrailsSaving(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/trading/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, confirmation })
      });
      if (res.ok) {
        setRhEnvironment(mode);
        setSuccessMsg(`Operating mode switched to ${mode}.`);
        setAutonomousConfirmOpen(false);
        setAutonomousInput('');
        checkRhConfig();
        fetchRhData();
        fetchLiveLedger();
        fetchPendingPlan();
      } else {
        const err = await res.json();
        setError(err.detail || "Failed to change mode.");
      }
    } catch (e) {
      setError("Error changing trading mode.");
    } finally {
      setGuardrailsSaving(false);
    }
  };

  const handleToggleKillSwitch = async () => {
    const nextState = !rhKillSwitch;
    setRhKillSwitch(nextState);
    try {
      const res = await fetch(`${API_BASE_URL}/api/trading/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextState, reason: "Manual UI toggle" })
      });
      if (res.ok) {
        setSuccessMsg(nextState ? "EMERGENCY KILL SWITCH ENGAGED! All trading halted." : "Kill switch released.");
        checkRhConfig();
      }
    } catch (e) {
      handleSaveGuardrails({ emergency_kill_switch: nextState });
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

  const handleRhResetSandbox = async () => {
    if (!window.confirm("Are you sure you want to reset the Robinhood Sandbox? This will clear all holdings, option contracts, and orders, resetting cash to $25,000.")) {
      return;
    }
    try {
      setRhLoading(true);
      setError(null);
      setSuccessMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/rh/reset`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.message || "Robinhood Sandbox reset successfully to $25,000 cash.");
        setPipelineReport(null);
        fetchRhData();
      } else {
        setError("Failed to reset sandbox.");
      }
    } catch (err) {
      setError("Error resetting sandbox.");
    } finally {
      setRhLoading(false);
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
        setTradePreviewData(null);
        fetchRhData();
        fetchLiveLedger();
      } else {
        const errData = await res.json();
        setTradeError(errData.detail || "Trade failed.");
        fetchLiveLedger();
      }
    } catch (err) {
      setTradeError("An error occurred executing the trade.");
      fetchLiveLedger();
    }
  };

  const handleRhTradePreview = async () => {
    setTradeError(null);
    setTradeSuccess(null);
    setTradePreviewData(null);

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
      setTradePreviewing(true);
      const res = await fetch(
        `${API_BASE_URL}/api/rh/order?ticker=${tradeTicker}&action=${tradeAction}&quantity=${qty}&price=${price}&preview=true`,
        { method: 'POST' }
      );

      if (res.ok) {
        const result = await res.json();
        setTradeSuccess(result.message);
        setTradePreviewData(result.order);
        fetchLiveLedger();
      } else {
        const errData = await res.json();
        setTradeError(errData.detail || "Preview checks failed.");
        fetchLiveLedger();
      }
    } catch (err) {
      setTradeError("An error occurred running the pre-trade review.");
      fetchLiveLedger();
    } finally {
      setTradePreviewing(false);
    }
  };

  const fetchTickerPrice = async (symbol: string) => {
    if (!symbol) return;
    try {
      setPriceLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/quote/${encodeURIComponent(symbol.trim().toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.price != null && !isNaN(Number(data.price))) {
          setTradePrice(Number(data.price).toFixed(2));
        }
      }
    } catch (err) {
      logger.error("Failed to fetch quote for " + symbol, err);
    } finally {
      setPriceLoading(false);
    }
  };

  const handleTickerChange = (newTicker: string) => {
    setTradeTicker(newTicker);
    fetchTickerPrice(newTicker);
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
      setPlanActionError(null);
      setPlanActionMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/agents/pipeline/run`, { method: 'POST' });
      if (res.ok) {
        const report: PipelineReport = await res.json();
        setPipelineReport(report);

        // Dynamic success message according to the active operating mode
        const mode = report.trading_mode || rhEnvironment;
        let modeMsg = "Automated Daily Pipeline executed successfully in Robinhood MCP Sandbox!";
        if (mode === 'LIVE_APPROVAL') {
          modeMsg = "Automated Daily Pipeline executed! Proposed rebalance plan is queued below for your review & approval.";
          setPlanActionMsg("New rebalance plan generated by daily pipeline. Review proposed trades and approve or reject below.");
        } else if (mode === 'LIVE_AUTONOMOUS') {
          modeMsg = "Automated Daily Pipeline executed successfully in Live Autonomous mode via Robinhood MCP!";
        } else if (mode === 'LIVE_SHADOW') {
          modeMsg = "Automated Daily Pipeline executed in Live Shadow mode! Shadow orders recorded to live ledger.";
        }
        setSuccessMsg(modeMsg);

        fetchRhData();
        fetchPipelineStatus();
        fetchPendingPlan();
        fetchLiveLedger();
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
    checkRhConfig();
    fetchPipelineStatus();
    fetchTickerPrice(tradeTicker);
    fetchPendingPlan();
    fetchLiveLedger();

    const interval = setInterval(() => {
      fetchPendingPlan();
      fetchLiveLedger();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Selector & Global Alert messages */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/40 backdrop-blur-md p-4 rounded-xl border border-white/5 shadow-lg">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Broker Connections</h2>
          <p className="text-xs text-muted-foreground">Link and manage your brokerage platforms & AI trading agents</p>
        </div>
        <div className="flex items-center gap-2 bg-black/45 px-3 py-1.5 rounded-lg border border-emerald-500/30">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-xs text-white">Robinhood Agentic AI</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold">Active</span>
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
                        Specialized AI Agents &amp; Robinhood MCP Pipeline
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {rhEnvironment}
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
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-emerald-500/20 text-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-muted-foreground text-[11px]">24x7 Auto-Trigger:</span>
                    <span className="font-semibold text-white text-[11px]">
                      {pipelineStatus?.next_run_time_est ? `Next: ${pipelineStatus.next_run_time_est}` : "2:00 PM EST (Mon-Fri)"}
                    </span>
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
                        <div className="font-bold text-emerald-400 flex items-center justify-between">
                          <span>Purchased Stocks &amp; Options ({pipelineReport.stage_2_broker.actions.buys_stock.length + pipelineReport.stage_2_broker.actions.buys_options.length})</span>
                          <span className="text-[10px] text-muted-foreground font-normal">Stage 1 Sizing &amp; Fills</span>
                        </div>
                        <div className="space-y-1.5 font-mono text-[11px]">
                          {pipelineReport.stage_2_broker.actions.buys_stock.map((b, i) => {
                            const isPartial = b.status === 'PARTIAL' || (b.target_quantity != null && b.quantity < b.target_quantity && b.quantity > 0);
                            const isSkipped = b.status === 'SKIPPED' || b.quantity === 0;
                            return (
                              <div key={`stk-${i}`} className="flex justify-between items-center text-muted-foreground bg-black/25 px-2 py-1.5 rounded border border-white/5">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isSkipped 
                                      ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' 
                                      : isPartial 
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}>
                                    {b.status}
                                  </span>
                                  <span className="text-white font-semibold">
                                    BUY {b.quantity}{b.target_quantity && b.target_quantity !== b.quantity ? `/${b.target_quantity}` : ''} shs {b.symbol}
                                  </span>
                                  <span className="text-zinc-400 text-[10px]">@{formatMoney(b.price)}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-white font-semibold">{formatMoney(b.total_cost)}</span>
                                </div>
                              </div>
                            );
                          })}
                          {pipelineReport.stage_2_broker.actions.buys_options.map((o, i) => {
                            const isPartial = o.status === 'PARTIAL' || (o.target_contracts != null && o.contracts < o.target_contracts && o.contracts > 0);
                            const isSkipped = o.status === 'SKIPPED' || o.contracts === 0;
                            return (
                              <div key={`opt-${i}`} className="flex justify-between items-center text-indigo-300 bg-black/25 px-2 py-1.5 rounded border border-white/5">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isSkipped 
                                      ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' 
                                      : isPartial 
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  }`}>
                                    {o.status}
                                  </span>
                                  <span className="text-indigo-200 font-semibold">
                                    BUY {o.contracts}{o.target_contracts && o.target_contracts !== o.contracts ? `/${o.target_contracts}` : ''}x {o.symbol} ${o.strike} CALL
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-white font-semibold">{formatMoney(o.total_cost)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ========================================================================= */}
          {/* ROBINHOOD AGENTIC TRADING RISK FIREWALL & GUARDRAILS CONTROL CENTER */}
          {/* ========================================================================= */}
          <Card className="bg-gradient-to-br from-black/60 via-card/40 to-black/60 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base font-bold flex items-center gap-2">
                      Agentic Risk Firewall &amp; Execution Guardrails
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                        rhEnvironment === 'LIVE_AUTONOMOUS' 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                          : rhEnvironment === 'LIVE_APPROVAL'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : rhEnvironment === 'LIVE_SHADOW'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {rhEnvironment === 'LIVE_AUTONOMOUS' 
                          ? '⚡ LIVE AUTONOMOUS (REAL MONEY)' 
                          : rhEnvironment === 'LIVE_APPROVAL'
                            ? '⏳ LIVE APPROVAL (HITL GATEWAY)'
                            : rhEnvironment === 'LIVE_SHADOW'
                              ? '👁️ LIVE SHADOW (REAL DATA, SIM ORDERS)'
                              : '🛡️ SANDBOX SIMULATION (0% RISK)'}
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Enforce institutional safety limits, daily spend caps, position allocation ceilings, and emergency controls.
                    </CardDescription>
                  </div>
                </div>

                {/* Emergency Kill Switch Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleKillSwitch()}
                  disabled={guardrailsSaving}
                  className={`h-9 font-bold text-xs flex items-center gap-2 transition-all ${
                    rhKillSwitch
                      ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-lg shadow-red-600/30 animate-pulse'
                      : 'bg-red-950/40 hover:bg-red-900/60 text-red-400 border-red-500/30 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  {rhKillSwitch ? '🚨 KILL SWITCH ENGAGED (TRADING HALTED)' : 'EMERGENCY KILL SWITCH'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Guardrail Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Operating Environment Switcher (4 Modes) */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Operating Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSwitchMode('SANDBOX')}
                      disabled={guardrailsSaving}
                      className={`h-7 px-1.5 text-[11px] font-semibold ${
                        rhEnvironment === 'SANDBOX'
                          ? 'bg-emerald-500 text-black hover:bg-emerald-400 font-bold shadow-md shadow-emerald-500/20'
                          : 'bg-black/40 text-muted-foreground hover:text-white border border-white/5'
                      }`}
                      title="Internal sandbox simulator (0% real money risk)"
                    >
                      🛡️ Sandbox
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSwitchMode('LIVE_SHADOW')}
                      disabled={guardrailsSaving}
                      className={`h-7 px-1.5 text-[11px] font-semibold ${
                        rhEnvironment === 'LIVE_SHADOW'
                          ? 'bg-cyan-500 text-black hover:bg-cyan-400 font-bold shadow-md shadow-cyan-500/20'
                          : 'bg-black/40 text-muted-foreground hover:text-white border border-white/5'
                      }`}
                      title="Live Robinhood MCP: Real quotes & portfolio, shadow simulated orders"
                    >
                      👁️ Shadow
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSwitchMode('LIVE_APPROVAL')}
                      disabled={guardrailsSaving}
                      className={`h-7 px-1.5 text-[11px] font-semibold ${
                        rhEnvironment === 'LIVE_APPROVAL'
                          ? 'bg-amber-500 text-black hover:bg-amber-400 font-bold shadow-md shadow-amber-500/20'
                          : 'bg-black/40 text-muted-foreground hover:text-white border border-white/5'
                      }`}
                      title="Live Robinhood MCP: Plans queued for HITL human approval"
                    >
                      ⏳ Approval
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setAutonomousInput('');
                        setAutonomousConfirmOpen(true);
                      }}
                      disabled={guardrailsSaving}
                      className={`h-7 px-1.5 text-[11px] font-semibold ${
                        rhEnvironment === 'LIVE_AUTONOMOUS'
                          ? 'bg-rose-600 text-white hover:bg-rose-500 font-bold shadow-md shadow-rose-600/30 animate-pulse'
                          : 'bg-black/40 text-rose-400/80 hover:text-rose-300 border border-rose-500/20'
                      }`}
                      title="Autonomous live trading with real money via Robinhood Agentic MCP"
                    >
                      ⚡ Auto
                    </Button>
                  </div>
                </div>

                {/* 2. Daily Spend Limit */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daily Spend Cap ($)</label>
                    <span className="text-[10px] font-mono text-emerald-400">
                      Rem: {formatMoney(rhConfig?.remaining_daily_budget ?? 5000)}
                    </span>
                  </div>
                  <Input
                    type="number"
                    step="100"
                    value={rhDailyLimitInput}
                    onChange={(e) => setRhDailyLimitInput(e.target.value)}
                    className="bg-black/60 border-white/10 rounded-md text-white h-8 text-xs font-mono"
                    placeholder="5000"
                  />
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all" 
                      style={{ width: `${Math.min(100, ((rhConfig?.today_spend_total || 0) / (parseFloat(rhDailyLimitInput) || 5000)) * 100)}%` }} 
                    />
                  </div>
                </div>

                {/* 3. Position Equity Cap */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max Position Cap (%)</label>
                    <span className="text-[10px] font-mono text-indigo-400">Max Single Asset</span>
                  </div>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    value={rhPositionCapInput}
                    onChange={(e) => setRhPositionCapInput(e.target.value)}
                    className="bg-black/60 border-white/10 rounded-md text-white h-8 text-xs font-mono"
                    placeholder="15"
                  />
                  <div className="text-[10px] text-muted-foreground">
                    Max {rhPositionCapInput}% equity per stock/option
                  </div>
                </div>

                {/* 4. Actions & Telemetry */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">API Status:</span>
                    <span className="text-emerald-400 font-mono text-[10px] font-semibold truncate max-w-[120px]">
                      {rhConfig?.api_key_status?.mode || 'Active'}
                    </span>
                  </div>
                  <Button
                    onClick={() => handleSaveGuardrails()}
                    disabled={guardrailsSaving}
                    className="w-full h-8 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white mt-2 shadow-md shadow-indigo-600/20"
                  >
                    {guardrailsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Guardrails'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================================= */}
          {/* BROKER AGENT PENDING APPROVAL NOTIFICATION & QUEUE CARD */}
          {/* ========================================================================= */}

          {/* Plan Status Banner (Approve / Reject / Expired feedback placed directly above plan) */}
          {(planActionMsg || planActionError) && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              {planActionMsg && (
                <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm p-3.5 rounded-xl font-medium flex items-center justify-between shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    <span>{planActionMsg}</span>
                  </div>
                  <button
                    onClick={() => setPlanActionMsg(null)}
                    className="p-1 rounded-md text-emerald-300 hover:text-white hover:bg-emerald-500/20 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {planActionError && (
                <div className="bg-rose-500/20 border border-rose-500/50 text-rose-200 text-sm p-3.5 rounded-xl font-medium flex items-center justify-between shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                    <span className="font-semibold">{planActionError}</span>
                  </div>
                  <button
                    onClick={() => setPlanActionError(null)}
                    className="p-1 rounded-md text-rose-300 hover:text-white hover:bg-rose-500/20 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Live Approval empty state banner when no pending plan is queued */}
          {rhEnvironment === 'LIVE_APPROVAL' && (!pendingPlan || !pendingPlan.has_plan) && (
            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs text-amber-200/80 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  <strong>Live Approval Mode Active:</strong> No pending execution plans awaiting review. Click &quot;Run Daily Pipeline Now&quot; above to trigger analysis and queue a new rebalance proposal.
                </span>
              </div>
            </div>
          )}

          {/* Pending Approval Queue Card */}
          {pendingPlan && pendingPlan.has_plan && (
            <Card className="bg-gradient-to-br from-amber-950/40 via-card/50 to-amber-950/20 border-amber-500/40 shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader className="pb-3 border-b border-amber-500/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg border ${pendingPlan.is_expired ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}>
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-base font-bold flex items-center gap-2">
                        Broker Agent Pending Approval Plan
                        {pendingPlan.is_expired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold">
                            EXPIRED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                            TTL: {Math.max(0, Math.floor(pendingPlan.seconds_remaining || 0))}s remaining
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs text-amber-200/70">
                        Plan ID: <span className="font-mono text-white">{pendingPlan.plan?.plan_id}</span> | Created: {pendingPlan.plan?.created_at ? new Date(pendingPlan.plan.created_at).toLocaleTimeString() : '--'} | Target Mode: {pendingPlan.plan?.mode || 'LIVE_APPROVAL'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRejectPlan}
                      disabled={planLoading}
                      className="bg-black/40 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 hover:text-white text-xs font-bold h-9"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Reject Plan
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApprovePlan}
                      disabled={planLoading || pendingPlan.is_expired}
                      className={`font-bold text-xs h-9 shadow-lg ${
                        pendingPlan.is_expired 
                          ? 'bg-zinc-700 opacity-60 cursor-not-allowed text-zinc-300' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      }`}
                      title={pendingPlan.is_expired ? pendingPlan.plan?.expiration_reason || "Plan expired" : "Approve and execute plan"}
                    >
                      {planLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                      {pendingPlan.is_expired ? 'Plan Expired' : 'Approve & Execute via Live Gateway'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {pendingPlan.is_expired && (
                  <div className="p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>
                      <strong>Notice:</strong> {pendingPlan.plan?.expiration_reason || "Plan expired: passed daily market close cutoff (15:55 ET)"}. Please reject this plan or click &quot;Run Daily Pipeline Now&quot; above to generate a fresh one.
                    </span>
                  </div>
                )}
                {/* Planned Liquidations */}
                {((pendingPlan.plan?.liquidations && pendingPlan.plan.liquidations.length > 0) || (pendingPlan.plan?.planned_actions?.sells && pendingPlan.plan.planned_actions.sells.length > 0)) && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Planned Liquidations ({((pendingPlan.plan?.liquidations || pendingPlan.plan?.planned_actions?.sells) || []).length})
                    </div>
                    <div className="rounded-md border border-white/10 overflow-x-auto bg-black/40">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="text-xs text-white">Symbol</TableHead>
                            <TableHead className="text-xs text-right text-white">Quantity</TableHead>
                            <TableHead className="text-xs text-right text-white">Current Price</TableHead>
                            <TableHead className="text-xs text-right text-white">Est. Proceeds</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(pendingPlan.plan?.liquidations || pendingPlan.plan?.planned_actions?.sells || []).map((liq: any, idx: number) => (
                            <TableRow key={idx} className="border-white/5">
                              <TableCell className="font-bold text-rose-300">{liq.symbol}</TableCell>
                              <TableCell className="text-right font-mono text-white">{liq.quantity}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{formatMoney(liq.current_price ?? liq.price)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-emerald-400">{formatMoney(liq.estimated_proceeds ?? (liq.quantity * (liq.current_price ?? liq.price ?? 0)))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Planned Buys */}
                {((pendingPlan.plan?.buys && pendingPlan.plan.buys.length > 0) || (pendingPlan.plan?.planned_actions?.buys_stock && pendingPlan.plan.planned_actions.buys_stock.length > 0)) && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Planned Stock Buys ({((pendingPlan.plan?.buys || pendingPlan.plan?.planned_actions?.buys_stock) || []).length})
                    </div>
                    <div className="rounded-md border border-white/10 overflow-x-auto bg-black/40">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="text-xs text-white">Rank</TableHead>
                            <TableHead className="text-xs text-white">Symbol</TableHead>
                            <TableHead className="text-xs text-right text-white">Quantity</TableHead>
                            <TableHead className="text-xs text-right text-white">Target Price</TableHead>
                            <TableHead className="text-xs text-right text-white">Est. Total Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(pendingPlan.plan?.buys || pendingPlan.plan?.planned_actions?.buys_stock || []).map((b: any, idx: number) => (
                            <TableRow key={idx} className="border-white/5">
                              <TableCell className="font-mono text-muted-foreground text-xs">#{b.rank || (idx + 1)}</TableCell>
                              <TableCell className="font-bold text-emerald-300">{b.symbol}</TableCell>
                              <TableCell className="text-right font-mono text-white">{b.quantity}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">{formatMoney(b.target_price ?? b.price)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-white">{formatMoney(b.suggested_budget ?? b.total_cost ?? (b.quantity * (b.target_price ?? b.price ?? 0)))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  <p className="text-[10px] text-muted-foreground">
                    {rhEnvironment.startsWith('LIVE') ? 'Robinhood Live Buying Power' : 'Sandbox Buying Power (RH-SIM-SANDBOX-001)'}
                  </p>
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
              <div className="font-semibold text-sm text-white/90">Robinhood MCP Active ({rhEnvironment} Mode)</div>
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
                      <CardTitle className="text-white text-base">
                        Active Stock Holdings
                      </CardTitle>
                      <CardDescription>
                        {isLive 
                          ? 'Real equities held in your Robinhood MCP brokerage account' 
                          : 'Simulated equities controlled by the AI Broker Agent sandbox policy'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        isLive 
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {isLive ? `Robinhood MCP (${rhEnvironment})` : 'Sandbox Simulation'}
                      </span>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-white/5 text-white border border-white/10 font-semibold">
                        {(rhData.holdings || []).length} Held
                      </span>
                      {rhData.queued_orders && rhData.queued_orders.length > 0 && (
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-pulse" />
                          {rhData.queued_orders.length} Queued
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Queued Orders Info Notice (when orders are queued outside regular hours) */}
                  {rhData.queued_orders && rhData.queued_orders.length > 0 && (!rhData.holdings || rhData.holdings.length === 0) && (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-lg flex items-start gap-2.5 text-xs text-amber-200 mb-4">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-1">
                        <div className="font-semibold text-amber-300">
                          {rhData.queued_orders.length} Stock Buy Order{rhData.queued_orders.length > 1 ? 's' : ''} Queued in Robinhood MCP:
                        </div>
                        <div className="text-[11px] text-amber-200/80 leading-relaxed">
                          Your buy orders for <strong className="text-white">{rhData.queued_orders.map((q: any) => q.symbol || q.ticker).join(', ')}</strong> were successfully received by Robinhood. Because the regular NYSE session is currently closed, Robinhood has queued them for execution. When regular market hours open (Monday 9:30 AM ET), these orders will execute and appear as active holdings.
                        </div>
                      </div>
                    </div>
                  )}

                  {!rhData.holdings || rhData.holdings.length === 0 ? (
                    (!rhData.queued_orders || rhData.queued_orders.length === 0) ? (
                      <div className="text-center py-10 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5 text-xs">
                        {isLive 
                          ? 'No active stock positions held in your Robinhood MCP account. Orders placed will appear here once submitted or filled.' 
                          : 'No active stock positions. Run the AI Pipeline or execute orders to seed this sandbox portfolio.'}
                      </div>
                    ) : null
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
                          {(rhData.holdings || []).map((h, idx) => (
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

                  {/* Queued Orders Sub-Table */}
                  {rhData.queued_orders && rhData.queued_orders.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          Orders Queued for Market Open ({rhData.queued_orders.length})
                        </div>
                        <span className="text-[10px] font-mono text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                          Awaiting Regular Session Open (Mon 9:30 AM ET)
                        </span>
                      </div>
                      <div className="rounded-md border border-amber-500/25 overflow-x-auto bg-black/35">
                        <Table>
                          <TableHeader className="bg-amber-500/10">
                            <TableRow className="border-amber-500/20">
                              <TableHead className="text-xs text-amber-200">Ticker</TableHead>
                              <TableHead className="text-xs text-amber-200">Action</TableHead>
                              <TableHead className="text-xs text-right text-amber-200">Quantity</TableHead>
                              <TableHead className="text-xs text-right text-amber-200">Limit Price</TableHead>
                              <TableHead className="text-xs text-right text-amber-200">Est. Total</TableHead>
                              <TableHead className="text-xs text-amber-200">Status</TableHead>
                              <TableHead className="text-xs text-amber-200">Time Placed</TableHead>
                              <TableHead className="text-xs text-amber-200">Robinhood Order ID</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rhData.queued_orders.map((qOrd: any, idx: number) => {
                              const sym = qOrd.symbol || qOrd.ticker || '--';
                              const qty = qOrd.quantity != null ? qOrd.quantity : (qOrd.total_quantity || 1);
                              const price = qOrd.price || 0;
                              const totalCost = qty * price;
                              return (
                                <TableRow key={qOrd.order_id || idx} className="border-white/5 hover:bg-white/5">
                                  <TableCell className="font-bold text-white text-sm">{sym}</TableCell>
                                  <TableCell>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      {qOrd.action || qOrd.side || 'BUY'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right text-white font-mono">{qty} sh</TableCell>
                                  <TableCell className="text-right text-emerald-400 font-mono font-medium">{formatMoney(price)}</TableCell>
                                  <TableCell className="text-right text-white font-mono font-semibold">{formatMoney(totalCost)}</TableCell>
                                  <TableCell>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                      ● {qOrd.status || 'QUEUED'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                    {qOrd.timestamp || qOrd.created_at || '--'}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[120px]" title={qOrd.order_id}>
                                    {qOrd.order_id ? qOrd.order_id.slice(0, 10) + '...' : '--'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
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
                  <CardTitle className="text-white text-base flex items-center justify-between">
                    <span>Execution Playground</span>
                    <div className="flex items-center gap-1.5">
                      {rhConfig?.market_status && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          rhConfig.market_status.market_open
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`} title={rhConfig.market_status.market_open ? "Regular NYSE market session open (9:30 AM - 4:00 PM ET)" : "Outside regular NYSE market session hours"}>
                          {rhConfig.market_status.market_open ? "● NYSE Open" : "○ NYSE Closed"}
                        </span>
                      )}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        isLive 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {rhEnvironment}
                      </span>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {isLive 
                      ? 'Push ad-hoc orders directly to your Robinhood MCP trading account' 
                      : 'Push ad-hoc test orders directly to the local Sandbox environment'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRhTradeSubmit} className="space-y-4">
                    {isLive && rhConfig?.market_status && !rhConfig.market_status.market_open && (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-2.5 rounded-md flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <span className="font-semibold">NYSE Regular Market Hours Closed: </span>
                          Live orders placed now will be transmitted to Robinhood and queued for execution when the market opens. Track execution updates below in the Live Gateway Audit Ledger.
                        </div>
                      </div>
                    )}
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
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ticker Symbol</label>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {priceLoading ? "Fetching quote..." : `Price: $${tradePrice}`}
                        </span>
                      </div>
                      <select 
                        value={tradeTicker}
                        onChange={(e) => handleTickerChange(e.target.value)}
                        className="w-full bg-black/45 border-white/10 rounded-md h-9 text-xs text-white px-2 focus:border-emerald-500/50 font-medium"
                      >
                        {/* Recommendations from Stage 1 if available */}
                        {pipelineReport?.stage_1_backtester.ranked_recommendations && pipelineReport.stage_1_backtester.ranked_recommendations.length > 0 && (
                          <optgroup label="Stage 1 Recommendations">
                            {pipelineReport.stage_1_backtester.ranked_recommendations.map((r) => (
                              <option key={`rec-${r.symbol}`} value={r.symbol}>
                                {r.symbol} (#{r.rank} - ${r.current_price.toFixed(2)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {/* Active Holdings */}
                        {rhData?.holdings && rhData.holdings.length > 0 && (
                          <optgroup label="Current Holdings">
                            {rhData.holdings.map((h) => (
                              <option key={`hld-${h.symbol}`} value={h.symbol}>
                                {h.symbol} (Held: {h.total_quantity} shs @ ${h.current_price.toFixed(2)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {/* Standard Popular Equities */}
                        <optgroup label="Standard Equities">
                          <option value="NVDA">NVDA (NVIDIA)</option>
                          <option value="TSLA">TSLA (Tesla)</option>
                          <option value="AAPL">AAPL (Apple)</option>
                          <option value="MSFT">MSFT (Microsoft)</option>
                          <option value="AMZN">AMZN (Amazon)</option>
                          <option value="GOOGL">GOOGL (Alphabet)</option>
                          <option value="META">META (Meta)</option>
                          <option value="AVGO">AVGO (Broadcom)</option>
                          <option value="BMY">BMY (Bristol-Myers)</option>
                          <option value="DOW">DOW (Dow Inc)</option>
                          <option value="NOW">NOW (ServiceNow)</option>
                          <option value="DXCM">DXCM (DexCom)</option>
                          <option value="VZ">VZ (Verizon)</option>
                          <option value="F">F (Ford)</option>
                          <option value="JPM">JPM (JPMorgan Chase)</option>
                          <option value="SPY">SPY (S&P 500 ETF)</option>
                          <option value="QQQ">QQQ (Invesco QQQ)</option>
                        </optgroup>
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
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Limit Price ($)</label>
                          <button
                            type="button"
                            onClick={() => fetchTickerPrice(tradeTicker)}
                            disabled={priceLoading}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                            title="Fetch latest live stock quote"
                          >
                            <RotateCcw className={`w-2.5 h-2.5 ${priceLoading ? 'animate-spin' : ''}`} />
                            {priceLoading ? 'Fetching...' : 'Latest Quote'}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="125.00"
                            value={tradePrice}
                            onChange={(e) => setTradePrice(e.target.value)}
                            className="bg-black/45 border-white/10 rounded-md text-white h-9 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={rhKillSwitch}
                      className={`w-full rounded-md font-bold text-xs h-9 uppercase tracking-wider shadow-md ${
                        rhKillSwitch 
                          ? 'bg-red-800/50 text-red-300 cursor-not-allowed'
                          : isLive
                            ? 'bg-amber-500 text-black hover:bg-amber-400'
                            : 'bg-emerald-500 text-black hover:bg-emerald-400'
                      }`}
                    >
                      {rhKillSwitch ? 'Blocked by Kill Switch' : 'Execute Order'}
                    </Button>

                    {isLive && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={tradePreviewing}
                        onClick={handleRhTradePreview}
                        className="w-full rounded-md font-semibold text-xs h-8 border-white/10 hover:bg-white/5 text-amber-300 flex items-center justify-center gap-1.5"
                      >
                        {tradePreviewing ? "Verifying with Robinhood MCP..." : "Pre-Check / Review Order (Dry Run)"}
                      </Button>
                    )}

                    {tradePreviewData && (
                      <div className="bg-black/45 border border-white/10 p-3 rounded-md space-y-2 text-xs font-mono">
                        <div className="text-[11px] text-muted-foreground uppercase font-sans font-bold flex items-center justify-between">
                          <span>Robinhood MCP Verification</span>
                          <span className="text-emerald-400 font-normal">Checks Passed</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-white">
                          <div>Symbol: <span className="font-bold">{tradePreviewData.data?.symbol || tradeTicker}</span></div>
                          <div>Side: <span className="font-bold">{tradePreviewData.data?.side?.toUpperCase() || tradeAction}</span></div>
                          <div>Qty: <span className="font-bold">{tradePreviewData.data?.quantity || tradeQty}</span></div>
                          <div>Limit: <span className="font-bold">${tradePreviewData.data?.limit_price || tradePrice}</span></div>
                        </div>
                        {tradePreviewData.data?.quote_data && (
                          <div className="text-[11px] text-muted-foreground border-t border-white/5 pt-1.5 flex justify-between">
                            <span>Bid: ${tradePreviewData.data.quote_data.bid_price}</span>
                            <span>Ask: ${tradePreviewData.data.quote_data.ask_price}</span>
                            <span>Last: ${tradePreviewData.data.quote_data.last_trade_price}</span>
                          </div>
                        )}
                        {tradePreviewData.data?.market_data_disclosure && (
                          <div className="text-[10px] text-muted-foreground italic border-t border-white/5 pt-1 leading-tight">
                            {tradePreviewData.data.market_data_disclosure}
                          </div>
                        )}
                      </div>
                    )}
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
                        {(rhData.orders || []).length} Executed Orders
                      </span>
                    </CardTitle>
                    <CardDescription>Live audit log of stock and option orders executed via Robinhood MCP</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isLive && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRhResetSandbox} 
                        className="text-xs text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-300 flex items-center gap-1.5 h-8"
                        title="Reset cash to $25,000 and clear all holdings & orders"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Sandbox
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={fetchRhData} className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-white h-8">
                      <RefreshCcw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {!rhData.orders || rhData.orders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5 text-xs">
                    No orders registered yet in this session. Execute the pipeline to populate the ledger.
                  </div>
                ) : (
                  <div className="rounded-md border border-white/5 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-black/35">
                        <TableRow className="border-white/5">
                          <TableHead className="text-xs text-white">Date &amp; Time</TableHead>
                          <TableHead className="text-xs text-white">Mode</TableHead>
                          <TableHead className="text-xs text-white">Symbol / Contract</TableHead>
                          <TableHead className="text-xs text-white">Action</TableHead>
                          <TableHead className="text-xs text-right text-white">Amount (Filled/Total)</TableHead>
                          <TableHead className="text-xs text-right text-white">Price / Premium</TableHead>
                          <TableHead className="text-xs text-white">Status</TableHead>
                          <TableHead className="text-xs text-white">Order ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(rhData.orders || []).map((ord, idx) => (
                          <TableRow key={ord.order_id || idx} className="border-white/5 hover:bg-white/5">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">{ord.last_update || (ord as any).timestamp}</TableCell>
                            <TableCell>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                (ord as any).environment === 'LIVE'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {(ord as any).environment || 'SANDBOX'}
                              </span>
                            </TableCell>
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

          {/* Live Gateway Audit Ledger (JSONL) */}
          <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl animate-in fade-in duration-300">
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    Robinhood Live Gateway Audit Ledger
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {liveLedgerRecords.length} Events (ledger.jsonl)
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Append-only audit trail logging every pre-flight firewall check, execution fill, and human approval decision
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchLiveLedger}
                  disabled={ledgerLoading}
                  className="text-xs text-muted-foreground flex items-center gap-1.5 hover:text-white h-8"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${ledgerLoading ? 'animate-spin' : ''}`} />
                  Refresh Ledger
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {liveLedgerRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5 text-xs">
                  No events recorded in the live audit ledger yet.
                </div>
              ) : (
                <div className="rounded-md border border-white/5 overflow-x-auto max-h-96">
                  <Table>
                    <TableHeader className="bg-black/35 sticky top-0 z-10 backdrop-blur-md">
                      <TableRow className="border-white/5">
                        <TableHead className="text-xs text-white">Timestamp</TableHead>
                        <TableHead className="text-xs text-white">Event</TableHead>
                        <TableHead className="text-xs text-white">Mode</TableHead>
                        <TableHead className="text-xs text-white">Symbol / Target</TableHead>
                        <TableHead className="text-xs text-white">Side / Action</TableHead>
                        <TableHead className="text-xs text-right text-white">Qty</TableHead>
                        <TableHead className="text-xs text-right text-white">Price</TableHead>
                        <TableHead className="text-xs text-white">Status / Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liveLedgerRecords.map((r, idx) => {
                        const d = r.details || {};
                        const symbol = d.symbol || d.ticker || r.symbol || '--';
                        const side = d.side || d.action || r.side || r.action || '--';
                        const qty = d.quantity != null ? d.quantity : (r.quantity != null ? r.quantity : (r.target_quantity != null ? r.target_quantity : '--'));
                        const price = d.price != null ? formatMoney(d.price) : (d.limit_price != null ? formatMoney(d.limit_price) : (r.price != null ? formatMoney(r.price) : (r.limit_price != null ? formatMoney(r.limit_price) : '--')));
                        const status = d.status || r.status || (r.event.includes('FAILED') || r.event.includes('BLOCKED') || r.event.includes('REJECTED') ? 'BLOCKED' : 'LOGGED');
                        const message = d.summary || d.reason || d.message || r.summary || r.reason || r.error || (r.order_id ? `Order ID: ${r.order_id}` : (r.client_order_id ? `Client ID: ${r.client_order_id}` : ''));

                        return (
                          <TableRow key={idx} className="border-white/5 hover:bg-white/5 text-xs">
                            <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                              {r.ts ? new Date(r.ts).toLocaleTimeString() : (r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '--')}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-[10px] font-semibold text-cyan-300">
                                {r.event}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/5 border border-white/10 text-white">
                                {r.mode || '--'}
                              </span>
                            </TableCell>
                            <TableCell className="font-bold text-white">{symbol}</TableCell>
                            <TableCell>
                              {side !== '--' && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                                }`}>
                                  {side}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-white">{qty}</TableCell>
                            <TableCell className="text-right font-mono text-emerald-400">{price}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 max-w-xs">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap ${
                                  status === 'FILLED' || status === 'EXECUTED' || status === 'SUCCESS'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : status === 'QUEUED' || status === 'CONFIRMED' || status === 'PENDING' || status === 'QUEUING'
                                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                      : status === 'BLOCKED' || status === 'REJECTED' || status === 'FAILED'
                                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}>
                                  {status}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate" title={message}>
                                  {message}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* Autonomous Confirmation Modal */}
      {autonomousConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl border-rose-500/30 bg-black/95 backdrop-blur-md animate-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-rose-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-white text-lg font-bold">
                    Activate Autonomous Live Trading
                  </CardTitle>
                  <CardDescription className="text-xs text-rose-300/80">
                    REAL MONEY BROKERAGE EXECUTION
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3.5 text-xs text-rose-200 space-y-2">
                <p className="font-semibold text-rose-100 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-400" /> Warning: Unattended Real-Money Orders
                </p>
                <p className="leading-relaxed">
                  You are about to switch the Robinhood Broker Agent into <strong className="text-white">LIVE_AUTONOMOUS</strong> mode.
                  Real stock orders will be automatically submitted to your linked Robinhood Brokerage Account without manual confirmation.
                </p>
                <p className="text-[11px] text-rose-300">
                  Equities only. Governed by the Live Gateway firewall (kill switch, rest window, 0.5% max spread, daily spend limits).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Type <span className="font-mono text-rose-300 font-bold select-all">&quot;I UNDERSTAND THIS TRADES REAL MONEY&quot;</span> to confirm:
                </label>
                <Input
                  type="text"
                  placeholder="I UNDERSTAND THIS TRADES REAL MONEY"
                  value={autonomousInput}
                  onChange={(e) => setAutonomousInput(e.target.value)}
                  className="bg-black/60 border-rose-500/30 text-white font-mono text-xs h-9"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAutonomousConfirmOpen(false);
                    setAutonomousInput('');
                  }}
                  className="text-xs rounded-md text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSwitchMode('LIVE_AUTONOMOUS', autonomousInput.trim())}
                  disabled={guardrailsSaving || autonomousInput.trim() !== "I UNDERSTAND THIS TRADES REAL MONEY"}
                  className="px-5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  {guardrailsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Enable Live Autonomous"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
