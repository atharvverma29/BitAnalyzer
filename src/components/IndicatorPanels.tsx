import React from 'react';
import { IndicatorResults, Candle } from '../types/market';
import { Activity, Gauge, TrendingUp, BarChart2, ShieldAlert } from 'lucide-react';

interface IndicatorPanelsProps {
  indicators: IndicatorResults;
  candles: Candle[];
  currentPrice: number | null;
}

export const IndicatorPanels: React.FC<IndicatorPanelsProps> = ({
  indicators,
  candles,
  currentPrice,
}) => {
  const rsi = indicators.rsi14.length > 0 ? indicators.rsi14[indicators.rsi14.length - 1] : null;
  const ema20 = indicators.ema20.length > 0 ? indicators.ema20[indicators.ema20.length - 1] : null;
  const ema50 = indicators.ema50.length > 0 ? indicators.ema50[indicators.ema50.length - 1] : null;

  const macd = indicators.macd.macd.length > 0 ? indicators.macd.macd[indicators.macd.macd.length - 1] : null;
  const macdSignal = indicators.macd.signal.length > 0 ? indicators.macd.signal[indicators.macd.signal.length - 1] : null;
  const macdHist = indicators.macd.histogram.length > 0 ? indicators.macd.histogram[indicators.macd.histogram.length - 1] : null;

  const atr = indicators.atr14.length > 0 ? indicators.atr14[indicators.atr14.length - 1] : null;
  const atrPct = (atr !== null && currentPrice !== null && currentPrice > 0) ? (atr / currentPrice) * 100 : null;

  const volRatio = indicators.volumeRatio.ratio;
  const volMa = indicators.volumeRatio.maVolume;

  const return20 = indicators.priceStats.return20PeriodPct;
  const volAnnualized = indicators.priceStats.annualizedVolatilityPct;

  // Recent RSI history (last 15 points) for mini sparkline
  const rsiPoints = indicators.rsi14.slice(-15).filter((x): x is number => x !== null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. RSI (14) Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>RSI (14 Periods)</span>
            </span>
            <span className="text-[11px] text-slate-400">Wilder Smoothed</span>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {rsi !== null ? rsi.toFixed(1) : 'Unavailable'}
            </span>
            <span className="text-xs font-mono text-slate-400">/ 100</span>
          </div>

          {/* RSI Visual Meter */}
          {rsi !== null && (
            <div className="space-y-1.5">
              <div className="relative w-full h-2 bg-slate-800 rounded overflow-hidden">
                {/* 30-70 zone marking */}
                <div className="absolute left-[30%] right-[30%] top-0 bottom-0 bg-slate-700/40"></div>
                {/* Needle / Progress */}
                <div
                  className={`h-full transition-all duration-300 ${
                    rsi > 70 ? 'bg-amber-400' : rsi < 30 ? 'bg-sky-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(Math.max(rsi, 0), 100)}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>0 (Oversold &lt;30)</span>
                <span>50</span>
                <span>100 (Overbought &gt;70)</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          {rsi !== null ? (
            rsi > 70 ? (
              <span className="text-amber-400">Overbought Momentum · Watch for pullback</span>
            ) : rsi < 30 ? (
              <span className="text-sky-400">Oversold Contraction · Bounce potential</span>
            ) : rsi >= 55 ? (
              <span className="text-emerald-400">Bullish Momentum Expansion</span>
            ) : rsi <= 45 ? (
              <span className="text-rose-400">Bearish Momentum Drift</span>
            ) : (
              <span className="text-slate-400">Neutral Equilibrium (45–55)</span>
            )
          ) : (
            'Requires at least 15 historical periods'
          )}
        </div>
      </div>

      {/* 2. MACD (12, 26, 9) Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
              <span>MACD (12, 26, 9)</span>
            </span>
            <span className="text-[11px] text-slate-400">Histogram</span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                macdHist !== null
                  ? macdHist > 0
                    ? 'text-emerald-400'
                    : macdHist < 0
                    ? 'text-rose-400'
                    : 'text-white'
                  : 'text-slate-400'
              }`}
            >
              {macdHist !== null ? `${macdHist > 0 ? '+' : ''}${macdHist.toFixed(2)}` : 'Unavailable'}
            </span>
            <span className="text-xs font-mono text-slate-400">Hist</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono py-1">
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">MACD Line</span>
              <span className="text-slate-200 tabular-nums">
                {macd !== null ? macd.toFixed(2) : '—'}
              </span>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Signal Line</span>
              <span className="text-slate-200 tabular-nums">
                {macdSignal !== null ? macdSignal.toFixed(2) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          {macd !== null && macdSignal !== null ? (
            macd > macdSignal ? (
              <span className="text-emerald-400">MACD above Signal (Bullish cross)</span>
            ) : (
              <span className="text-rose-400">MACD below Signal (Bearish cross)</span>
            )
          ) : (
            'Requires at least 35 historical periods'
          )}
        </div>
      </div>

      {/* 3. ATR & Volatility Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>ATR (14) Volatility</span>
            </span>
            <span className="text-[11px] text-slate-400">Average Range</span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {atr !== null ? `$${atr.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : 'Unavailable'}
            </span>
            {atrPct !== null && (
              <span className="text-xs font-mono text-purple-400 tabular-nums">
                ({atrPct.toFixed(2)}%)
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Annualized Log Vol:</span>
              <span className="text-slate-200 tabular-nums">
                {volAnnualized !== null ? `${volAnnualized.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>20-Bar Price Delta:</span>
              <span
                className={`tabular-nums ${
                  return20 !== null && return20 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {return20 !== null ? `${return20 >= 0 ? '+' : ''}${return20.toFixed(2)}%` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          <span>Expected 1-candle range: ±${atr ? Math.round(atr) : '—'}</span>
        </div>
      </div>

      {/* 4. Volume Ratio Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Volume vs 20-SMA</span>
            </span>
            <span className="text-[11px] text-slate-400">Participation</span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {volRatio !== null ? `${volRatio.toFixed(2)}x` : 'Unavailable'}
            </span>
            <span className="text-xs font-mono text-slate-400">of Average</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>20-SMA Volume:</span>
              <span className="text-slate-200 tabular-nums">
                {volMa !== null ? `${Math.round(volMa).toLocaleString()} BTC` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Trend Filter (EMA50):</span>
              <span className="text-slate-200 tabular-nums">
                {ema50 !== null ? `$${Math.round(ema50).toLocaleString()}` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          {volRatio !== null ? (
            volRatio >= 1.3 ? (
              <span className="text-emerald-400">High Conviction (+{((volRatio - 1) * 100).toFixed(0)}% vol)</span>
            ) : volRatio <= 0.7 ? (
              <span className="text-amber-400">Low Volume Participation</span>
            ) : (
              <span className="text-slate-400">Typical Baseline Activity</span>
            )
          ) : (
            'Requires at least 20 historical periods'
          )}
        </div>
      </div>
    </div>
  );
};
