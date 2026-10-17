import { Candle, IndicatorResults } from '../types/market';

/**
 * Calculates Exponential Moving Average (EMA).
 * If data length is less than period, all entries will be null.
 */
export function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (!prices || prices.length < period || period <= 0) {
    return result;
  }

  // First EMA value is SMA of first `period` elements
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  let prevEma = sum / period;
  result[period - 1] = prevEma;

  const multiplier = 2 / (period + 1);

  for (let i = period; i < prices.length; i++) {
    const currentEma = (prices[i] - prevEma) * multiplier + prevEma;
    result[i] = currentEma;
    prevEma = currentEma;
  }

  return result;
}

/**
 * Calculates Wilder's smoothed Relative Strength Index (RSI 14).
 */
export function calculateRSI(prices: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (!prices || prices.length <= period || period <= 0) {
    return result;
  }

  let gainSum = 0;
  let lossSum = 0;

  // Initial average gain/loss over the first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      gainSum += change;
    } else {
      lossSum += Math.abs(change);
    }
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else if (avgGain === 0) {
    result[period] = 0;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - (100 / (1 + rs));
  }

  // Wilder's smoothing for subsequent periods
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else if (avgGain === 0) {
      result[i] = 0;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - (100 / (1 + rs));
    }
  }

  return result;
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 * Default: fast = 12, slow = 26, signal = 9
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const len = prices.length;
  const macdLine: (number | null)[] = new Array(len).fill(null);
  const signalLine: (number | null)[] = new Array(len).fill(null);
  const histogram: (number | null)[] = new Array(len).fill(null);

  if (len < slowPeriod) {
    return { macd: macdLine, signal: signalLine, histogram };
  }

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const validMacdValues: number[] = [];
  const validMacdIndices: number[] = [];

  for (let i = 0; i < len; i++) {
    const f = fastEMA[i];
    const s = slowEMA[i];
    if (f !== null && s !== null) {
      const val = f - s;
      macdLine[i] = val;
      validMacdValues.push(val);
      validMacdIndices.push(i);
    }
  }

  if (validMacdValues.length >= signalPeriod) {
    const signalValues = calculateEMA(validMacdValues, signalPeriod);
    for (let j = 0; j < validMacdValues.length; j++) {
      const sig = signalValues[j];
      const origIndex = validMacdIndices[j];
      if (sig !== null) {
        signalLine[origIndex] = sig;
        const macdVal = macdLine[origIndex];
        if (macdVal !== null) {
          histogram[origIndex] = macdVal - sig;
        }
      }
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculates Average True Range (ATR 14) using Wilder's smoothing.
 */
export function calculateATR(candles: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (!candles || candles.length <= period || period <= 0) {
    return result;
  }

  const trueRanges: number[] = [];
  trueRanges.push(candles[0].high - candles[0].low);

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trueRanges.push(tr);
  }

  // Initial ATR: SMA of first `period` true ranges
  let trSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += trueRanges[i];
  }
  let prevAtr = trSum / period;
  result[period - 1] = prevAtr;

  // Wilder's smoothing
  for (let i = period; i < candles.length; i++) {
    const currentAtr = (prevAtr * (period - 1) + trueRanges[i]) / period;
    result[i] = currentAtr;
    prevAtr = currentAtr;
  }

  return result;
}

/**
 * Calculates Volume relative to its 20-period simple moving average.
 */
export function calculateVolumeRatio(
  volumes: number[],
  period: number = 20
): { ratio: number | null; maVolume: number | null } {
  if (!volumes || volumes.length < period || period <= 0) {
    return { ratio: null, maVolume: null };
  }

  const recent = volumes.slice(-period);
  const sum = recent.reduce((acc, v) => acc + v, 0);
  const maVolume = sum / period;
  const currentVolume = volumes[volumes.length - 1];

  if (maVolume === 0) {
    return { ratio: null, maVolume: 0 };
  }

  return {
    ratio: currentVolume / maVolume,
    maVolume,
  };
}

/**
 * Calculates price returns over a period and annualized historical volatility.
 */
export function calculateReturnsAndVolatility(
  prices: number[],
  period: number = 20,
  interval: '15m' | '1h' | '4h' = '1h'
): { return20PeriodPct: number | null; annualizedVolatilityPct: number | null } {
  if (!prices || prices.length < period + 1) {
    return { return20PeriodPct: null, annualizedVolatilityPct: null };
  }

  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];
  const return20PeriodPct = pastPrice > 0 ? ((currentPrice - pastPrice) / pastPrice) * 100 : null;

  // Calculate log returns for historical volatility
  const logReturns: number[] = [];
  for (let i = prices.length - period; i < prices.length; i++) {
    const p1 = prices[i];
    const p0 = prices[i - 1];
    if (p0 > 0 && p1 > 0) {
      logReturns.push(Math.log(p1 / p0));
    }
  }

  if (logReturns.length < 2) {
    return { return20PeriodPct, annualizedVolatilityPct: null };
  }

  const meanReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((acc, val) => acc + Math.pow(val - meanReturn, 2), 0) / (logReturns.length - 1);
  const stdDev = Math.sqrt(variance);

  // Annualization factor based on candle interval
  const periodsPerYearMap: Record<string, number> = {
    '15m': 96 * 365,
    '1h': 24 * 365,
    '4h': 6 * 365,
  };
  const periodsPerYear = periodsPerYearMap[interval] || 24 * 365;
  const annualizedVolatilityPct = stdDev * Math.sqrt(periodsPerYear) * 100;

  return {
    return20PeriodPct,
    annualizedVolatilityPct,
  };
}

/**
 * Computes all technical indicators for an array of candles.
 */
export function computeAllIndicators(
  candles: Candle[],
  interval: '15m' | '1h' | '4h' = '1h'
): IndicatorResults {
  const closePrices = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  return {
    ema20: calculateEMA(closePrices, 20),
    ema50: calculateEMA(closePrices, 50),
    rsi14: calculateRSI(closePrices, 14),
    macd: calculateMACD(closePrices, 12, 26, 9),
    atr14: calculateATR(candles, 14),
    volumeRatio: calculateVolumeRatio(volumes, 20),
    priceStats: calculateReturnsAndVolatility(closePrices, 20, interval),
  };
}
