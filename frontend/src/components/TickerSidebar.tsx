import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Plus, X, Activity } from 'lucide-react';

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
    const [tempFilename, setTempFilename] = useState(portfolioFilename);

    // Update internal state if external filename changes (e.g. from initial load)
    React.useEffect(() => {
        setTempFilename(portfolioFilename);
    }, [portfolioFilename]);

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
                    v20260411
                </div>
            </div>

            <div className="p-4 border-b space-y-2 bg-muted/30">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Portfolio Source</label>
                <div className="flex gap-2">
                    <Input
                        placeholder="filename.csv"
                        value={tempFilename}
                        onChange={(e) => setTempFilename(e.target.value)}
                        className="text-xs h-8 bg-background"
                    />
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2"
                        onClick={() => onLoadPortfolio(tempFilename)}
                        title="Load tickers from this file"
                    >
                        Load
                    </Button>
                </div>
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
