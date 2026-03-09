export interface StrategyResult {
    strategy_name: string;
    match_percentage: number;
    justifications: string[];
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
    price_history?: { date: string; close: number }[];
    technical_indicators?: TechnicalIndicators;
    raw_data?: Record<string, any>;
    error?: string;
}
