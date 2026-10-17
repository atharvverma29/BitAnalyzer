import React, { useState } from 'react';
import { RiskCalculationInputs } from '../types/market';
import { calculatePositionRisk } from '../lib/riskCalculator';
import {
  Calculator,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

interface RiskCalculatorViewProps {
  currentSpotPrice: number | null;
}

export const RiskCalculatorView: React.FC<RiskCalculatorViewProps> = ({ currentSpotPrice }) => {
  const [inputs, setInputs] = useState<RiskCalculationInputs>({
    accountEquity: 25000,
    riskPct: 1.5,
    entryPrice: currentSpotPrice || 68000,
    stopLossPrice: (currentSpotPrice || 68000) * 0.96, // 4% stop default
    direction: 'LONG',
    targetPrice: (currentSpotPrice || 68000) * 1.08, // 8% target default (1:2 R/R)
  });

  const handleUseLivePrice = () => {
    if (!currentSpotPrice) return;
    const isLong = inputs.direction === 'LONG';
    setInputs({
      ...inputs,
      entryPrice: parseFloat(currentSpotPrice.toFixed(2)),
      stopLossPrice: parseFloat((currentSpotPrice * (isLong ? 0.96 : 1.04)).toFixed(2)),
      targetPrice: parseFloat((currentSpotPrice * (isLong ? 1.08 : 0.92)).toFixed(2)),
    });
  };

  const handleDirectionChange = (newDirection: 'LONG' | 'SHORT') => {
    if (newDirection === inputs.direction) return;
    const currentEntry = inputs.entryPrice;
    setInputs({
      ...inputs,
      direction: newDirection,
      stopLossPrice: parseFloat((currentEntry * (newDirection === 'LONG' ? 0.96 : 1.04)).toFixed(2)),
      targetPrice: inputs.targetPrice
        ? parseFloat((currentEntry * (newDirection === 'LONG' ? 1.08 : 0.92)).toFixed(2))
        : undefined,
    });
  };

  const result = calculatePositionRisk(inputs);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-100">
              Position Sizing & Risk Management Calculator
            </h2>
          </div>
          {currentSpotPrice && (
            <button
              onClick={handleUseLivePrice}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded border border-amber-500/30 transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              Use Live Spot Price (${currentSpotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </button>
          )}
        </div>
        <p className="text-xs font-mono text-slate-400 mt-2">
          Calculates mathematically exact position units and leverage required to cap loss at your targeted account risk percentage.
        </p>
      </div>

      {/* 2. Main Grid: Inputs Form & Calculated Output Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Inputs (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 font-mono text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
            Trade Parameters
          </h3>

          {/* Direction Toggle */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1.5">
              Position Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDirectionChange('LONG')}
                className={`py-2 px-3 rounded font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                  inputs.direction === 'LONG'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>LONG / BUY</span>
              </button>
              <button
                type="button"
                onClick={() => handleDirectionChange('SHORT')}
                className={`py-2 px-3 rounded font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                  inputs.direction === 'SHORT'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>SHORT / SELL</span>
              </button>
            </div>
          </div>

          {/* Account Equity */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
              Account Equity (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">$</span>
              <input
                type="number"
                min="10"
                step="500"
                value={inputs.accountEquity}
                onChange={(e) =>
                  setInputs({ ...inputs, accountEquity: Math.max(0, Number(e.target.value)) })
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded pl-7 p-2 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Risk Percentage with quick presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-400">
                Risk Per Trade (%)
              </label>
              <div className="flex gap-1">
                {[0.5, 1.0, 1.5, 2.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInputs({ ...inputs, riskPct: preset })}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      inputs.riskPct === preset
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={inputs.riskPct}
                onChange={(e) =>
                  setInputs({ ...inputs, riskPct: Math.max(0.01, Number(e.target.value)) })
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded p-2 focus:border-amber-500 focus:outline-none"
              />
              <span className="absolute right-3 top-2.5 text-slate-400">%</span>
            </div>
          </div>

          {/* Planned Entry Price */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
              Planned Entry Price ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">$</span>
              <input
                type="number"
                min="1"
                step="100"
                value={inputs.entryPrice}
                onChange={(e) =>
                  setInputs({ ...inputs, entryPrice: Math.max(1, Number(e.target.value)) })
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded pl-7 p-2 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Stop Loss Price */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
              Stop Loss Price ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">$</span>
              <input
                type="number"
                min="1"
                step="100"
                value={inputs.stopLossPrice}
                onChange={(e) =>
                  setInputs({ ...inputs, stopLossPrice: Math.max(1, Number(e.target.value)) })
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded pl-7 p-2 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              {inputs.direction === 'LONG' ? 'Must be below Entry' : 'Must be above Entry'}
            </span>
          </div>

          {/* Optional Target Price */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
              Profit Target Price (Optional, $)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">$</span>
              <input
                type="number"
                min="1"
                step="100"
                value={inputs.targetPrice || ''}
                placeholder="Optional take profit level"
                onChange={(e) =>
                  setInputs({
                    ...inputs,
                    targetPrice: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded pl-7 p-2 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Output: Results Dashboard (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {!result.isValid ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-rose-400 font-mono text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-300">Invalid Input Configuration</span>
                <span className="text-rose-400/90 text-[11px] mt-1 block">
                  {result.validationError}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5 font-mono">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
                Calculated Sizing & Risk Profile
              </h3>

              {/* Primary Output Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Recommended Position Size */}
                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                    Calculated Position Size
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-amber-400 tabular-nums">
                      {result.positionSizeBtc.toFixed(4)} BTC
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-300 block mt-1">
                    Notional: ${result.notionalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Maximum Planned Loss */}
                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                    Maximum Planned Loss
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-rose-400 tabular-nums">
                      -${result.maxLossUsd.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({inputs.riskPct}% of equity)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-300 block mt-1">
                    Risk per BTC: ${result.riskPerBtc.toFixed(2)} ({result.riskPctOfPrice.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Detailed Metrics Table */}
              <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Account Equity:</span>
                  <span className="text-slate-200 font-semibold tabular-nums">
                    ${inputs.accountEquity.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Effective Leverage:</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      result.effectiveLeverage > 1 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {result.effectiveLeverage.toFixed(2)}x
                    {result.effectiveLeverage <= 1
                      ? ' (Fully Unleveraged / Spot)'
                      : ' (Margin / Perpetual Required)'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Stop Loss Distance:</span>
                  <span className="text-slate-200 tabular-nums">
                    ${result.riskPerBtc.toFixed(2)} ({result.riskPctOfPrice.toFixed(2)}% from entry)
                  </span>
                </div>

                {result.riskRewardRatio !== null && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Target Profit Potential:</span>
                      <span className="text-emerald-400 font-semibold tabular-nums">
                        +${result.expectedRewardUsd?.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Risk-to-Reward Ratio:</span>
                      <span className="text-white font-bold tabular-nums">
                        1 : {result.riskRewardRatio.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Formula Documentation */}
              <div className="p-3 bg-slate-950/40 rounded border border-slate-800 text-[11px] text-slate-400 leading-relaxed space-y-1">
                <div>
                  <span className="text-slate-300 font-semibold">Mathematical Formula:</span>
                </div>
                <div>
                  Position Size (BTC) = (Equity &times; Risk%) / |Entry - StopLoss| = (${inputs.accountEquity.toLocaleString()} &times; {inputs.riskPct}%) / ${result.riskPerBtc.toFixed(2)} = <strong className="text-slate-200">{result.positionSizeBtc.toFixed(4)} BTC</strong>
                </div>
              </div>
            </div>
          )}

          {/* Explicit Risk Disclaimers */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-start gap-3 text-xs font-mono text-slate-400">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px]">
              <span className="font-semibold text-slate-200 block">
                Execution Variance & Gap Risk Disclaimers
              </span>
              <p className="leading-relaxed">
                Calculated losses reflect ideal stop-loss fills at the exact entered price. In live exchange conditions,
                slippage, taker liquidation fees, order book depth voids, and weekend CME/spot gaps can cause actual realized losses to exceed the planned max loss.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Notice: This terminal is purely an analytical quantitative tool and does NOT connect to exchange trading accounts or execute transactions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
