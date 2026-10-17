import React, { useState, useMemo } from 'react';
import { Candle, BacktestConfig, BacktestResult } from '../types/market';
import { runHistoricalBacktest } from '../lib/backtester';
import {
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  AlertTriangle,
  History,
  Shield,
  CheckCircle,
} from 'lucide-react';

interface BacktestingViewProps {
  candles: Candle[];
  interval: string;
}

export const BacktestingView: React.FC<BacktestingViewProps> = ({ candles, interval }) => {
  const [config, setConfig] = useState<BacktestConfig>({
    strategy: 'ema_cross',
    initialCapital: 10000,
    positionSizePct: 100,
    tradingFeePct: 0.075, // 0.075% taker fee
    stopLossPct: 4, // 4% stop loss
  });

  const [useStopLoss, setUseStopLoss] = useState(true);

  // Compute backtest result
  const result: BacktestResult = useMemo(() => {
    return runHistoricalBacktest(candles, {
      ...config,
      stopLossPct: useStopLoss ? config.stopLossPct : undefined,
    });
  }, [candles, config, useStopLoss]);

  const isAlphaPositive = result.alphaPct >= 0;

  return (
    <div className="space-y-6">
      {/* 1. Header & Configuration Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-100">
                Historical Quantitative Backtester
              </h2>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Strict candle-close decision execution on subsequent bar open · Zero look-ahead bias
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Historical Dataset:</span>
            <span className="text-amber-400 font-semibold">{candles.length} bars ({interval})</span>
            <span>·</span>
            <span>{result.startDate} to {result.endDate}</span>
          </div>
        </div>

        {/* Strategy & Risk Parameter Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 font-mono text-xs">
          {/* Strategy Select */}
          <div className="lg:col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
              Strategy Algorithm
            </label>
            <select
              value={config.strategy}
              onChange={(e) =>
                setConfig({ ...config, strategy: e.target.value as BacktestConfig['strategy'] })
              }
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2 focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="ema_cross">EMA 20 / 50 Trend Crossover</option>
              <option value="rsi_mean_reversion">RSI Mean Reversion (&lt;35) + EMA50 Filter</option>
              <option value="quant_composite">Multi-Factor Trend + Momentum Model</option>
            </select>
          </div>

          {/* Initial Capital */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
              Initial Capital ($)
            </label>
            <input
              type="number"
              min="100"
              max="10000000"
              step="500"
              value={config.initialCapital}
              onChange={(e) =>
                setConfig({ ...config, initialCapital: Math.max(100, Number(e.target.value)) })
              }
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Trading Fee % */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
              Trading Fee / Slippage (%)
            </label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.01"
              value={config.tradingFeePct}
              onChange={(e) =>
                setConfig({ ...config, tradingFeePct: Math.max(0, Number(e.target.value)) })
              }
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Stop Loss Toggle & Pct */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400">
                Stop Loss (%)
              </label>
              <button
                type="button"
                onClick={() => setUseStopLoss(!useStopLoss)}
                className={`text-[10px] px-1 rounded transition-colors ${
                  useStopLoss ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {useStopLoss ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <input
              type="number"
              min="0.5"
              max="20"
              step="0.5"
              disabled={!useStopLoss}
              value={config.stopLossPct || 4}
              onChange={(e) =>
                setConfig({ ...config, stopLossPct: Math.max(0.5, Number(e.target.value)) })
              }
              className={`w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2 focus:border-amber-500 focus:outline-none ${
                !useStopLoss ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* 2. Strategy Results or Unavailable Warning */}
      {!result.isViable ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-xs font-mono text-amber-400">
          <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-400" />
          <p className="font-semibold text-slate-200 mb-1">Backtest Unavailable</p>
          <p className="text-slate-400">{result.unavailableReason}</p>
        </div>
      ) : (
        <>
          {/* Performance KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 font-mono">
            {/* Total Return */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Strategy Return
              </span>
              <div
                className={`text-xl font-bold tabular-nums ${
                  result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.totalReturnPct >= 0 ? '+' : ''}
                {result.totalReturnPct.toFixed(2)}%
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Final: ${result.finalCapital.toLocaleString()}
              </span>
            </div>

            {/* Benchmark Return (Buy & Hold) */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Buy & Hold (B&H)
              </span>
              <div
                className={`text-xl font-bold tabular-nums ${
                  result.benchmarkReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.benchmarkReturnPct >= 0 ? '+' : ''}
                {result.benchmarkReturnPct.toFixed(2)}%
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Spot Benchmark</span>
            </div>

            {/* Alpha */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Strategy Alpha
              </span>
              <div
                className={`text-xl font-bold tabular-nums ${
                  isAlphaPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isAlphaPositive ? '+' : ''}
                {result.alphaPct.toFixed(2)}%
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Over Benchmark</span>
            </div>

            {/* Max Drawdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Max Drawdown
              </span>
              <div className="text-xl font-bold text-rose-400 tabular-nums">
                -{result.maxDrawdownPct.toFixed(2)}%
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Peak-to-Trough</span>
            </div>

            {/* Win Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Win Rate
              </span>
              <div className="text-xl font-bold text-white tabular-nums">
                {result.winRatePct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {result.winningTrades}W / {result.losingTrades}L
              </span>
            </div>

            {/* Total Trades */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Total Trades
              </span>
              <div className="text-xl font-bold text-slate-200 tabular-nums">
                {result.totalTrades}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Completed Cycles</span>
            </div>

            {/* Profit Factor */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Profit Factor
              </span>
              <div className="text-xl font-bold text-white tabular-nums">
                {result.profitFactor !== null ? result.profitFactor.toFixed(2) : '—'}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Gains / Losses</span>
            </div>
          </div>

          {/* Equity Curve Visualizer (Custom SVG Chart) */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                Equity Curve vs Buy & Hold Benchmark
              </h3>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-3 h-0.5 bg-amber-400 inline-block"></span>
                  <span>Strategy Equity</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-3 h-0.5 bg-slate-500 inline-block"></span>
                  <span>Buy & Hold Equity</span>
                </span>
              </div>
            </div>

            {/* Equity Curve SVG */}
            <div className="w-full h-56 bg-slate-950/60 rounded border border-slate-800/80 p-2 relative overflow-hidden">
              <EquityCurveSvg points={result.equityCurve} initialCapital={result.initialCapital} />
            </div>
          </div>

          {/* Trade Execution Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                Historical Trade Execution Log ({result.trades.length} Trades)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Chronological closed trade positions
              </span>
            </div>

            {result.trades.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-400">
                No trades were triggered by this strategy over the loaded {candles.length} candle history.
              </div>
            ) : (
              <div className="overflow-x-auto mt-4 max-h-96">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Entry Time</th>
                      <th className="py-2 px-3">Entry Price</th>
                      <th className="py-2 px-3">Exit Time</th>
                      <th className="py-2 px-3">Exit Price</th>
                      <th className="py-2 px-3">Size (BTC)</th>
                      <th className="py-2 px-3 text-right">Net PnL ($)</th>
                      <th className="py-2 px-3 text-right">Return (%)</th>
                      <th className="py-2 px-3">Exit Trigger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {result.trades.map((t) => {
                      const isProfit = t.netProfitUsd >= 0;
                      return (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 text-slate-400">{t.id}</td>
                          <td className="py-2 px-3 text-slate-300">
                            {new Date(t.entryTime * 1000).toLocaleString('en-US', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </td>
                          <td className="py-2 px-3 text-slate-200 tabular-nums">
                            ${t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {new Date(t.exitTime * 1000).toLocaleString('en-US', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </td>
                          <td className="py-2 px-3 text-slate-200 tabular-nums">
                            ${t.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </td>
                          <td className="py-2 px-3 text-slate-300 tabular-nums">
                            {t.positionSizeBtc.toFixed(4)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-semibold tabular-nums ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : ''}${t.netProfitUsd.toFixed(2)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-medium tabular-nums ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : ''}{t.returnPct.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                t.exitReason === 'STOP_LOSS'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : t.exitReason === 'SIGNAL'
                                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {t.exitReason}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Disclaimers & Assumptions Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-start gap-3 text-xs font-mono text-slate-400">
        <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-300">Quantitative Backtesting Disclaimer</span>
          <p className="leading-relaxed text-[11px]">
            Historical performance is modeled strictly on retrieved OHLCV exchange candles and does NOT represent or guarantee future returns.
            Decisions are simulated at bar-close timestamp and executed on subsequent bar-open prices to prevent look-ahead bias.
            Slippage, exchange fee adjustments, liquidity thinness during volatile gaps, and exchange outage risks can cause live execution to diverge substantially.
          </p>
        </div>
      </div>
    </div>
  );
};

// SVG Equity Curve Renderer
const EquityCurveSvg: React.FC<{ points: { equity: number; benchmarkEquity: number }[]; initialCapital: number }> = ({
  points,
  initialCapital,
}) => {
  if (points.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-mono">
        Insufficient data points to plot curve.
      </div>
    );
  }

  const allEquities = points.flatMap((p) => [p.equity, p.benchmarkEquity]);
  const minEquity = Math.min(...allEquities, initialCapital * 0.95);
  const maxEquity = Math.max(...allEquities, initialCapital * 1.05);
  const range = maxEquity - minEquity || 1;

  const width = 800;
  const height = 180;
  const padTop = 15;
  const padBottom = 20;
  const chartH = height - padTop - padBottom;

  const getX = (idx: number) => (idx / (points.length - 1)) * width;
  const getY = (val: number) => padTop + chartH - ((val - minEquity) / range) * chartH;

  // Build SVG paths
  const strategyPath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p.equity).toFixed(1)}`)
    .join(' ');

  const benchmarkPath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p.benchmarkEquity).toFixed(1)}`)
    .join(' ');

  const baseLineY = getY(initialCapital);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      {/* Baseline (Initial Capital) */}
      <line
        x1="0"
        y1={baseLineY}
        x2={width}
        y2={baseLineY}
        stroke="rgba(148, 163, 184, 0.2)"
        strokeDasharray="4 4"
        strokeWidth="1"
      />

      {/* Benchmark Line */}
      <path
        d={benchmarkPath}
        fill="none"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        strokeOpacity="0.8"
      />

      {/* Strategy Line */}
      <path
        d={strategyPath}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
      />
    </svg>
  );
};
