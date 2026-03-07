import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StrategyResult } from '@/lib/types';
import { Info } from 'lucide-react';

interface JustificationEngineProps {
    strategies: StrategyResult[];
}

export function JustificationEngine({ strategies }: JustificationEngineProps) {
    // Sort strategies by highest match percentage first
    const sorted = [...strategies].sort((a, b) => b.match_percentage - a.match_percentage);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    Why this stock?
                </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {sorted.map(strat => (
                        <div key={strat.strategy_name} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant={strat.match_percentage >= 75 ? "default" : strat.match_percentage >= 40 ? "secondary" : "outline"}>
                                    {strat.match_percentage}%
                                </Badge>
                                <h4 className="font-semibold">{strat.strategy_name}</h4>
                            </div>
                            <ul className="space-y-1.5 pl-6 border-l-2 ml-3 list-disc text-sm text-muted-foreground">
                                {strat.justifications.map((justification, i) => {
                                    const isPositive = justification.includes("Strong") || justification.includes("Healthy") || justification.includes("Positive") || justification.includes("Matches") || justification.includes("Undervalued");
                                    const isNegative = justification.includes("Negative") || justification.includes("Insufficient") || justification.includes("Overvalued") || justification.includes("fails") || justification.includes("Data Gap") || justification.includes("wanning");

                                    return (
                                        <li key={i} className={isPositive ? 'text-green-400 font-medium' : isNegative ? 'text-red-400' : ''}>
                                            {justification}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </Card>
    );
}
