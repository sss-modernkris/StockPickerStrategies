import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Lock, RefreshCcw, Unlock, Database, DollarSign, Briefcase, 
  TrendingUp, Cpu, Sliders, Play, Pause, PlayCircle, Shield, 
  ArrowUpRight, Landmark, Badge, CheckCircle2, AlertTriangle, ToggleLeft
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
  orders: IBOrder[];
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

  useEffect(() => {
    checkIbConfig();
    checkRhConfig();
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
          
          {/* Main Control Panel and Connect Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2 text-lg">
                      <Cpu className="w-5 h-5 text-emerald-400" /> Setup & Authentication
                    </CardTitle>
                    <CardDescription>Configure Robinhood Agentic Trading MCP Server URL</CardDescription>
                  </div>
                  {rhConfig?.is_connected && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      rhConfig.is_simulated 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${rhConfig.is_simulated ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      {rhConfig.is_simulated ? 'SIMULATED' : 'LIVE'}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Robinhood MCP URL</label>
                    <Input
                      placeholder="https://agent.robinhood.com/mcp/trading"
                      value={rhMcpUrl}
                      disabled={rhConfig?.is_connected}
                      onChange={(e) => setRhMcpUrl(e.target.value)}
                      className="bg-black/35 border-white/10 text-white rounded-md h-10 text-sm focus:border-emerald-500/50 focus:ring-emerald-500/20"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 h-10 px-3 bg-black/25 rounded-md border border-white/10 select-none">
                    <input 
                      type="checkbox" 
                      id="rhSim" 
                      checked={rhSimulate}
                      disabled={rhConfig?.is_connected}
                      onChange={(e) => setRhSimulate(e.target.checked)}
                      className="rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500/30"
                    />
                    <label htmlFor="rhSim" className="text-xs font-semibold text-white cursor-pointer">Use Sandbox Simulation</label>
                  </div>

                  <Button
                    onClick={rhConfig?.is_connected ? handleRhDisconnect : handleRhConnect}
                    disabled={rhLoading || !rhMcpUrl}
                    className={`h-10 px-6 rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                      rhConfig?.is_connected 
                        ? 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20' 
                        : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/10'
                    }`}
                  >
                    {rhConfig?.is_connected ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Disconnect
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Connect via OAuth
                      </>
                    )}
                  </Button>
                </div>
                
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Connecting establishes an encrypted SSE/Model Context Protocol gateway to Robinhood. 
                  Sandbox simulation allows you to test quantitative rebalancing without risking capital.
                </p>
              </CardContent>
            </Card>

            {/* Agent Control & Safeguards Panel */}
            <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <Sliders className="w-5 h-5 text-indigo-400" /> Agent Safeguards
                </CardTitle>
                <CardDescription>Guardrails and autonomous trading controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-black/25 border border-white/5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white">Autonomous Agent Strategy</div>
                    <div className="text-[10px] text-muted-foreground">Allows AI agent to place rebalance orders</div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!rhConfig?.is_connected}
                    variant={rhConfig?.paused ? "default" : "secondary"}
                    onClick={() => handleRhControlUpdate(!rhConfig?.paused, null)}
                    className={`rounded-md px-3 h-8 text-[11px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                      !rhConfig?.is_connected ? 'opacity-40' :
                      rhConfig?.paused 
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20' 
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    {rhConfig?.paused ? (
                      <>
                        <Pause className="w-3 h-3" /> Paused
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" /> Active
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground uppercase tracking-wider">Trading Budget Limit</span>
                    <span className="text-emerald-400 font-bold">{formatMoney(parseFloat(rhBudgetInput) || 0)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={rhBudgetInput}
                      disabled={!rhConfig?.is_connected}
                      onChange={(e) => setRhBudgetInput(e.target.value)}
                      className="bg-black/35 border-white/10 text-white rounded-md h-9 text-xs focus:border-emerald-500/50 focus:ring-emerald-500/20"
                    />
                    <Button
                      size="sm"
                      disabled={!rhConfig?.is_connected}
                      onClick={() => handleRhControlUpdate(null, parseFloat(rhBudgetInput))}
                      className="bg-indigo-600 text-white hover:bg-indigo-500 rounded-md text-xs px-4 font-bold"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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
                  <p className="text-[10px] text-muted-foreground">Real-time buying power in Agentic Account</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-500/5 to-transparent border-white/5 shadow-lg relative overflow-hidden">
                <div className="absolute right-3 top-3 opacity-10"><Briefcase className="w-12 h-12 text-indigo-400" /></div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invested Capital</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white font-mono">{formatMoney(rhData.invested_capital)}</div>
                  <p className="text-[10px] text-muted-foreground">Market value of active rebalance holdings</p>
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
            <div className="text-center py-16 border rounded-xl bg-card/25 border-dashed border-white/10 text-muted-foreground backdrop-blur-md">
              <Cpu className="w-10 h-10 mx-auto mb-3 text-muted-foreground/35 animate-pulse" />
              <div className="font-semibold text-sm text-white/90">Robinhood Agentic AI is disconnected</div>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                Authenticate your AI agent using the OAuth portal above to access balances, review P&L curves, and inspect rebalance history.
              </p>
            </div>
          )}

          {/* Holdings and Interactive Manual Order Exec Form */}
          {rhData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Holdings Table */}
              <Card className="lg:col-span-2 bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-base">Active Sandbox Holdings</CardTitle>
                  <CardDescription>Positions controlled by the Agentic trading policy</CardDescription>
                </CardHeader>
                <CardContent>
                  {rhData.holdings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5">
                      No active holdings. Place a transaction using the execution tool to seed this portfolio.
                    </div>
                  ) : (
                    <div className="rounded-md border border-white/5 overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-black/35">
                          <TableRow className="border-white/5">
                            <TableHead className="text-xs text-white">Ticker</TableHead>
                            <TableHead className="text-xs text-right text-white">Quantity</TableHead>
                            <TableHead className="text-xs text-right text-white">Avg Cost</TableHead>
                            <TableHead className="text-xs text-right text-white">Last Close</TableHead>
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
                </CardContent>
              </Card>

              {/* Manual Execution Form */}
              <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-base">Execution Playground</CardTitle>
                  <CardDescription>Manually push trade orders to the Agentic channel</CardDescription>
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
                        <option value="F">F (Ford)</option>
                        <option value="INTC">INTC (Intel)</option>
                        <option value="KTOS">KTOS (Kratos)</option>
                        <option value="AMBA">AMBA (Ambarella)</option>
                        <option value="CRSR">CRSR (Corsair)</option>
                        <option value="RIVN">RIVN (Rivian)</option>
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
                      className="w-full bg-indigo-600 text-white hover:bg-indigo-500 rounded-md font-bold text-xs h-9 uppercase tracking-wider"
                    >
                      Execute Trade
                    </Button>
                  </form>
                </CardContent>
              </Card>

            </div>
          )}

          {/* Robinhood Order Logs */}
          {rhData && (
            <Card className="bg-card/30 backdrop-blur-md border-white/5 shadow-2xl">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-white text-base">Agentic Activity Ledger</CardTitle>
                    <CardDescription>Complete audit log of trades generated by the AI model context</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchRhData} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <RefreshCcw className="w-3.5 h-3.5" /> Reload
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {rhData.orders.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border rounded-lg bg-black/25 border-dashed border-white/5">
                    No orders registered yet in this session.
                  </div>
                ) : (
                  <div className="rounded-md border border-white/5 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-black/35">
                        <TableRow className="border-white/5">
                          <TableHead className="text-xs text-white">Date & Time</TableHead>
                          <TableHead className="text-xs text-white">Symbol</TableHead>
                          <TableHead className="text-xs text-white">Action</TableHead>
                          <TableHead className="text-xs text-right text-white">Amount (Filled/Total)</TableHead>
                          <TableHead className="text-xs text-right text-white">Price</TableHead>
                          <TableHead className="text-xs text-white">Status</TableHead>
                          <TableHead className="text-xs text-white">Order ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rhData.orders.map((ord) => (
                          <TableRow key={ord.order_id} className="border-white/5 hover:bg-white/5">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{ord.last_update}</TableCell>
                            <TableCell className="font-bold text-white">{ord.ticker || ord.symbol}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ord.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive'
                              }`}>
                                {ord.action}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-white">
                              <span className="font-semibold">{ord.filled}</span>
                              <span className="text-muted-foreground text-xs"> / {ord.total_quantity}</span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-emerald-400">{formatMoney(ord.price)}</TableCell>
                            <TableCell>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400">
                                {ord.status}
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
