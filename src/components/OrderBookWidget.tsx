import React from 'react';
import { OrderBookData } from '../types/market';
import { Layers, ArrowDownUp } from 'lucide-react';

interface OrderBookWidgetProps {
  orderBook: OrderBookData | null;
  isLoading: boolean;
}

export const OrderBookWidget: React.FC<OrderBookWidgetProps> = ({ orderBook, isLoading }) => {
  if (!orderBook && isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 animate-pulse h-96">
        <div className="h-5 w-40 bg-slate-800 rounded mb-4"></div>
        <div className="h-64 bg-slate-800/50 rounded"></div>
      </div>
    );
  }

  if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
          <Layers className="w-3.5 h-3.5" />
          <span>Spot Order Book Depth</span>
        </div>
        <div className="text-xs text-amber-400 font-mono py-8 text-center bg-slate-950/40 rounded border border-slate-800/80">
          Order book depth is temporarily unavailable from public exchange endpoint.
        </div>
      </div>
    );
  }

  const bids = orderBook.bids.slice(0, 10);
  const asks = orderBook.asks.slice(0, 10);

  const maxBidVol = Math.max(...bids.map((b) => b[1]), 0.1);
  const maxAskVol = Math.max(...asks.map((a) => a[1]), 0.1);
  const maxSingleLevelVol = Math.max(maxBidVol, maxAskVol);

  const imbalance = orderBook.imbalanceRatio; // -1 to +1
  const bidSharePct = Math.round(((orderBook.totalBidVolume / (orderBook.totalBidVolume + orderBook.totalAskVolume || 1)) * 100));
  const askSharePct = 100 - bidSharePct;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
      <div>
        {/* Header & Spread Metric */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              Spot Order Book (BTC/USDT)
            </h3>
          </div>
          <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
            <span>Spread:</span>
            <span className="text-slate-200 font-semibold tabular-nums">
              ${orderBook.spread?.toFixed(2)}
            </span>
            <span className="text-slate-400">
              ({orderBook.spreadBps?.toFixed(1)} bps)
            </span>
          </div>
        </div>

        {/* Imbalance Meter */}
        <div className="my-3.5 bg-slate-950/60 p-2.5 rounded border border-slate-800">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-emerald-400 font-semibold tabular-nums">
              Bid Depth: {bidSharePct}% ({orderBook.totalBidVolume.toFixed(2)} BTC)
            </span>
            <span className="text-rose-400 font-semibold tabular-nums">
              {askSharePct}% ({orderBook.totalAskVolume.toFixed(2)} BTC) Ask Depth
            </span>
          </div>

          {/* Dual Bar */}
          <div className="w-full h-2 bg-slate-800 rounded overflow-hidden flex">
            <div
              className="h-full bg-emerald-500/80 transition-all duration-300"
              style={{ width: `${bidSharePct}%` }}
              title={`Bid side dominance: ${bidSharePct}%`}
            />
            <div
              className="h-full bg-rose-500/80 transition-all duration-300"
              style={{ width: `${askSharePct}%` }}
              title={`Ask side dominance: ${askSharePct}%`}
            />
          </div>

          <div className="text-center mt-1.5 text-[10px] font-mono text-slate-400">
            {imbalance > 0.15 ? (
              <span className="text-emerald-400 font-medium">
                Positive Imbalance: Strong resting bid support under spot price
              </span>
            ) : imbalance < -0.15 ? (
              <span className="text-rose-400 font-medium">
                Negative Imbalance: Substantial sell wall depth capping immediate upside
              </span>
            ) : (
              <span className="text-slate-400">
                Balanced Book: Symmetrical resting liquidity within top levels
              </span>
            )}
          </div>
        </div>

        {/* Dual Column Depth Ladder */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          {/* Bids Column */}
          <div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-1">
              <span>Bid Price ($)</span>
              <span>Size (BTC)</span>
            </div>
            <div className="space-y-1">
              {bids.map(([price, amount], idx) => {
                const barWidth = Math.min((amount / maxSingleLevelVol) * 100, 100);
                return (
                  <div key={idx} className="relative flex justify-between py-0.5 px-1 rounded overflow-hidden">
                    {/* Background Depth Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none"
                      style={{ width: `${barWidth}%` }}
                    />
                    <span className="text-emerald-400 font-medium tabular-nums relative z-10">
                      ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-300 tabular-nums relative z-10">
                      {amount.toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Asks Column */}
          <div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-1">
              <span>Ask Price ($)</span>
              <span>Size (BTC)</span>
            </div>
            <div className="space-y-1">
              {asks.map(([price, amount], idx) => {
                const barWidth = Math.min((amount / maxSingleLevelVol) * 100, 100);
                return (
                  <div key={idx} className="relative flex justify-between py-0.5 px-1 rounded overflow-hidden">
                    {/* Background Depth Bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none"
                      style={{ width: `${barWidth}%` }}
                    />
                    <span className="text-rose-400 font-medium tabular-nums relative z-10">
                      ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-300 tabular-nums relative z-10">
                      {amount.toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Provider: {orderBook.provider}</span>
        <span>Top 10 Levels Sampled</span>
      </div>
    </div>
  );
};
