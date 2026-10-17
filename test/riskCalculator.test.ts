import { describe, it, expect } from 'vitest';
import { calculatePositionRisk } from '../src/lib/riskCalculator';

describe('Risk Calculator: Position Sizing & Fixed Fractional Math', () => {
  it('calculates exact position size for standard long trade', () => {
    // Equity: $10,000, Risk: 1% ($100 max loss)
    // Entry: $50,000, Stop: $48,000 ($2,000 risk per BTC)
    // Sizing: $100 / $2,000 = 0.05 BTC
    // Notional: 0.05 * 50,000 = $2,500
    // Leverage: 2,500 / 10,000 = 0.25x
    const res = calculatePositionRisk({
      accountEquity: 10000,
      riskPct: 1,
      entryPrice: 50000,
      stopLossPrice: 48000,
      direction: 'LONG',
      targetPrice: 56000, // Reward: $6,000 / Risk: $2,000 = 3.0 R/R
    });

    expect(res.isValid).toBe(true);
    expect(res.maxLossUsd).toBe(100);
    expect(res.riskPerBtc).toBe(2000);
    expect(res.positionSizeBtc).toBe(0.05);
    expect(res.notionalValueUsd).toBe(2500);
    expect(res.effectiveLeverage).toBe(0.25);
    expect(res.expectedRewardUsd).toBe(300);
    expect(res.riskRewardRatio).toBe(3.0);
  });

  it('calculates exact position size for short trade', () => {
    // Equity: $20,000, Risk: 2% ($400 max loss)
    // Entry: $60,000, Stop: $62,000 ($2,000 risk per BTC)
    // Sizing: $400 / $2,000 = 0.2 BTC
    const res = calculatePositionRisk({
      accountEquity: 20000,
      riskPct: 2,
      entryPrice: 60000,
      stopLossPrice: 62000,
      direction: 'SHORT',
      targetPrice: 54000,
    });

    expect(res.isValid).toBe(true);
    expect(res.maxLossUsd).toBe(400);
    expect(res.riskPerBtc).toBe(2000);
    expect(res.positionSizeBtc).toBe(0.2);
    expect(res.riskRewardRatio).toBe(3.0);
  });

  it('rejects invalid inputs when stop loss is improperly placed', () => {
    // Long trade where stop loss is above entry
    const invalidLong = calculatePositionRisk({
      accountEquity: 10000,
      riskPct: 1,
      entryPrice: 50000,
      stopLossPrice: 51000,
      direction: 'LONG',
    });
    expect(invalidLong.isValid).toBe(false);
    expect(invalidLong.validationError).toBeDefined();

    // Short trade where stop loss is below entry
    const invalidShort = calculatePositionRisk({
      accountEquity: 10000,
      riskPct: 1,
      entryPrice: 50000,
      stopLossPrice: 49000,
      direction: 'SHORT',
    });
    expect(invalidShort.isValid).toBe(false);
  });

  it('rejects negative or zero account equity', () => {
    const res = calculatePositionRisk({
      accountEquity: 0,
      riskPct: 1,
      entryPrice: 50000,
      stopLossPrice: 48000,
      direction: 'LONG',
    });
    expect(res.isValid).toBe(false);
  });
});
