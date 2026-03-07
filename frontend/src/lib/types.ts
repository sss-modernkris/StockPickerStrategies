export interface StrategyResult {
    strategy_name: string;
    match_percentage: number;
    justifications: string[];
}

export interface TickerAnalysis {
    symbol: string;
    strategies: StrategyResult[];
    alpha_probability?: number;
    top_factor?: string;
    price_history?: { date: string; close: number }[];
    raw_data?: Record<string, any>;
    error?: string;
}
