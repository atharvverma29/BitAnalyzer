import { describe, it, expect } from 'vitest';
import { analyzeMarketSignals } from '../src/lib/signalEngine';
import { Candle, IndicatorResults } from '../src/types/market';

describe('Signal Engine: Quantitative Multi-Factor Analysis', () => {
  const dummyCandles: Candle[] = Array.from({ length: 60 }, (_, i) => ({
    time: 1700000000 + i * 3600,
    open: 60000 + i * 100,
    high: 60200 + i * 100,
    low: 59900 + i * 100,
    close: 60100 + i * 100,
    volume: 1500,
  }));

  it('correctly renormalizes weights when derivatives and orderbook are unavailable', () => {
    const indicators: IndicatorResults = {
      ema20: Array(60).fill(62000),
      ema50: Array(60).fill(60000),
      rsi14: Array(60).fill(62),
      macd: {
        macd: Array(60).fill(150),
        signal: Array(60).fill(100),
        histogram: Array(60).fill(50),
      },
      atr14: Array(60).fill(500),
      volumeRatio: { ratio: 1.4, maVolume: 1200 },
      priceStats: { return20PeriodPct: 3.5, annualizedVolatilityPct: 45 },
    };

    const res = analyzeMarketSignals({
      candles: dummyCandles,
      indicators,
      orderBook: null, // missing
      derivatives: null, // missing
    });

    const activeFactors = res.factors.filter((f) => f.status === 'ACTIVE');
    const unavailableFactors = res.factors.filter((f) => f.status === 'UNAVAILABLE');

    expect(activeFactors.length).toBe(4);
    expect(unavailableFactors.length).toBe(2);

    // Sum of effective weights of active factors MUST equal exactly 1.0 (100%)
    const sumEffectiveWeights = activeFactors.reduce((acc, f) => acc + f.effectiveWeight, 0);
    expect(sumEffectiveWeights).toBeCloseTo(1.0, 5);

    // Unavailable factors must have zero contribution
    for (const uf of unavailableFactors) {
      expect(uf.contribution).toBe(0);
      expect(uf.effectiveWeight).toBe(0);
    }

    // Completeness score should reflect missing weights (4 factors = 80%)
    expect(res.dataCompletenessPct).toBe(80);
    expect(res.assessment).toBe('BULLISH');
  });

  it('produces BEARISH assessment when trend, momentum, and volume break downward', () => {
    const bearishCandles: Candle[] = Array.from({ length: 60 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 65000 - i * 100,
      high: 65100 - i * 100,
      low: 64700 - i * 100,
      close: 64800 - i * 100,
      volume: 2000,
    }));

    const indicators: IndicatorResults = {
      ema20: Array(60).fill(60000), // price (approx 58800) is below EMA20
      ema50: Array(60).fill(62000), // EMA20 is below EMA50
      rsi14: Array(60).fill(34), // RSI in bearish zone (30-45)
      macd: {
        macd: Array(60).fill(-200),
        signal: Array(60).fill(-100),
        histogram: Array(60).fill(-100),
      },
      atr14: Array(60).fill(600),
      volumeRatio: { ratio: 1.5, maVolume: 1200 }, // high volume on down move
      priceStats: { return20PeriodPct: -5.2, annualizedVolatilityPct: 55 },
    };

    const res = analyzeMarketSignals({
      candles: bearishCandles,
      indicators,
      orderBook: null,
      derivatives: null,
    });

    expect(res.assessment).toBe('BEARISH');
    expect(res.compositeScore).toBeLessThan(-0.5);
  });

  it('detects conflicting evidence when overbought RSI opposes bullish trend', () => {
    const indicators: IndicatorResults = {
      ema20: Array(60).fill(62000),
      ema50: Array(60).fill(60000),
      rsi14: Array(60).fill(78), // overbought > 70
      macd: {
        macd: Array(60).fill(150),
        signal: Array(60).fill(100),
        histogram: Array(60).fill(50),
      },
      atr14: Array(60).fill(500),
      volumeRatio: { ratio: 1.1, maVolume: 1200 },
      priceStats: { return20PeriodPct: 4.0, annualizedVolatilityPct: 40 },
    };

    const res = analyzeMarketSignals({
      candles: dummyCandles,
      indicators,
      orderBook: null,
      derivatives: null,
    });

    expect(res.conflictingEvidence.length).toBeGreaterThan(0);
    expect(res.conflictingEvidence.some((c) => c.includes('overbought'))).toBe(true);
  });

  it('bounds composite score strictly within [-1.0, 1.0]', () => {
    const indicators: IndicatorResults = {
      ema20: Array(60).fill(100),
      ema50: Array(60).fill(50),
      rsi14: Array(60).fill(65),
      macd: {
        macd: Array(60).fill(10),
        signal: Array(60).fill(5),
        histogram: Array(60).fill(5),
      },
      atr14: Array(60).fill(10),
      volumeRatio: { ratio: 2.0, maVolume: 50 },
      priceStats: { return20PeriodPct: 10, annualizedVolatilityPct: 30 },
    };

    const res = analyzeMarketSignals({
      candles: dummyCandles,
      indicators,
      orderBook: null,
      derivatives: null,
    });

    expect(res.compositeScore).toBeGreaterThanOrEqual(-1.0);
    expect(res.compositeScore).toBeLessThanOrEqual(1.0);
  });
});
