import {
  Candle,
  DerivativesContext,
  FactorContribution,
  IndicatorResults,
  OrderBookData,
  SignalAnalysis,
  SignalAssessment,
} from '../types/market';

export interface SignalEngineInputs {
  candles: Candle[];
  indicators: IndicatorResults;
  orderBook: OrderBookData | null;
  derivatives: DerivativesContext | null;
  dataTimestamp?: number;
}

/**
 * Base configurable weights for the deterministic quantitative model.
 * Sums to 1.00 (100%).
 */
export const BASE_FACTOR_WEIGHTS = {
  trend_alignment: 0.25,
  momentum_rsi: 0.20,
  macd_acceleration: 0.20,
  volume_confirmation: 0.15,
  orderbook_imbalance: 0.10,
  derivatives_funding: 0.10,
};

/**
 * Analyzes market data using a deterministic, multi-factor quantitative engine.
 * Renormalizes weights when factors are missing, penalizes evidence strength,
 * and outputs fully explainable reasoning with conflicting evidence.
 */
export function analyzeMarketSignals(inputs: SignalEngineInputs): SignalAnalysis {
  const { candles, indicators, orderBook, derivatives, dataTimestamp } = inputs;
  const factors: FactorContribution[] = [];
  const conflictingEvidence: string[] = [];
  const limitations: string[] = [];

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const currentPrice = lastCandle ? lastCandle.close : null;

  // -------------------------------------------------------------
  // Factor 1: Trend Alignment (EMA 20 & EMA 50)
  // -------------------------------------------------------------
  const ema20 = indicators.ema20.length > 0 ? indicators.ema20[indicators.ema20.length - 1] : null;
  const ema50 = indicators.ema50.length > 0 ? indicators.ema50[indicators.ema50.length - 1] : null;

  if (ema20 !== null && ema50 !== null && currentPrice !== null) {
    let score = 0;
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let explanation = '';

    const priceAboveEma20 = currentPrice > ema20;
    const priceAboveEma50 = currentPrice > ema50;
    const ema20AboveEma50 = ema20 > ema50;

    if (priceAboveEma20 && ema20AboveEma50) {
      score = 1.0;
      direction = 'BULLISH';
      explanation = `Price ($${currentPrice.toLocaleString()}) trades above EMA20 ($${ema20.toLocaleString(undefined, { maximumFractionDigits: 1 })}) and EMA50 ($${ema50.toLocaleString(undefined, { maximumFractionDigits: 1 })}), confirming established structural uptrend.`;
    } else if (priceAboveEma20 && !ema20AboveEma50) {
      score = 0.45;
      direction = 'BULLISH';
      explanation = `Price recovered above EMA20 ($${ema20.toLocaleString(undefined, { maximumFractionDigits: 1 })}), but EMA20 remains below EMA50 (early recovery / potential trend transition).`;
    } else if (!priceAboveEma20 && ema20AboveEma50 && priceAboveEma50) {
      score = -0.3;
      direction = 'BEARISH';
      explanation = `Price dipped below EMA20 ($${ema20.toLocaleString(undefined, { maximumFractionDigits: 1 })}) into EMA50 support ($${ema50.toLocaleString(undefined, { maximumFractionDigits: 1 })}); minor pullback within larger trend.`;
    } else if (!priceAboveEma20 && !ema20AboveEma50) {
      score = -1.0;
      direction = 'BEARISH';
      explanation = `Price ($${currentPrice.toLocaleString()}) trades below both EMA20 ($${ema20.toLocaleString(undefined, { maximumFractionDigits: 1 })}) and EMA50 ($${ema50.toLocaleString(undefined, { maximumFractionDigits: 1 })}), confirming persistent downtrend regime.`;
    } else {
      score = -0.4;
      direction = 'BEARISH';
      explanation = `Price broken below EMA50 while EMA20 compresses; deteriorating trend support.`;
    }

    factors.push({
      id: 'trend_alignment',
      name: 'EMA 20 / 50 Trend Alignment',
      category: 'Trend',
      metricValue: `EMA20: $${Math.round(ema20).toLocaleString()} · EMA50: $${Math.round(ema50).toLocaleString()}`,
      rawScore: score,
      baseWeight: BASE_FACTOR_WEIGHTS.trend_alignment,
      effectiveWeight: 0,
      contribution: 0,
      status: 'ACTIVE',
      direction,
      explanation,
    });
  } else {
    limitations.push('Insufficient historical candles to calculate EMA 50 (minimum 50 periods required).');
    factors.push({
      id: 'trend_alignment',
      name: 'EMA 20 / 50 Trend Alignment',
      category: 'Trend',
      metricValue: 'Unavailable (< 50 bars)',
      rawScore: 0,
      baseWeight: BASE_FACTOR_WEIGHTS.trend_alignment,
      effectiveWeight: 0,
      contribution: 0,
      status: 'UNAVAILABLE',
      direction: 'N/A',
      explanation: 'Unavailable: Requires at least 50 valid historical candles.',
    });
  }

  // -------------------------------------------------------------
  // Factor 2: Momentum (RSI 14)
  // -------------------------------------------------------------
  const rsi = indicators.rsi14.length > 0 ? indicators.rsi14[indicators.rsi14.length - 1] : null;
  if (rsi !== null) {
    let score = 0;
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let explanation = '';

    if (rsi > 70) {
      score = 0.25;
      direction = 'BULLISH';
      explanation = `RSI at ${rsi.toFixed(1)} indicates aggressive buying momentum, though entering elevated overbought territory (> 70) where mean-reversion pauses are common.`;
      conflictingEvidence.push(`RSI is in overbought territory (${rsi.toFixed(1)} > 70), warning of short-term exhaustion risk.`);
    } else if (rsi >= 55) {
      score = 0.85;
      direction = 'BULLISH';
      explanation = `RSI at ${rsi.toFixed(1)} sits in the optimal bullish expansion zone (55–70) with healthy upward velocity and headroom.`;
    } else if (rsi >= 45) {
      score = 0.0;
      direction = 'NEUTRAL';
      explanation = `RSI at ${rsi.toFixed(1)} rests in the neutral balance zone (45–55); neither buyers nor sellers hold decisive momentum.`;
    } else if (rsi >= 30) {
      score = -0.85;
      direction = 'BEARISH';
      explanation = `RSI at ${rsi.toFixed(1)} reflects negative momentum expansion (30–45) with dominant selling pressure.`;
    } else {
      score = -0.25;
      direction = 'BEARISH';
      explanation = `RSI at ${rsi.toFixed(1)} is heavily depressed (< 30 oversold); while the trend is down, oversold conditions present short-squeeze / bounce risk.`;
      conflictingEvidence.push(`RSI is in oversold territory (${rsi.toFixed(1)} < 30), which can provoke sharp corrective counter-trend rallies.`);
    }

    factors.push({
      id: 'momentum_rsi',
      name: 'RSI 14 Momentum',
      category: 'Momentum',
      metricValue: `${rsi.toFixed(1)} pts`,
      rawScore: score,
      baseWeight: BASE_FACTOR_WEIGHTS.momentum_rsi,
      effectiveWeight: 0,
      contribution: 0,
      status: 'ACTIVE',
      direction,
      explanation,
    });
  } else {
    limitations.push('Insufficient candle history to calculate RSI 14.');
    factors.push({
      id: 'momentum_rsi',
      name: 'RSI 14 Momentum',
      category: 'Momentum',
      metricValue: 'Unavailable (< 15 bars)',
      rawScore: 0,
      baseWeight: BASE_FACTOR_WEIGHTS.momentum_rsi,
      effectiveWeight: 0,
      contribution: 0,
      status: 'UNAVAILABLE',
      direction: 'N/A',
      explanation: 'Unavailable: Requires at least 15 historical periods.',
    });
  }

  // -------------------------------------------------------------
  // Factor 3: MACD Acceleration & Histogram
  // -------------------------------------------------------------
  const macdVal = indicators.macd.macd.length > 0 ? indicators.macd.macd[indicators.macd.macd.length - 1] : null;
  const signalVal = indicators.macd.signal.length > 0 ? indicators.macd.signal[indicators.macd.signal.length - 1] : null;
  const histVal = indicators.macd.histogram.length > 0 ? indicators.macd.histogram[indicators.macd.histogram.length - 1] : null;
  const prevHistVal = indicators.macd.histogram.length > 1 ? indicators.macd.histogram[indicators.macd.histogram.length - 2] : null;

  if (macdVal !== null && signalVal !== null && histVal !== null) {
    let score = 0;
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let explanation = '';

    const isMacdAboveSignal = macdVal > signalVal;
    const isHistExpanding = prevHistVal !== null ? Math.abs(histVal) > Math.abs(prevHistVal) : true;

    if (isMacdAboveSignal && histVal > 0) {
      if (isHistExpanding) {
        score = 0.9;
        direction = 'BULLISH';
        explanation = `MACD line (${macdVal.toFixed(1)}) leads Signal line (${signalVal.toFixed(1)}) with positive expanding histogram bars (+${histVal.toFixed(1)}), confirming accelerating bullish momentum.`;
      } else {
        score = 0.4;
        direction = 'BULLISH';
        explanation = `MACD remains above Signal line, but positive histogram tick weakened (+${histVal.toFixed(1)}), signaling deceleration in buy velocity.`;
      }
    } else if (!isMacdAboveSignal && histVal < 0) {
      if (isHistExpanding) {
        score = -0.9;
        direction = 'BEARISH';
        explanation = `MACD line (${macdVal.toFixed(1)}) is beneath Signal line (${signalVal.toFixed(1)}) with expanding negative histogram (${histVal.toFixed(1)}), indicating strong downward trend acceleration.`;
      } else {
        score = -0.4;
        direction = 'BEARISH';
        explanation = `MACD remains below Signal line, but negative histogram bars contracted (${histVal.toFixed(1)}), indicating selling exhaustion may be approaching.`;
      }
    } else {
      score = isMacdAboveSignal ? 0.2 : -0.2;
      direction = isMacdAboveSignal ? 'BULLISH' : 'BEARISH';
      explanation = `MACD and Signal lines are hovering around crossover equilibrium.`;
    }

    factors.push({
      id: 'macd_acceleration',
      name: 'MACD (12, 26, 9) Acceleration',
      category: 'Trend',
      metricValue: `Hist: ${histVal > 0 ? '+' : ''}${histVal.toFixed(1)} · MACD: ${macdVal.toFixed(1)}`,
      rawScore: score,
      baseWeight: BASE_FACTOR_WEIGHTS.macd_acceleration,
      effectiveWeight: 0,
      contribution: 0,
      status: 'ACTIVE',
      direction,
      explanation,
    });
  } else {
    limitations.push('Insufficient candle history to compute 26-period MACD.');
    factors.push({
      id: 'macd_acceleration',
      name: 'MACD (12, 26, 9) Acceleration',
      category: 'Trend',
      metricValue: 'Unavailable (< 35 bars)',
      rawScore: 0,
      baseWeight: BASE_FACTOR_WEIGHTS.macd_acceleration,
      effectiveWeight: 0,
      contribution: 0,
      status: 'UNAVAILABLE',
      direction: 'N/A',
      explanation: 'Unavailable: Requires at least 35 historical periods.',
    });
  }

  // -------------------------------------------------------------
  // Factor 4: Volume Confirmation vs 20-Period Average
  // -------------------------------------------------------------
  const volRatio = indicators.volumeRatio.ratio;
  const priceReturn = indicators.priceStats.return20PeriodPct;

  if (volRatio !== null) {
    let score = 0;
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let explanation = '';

    const priceIsUp = (priceReturn || 0) >= 0;

    if (volRatio >= 1.3) {
      if (priceIsUp) {
        score = 0.8;
        direction = 'BULLISH';
        explanation = `Volume is ${((volRatio - 1) * 100).toFixed(0)}% above the 20-period average on upward price trajectory, signaling institutional conviction / aggressive accumulation.`;
      } else {
        score = -0.8;
        direction = 'BEARISH';
        explanation = `Elevated volume (${((volRatio - 1) * 100).toFixed(0)}% above average) accompanies price depreciation, confirming aggressive distribution / selling pressure.`;
      }
    } else if (volRatio <= 0.7) {
      score = priceIsUp ? -0.2 : 0.2;
      direction = 'NEUTRAL';
      explanation = `Volume is suppressed (${volRatio.toFixed(2)}x of 20-period average); low liquidity or muted participation suggests recent moves lack strong institutional commitment.`;
      conflictingEvidence.push(`Subdued trading volume (${volRatio.toFixed(2)}x average) suggests lack of high-conviction participation.`);
    } else {
      score = priceIsUp ? 0.3 : -0.3;
      direction = priceIsUp ? 'BULLISH' : 'BEARISH';
      explanation = `Volume is tracking standard baseline levels (${volRatio.toFixed(2)}x average) with moderate directional backing.`;
    }

    factors.push({
      id: 'volume_confirmation',
      name: 'Volume Relative to 20-SMA',
      category: 'Volume',
      metricValue: `${volRatio.toFixed(2)}x Avg`,
      rawScore: score,
      baseWeight: BASE_FACTOR_WEIGHTS.volume_confirmation,
      effectiveWeight: 0,
      contribution: 0,
      status: 'ACTIVE',
      direction,
      explanation,
    });
  } else {
    factors.push({
      id: 'volume_confirmation',
      name: 'Volume Relative to 20-SMA',
      category: 'Volume',
      metricValue: 'Unavailable (< 20 bars)',
      rawScore: 0,
      baseWeight: BASE_FACTOR_WEIGHTS.volume_confirmation,
      effectiveWeight: 0,
      contribution: 0,
      status: 'UNAVAILABLE',
      direction: 'N/A',
      explanation: 'Unavailable: Requires 20 volume observations.',
    });
  }

  // -------------------------------------------------------------
  // Factor 5: Order Book Microstructure (Bid/Ask Imbalance)
  // -------------------------------------------------------------
  if (orderBook && orderBook.bestBid && orderBook.bestAsk && orderBook.bids.length >= 5 && orderBook.asks.length >= 5) {
    const imbalance = orderBook.imbalanceRatio; // -1.0 to +1.0
    const spreadBps = orderBook.spreadBps || 0;
    let score = 0;
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let explanation = '';

    if (spreadBps > 15) {
      limitations.push(`Spot bid/ask spread is wide (${spreadBps.toFixed(2)} bps); market depth may experience temporary slippage.`);
    }

    if (imbalance > 0.15) {
      score = Math.min(imbalance * 1.5, 0.85);
      direction = 'BULLISH';
      explanation = `Order book shows +${(imbalance * 100).toFixed(1)}% bid-side depth surplus, reflecting active bid support defending spot levels (Spread: ${spreadBps.toFixed(1)} bps).`;
    } else if (imbalance < -0.15) {
      score = Math.max(imbalance * 1.5, -0.85);
      direction = 'BEARISH';
      explanation = `Order book displays ${(Math.abs(imbalance) * 100).toFixed(1)}% ask-side depth overhang, indicating heavy sell-side liquidity capping upward progress (Spread: ${spreadBps.toFixed(1)} bps).`;
    } else {
      score = imbalance * 0.5;
      direction = 'NEUTRAL';
      explanation = `Order book depth is symmetrically balanced (${(imbalance * 100).toFixed(1)}% skew, Spread: ${spreadBps.toFixed(1)} bps); no acute immediate pressure from resting limit orders.`;
    }

    factors.push({
      id: 'orderbook_imbalance',
      name: 'Order Book Microstructure',
      category: 'Microstructure',
      metricValue: `Imbalance: ${(imbalance * 100).toFixed(1)}% · Spread: ${spreadBps.toFixed(1)} bps`,
      rawScore: score,
      baseWeight: BASE_FACTOR_WEIGHTS.orderbook_imbalance,
      effectiveWeight: 0,
      contribution: 0,
      status: 'ACTIVE',
      direction,
      explanation,
    });
  } else {
    limitations.push('Order book limit depth is currently unavailable or filtered out; microstructure weight renormalized.');
    factors.push({
      id: 'orderbook_imbalance',
      name: 'Order Book Microstructure',
      category: 'Microstructure',
      metricValue: 'Unavailable',
      rawScore: 0,
      baseWeight: BASE_FACTOR_WEIGHTS.orderbook_imbalance,
      effectiveWeight: 0,
      contribution: 0,
      status: 'UNAVAILABLE',
      direction: 'N/A',
      explanation: 'Unavailable: Live limit depth not returned by upstream exchange.',
    });
  }

  // -------------------------------------------------------------
  // Factor 6: Derivatives Perpetual Funding & Positioning Context
  // -------------------------------------------------------------
  if (derivatives && derivatives.isAvailable && derivatives.fundingRate8h !== null) {
    const fr = derivatives.fundingRate8h;
    const annFr = derivatives.annualizedFundingRatePct ?? (fr * 3 * 365 * 100);
    let score = 0;
    let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let explanation = '';

    // Standard 8h funding rate thresholds:
    // Baseline neutral: 0.005% to 0.015% (annualized ~5.5% to 16.4%)
    // Crowded long / overheat: > 0.03% (annualized > 32.8%)
    // Crowded short / squeeze potential: < -0.005%
    if (fr > 0.0003) {
      score = -0.55; // Contrarian headwind: longs paying very high premium
      direction = 'BEARISH';
      explanation = `8h perpetual funding rate is elevated at +${(fr * 100).toFixed(4)}% (~${annFr.toFixed(1)}% ann.), indicating crowded speculative long leverage susceptible to liquidation flushes.`;
      conflictingEvidence.push(`Derivatives funding is overheated (+${(fr * 100).toFixed(4)}%), indicating crowded leveraged long positions.`);
    } else if (fr < -0.00005) {
      score = 0.55; // Contrarian tailwind: shorts paying longs
      direction = 'BULLISH';
      explanation = `8h perpetual funding rate is negative at ${(fr * 100).toFixed(4)}% (~${annFr.toFixed(1)}% ann.); perpetual market is heavily short, creating favorable short-squeeze conditions.`;
    } else if (fr >= 0.00005 && fr <= 0.0002) {
      score = 0.15;
      direction = 'BULLISH';
      explanation = `Perpetual funding rate is positive yet disciplined (+${(fr * 100).toFixed(4)}% 8h, ~${annFr.toFixed(1)}% ann.), reflecting sustainable organic spot demand without extreme leverage excess.`;
    } else {
      score = 0.0;
      direction = 'NEUTRAL';
      explanation = `Perpetual funding rate is neutral (${(fr * 100).toFixed(4)}% 8h); derivatives basis is aligned with spot fair value.`;
    }

    factors.push({
      id: 'derivatives_funding',
      name: 'Derivatives Funding Rate Context',
      category: 'Derivatives',
      metricValue: `${(fr * 100).toFixed(4)}% / 8h (${annFr.toFixed(1)}% p.a.)`,
      rawScore: score,
      baseWeight: BASE_FACTOR_WEIGHTS.derivatives_funding,
      effectiveWeight: 0,
      contribution: 0,
      status: 'ACTIVE',
      direction,
      explanation,
    });
  } else {
    limitations.push('Perpetual futures funding data is unavailable; derivatives context excluded from calculations without penalizing directional score.');
    factors.push({
      id: 'derivatives_funding',
      name: 'Derivatives Funding Rate Context',
      category: 'Derivatives',
      metricValue: 'Unavailable',
      rawScore: 0,
      baseWeight: BASE_FACTOR_WEIGHTS.derivatives_funding,
      effectiveWeight: 0,
      contribution: 0,
      status: 'UNAVAILABLE',
      direction: 'N/A',
      explanation: 'Unavailable: Public derivatives endpoint unreachable or omitted.',
    });
  }

  // -------------------------------------------------------------
  // Transparent Weight Renormalization
  // -------------------------------------------------------------
  const activeFactors = factors.filter((f) => f.status === 'ACTIVE');
  const sumActiveBaseWeights = activeFactors.reduce((acc, f) => acc + f.baseWeight, 0);

  let compositeScore = 0;
  if (sumActiveBaseWeights > 0) {
    for (const factor of factors) {
      if (factor.status === 'ACTIVE') {
        factor.effectiveWeight = factor.baseWeight / sumActiveBaseWeights;
        factor.contribution = factor.rawScore * factor.effectiveWeight;
        compositeScore += factor.contribution;
      } else {
        factor.effectiveWeight = 0;
        factor.contribution = 0;
      }
    }
  }

  // Bound composite score safely between -1.0 and +1.0
  compositeScore = Math.max(-1.0, Math.min(1.0, compositeScore));

  // Determine overall directional assessment
  let assessment: SignalAssessment = 'NEUTRAL';
  if (compositeScore >= 0.22) {
    assessment = 'BULLISH';
  } else if (compositeScore <= -0.22) {
    assessment = 'BEARISH';
  } else {
    assessment = 'NEUTRAL';
  }

  // -------------------------------------------------------------
  // Evidence Strength Score Calculation
  // -------------------------------------------------------------
  // Data completeness: proportion of total theoretical weights active
  const totalPossibleWeight = Object.values(BASE_FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
  const dataCompletenessPct = Math.round((sumActiveBaseWeights / totalPossibleWeight) * 100);

  // Freshness penalty: if data is older than 60 seconds
  let freshnessFactor = 1.0;
  if (dataTimestamp) {
    const ageSeconds = (Date.now() - dataTimestamp) / 1000;
    if (ageSeconds > 120) {
      freshnessFactor = 0.7;
      limitations.push(`Market data timestamp is ${Math.round(ageSeconds)}s old; evidence score penalized for latency.`);
    } else if (ageSeconds > 45) {
      freshnessFactor = 0.9;
    }
  }

  // Conflicting signals penalty:
  const bullishCount = activeFactors.filter((f) => f.direction === 'BULLISH').length;
  const bearishCount = activeFactors.filter((f) => f.direction === 'BEARISH').length;
  const conflictRatio = activeFactors.length > 0
    ? Math.min(bullishCount, bearishCount) / activeFactors.length
    : 0;

  // Raw agreement: absolute composite score reflects factor consensus
  const consensusMagnitude = Math.abs(compositeScore); // 0 to 1.0
  const evidenceStrengthRaw = (0.35 + 0.65 * consensusMagnitude) * (sumActiveBaseWeights / totalPossibleWeight) * freshnessFactor * (1.0 - 0.4 * conflictRatio);
  const evidenceStrengthPct = Math.max(10, Math.min(99, Math.round(evidenceStrengthRaw * 100)));

  // Add general quantitative limitations
  limitations.push('Deterministic model outputs reflect historical and instantaneous spot data; they are not predictive forecasts or trading recommendations.');
  limitations.push('Macroeconomic announcements, ETF flow shifts, and sudden regulatory events can override technical conditions instantaneously.');

  // Check for directional conflicts
  if (assessment === 'BULLISH' && bearishCount > 0) {
    for (const bf of activeFactors.filter((f) => f.direction === 'BEARISH')) {
      conflictingEvidence.push(`${bf.name} is bearish (${bf.metricValue}), conflicting with the net bullish thesis.`);
    }
  } else if (assessment === 'BEARISH' && bullishCount > 0) {
    for (const bf of activeFactors.filter((f) => f.direction === 'BULLISH')) {
      conflictingEvidence.push(`${bf.name} is bullish (${bf.metricValue}), diverging from the net bearish thesis.`);
    }
  }

  // -------------------------------------------------------------
  // Plain Language Summary Generation
  // -------------------------------------------------------------
  const dominantFactors = [...activeFactors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const topFactor = dominantFactors.length > 0 ? dominantFactors[0] : null;

  let plainLanguageSummary = '';
  if (activeFactors.length === 0) {
    plainLanguageSummary = 'Insufficient active market inputs to compute an assessment. Please check data feed connections.';
  } else if (assessment === 'BULLISH') {
    plainLanguageSummary = `Net Bullish composite posture (${(compositeScore * 100).toFixed(0)} score, ${evidenceStrengthPct}% evidence strength). Led primarily by ${topFactor?.name.toLowerCase()} (${topFactor?.direction.toLowerCase()}), supported by ${bullishCount} of ${activeFactors.length} active quantitative dimensions. Missing factors were renormalized without artificial bias.`;
  } else if (assessment === 'BEARISH') {
    plainLanguageSummary = `Net Bearish composite posture (${(compositeScore * 100).toFixed(0)} score, ${evidenceStrengthPct}% evidence strength). Driven primarily by ${topFactor?.name.toLowerCase()} (${topFactor?.direction.toLowerCase()}), with ${bearishCount} of ${activeFactors.length} factors signaling downward pressure.`;
  } else {
    plainLanguageSummary = `Neutral market equilibrium (${(compositeScore * 100).toFixed(0)} composite score). Opposing signals are roughly balanced (${bullishCount} bullish vs ${bearishCount} bearish factors). No clear directional edge is present under current quantitative metrics.`;
  }

  return {
    assessment,
    compositeScore: parseFloat(compositeScore.toFixed(4)),
    evidenceStrengthPct,
    dataCompletenessPct,
    activeFactorsCount: activeFactors.length,
    totalFactorsCount: factors.length,
    factors,
    plainLanguageSummary,
    conflictingEvidence: Array.from(new Set(conflictingEvidence)),
    limitations,
    calculatedAt: Date.now(),
  };
}
