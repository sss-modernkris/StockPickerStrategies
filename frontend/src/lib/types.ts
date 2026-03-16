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
    macd_line?: number;
    macd_signal?: number;
    bollinger_upper?: number;
    bollinger_middle?: number;
    bollinger_lower?: number;
    volume?: number;
    volume_avg_20?: number;
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
