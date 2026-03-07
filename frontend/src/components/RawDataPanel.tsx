import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RawDataPanelProps {
    rawData?: Record<string, any>;
}

export function RawDataPanel({ rawData }: RawDataPanelProps) {
    if (!rawData || Object.keys(rawData).length === 0) {
        return null;
    }

    // Helper to format values nicely
    const formatValue = (key: string, value: any) => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') {
            // Very large numbers (likely shares, market cap, volume)
            if (Math.abs(value) > 1e9) return `${(value / 1e9).toFixed(2)}B`;
            if (Math.abs(value) > 1e6) return `${(value / 1e6).toFixed(2)}M`;
            // Small decimals (likely ratios or percentages)
            if (Math.abs(value) < 100 && value % 1 !== 0) return value.toFixed(2);
            // Fallback
            return value.toLocaleString();
        }
        // String wrapper for safety
        return String(value);
    };

    // Groupings for the massive yfinance info dict
    const groups = {
        "Company Profile": [
            "shortName", "longName", "sector", "industry", "exchange", "country", "website", "employees"
        ],
        "Valuation Metrics": [
            "marketCap", "enterpriseValue", "trailingPE", "forwardPE", "pegRatio", "priceToBook", "priceToSalesTrailing12Months", "enterpriseToRevenue", "enterpriseToEbitda"
        ],
        "Financial Highlights": [
            "totalRevenue", "revenueGrowth", "grossMargins", "ebitda", "ebitdaMargins", "operatingMargins", "profitMargins", "returnOnAssets", "returnOnEquity", "freeCashflow", "totalDebt", "debtToEquity"
        ],
        "Trading Information": [
            "previousClose", "open", "dayLow", "dayHigh", "fiftyTwoWeekLow", "fiftyTwoWeekHigh", "volume", "averageVolume", "beta", "dividendYield", "trailingAnnualDividendRate"
        ]
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight mt-10">Raw Fundamental Data</h2>
            <p className="text-muted-foreground">Comprehensive ticker data directly from yfinance</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(groups).map(([groupName, keys]) => (
                    <Card key={groupName} className="flex flex-col h-full bg-muted/20">
                        <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-lg">{groupName}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 flex-grow text-sm space-y-2">
                            {keys.map((key) => {
                                const val = rawData[key];
                                // Only render if we actually have data, to keep it clean
                                if (val === undefined || val === null) return null;

                                // Add spaces to camelCase keys for display
                                const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                                return (
                                    <div key={key} className="flex justify-between items-center py-1 border-b border-border/10 last:border-0">
                                        <span className="text-muted-foreground mr-4">{displayKey}:</span>
                                        <span className="font-medium text-right">{formatValue(key, val)}</span>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
