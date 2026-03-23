import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Briefcase, TrendingUp, Lock, RefreshCcw, Unlock, Database } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { logger } from '@/lib/logger';

interface Holding {
  ticker: string;
  total_quantity: number;
  avg_buy_price: number;
  current_price: number;
  total_value: number;
  unrealized_pnl: number;
}

interface Transaction {
  date: string;
  ticker: string;
  quantity: number;
  price: number;
  total_cost: number;
  current_close_price: number | null;
  total_current_value: number | null;
  cash_balance: number;
  action: string;
}

interface PortfolioSummary {
  current_cash: number;
  invested_capital: number;
  total_equity: number;
  holdings: Holding[];
  transactions: Transaction[];
}

const formatMoney = (val: number | null | undefined) => {
  if (val == null) return '--';
  return val < 0
    ? `-$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function PaperStudyPanel() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [transactionType, setTransactionType] = useState<'Buy' | 'Sell' | 'Deposit' | 'Withdraw'>('Buy');

  // IB Integration State
  const [ibConfig, setIbConfig] = useState<{ is_configured: boolean; is_connected: boolean } | null>(null);
  const [ibData, setIbData] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [ibUsername, setIbUsername] = useState('');
  const [ibPassword, setIbPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const checkIbConfig = async () => {
    try {
      logger.info("Checking IB config from " + API_BASE_URL + "/api/ib/config");
      const res = await fetch(`${API_BASE_URL}/api/ib/config`);
      if (res.ok) {
        const data = await res.json();
        logger.info("IB config data: ", data);
        setIbConfig(data);
        if (data.is_connected) {
          logger.info("IB is connected, fetching data...");
          fetchIbData();
        } else if (data.is_configured) {
          // If env vars are set, attempt login automatically
          logger.info("IB is configured but not connected, attempting login...");
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
      logger.info("Attempting to login to IB at " + API_BASE_URL + "/api/ib/login");
      const res = await fetch(`${API_BASE_URL}/api/ib/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username || "",
          password: password || ""
        })
      });

      if (res.ok) {
        setIbConfig((prev: { is_configured: boolean; is_connected: boolean } | null) =>
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
      logger.info("Fetching IB data from " + API_BASE_URL + "/api/ib/data");
      const res = await fetch(`${API_BASE_URL}/api/ib/data`);
      if (res.ok) {
        const data = await res.json();
        setIbData(data);
      }
    } catch (err) {
      logger.error("Failed to fetch IB data", err);
    }
  };

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      logger.info("Fetching portfolio data from " + API_BASE_URL + "/api/paper-study");
      const res = await fetch(`${API_BASE_URL}/api/paper-study`);
      if (!res.ok) throw new Error('Failed to fetch portfolio data');
      const data = await res.json();
      setPortfolio(data);
      setError(null);
    } catch (err) {
      logger.error("Failed to fetch portfolio", err);
      setError('Could not load portfolio data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    checkIbConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setError(null);

    const q = transactionType === 'Deposit' || transactionType === 'Withdraw' ? 1 : parseFloat(quantity);
    const p = parseFloat(price);
    const tick = transactionType === 'Deposit' || transactionType === 'Withdraw' ? 'CASH' : ticker.toUpperCase();

    if ((!tick && transactionType !== 'Deposit' && transactionType !== 'Withdraw') || isNaN(q) || isNaN(p) || q <= 0 || p <= 0) {
      setError('Please provide valid positive numbers for quantity and price, and a ticker.');
      return;
    }

    const totalCost = q * p;
    // Client-side quick validation
    if (transactionType === 'Buy' && portfolio && totalCost > portfolio.current_cash) {
      setError(`Insufficient funds. This trade requires ${formatMoney(totalCost)} but you only have ${formatMoney(portfolio.current_cash)} available.`);
      return;
    }
    if (transactionType === 'Withdraw' && portfolio && p > portfolio.current_cash) {
      setError(`Insufficient funds for withdrawal. You only have ${formatMoney(portfolio.current_cash)} available.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/paper-study`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: tick,
          quantity: q,
          price: p,
          total_cost: transactionType === 'Deposit' ? -p : (transactionType === 'Withdraw' ? p : totalCost),
          transaction_type: transactionType
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to save transaction');
      }

      setSuccessMsg('Transaction successfully logged!');
      setTicker('');
      setQuantity('');
      setPrice('');
      setTransactionType('Buy');

      fetchPortfolio();
    } catch (err: any) {
      logger.error("Failed to save transaction", err);
      setError(err.message || 'An error occurred while saving the transaction.');
    }
  };

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Available</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ibData ? formatMoney(ibData.cash_available) : (portfolio ? formatMoney(portfolio.current_cash) : '--')}
            </div>
            <p className="text-xs text-muted-foreground">
              {ibData ? "Real-time IB Balance" : "Simulated Ready to deploy"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invested Capital</CardTitle>
            <Briefcase className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ibData ? formatMoney(ibData.invested_capital) : (portfolio ? formatMoney(portfolio.invested_capital) : '--')}
            </div>
            <p className="text-xs text-muted-foreground">
              {ibData ? "IB Market Value" : "Total Market Value of Stocks"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ibData ? formatMoney(ibData.total_equity) : (portfolio ? formatMoney(portfolio.total_equity) : '--')}
            </div>
            <p className="text-xs text-muted-foreground">
              {ibData ? "IB Account Net Liquidation" : "Cash + Invested Capital"}
            </p>
          </CardContent>
        </Card>
      </div>

      {ibData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-emerald-600 uppercase">Unrealized P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${ibData.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatMoney(ibData.unrealized_pnl)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-blue-600 uppercase">Realized P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${ibData.realized_pnl >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
                {formatMoney(ibData.realized_pnl)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-indigo-500/5 border-indigo-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-indigo-600 uppercase">Buying Power</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-indigo-600">
                {formatMoney(ibData.buying_power)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant={ibConfig?.is_connected ? "secondary" : "default"}
            disabled={ibConfig?.is_connected || loginLoading}
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-2"
          >
            {ibConfig?.is_connected ? (
              <>
                <Unlock className="w-4 h-4 text-emerald-500" />
                Connected to IB
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Login to Interactive Brokers
              </>
            )}
          </Button>
          {ibConfig?.is_connected && (
            <Button variant="ghost" size="sm" onClick={fetchIbData} className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Sync Dashboard
            </Button>
          )}
        </div>

        {ibConfig?.is_configured && ibConfig?.is_connected && (
          <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
            <Database className="w-3 h-3" /> Auto-login active via environment variables
          </div>
        )}
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle>Interactive Brokers Login</CardTitle>
              <CardDescription>Enter your TWS/Gateway credentials to link your dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {modalError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-md font-medium">
                  {modalError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  placeholder="IB Username"
                  value={ibUsername}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIbUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="IB Password"
                  value={ibPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIbPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="ghost" onClick={() => setShowLoginModal(false)}>Cancel</Button>
                <Button
                  onClick={() => handleIbLogin(ibUsername, ibPassword)}
                  disabled={loginLoading || !ibUsername || !ibPassword}
                  className="px-8"
                >
                  {loginLoading ? "Connecting..." : "Login"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Log New Transaction</CardTitle>
          <CardDescription>Enter your paper trading details to track simulated performance.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive mb-4 text-sm font-medium">{error}</div>}
          {successMsg && <div className="text-emerald-500 mb-4 text-sm font-medium">{successMsg}</div>}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ticker Symbol</label>
              <Input
                placeholder="e.g. AAPL"
                value={transactionType === 'Deposit' || transactionType === 'Withdraw' ? 'CASH' : ticker}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTicker(e.target.value.toUpperCase())}
                disabled={transactionType === 'Deposit' || transactionType === 'Withdraw'}
                required={transactionType === 'Buy' || transactionType === 'Sell'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={transactionType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTransactionType(e.target.value as 'Buy' | 'Sell' | 'Deposit' | 'Withdraw')}
              >
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
                <option value="Deposit">Deposit Cash</option>
                <option value="Withdraw">Withdraw Cash</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity (Shares)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 10"
                value={transactionType === 'Deposit' || transactionType === 'Withdraw' ? '1' : quantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                disabled={transactionType === 'Deposit' || transactionType === 'Withdraw'}
                required={transactionType === 'Buy' || transactionType === 'Sell'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {transactionType === 'Deposit' || transactionType === 'Withdraw' ? 'Amount ($)' : 'Current Price ($)'}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder={transactionType === 'Deposit' || transactionType === 'Withdraw' ? 'e.g. 5000' : 'e.g. 150.50'}
                value={price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">Submit</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Holdings</CardTitle>
          <CardDescription>Current open positions and aggregate performance.</CardDescription>
        </CardHeader>
        <CardContent>
          {!portfolio || portfolio.holdings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card border-dashed">No active holdings. Start by buying some shares.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="text-right">Avg Cost Basis</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Total Position Value</TableHead>
                    <TableHead className="text-right">Unrealized P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.holdings.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-bold">{h.ticker}</TableCell>
                      <TableCell className="text-right">{h.total_quantity}</TableCell>
                      <TableCell className="text-right">{formatMoney(h.avg_buy_price)}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(h.current_price)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatMoney(h.total_value)}</TableCell>
                      <TableCell className={`text-right font-bold ${h.unrealized_pnl < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
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

      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
          <CardDescription>Historical log of all simulated events.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !portfolio ? (
            <div className="text-center py-8 text-muted-foreground animate-pulse">Loading ledger...</div>
          ) : !portfolio || portfolio.transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card border-dashed">No transactions found.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Trade Price</TableHead>
                    <TableHead className="text-right">Trade Value</TableHead>
                    <TableHead className="text-right">Net Cash Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.transactions.map((tx, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${tx.action === 'Buy' ? 'bg-indigo-500/10 text-indigo-500' : tx.action === 'Sell' ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {tx.action}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{tx.ticker}</TableCell>
                      <TableCell className={`text-right font-semibold ${tx.ticker === 'CASH' ? 'text-muted-foreground' : (tx.quantity < 0 ? 'text-orange-500' : 'text-indigo-500')}`}>
                        {tx.ticker === 'CASH' ? '--' : (tx.quantity > 0 ? '+' : '') + tx.quantity}
                      </TableCell>
                      <TableCell className="text-right">{tx.ticker === 'CASH' ? '--' : formatMoney(tx.price)}</TableCell>
                      <TableCell className={`text-right font-medium ${tx.total_cost < 0 ? 'text-emerald-500' : (tx.action === 'Withdraw' ? 'text-orange-500' : '')}`}>
                        {tx.ticker === 'CASH' ? (tx.action === 'Deposit' ? `+${formatMoney(Math.abs(tx.total_cost))}` : `-${formatMoney(tx.total_cost)}`) : formatMoney(tx.total_cost)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(tx.cash_balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
