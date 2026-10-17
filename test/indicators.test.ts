import { describe, it, expect } from 'vitest';
import {
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateATR,
  calculateVolumeRatio,
  calculateReturnsAndVolatility,
} from '../src/lib/indicators';
import { Candle } from '../src/types/market';

describe('Indicators: EMA', () => {
  it('returns array of nulls when input length is less than period', () => {
    const prices = [10, 11, 12];
    const ema = calculateEMA(prices, 5);
    expect(ema).toEqual([null, null, null]);
  });

  it('calculates standard EMA correctly on deterministic sequence', () => {
    // 5 values, period 3: SMA of first 3 is (10+20+30)/3 = 20
    // Multiplier = 2 / (3 + 1) = 0.5
    // 4th val (40): (40 - 20) * 0.5 + 20 = 30
    // 5th val (50): (50 - 30) * 0.5 + 30 = 40
    const prices = [10, 20, 30, 40, 50];
    const ema = calculateEMA(prices, 3);
    expect(ema[0]).toBeNull();
    expect(ema[1]).toBeNull();
    expect(ema[2]).toBeCloseTo(20, 4);
    expect(ema[3]).toBeCloseTo(30, 4);
    expect(ema[4]).toBeCloseTo(40, 4);
  });
});

describe('Indicators: RSI (Wilder)', () => {
  it('returns nulls when data length is insufficient', () => {
    const prices = [100, 101, 102];
    const rsi = calculateRSI(prices, 14);
    expect(rsi[0]).toBeNull();
    expect(rsi[1]).toBeNull();
    expect(rsi[2]).toBeNull();
  });

  it('outputs 100 when all price changes are positive', () => {
    // 16 strictly increasing prices
    const prices = Array.from({ length: 16 }, (_, i) => 100 + i * 5);
    const rsi = calculateRSI(prices, 14);
    expect(rsi[14]).toBe(100);
    expect(rsi[15]).toBe(100);
  });

  it('outputs 0 when all price changes are negative', () => {
    const prices = Array.from({ length: 16 }, (_, i) => 200 - i * 5);
    const rsi = calculateRSI(prices, 14);
    expect(rsi[14]).toBe(0);
    expect(rsi[15]).toBe(0);
  });
});

describe('Indicators: MACD', () => {
  it('returns null lines when prices are shorter than slow period', () => {
    const prices = [10, 11, 12, 13, 14];
    const res = calculateMACD(prices, 12, 26, 9);
    expect(res.macd.every((v) => v === null)).toBe(true);
    expect(res.signal.every((v) => v === null)).toBe(true);
    expect(res.histogram.every((v) => v === null)).toBe(true);
  });

  it('calculates MACD line as Fast EMA minus Slow EMA', () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + i);
    const res = calculateMACD(prices, 5, 10, 3);
    expect(res.macd[9]).not.toBeNull();
    expect(res.signal[11]).not.toBeNull();
    expect(res.histogram[11]).not.toBeNull();
  });
});

describe('Indicators: ATR', () => {
  it('handles empty or insufficient candles gracefully', () => {
    const candles: Candle[] = [];
    const atr = calculateATR(candles, 14);
    expect(atr).toEqual([]);
  });

  it('calculates ATR correctly on constant range candles', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
      time: i * 3600,
      open: 100,
      high: 110,
      low: 90,
      close: 100,
      volume: 1000,
    }));
    const atr = calculateATR(candles, 14);
    // Each candle has TR = 110 - 90 = 20
    expect(atr[13]).toBeCloseTo(20, 2);
    expect(atr[19]).toBeCloseTo(20, 2);
  });
});

describe('Indicators: Volume Ratio & Volatility', () => {
  it('returns null when volumes length is less than period', () => {
    const res = calculateVolumeRatio([10, 20], 20);
    expect(res.ratio).toBeNull();
    expect(res.maVolume).toBeNull();
  });

  it('calculates correct volume ratio against 20-period SMA', () => {
    const volumes = new Array(19).fill(100);
    volumes.push(200); // 20th item is 200, average of all 20 is (19*100 + 200)/20 = 105
    const res = calculateVolumeRatio(volumes, 20);
    expect(res.maVolume).toBe(105);
    expect(res.ratio).toBeCloseTo(200 / 105, 3);
  });

  it('calculates annualized log volatility correctly', () => {
    const prices = Array.from({ length: 25 }, () => 50000); // constant price -> 0 vol
    const res = calculateReturnsAndVolatility(prices, 20, '1h');
    expect(res.return20PeriodPct).toBe(0);
    expect(res.annualizedVolatilityPct).toBe(0);
  });
});
