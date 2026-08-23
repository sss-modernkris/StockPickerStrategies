import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Plus, X, Activity, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { logger } from '@/lib/logger';

interface TickerSidebarProps {
    tickers: string[];
    selectedTicker: string | null;
    onAddTicker: (ticker: string) => void;
    onRemoveTicker: (ticker: string) => void;
    onSelectTicker: (ticker: string) => void;
    portfolioFilename: string;
    onLoadPortfolio: (filename: string) => void;
}

export function TickerSidebar({
    tickers,
    selectedTicker,
    onAddTicker,
    onRemoveTicker,
    onSelectTicker,
    portfolioFilename,
    onLoadPortfolio
}: TickerSidebarProps) {
    const [newTicker, setNewTicker] = useState('');
    const [availablePortfolios, setAvailablePortfolios] = useState<string[]>([]);
    const [isLoadingPortfolios, setIsLoadingPortfolios] = useState(false);

    React.useEffect(() => {
        const fetchPortfolios = async () => {
            try {
                setIsLoadingPortfolios(true);
                const res = await fetch(`${API_BASE_URL}/api/list-portfolios`);
                if (res.ok) {
                    const data = await res.json();
                    setAvailablePortfolios(data.files || []);
                }
            } catch (err) {
                logger.error("Failed to fetch available portfolios", err);
            } finally {
                setIsLoadingPortfolios(false);
            }
        };
        fetchPortfolios();
    }, []);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTicker.trim() && tickers.length < 100 && !tickers.includes(newTicker.toUpperCase())) {
            onAddTicker(newTicker.toUpperCase());
            setNewTicker('');
        }
    };

    return (
        <div className="w-64 h-full border-r bg-card flex flex-col">
            <div className="p-4 border-b space-y-1">
                <div className="flex items-center gap-2">
                    <Activity className="w-6 h-6 text-primary" />
                    <h2 className="font-bold text-lg tracking-tight">Strategic Alpha</h2>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono pl-8">
                    v20260822
                </div>
            </div>

            <div className="p-4 border-b space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Portfolio Source</label>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => onLoadPortfolio(portfolioFilename)}
                        title="Reload current portfolio"
                    >
                        <RefreshCw className={`w-3 h-3 ${isLoadingPortfolios ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all cursor-pointer"
                    value={portfolioFilename}
                    onChange={(e) => onLoadPortfolio(e.target.value)}
                    disabled={isLoadingPortfolios}
                >
                    {availablePortfolios.length === 0 ? (
                        <option value={portfolioFilename}>{portfolioFilename}</option>
                    ) : (
                        availablePortfolios.map(file => (
                            <option key={file} value={file}>{file}</option>
                        ))
                    )}
                </select>
            </div>

            <form onSubmit={handleAdd} className="p-4 border-b flex gap-2">
                <Input
                    placeholder="Add ticker..."
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value)}
                    className="uppercase bg-background"
                    maxLength={20}
                />
                <Button type="submit" size="icon" disabled={tickers.length >= 100 || !newTicker.trim()}>
                    <Plus className="w-4 h-4" />
                </Button>
            </form>

            <div className="flex-1 p-2 overflow-y-auto min-h-0">
                <div className="space-y-1">
                    {tickers.map(ticker => (
                        <div
                            key={ticker}
                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${selectedTicker === ticker ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
                            onClick={() => onSelectTicker(ticker)}
                        >
                            <span>{ticker}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-50 hover:opacity-100 object-contain"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveTicker(ticker);
                                }}
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    ))}
                    {tickers.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No tickers added. Add up to 100 to begin analysis.
                        </div>
                    )}
                </div>
            </div>
            <div className="p-4 border-t text-[10px] text-muted-foreground text-center">
                {tickers.length} / 100 Selected
            </div>
        </div>
    );
}
