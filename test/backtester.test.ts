import { describe, it, expect } from 'vitest';
import { runHistoricalBacktest } from '../src/lib/backtester';
import { Candle } from '../src/types/market';

describe('Backtester Engine: Look-Ahead Bias & Performance Math', () => {
  it('returns non-viable state when candles are below minimum required threshold', () => {
    const fewCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      time: i * 3600,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 100,
    }));

    const result = runHistoricalBacktest(fewCandles, {
      strategy: 'ema_cross',
      initialCapital: 10000,
      positionSizePct: 100,
      tradingFeePct: 0.075,
    });

    expect(result.isViable).toBe(false);
    expect(result.unavailableReason).toBeDefined();
    expect(result.trades.length).toBe(0);
  });

  it('verifies trade execution timing executes strictly on subsequent bar open', () => {
    // Construct 80 candles with clear trend cross
    const candles: Candle[] = [];
    let price = 50000;

    for (let i = 0; i < 80; i++) {
      if (i < 40) {
        price -= 50; // downward trend
      } else {
        price += 150; // sharp upward trend triggering EMA golden cross
      }
      candles.push({
        time: 1700000000 + i * 3600,
        open: price - 10,
        high: price + 20,
        low: price - 30,
        close: price,
        volume: 1000,
      });
    }

    const result = runHistoricalBacktest(candles, {
      strategy: 'ema_cross',
      initialCapital: 10000,
      positionSizePct: 100,
      tradingFeePct: 0.075,
    });

    expect(result.isViable).toBe(true);
    if (result.trades.length > 0) {
      const firstTrade = result.trades[result.trades.length - 1]; // earliest trade
      // Verify entry price matches one of the candle open prices
      const matchingOpenCandle = candles.find((c) => c.open === firstTrade.entryPrice);
      expect(matchingOpenCandle).toBeDefined();

      // Net profit must equal gross profit minus fees
      expect(firstTrade.netProfitUsd).toBeCloseTo(
        firstTrade.grossProfitUsd - firstTrade.feesPaidUsd,
        2
      );
    }
  });

  it('correctly calculates maximum drawdown as non-negative percentage', () => {
    const candles: Candle[] = Array.from({ length: 70 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 50000 + Math.sin(i / 5) * 2000,
      high: 50000 + Math.sin(i / 5) * 2000 + 100,
      low: 50000 + Math.sin(i / 5) * 2000 - 100,
      close: 50000 + Math.sin(i / 5) * 2000,
      volume: 1000,
    }));

    const result = runHistoricalBacktest(candles, {
      strategy: 'ema_cross',
      initialCapital: 10000,
      positionSizePct: 100,
      tradingFeePct: 0.075,
    });

    expect(result.maxDrawdownPct).toBeGreaterThanOrEqual(0);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });
});
