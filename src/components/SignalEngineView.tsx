import React, { useState } from 'react';
import { SignalAnalysis } from '../types/market';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SignalEngineViewProps {
  analysis: SignalAnalysis | null;
  isLoading: boolean;
}

export const SignalEngineView: React.FC<SignalEngineViewProps> = ({ analysis, isLoading }) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  if (!analysis && isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 animate-pulse space-y-4">
        <div className="h-8 w-64 bg-slate-800 rounded"></div>
        <div className="h-32 bg-slate-800/50 rounded"></div>
        <div className="h-64 bg-slate-800/30 rounded"></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-xs font-mono text-slate-400">
        Awaiting sufficient market data to execute quantitative signal calculations.
      </div>
    );
  }

  const {
    assessment,
    compositeScore,
    evidenceStrengthPct,
    dataCompletenessPct,
    activeFactorsCount,
    totalFactorsCount,
    factors,
    plainLanguageSummary,
    conflictingEvidence,
    limitations,
  } = analysis;

  const isBullish = assessment === 'BULLISH';
  const isBearish = assessment === 'BEARISH';
  const isNeutral = assessment === 'NEUTRAL';

  return (
    <div className="space-y-6">
      {/* 1. Master Assessment Hero Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          {/* Directional Verdict */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>Quantitative Directional Assessment</span>
              <span>·</span>
              <span>Deterministic Multi-Factor Model</span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-center ${
                  isBullish
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : isBearish
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {isBullish ? (
                  <TrendingUp className="w-7 h-7" />
                ) : isBearish ? (
                  <TrendingDown className="w-7 h-7" />
                ) : (
                  <Minus className="w-7 h-7" />
                )}
              </div>

              <div>
                <h2
                  className={`text-3xl font-extrabold tracking-tight font-mono ${
                    isBullish
                      ? 'text-emerald-400'
                      : isBearish
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {assessment}
                </h2>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Threshold: Composite Score &ge; +0.22 Bullish, &le; -0.22 Bearish, otherwise Neutral
                </div>
              </div>
            </div>
          </div>

          {/* KPI Gauges: Composite Score & Evidence Strength */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono">
            {/* Composite Score */}
            <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Composite Score
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    compositeScore > 0
                      ? 'text-emerald-400'
                      : compositeScore < 0
                      ? 'text-rose-400'
                      : 'text-slate-200'
                  }`}
                >
                  {compositeScore > 0 ? '+' : ''}
                  {compositeScore.toFixed(3)}
                </span>
                <span className="text-[11px] text-slate-400">[-1, +1]</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Weighted Factor Sum</span>
            </div>

            {/* Evidence Strength */}
            <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                <span>Evidence Strength</span>
                <button
                  onClick={() => setShowFormulaDetails(!showFormulaDetails)}
                  className="hover:text-slate-200 transition-colors"
                  title="View formula details"
                >
                  <Info className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white tabular-nums">
                  {evidenceStrengthPct}%
                </span>
                <span className="text-[11px] text-slate-400">Confidence</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {evidenceStrengthPct >= 70
                  ? 'High Consensus'
                  : evidenceStrengthPct >= 45
                  ? 'Moderate Evidence'
                  : 'Low Conviction'}
              </span>
            </div>

            {/* Factor Completeness */}
            <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                Data Completeness
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-200 tabular-nums">
                  {dataCompletenessPct}%
                </span>
                <span className="text-[11px] text-slate-400">
                  ({activeFactorsCount}/{totalFactorsCount} active)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {activeFactorsCount === totalFactorsCount
                  ? 'Full Coverage'
                  : 'Renormalized Weights'}
              </span>
            </div>
          </div>
        </div>

        {/* Plain Language Synthesis */}
        <div className="mt-4 pt-4 text-xs font-mono leading-relaxed text-slate-300 bg-slate-950/40 p-4 rounded border border-slate-800/80">
          <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-1">
            Plain-Language Analysis Synthesis
          </div>
          <p>{plainLanguageSummary}</p>
        </div>

        {/* Collapsible Formula & Weighting Rationale */}
        {showFormulaDetails && (
          <div className="mt-4 p-4 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
            <div className="font-semibold text-slate-200 text-xs">
              Mathematical Methodology & Score Formula:
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              1. <strong>Composite Score Formulation</strong>: Each active factor is evaluated into a normalized directional score <code className="text-amber-400">s_i &isin; [-1.0, +1.0]</code>. Base weights are defined as: Trend (25%), RSI Momentum (20%), MACD (20%), Volume (15%), Order Book (10%), Derivatives (10%).
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              2. <strong>Transparent Weight Renormalization</strong>: If an upstream input is unavailable (e.g. futures funding offline or insufficient candles), its weight is not treated as bullish or bearish. The remaining active weights are normalized such that <code className="text-amber-400">&Sigma; w_effective = 1.00</code>.
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              3. <strong>Evidence-Strength Score</strong>: <code className="text-amber-400">Evidence = (0.35 + 0.65 &times; |Score|) &times; (ActiveWeight / TotalWeight) &times; Freshness &times; (1 - 0.4 &times; ConflictRatio)</code>. This measures signal unanimity and data integrity, never calibrated as a probabilistic winning rate.
            </p>
          </div>
        )}
      </div>

      {/* 2. Factor Contribution Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              Quantitative Factor Contribution Matrix
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Individual factor scores, normalized weights, and arithmetic contributions to composite score
            </span>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Factor Dimension</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Metric Value</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3 text-right">Base Wt</th>
                <th className="py-2.5 px-3 text-right">Effective Wt</th>
                <th className="py-2.5 px-3 text-right">Net Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {factors.map((factor) => {
                const isFactBullish = factor.direction === 'BULLISH';
                const isFactBearish = factor.direction === 'BEARISH';
                const isFactActive = factor.status === 'ACTIVE';

                return (
                  <tr key={factor.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Name + Explanation */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-100">{factor.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 max-w-md leading-relaxed">
                        {factor.explanation}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3">
                      <span className="text-[11px] text-slate-400">{factor.category}</span>
                    </td>

                    {/* Metric Value */}
                    <td className="py-3 px-3 text-slate-200 font-medium tabular-nums">
                      {factor.metricValue}
                    </td>

                    {/* Direction Badge */}
                    <td className="py-3 px-3">
                      {isFactActive ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isFactBullish
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isFactBearish
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isFactBullish && <TrendingUp className="w-3 h-3" />}
                          {isFactBearish && <TrendingDown className="w-3 h-3" />}
                          {factor.direction}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/50">
                          UNAVAILABLE
                        </span>
                      )}
                    </td>

                    {/* Base Weight */}
                    <td className="py-3 px-3 text-right text-slate-400 tabular-nums">
                      {(factor.baseWeight * 100).toFixed(0)}%
                    </td>

                    {/* Effective Weight (renormalized) */}
                    <td className="py-3 px-3 text-right font-medium text-slate-200 tabular-nums">
                      {factor.status === 'ACTIVE'
                        ? `${(factor.effectiveWeight * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>

                    {/* Contribution */}
                    <td className="py-3 px-3 text-right font-bold tabular-nums">
                      {factor.status === 'ACTIVE' ? (
                        <span
                          className={
                            factor.contribution > 0
                              ? 'text-emerald-400'
                              : factor.contribution < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                          }
                        >
                          {factor.contribution > 0 ? '+' : ''}
                          {factor.contribution.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-slate-400">0.000</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Conflicting Evidence & Quantitative Limitations Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conflicting Evidence */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-amber-400 mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Conflicting Evidence & Divergence Notes</span>
          </div>

          {conflictingEvidence.length > 0 ? (
            <ul className="space-y-2 text-xs font-mono text-slate-300">
              {conflictingEvidence.map((conflict, i) => (
                <li key={i} className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                  <span className="text-amber-400 font-bold">&bull;</span>
                  <span>{conflict}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 bg-slate-950/40 rounded border border-slate-800/60 text-xs font-mono text-slate-400">
              No significant directional divergences detected across active factor inputs.
            </div>
          )}
        </div>

        {/* Model Limitations & Assumptions */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-slate-200 mb-3">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Model Limitations & Boundary Conditions</span>
          </div>

          <ul className="space-y-2 text-xs font-mono text-slate-400">
            {limitations.map((limitation, i) => (
              <li key={i} className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                <span className="text-sky-400 font-bold">&bull;</span>
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
