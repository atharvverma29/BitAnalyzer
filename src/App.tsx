import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header, NavTab } from './components/Header';
import { MarketOverviewBar } from './components/MarketOverviewBar';
import { CandlestickChart } from './components/CandlestickChart';
import { IndicatorPanels } from './components/IndicatorPanels';
import { OrderBookWidget } from './components/OrderBookWidget';
import { DerivativesWidget } from './components/DerivativesWidget';
import { SignalEngineView } from './components/SignalEngineView';
import { BacktestingView } from './components/BacktestingView';
import { RiskCalculatorView } from './components/RiskCalculatorView';
import { MacroResearchPanel } from './components/MacroResearchPanel';
import { MethodologyDoc } from './components/MethodologyDoc';

import {
  MarketTicker,
  Candle,
  OrderBookData,
  DerivativesContext,
  IndicatorResults,
  SignalAnalysis,
} from './types/market';
import { computeAllIndicators } from './lib/indicators';
import { analyzeMarketSignals } from './lib/signalEngine';
import { AlertCircle, RefreshCw, Layers, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h'>('1h');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // 30s default

  // Market state
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativesContext | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Fetch all market data from Express backend endpoints
  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [tickerRes, candlesRes, bookRes, derivRes] = await Promise.allSettled([
        fetch('/api/market/ticker'),
        fetch(`/api/market/candles?interval=${timeframe}&limit=160`),
        fetch('/api/market/orderbook?limit=20'),
        fetch('/api/market/derivatives'),
      ]);

      let tickerOk = false;
      let candlesOk = false;

      // 1. Ticker
      if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
        const data: MarketTicker = await tickerRes.value.json();
        setTicker(data);
        tickerOk = true;
      }

      // 2. Candles
      if (candlesRes.status === 'fulfilled' && candlesRes.value.ok) {
        const data = await candlesRes.value.json();
        if (Array.isArray(data.candles) && data.candles.length > 0) {
          setCandles(data.candles);
          candlesOk = true;
        }
      }

      // 3. Orderbook
      if (bookRes.status === 'fulfilled' && bookRes.value.ok) {
        const data: OrderBookData = await bookRes.value.json();
        setOrderBook(data);
      } else {
        setOrderBook(null);
      }

      // 4. Derivatives
      if (derivRes.status === 'fulfilled' && derivRes.value.ok) {
        const data: DerivativesContext = await derivRes.value.json();
        setDerivatives(data);
      } else {
        setDerivatives(null);
      }

      if (tickerOk || candlesOk) {
        setLastUpdated(Date.now());
      } else {
        setErrorMessage(
          'Unable to retrieve current market data from public exchange endpoints. Check network or retry.'
        );
      }
    } catch (err: any) {
      setErrorMessage((err as Error).message || 'Failed to fetch live market feeds.');
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  // Initial fetch and interval change trigger
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = window.setInterval(() => {
      fetchMarketData();
    }, autoRefreshInterval * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefreshInterval, fetchMarketData]);

  // Indicators calculation
  const indicators: IndicatorResults = useMemo(() => {
    if (candles.length === 0) {
      return {
        ema20: [],
        ema50: [],
        rsi14: [],
        macd: { macd: [], signal: [], histogram: [] },
        atr14: [],
        volumeRatio: { ratio: null, maVolume: null },
        priceStats: { return20PeriodPct: null, annualizedVolatilityPct: null },
      };
    }
    return computeAllIndicators(candles, timeframe);
  }, [candles, timeframe]);

  // Deterministic quantitative signal analysis
  const signalAnalysis: SignalAnalysis | null = useMemo(() => {
    if (candles.length === 0) return null;
    return analyzeMarketSignals({
      candles,
      indicators,
      orderBook,
      derivatives,
      dataTimestamp: lastUpdated || undefined,
    });
  }, [candles, indicators, orderBook, derivatives, lastUpdated]);

  const providerName = ticker?.provider || (candles.length > 0 ? 'Binance Spot' : 'Connecting...');
  const isFallback = ticker?.isFallback || false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* 1. Header (Follows Top Bar Contract: 3 zones, single line) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLoading={isLoading}
        onRefresh={fetchMarketData}
        lastUpdated={lastUpdated}
        provider={providerName}
        isFallback={isFallback}
        autoRefreshInterval={autoRefreshInterval}
        setAutoRefreshInterval={setAutoRefreshInterval}
      />

      {/* 2. Global Market Overview Ticker Bar */}
      <MarketOverviewBar
        ticker={ticker}
        orderBook={orderBook}
        interval={timeframe}
        setInterval={setTimeframe}
        isLoading={isLoading}
      />

      {/* 3. Error Banner (if any) */}
      {errorMessage && (
        <div className="bg-rose-950/80 border-b border-rose-800/80 px-6 py-2.5 flex items-center justify-between text-xs font-mono text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={fetchMarketData}
            className="flex items-center gap-1 underline hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* 4. Main Terminal Viewport */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Signal Snapshot Banner */}
            {signalAnalysis && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Model Assessment:
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${
                      signalAnalysis.assessment === 'BULLISH'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : signalAnalysis.assessment === 'BEARISH'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {signalAnalysis.assessment === 'BULLISH' && <TrendingUp className="w-3.5 h-3.5" />}
                    {signalAnalysis.assessment === 'BEARISH' && <TrendingDown className="w-3.5 h-3.5" />}
                    {signalAnalysis.assessment === 'NEUTRAL' && <Minus className="w-3.5 h-3.5" />}
                    <span>{signalAnalysis.assessment}</span>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-300">
                    Score: <strong className="text-white">{signalAnalysis.compositeScore > 0 ? '+' : ''}{signalAnalysis.compositeScore}</strong>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-300">
                    Evidence: <strong className="text-white">{signalAnalysis.evidenceStrengthPct}%</strong>
                  </span>
                </div>

                <button
                  onClick={() => setActiveTab('signal')}
                  className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 self-start sm:self-auto text-xs"
                >
                  <span>Inspect Factor Breakdown</span>
                  <span>&rarr;</span>
                </button>
              </div>
            )}

            {/* Candlestick Interactive Chart */}
            <CandlestickChart
              candles={candles}
              indicators={indicators}
              symbol="BTC/USDT"
              interval={timeframe}
              setInterval={setTimeframe}
              isLoading={isLoading}
            />

            {/* Technical Indicators Strip (RSI, MACD, ATR, Volume) */}
            <IndicatorPanels
              indicators={indicators}
              candles={candles}
              currentPrice={ticker?.price || null}
            />

            {/* Microstructure & Derivatives Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OrderBookWidget orderBook={orderBook} isLoading={isLoading} />
              <DerivativesWidget
                derivatives={derivatives}
                currentSpotPrice={ticker?.price || null}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}

        {activeTab === 'signal' && (
          <SignalEngineView analysis={signalAnalysis} isLoading={isLoading} />
        )}

        {activeTab === 'backtest' && (
          <BacktestingView candles={candles} interval={timeframe} />
        )}

        {activeTab === 'risk' && (
          <RiskCalculatorView currentSpotPrice={ticker?.price || null} />
        )}

        {activeTab === 'macro' && <MacroResearchPanel />}

        {activeTab === 'methodology' && <MethodologyDoc />}
      </main>

      {/* 5. Terminal Footer (quiet copyright & metadata without mechanical telemetry clutter) */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-xs font-mono text-slate-400">
        <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-300">Bitcoin Spot Analyzer</span>
            <span>·</span>
            <span>Quantitative Terminal v1.0</span>
            <span>·</span>
            <span>Deterministic Research Architecture</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Non-Custodial</span>
            <span>·</span>
            <span>Zero Predictive Claims</span>
            <span>·</span>
            <span>Pure Math & Data Ingestion</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
