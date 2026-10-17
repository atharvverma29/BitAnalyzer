import React from 'react';
import { TrendingUp, TrendingDown, Layers, Clock } from 'lucide-react';
import { MarketTicker, OrderBookData } from '../types/market';

interface MarketOverviewBarProps {
  ticker: MarketTicker | null;
  orderBook: OrderBookData | null;
  interval: string;
  setInterval: (interval: '15m' | '1h' | '4h') => void;
  isLoading: boolean;
}

export const MarketOverviewBar: React.FC<MarketOverviewBarProps> = ({
  ticker,
  orderBook,
  interval,
  setInterval,
  isLoading,
}) => {
  if (!ticker && isLoading) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-48 bg-slate-800 rounded"></div>
          <div className="h-8 w-72 bg-slate-800 rounded"></div>
          <div className="h-8 w-40 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!ticker) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 text-xs text-rose-400 flex items-center justify-between">
        <span>Public exchange market feed currently unavailable. Click Refresh to re-attempt connection.</span>
      </div>
    );
  }

  const isPositive = ticker.priceChange24h >= 0;
  const spreadUsd = orderBook?.spread !== null && orderBook?.spread !== undefined ? orderBook.spread : null;
  const spreadBps = orderBook?.spreadBps !== null && orderBook?.spreadBps !== undefined ? orderBook.spreadBps : null;

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
        {/* Left: Symbol & Big Price Display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100 tracking-tight">BTC/USDT</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
              SPOT
            </span>
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              ${ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div
              className={`flex items-center gap-1 text-xs font-mono font-medium tabular-nums ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>
                {isPositive ? '+' : ''}
                {ticker.priceChange24h.toFixed(2)} ({isPositive ? '+' : ''}
                {ticker.priceChangePercent24h.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Center: 24h Stats Matrix (Tabular figures) */}
        <div className="hidden lg:flex items-center gap-6 text-xs border-x border-slate-800 px-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">24h High</div>
            <div className="font-mono font-medium text-slate-200 tabular-nums">
              ${ticker.high24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">24h Low</div>
            <div className="font-mono font-medium text-slate-200 tabular-nums">
              ${ticker.low24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">24h Volume (BTC)</div>
            <div className="font-mono font-medium text-slate-200 tabular-nums">
              {ticker.volume24hBtc.toLocaleString('en-US', { maximumFractionDigits: 2 })} BTC
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">24h Turnover (USD)</div>
            <div className="font-mono font-medium text-slate-200 tabular-nums">
              ${(ticker.quoteVolume24hUsd / 1_000_000).toFixed(2)}M
            </div>
          </div>

          {spreadUsd !== null && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Order Spread</div>
              <div className="font-mono font-medium text-slate-200 tabular-nums flex items-center gap-1">
                <span>${spreadUsd.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400">({spreadBps?.toFixed(1)} bps)</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Timeframe Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            {(['15m', '1h', '4h'] as const).map((int) => (
              <button
                key={int}
                onClick={() => setInterval(int)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap ${
                  interval === int
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {int}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-mono pl-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Candle resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
};
