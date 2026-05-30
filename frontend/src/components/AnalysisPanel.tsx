import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/api';
import { 
    Loader2, Play, CheckCircle, RefreshCw, AlertTriangle, 
    TrendingUp, TrendingDown, Info, Maximize2, X, ClipboardList,
    Layers, LayoutList, Calendar, CheckSquare
} from 'lucide-react';
import { StockAnalysisItem, PortfolioAnalysisResponse } from '@/lib/types';

export function AnalysisPanel() {
    const [portfolioFiles, setPortfolioFiles] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>('portfolio-01.csv');
    const [loading, setLoading] = useState<boolean>(false);
    const [analysisData, setAnalysisData] = useState<PortfolioAnalysisResponse | null>(null);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [lightboxTitle, setLightboxTitle] = useState<string | null>(null);
    const [screenshotStatus, setScreenshotStatus] = useState<'idle' | 'capturing' | 'complete'>('idle');
    const [imageSalt, setImageSalt] = useState<number>(0);
    const [imageStatus, setImageStatus] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

    useEffect(() => {
        setImageStatus({});
    }, [imageSalt, analysisData]);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Load available portfolios and last saved analysis on mount
    useEffect(() => {
        const fetchInit = async () => {
            try {
                // Fetch list of portfolios
                const listRes = await fetch(`${API_BASE_URL}/api/list-portfolios`);
                if (listRes.ok) {
                    const listData = await listRes.json();
                    if (listData.files && listData.files.length > 0) {
                        setPortfolioFiles(listData.files);
                        // Default to portfolio-01.csv if present, else first file
                        if (listData.files.includes('portfolio-01.csv')) {
                            setSelectedFile('portfolio-01.csv');
                        } else {
                            setSelectedFile(listData.files[0]);
                        }
                    }
                }

                // Fetch last analysis
                const lastRes = await fetch(`${API_BASE_URL}/api/last-analysis`);
                if (lastRes.ok) {
                    const lastData = await lastRes.json();
                    if (lastData && lastData.items && lastData.items.length > 0) {
                        setAnalysisData(lastData);
                        setScreenshotStatus('complete');
                        if (lastData.filename) {
                            setSelectedFile(lastData.filename);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to run initialization fetches", err);
            }
        };

        fetchInit();
    }, []);

    // 2. Timer effect for live analysis run
    useEffect(() => {
        if (loading) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setElapsedTime(0);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading]);

    // 3. Dynamic background chart generation poller
    const startScreenshotPolling = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        setScreenshotStatus('capturing');
        
        let attempts = 0;
        pollRef.current = setInterval(() => {
            attempts++;
            // Force browser image reload by incrementing imageSalt
            setImageSalt(Date.now());

            // Stop polling after 45 seconds (approx screenshot script run duration)
            if (attempts >= 15) {
                if (pollRef.current) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                }
                setScreenshotStatus('complete');
            }
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // 4. Action: Trigger quantitative analysis
    const handleRunAnalysis = async () => {
        try {
            setLoading(true);
            setAnalysisData(null);
            setScreenshotStatus('idle');

            const res = await fetch(`${API_BASE_URL}/api/run-analysis?filename=${selectedFile}`);
            if (res.ok) {
                const data: PortfolioAnalysisResponse = await res.json();
                setAnalysisData(data);
                
                // Screenshots trigger asynchronously in background
                startScreenshotPolling();
            } else {
                console.error("Run analysis returned failed status", res.status);
            }
        } catch (err) {
            console.error("Error occurred while triggering run-analysis", err);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Dynamic colors based on posture/recommendations
    const getPostureColorClasses = (posture: string) => {
        const p = posture.toLowerCase();
        if (p.includes('overbought')) {
            return {
                badge: 'bg-red-500/10 text-red-500 border-red-500/20',
                border: 'border-red-500/20 hover:border-red-500/40',
                text: 'text-red-500',
                bg: 'bg-red-500/5',
                lightText: 'text-red-400'
            };
        } else if (p.includes('oversold')) {
            return {
                badge: 'bg-green-500/10 text-green-500 border-green-500/20',
                border: 'border-green-500/20 hover:border-green-500/40',
                text: 'text-green-500',
                bg: 'bg-green-500/5',
                lightText: 'text-green-400'
            };
        } else if (p.includes('bullish')) {
            return {
                badge: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
                border: 'border-cyan-500/20 hover:border-cyan-500/40',
                text: 'text-cyan-500',
                bg: 'bg-cyan-500/5',
                lightText: 'text-cyan-400'
            };
        } else {
            return {
                badge: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                border: 'border-yellow-500/20 hover:border-yellow-500/40',
                text: 'text-yellow-500',
                bg: 'bg-yellow-500/5',
                lightText: 'text-yellow-400'
            };
        }
    };

    // Statistics counts
    const overboughtCount = analysisData?.items?.filter(item => item.posture.toLowerCase().includes('overbought')).length ?? 0;
    const oversoldCount = analysisData?.items?.filter(item => item.posture.toLowerCase().includes('oversold')).length ?? 0;
    const bullishCount = analysisData?.items?.filter(item => item.posture.toLowerCase().includes('bullish')).length ?? 0;
    const bearishCount = analysisData?.items?.filter(item => item.posture.toLowerCase().includes('bearish')).length ?? 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Control Panel Section */}
            <Card className="border-border/50 bg-card/45 backdrop-blur-md shadow-lg">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-cyan-500" />
                        Strategic Portfolio Controller
                    </CardTitle>
                    <CardDescription>
                        Select a portfolio source and execute the full 11-strategy quantitative algorithm with dynamic volume-weighted screenshots.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                        <div className="flex flex-col gap-1 flex-1 max-w-md">
                            <label className="text-xs text-muted-foreground font-semibold">Active Portfolio Source</label>
                            <select 
                                className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                value={selectedFile}
                                onChange={(e) => setSelectedFile(e.target.value)}
                                disabled={loading}
                            >
                                {portfolioFiles.map(file => (
                                    <option key={file} value={file}>{file}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {loading && (
                            <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-lg border border-border text-xs font-mono text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                                Elapsed: {elapsedTime}s
                            </div>
                        )}
                        <Button 
                            variant="default"
                            className="h-10 px-5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold transition-all duration-300 shadow-md shadow-cyan-500/10 flex items-center gap-2"
                            onClick={handleRunAnalysis}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Run Live Analysis
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Loading Indicator Screen */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4 border rounded-xl border-dashed border-border bg-card/20">
                    <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
                    <h3 className="text-lg font-bold text-foreground animate-pulse">Running Batch Quant Models</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                        Fetching live data, computing the Willy VWAP support levels, fitting the TimeSeriesSplit XGBoost model, and preparing dynamic screenshot buffers.
                    </p>
                </div>
            )}

            {/* Analysis Dashboard Section */}
            {analysisData && !loading && (
                <div className="space-y-6">
                    {/* Background Screenshot Status Banner */}
                    {screenshotStatus === 'capturing' && (
                        <div className="flex items-center gap-3 bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 px-4 py-3 rounded-lg text-sm font-medium animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>Playwright Engine is generating technical chart overlays in the background. Visual charts will load and refresh automatically.</span>
                        </div>
                    )}
                    {screenshotStatus === 'complete' && (
                        <div className="flex items-center gap-2 bg-green-950/20 text-green-500 border border-green-500/20 px-4 py-3 rounded-lg text-sm font-medium">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>Visual chart screenshots successfully synchronized and loaded.</span>
                        </div>
                    )}

                    {/* Executive Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-red-500/20 bg-red-500/5 shadow-sm">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Overbought</p>
                                    <h4 className="text-2xl font-bold mt-1 text-red-500">{overboughtCount}</h4>
                                </div>
                                <TrendingUp className="w-8 h-8 text-red-500/20" />
                            </CardContent>
                        </Card>
                        <Card className="border-green-500/20 bg-green-500/5 shadow-sm">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Oversold</p>
                                    <h4 className="text-2xl font-bold mt-1 text-green-500">{oversoldCount}</h4>
                                </div>
                                <TrendingDown className="w-8 h-8 text-green-500/20" />
                            </CardContent>
                        </Card>
                        <Card className="border-cyan-500/20 bg-cyan-500/5 shadow-sm">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Bullish Swing</p>
                                    <h4 className="text-2xl font-bold mt-1 text-cyan-500">{bullishCount}</h4>
                                </div>
                                <Layers className="w-8 h-8 text-cyan-500/20" />
                            </CardContent>
                        </Card>
                        <Card className="border-yellow-500/20 bg-yellow-500/5 shadow-sm">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Bearish Swing</p>
                                    <h4 className="text-2xl font-bold mt-1 text-yellow-500">{bearishCount}</h4>
                                </div>
                                <LayoutList className="w-8 h-8 text-yellow-500/20" />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Comparison Action Matrix Table */}
                    <Card className="border-border/50 bg-card/45 backdrop-blur-md shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <LayoutList className="w-4 h-4 text-cyan-500" />
                                Action Matrix Table
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-muted/40 border-b border-border text-muted-foreground font-bold">
                                    <tr>
                                        <th className="px-6 py-3">Ticker</th>
                                        <th className="px-6 py-3 text-center">Close Price</th>
                                        <th className="px-6 py-3 text-center">Willy VWAP</th>
                                        <th className="px-6 py-3 text-center">Lower ATR Support</th>
                                        <th className="px-6 py-3 text-center">Upper ATR Resistance</th>
                                        <th className="px-6 py-3">Posture</th>
                                        <th className="px-6 py-3 text-center">Recommendation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {analysisData.items.map(item => {
                                        const c = getPostureColorClasses(item.posture);
                                        return (
                                            <tr key={item.symbol} className="hover:bg-muted/15 transition-colors font-medium">
                                                <td className="px-6 py-3.5 font-bold text-foreground text-base">{item.symbol}</td>
                                                <td className="px-6 py-3.5 text-center font-mono text-foreground">${item.close.toFixed(2)}</td>
                                                <td className="px-6 py-3.5 text-center font-mono text-muted-foreground">${item.willy_vwap.toFixed(2)}</td>
                                                <td className="px-6 py-3.5 text-center font-mono text-muted-foreground">${item.vwap_lower.toFixed(2)}</td>
                                                <td className="px-6 py-3.5 text-center font-mono text-muted-foreground">${item.vwap_upper.toFixed(2)}</td>
                                                <td className="px-6 py-3.5 text-xs">
                                                    <span className={`px-2 py-0.5 rounded-full font-semibold border ${c.badge}`}>{item.posture}</span>
                                                </td>
                                                <td className="px-6 py-3.5 text-center font-bold text-xs">
                                                    <span className={`px-2.5 py-1 rounded-md border ${c.badge}`}>{item.recommendation}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    {/* Grid of Individual Ticker Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {analysisData.items.map(item => {
                            const c = getPostureColorClasses(item.posture);
                            const imgUrl = `/images_advanced/${item.symbol}_advanced_chart.png?salt=${imageSalt}`;
                            const status = imageStatus[item.symbol] || 'loading';

                            return (
                                <Card key={item.symbol} className={`border border-border/50 bg-card/45 backdrop-blur-sm overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl`}>
                                    {/* Card Header */}
                                    <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-xl font-bold text-foreground">{item.symbol}</h3>
                                            <span className="text-sm font-mono text-muted-foreground">${item.close.toFixed(2)}</span>
                                        </div>
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${c.badge}`}>
                                            {item.recommendation}
                                        </span>
                                    </div>

                                    {/* Card Body & Visual Overlay */}
                                    <div className="p-5 flex-1 flex flex-col gap-4">
                                        {/* Image Section */}
                                        <div className="relative rounded-lg overflow-hidden border border-border/60 bg-muted/20 group/img h-[200px] flex items-center justify-center cursor-pointer"
                                             onClick={() => {
                                                 if (status === 'loaded') {
                                                     setLightboxImage(imgUrl);
                                                     setLightboxTitle(`${item.symbol} Technical Indicators`);
                                                 }
                                             }}
                                        >
                                            {status !== 'loaded' && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs p-4 text-center">
                                                    <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                                                    {status === 'loading' ? 'Loading Visual Chart...' : 'Generating Advanced Chart...'}
                                                </div>
                                            )}

                                            <img 
                                                src={imgUrl} 
                                                alt={`${item.symbol} Chart`} 
                                                className={`w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-[1.03] ${status === 'loaded' ? 'block' : 'hidden'}`}
                                                onLoad={() => setImageStatus(prev => ({ ...prev, [item.symbol]: 'loaded' }))}
                                                onError={() => setImageStatus(prev => ({ ...prev, [item.symbol]: 'error' }))}
                                            />

                                            {/* Maximizer Hover Button */}
                                            {status === 'loaded' && (
                                                <div className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Technical Posture Metrics */}
                                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="bg-muted/30 p-2 rounded-lg border border-border/20">
                                                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Willy VWAP</span>
                                                <span className="font-bold text-foreground font-mono mt-0.5 block">${item.willy_vwap.toFixed(2)}</span>
                                            </div>
                                            <div className="bg-muted/30 p-2 rounded-lg border border-border/20">
                                                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Support (Lower)</span>
                                                <span className="font-bold text-foreground font-mono mt-0.5 block">${item.vwap_lower.toFixed(2)}</span>
                                            </div>
                                            <div className="bg-muted/30 p-2 rounded-lg border border-border/20">
                                                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Resistance (Upper)</span>
                                                <span className="font-bold text-foreground font-mono mt-0.5 block">${item.vwap_upper.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Strategy Engine Justifications */}
                                        <div className="space-y-1.5 flex-1">
                                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                                                <Info className="w-3.5 h-3.5 text-cyan-500" /> Justification
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                                                {item.details.map((detail, idx) => (
                                                    <li key={idx}>{detail}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Fullscreen Lightbox Modal */}
            {lightboxImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-all duration-300">
                    <div className="relative max-w-5xl w-full max-h-[90vh] mx-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between text-white border-b border-white/10 pb-2">
                            <h4 className="text-lg font-bold">{lightboxTitle}</h4>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-white hover:bg-white/10 rounded-full"
                                onClick={() => {
                                    setLightboxImage(null);
                                    setLightboxTitle(null);
                                }}
                            >
                                <X className="w-6 h-6" />
                            </Button>
                        </div>
                        <div className="bg-muted/5 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-2 max-h-[80vh]">
                            <img 
                                src={lightboxImage} 
                                alt={lightboxTitle || "Expanded view"} 
                                className="max-w-full max-h-[75vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
