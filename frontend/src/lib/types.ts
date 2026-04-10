export interface StrategyResult {
    strategy_name: string;
    match_percentage: number;
    justifications: string[];
}

export interface PricePoint {
    date: string;
    close: number;
    macd?: number | null;
    macd_signal?: number | null;
    macd_hist?: number | null;
    sma_9?: number | null;
    sma_12?: number | null;
    sma_26?: number | null;
    sma_50?: number | null;
    sma_200?: number | null;
    rsi_14?: number | null;
    bb_upper?: number | null;
    bb_lower?: number | null;
    bb_middle?: number | null;
    willy_vwap?: number | null;
}

export interface TickerHistory {
    symbol: string;
    history: PricePoint[];
}

export interface TechnicalIndicators {
    sma_50?: number;
    sma_200?: number;
    ema_20?: number;
    rsi_14?: number;
    rsi_slope?: number;
    macd_line?: number;
    macd_signal?: number;
    macd_slope?: number;
    bollinger_upper?: number;
    bollinger_middle?: number;
    bollinger_lower?: number;
    volume?: number;
    volume_avg_20?: number;
    willy_vwap?: number;
}

export interface TickerAnalysis {
    symbol: string;
    strategies: StrategyResult[];
    alpha_probability?: number;
    top_factor?: string;
    price_history?: PricePoint[];
    technical_indicators?: TechnicalIndicators;
    raw_data?: Record<string, unknown>;
    error?: string;
}
export interface Holding {
  ticker: string;
  total_quantity: number;
  avg_buy_price: number;
  current_price: number;
  total_value: number;
  unrealized_pnl: number;
}

export interface Transaction {
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

export interface IBOrder {
  order_id: number;
  account: string;
  ticker: string;
  action: string;
  total_quantity: number;
  filled: number;
  remaining: number;
  status: string;
  price: number;
  avg_fill_price: number;
  last_update: string;
}

export interface PortfolioSummary {
  current_cash: number;
  invested_capital: number;
  total_equity: number;
  holdings: Holding[];
  transactions: Transaction[];
  ib_orders?: IBOrder[];
}
export interface IBData {
  cash_available: number;
  invested_capital: number;
  total_equity: number;
  unrealized_pnl: number;
  realized_pnl: number;
  buying_power: number;
  holdings: Holding[];
  orders: IBOrder[];
}
