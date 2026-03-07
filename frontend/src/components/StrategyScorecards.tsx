import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StrategyResult } from '@/lib/types';
import { BrainCircuit } from 'lucide-react';

interface StrategyScorecardsProps {
    strategies: StrategyResult[];
    alphaProbability?: number;
    topFactor?: string;
}

export function StrategyScorecards({ strategies, alphaProbability, topFactor }: StrategyScorecardsProps) {
    // Separate ML strategy from standard strategies
    const standardStrategies = strategies.filter(s => s.strategy_name !== "Quantitative ML (XGBoost)");
    const mlStrategy = strategies.find(s => s.strategy_name === "Quantitative ML (XGBoost)");

    return (
        <div className="space-y-4">
            {mlStrategy && alphaProbability !== undefined && (
                <Card className="border-primary/50 shadow-sm shadow-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-primary" />
                            Machine Learning Alpha Prediction
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Probability of Outperformance</span>
                            <span className="font-bold text-primary">{(alphaProbability * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={alphaProbability * 100} className="h-2 mb-2" />
                        <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Top Driving Factor: <strong className="text-foreground">{topFactor}</strong></span>
                            <span>Model: XGBoost (TimeSeriesSplit)</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {standardStrategies.map((strat) => (
                    <Card key={strat.strategy_name} className="flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {strat.strategy_name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-end">
                            <div className="flex items-end justify-between mb-1">
                                <span className="text-2xl font-bold">{strat.match_percentage}%</span>
                                <span className="text-xs text-muted-foreground mb-1">Match</span>
                            </div>
                            <Progress
                                value={strat.match_percentage}
                                className="h-1.5"
                                // Change color based on score
                                indicatorClassName={
                                    strat.match_percentage >= 75 ? "bg-green-500" :
                                        strat.match_percentage >= 40 ? "bg-yellow-500" : "bg-red-500"
                                }
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
