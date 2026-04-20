import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Lock, RefreshCcw, Unlock, Database, DollarSign, Briefcase, TrendingUp } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { logger } from '@/lib/logger';
import { IBOrder, IBData } from '@/lib/types';

const formatMoney = (val: number | null | undefined) => {
  if (val == null) return '--';
  return val < 0
    ? `-$${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function BrokersPanel() {
  const [ibConfig, setIbConfig] = useState<{ is_configured: boolean; is_connected: boolean } | null>(null);
  const [ibData, setIbData] = useState<IBData | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [ibUsername, setIbUsername] = useState('');
  const [ibPassword, setIbPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    checkIbConfig();
  }, []);

  return (
    <div className="space-y-6">
      {/* IB Status & Sync */}
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
              <RefreshCcw className="w-3 h-3" /> Sync Data
            </Button>
          )}
        </div>

        {ibConfig?.is_configured && ibConfig?.is_connected && (
          <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
            <Database className="w-3 h-3" /> Auto-login active via environment variables
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {successMsg && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm p-4 rounded-md font-medium">{successMsg}</div>}
      {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-md font-medium">{error}</div>}

      {/* IB Account Summary */}
      {ibData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cash Available</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(ibData.cash_available)}</div>
                <p className="text-xs text-muted-foreground">Real-time IB Balance</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Invested Capital</CardTitle>
                <Briefcase className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(ibData.invested_capital)}</div>
                <p className="text-xs text-muted-foreground">IB Market Value</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                <TrendingUp className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(ibData.total_equity)}</div>
                <p className="text-xs text-muted-foreground">IB Account Net Liquidation</p>
              </CardContent>
            </Card>
          </div>

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
        </>
      ) : (
        <div className="text-center py-12 border rounded-lg bg-card border-dashed text-muted-foreground">
          {ibConfig?.is_connected ? "Fetching account data..." : "Connect to Interactive Brokers to view your portfolio."}
        </div>
      )}

      {/* IB Active Holdings */}
      <Card>
        <CardHeader>
          <CardTitle>Active Holdings</CardTitle>
          <CardDescription>Real-time positions and performance from your IB account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!ibData || !ibData.holdings || ibData.holdings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card border-dashed">
              {ibConfig?.is_connected ? "No active positions found." : "Connect to Interactive Brokers to view your holdings."}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
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
                  {ibData.holdings.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-bold">{h.symbol}</TableCell>
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

      {/* IB Order History */}
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
          <CardDescription>Real-time order status and execution details from your IB account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!ibData || !ibData.orders || ibData.orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card border-dashed">
              {ibConfig?.is_connected ? "No recent IB orders found." : "Connect to Interactive Brokers to view real-time order history."}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Timestamp</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Quantity (Filled/Remain)</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Order ID</TableHead>
                    <TableHead>Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ibData.orders.map((ord: IBOrder) => (
                    <TableRow key={ord.order_id}>
                      <TableCell className="text-xs whitespace-nowrap">{ord.last_update || "Pending..."}</TableCell>
                      <TableCell className="font-bold">{ord.symbol}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          ord.status === 'Filled' ? 'bg-emerald-500/10 text-emerald-500' : 
                          ord.status === 'Cancelled' ? 'bg-destructive/10 text-destructive' : 
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {ord.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${ord.action === 'BUY' ? 'text-indigo-500' : 'text-orange-500'}`}>
                          {ord.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-emerald-500">{ord.filled}</span>
                        <span className="text-muted-foreground text-xs"> / {ord.remaining}</span>
                        <div className="text-[10px] text-muted-foreground">Total: {ord.total_quantity}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {ord.avg_fill_price > 0 ? formatMoney(ord.avg_fill_price) : formatMoney(ord.price)}
                        {ord.avg_fill_price > 0 && <div className="text-[10px] text-muted-foreground">Fill Price</div>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{ord.order_id}</TableCell>
                      <TableCell className="text-xs">{ord.account}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Login Modal */}
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
    </div>
  );
}
