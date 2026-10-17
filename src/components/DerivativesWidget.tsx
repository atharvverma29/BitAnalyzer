import React from 'react';
import { DerivativesContext } from '../types/market';
import { Zap, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

interface DerivativesWidgetProps {
  derivatives: DerivativesContext | null;
  currentSpotPrice: number | null;
  isLoading: boolean;
}

export const DerivativesWidget: React.FC<DerivativesWidgetProps> = ({
  derivatives,
  currentSpotPrice,
  isLoading,
}) => {
  if (!derivatives && isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 animate-pulse h-48">
        <div className="h-5 w-48 bg-slate-800 rounded mb-4"></div>
        <div className="h-24 bg-slate-800/40 rounded"></div>
      </div>
    );
  }

  const isAvailable = derivatives && derivatives.isAvailable;
  const fr = derivatives?.fundingRate8h ?? null;
  const annFr = derivatives?.annualizedFundingRatePct ?? null;
  const oiBtc = derivatives?.openInterestBtc ?? null;
  const oiUsd = (oiBtc !== null && currentSpotPrice !== null) ? oiBtc * currentSpotPrice : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
      <div>
        {/* Title & Distinction Tag */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              Derivatives Context (Perpetuals)
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
            FUTURES BASIS
          </span>
        </div>

        {isAvailable ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-3 text-xs font-mono">
            {/* Funding Rate Box */}
            <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                <span>8h Funding Rate</span>
                <span>Annualized</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-xl font-bold tabular-nums ${
                    fr !== null
                      ? fr > 0.0003
                        ? 'text-amber-400'
                        : fr < 0
                        ? 'text-emerald-400'
                        : 'text-slate-100'
                      : 'text-slate-400'
                  }`}
                >
                  {fr !== null ? `${fr >= 0 ? '+' : ''}${(fr * 100).toFixed(4)}%` : 'Unavailable'}
                </span>
                <span className="text-xs text-slate-300 font-semibold tabular-nums">
                  {annFr !== null ? `${annFr >= 0 ? '+' : ''}${annFr.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {fr !== null && fr > 0.0003
                  ? 'Longs paying steep fee to shorts · High squeeze vulnerability'
                  : fr !== null && fr < -0.0001
                  ? 'Shorts paying longs · Favorable short squeeze environment'
                  : 'Balanced funding rate environment · Normal spot/perpetual basis'}
              </div>
            </div>

            {/* Open Interest Box */}
            <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                <span>Perpetual Open Interest</span>
                <span>Active Leverage</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-white tabular-nums">
                  {oiBtc !== null ? `${Math.round(oiBtc).toLocaleString()} BTC` : 'Unavailable'}
                </span>
                {oiUsd !== null && (
                  <span className="text-xs text-slate-300 font-semibold tabular-nums">
                    ${(oiUsd / 1_000_000_000).toFixed(2)}B
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Measures aggregate outstanding contract commitments in global perpetual order books.
              </div>
            </div>
          </div>
        ) : (
          <div className="my-4 p-4 rounded bg-slate-950/40 border border-slate-800 text-xs font-mono text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Public Derivatives Endpoint Unreachable</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Derivatives funding and open interest data are not returned by the public exchange endpoint.
              In accordance with quantitative discipline, no fake funding rates or speculative interest figures are fabricated.
              Factor weights have automatically renormalized over available spot factors without directional bias.
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Provider: {derivatives?.provider || 'Public Futures Endpoint'}</span>
        <span>Isolated from Spot Signal calculation if unavailable</span>
      </div>
    </div>
  );
};
