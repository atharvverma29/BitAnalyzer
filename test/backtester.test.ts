import { describe, it, expect } from 'vitest';
import { runHistoricalBacktest } from '../src/lib/backtester';
import { Candle, BacktestConfig } from '../src/types/market';

/**
 * Helper to generate a baseline flat sequence of candles
 */
function createFlatCandles(count: number, price: number = 50000, startTimestamp: number = 1700000000): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: startTimestamp + i * 3600,
    open: price,
    high: price + 10,
    low: price - 10,
    close: price,
    volume: 1000,
  }));
}

describe('Backtester Engine: Comprehensive Quantitative Audit', () => {
  const baseConfig: BacktestConfig = {
    strategy: 'ema_cross',
    initialCapital: 10000,
    positionSizePct: 100,
    tradingFeePct: 0.1, // 0.1% fee for clean math
  };

  // ------------------------------------------------------------------------
  // 1. Insufficient Data
  // ------------------------------------------------------------------------
  it('explicitly returns non-viable result when candle count is insufficient (< 52)', () => {
    const fewCandles = createFlatCandles(40);
    const result = runHistoricalBacktest(fewCandles, baseConfig);

    expect(result.isViable).toBe(false);
    expect(result.totalTrades).toBe(0);
    expect(result.trades).toHaveLength(0);
    expect(result.finalCapital).toBe(10000);
    expect(result.totalReturnPct).toBe(0);
    expect(result.profitFactor).toBeNull();
    expect(result.unavailableReason).toContain('52 minimum required');
  });

  // ------------------------------------------------------------------------
  // 2. Zero-Trade Scenario
  // ------------------------------------------------------------------------
  it('accurately handles zero-trade scenario with exact numbers', () => {
    // 70 completely flat candles: EMA20 and EMA50 are identical flat lines, no cross
    const flatCandles = createFlatCandles(70, 50000);
    const result = runHistoricalBacktest(flatCandles, baseConfig);

    expect(result.isViable).toBe(true);
    expect(result.totalTrades).toBe(0);
    expect(result.winningTrades).toBe(0);
    expect(result.losingTrades).toBe(0);
    expect(result.winRatePct).toBe(0);
    expect(result.profitFactor).toBeNull();
    expect(result.finalCapital).toBe(10000);
    expect(result.totalReturnPct).toBe(0);
    expect(result.maxDrawdownPct).toBe(0);
    expect(result.equityCurve).toHaveLength(20); // 70 - 50 = 20 points
    expect(result.equityCurve[0].equity).toBe(10000);
    expect(result.equityCurve[19].equity).toBe(10000);
  });

  // ------------------------------------------------------------------------
  // 3. Execution Timing & Look-Ahead Bias Prevention
  // ------------------------------------------------------------------------
  it('executes strictly on next candle OPEN price after decision candle close', () => {
    // 50 initial candles with EMA20 < EMA50
    const candles: Candle[] = [];
    for (let i = 0; i < 50; i++) {
      const p = 50000 - i * 10;
      candles.push({
        time: 1700000000 + i * 3600,
        open: p,
        high: p + 5,
        low: p - 5,
        close: p,
        volume: 1000,
      });
    }

    // Candle 50: Upward move producing EMA20 > EMA50 golden cross on candle 50 close
    candles.push({
      time: 1700000000 + 50 * 3600,
      open: 50000,
      high: 56000,
      low: 49900,
      close: 56000,
      volume: 5000,
    });

    // Candle 51: opens at 56200 (this MUST strictly be the entry execution price)
    candles.push({
      time: 1700000000 + 51 * 3600,
      open: 56200,
      high: 56500,
      low: 56100,
      close: 56400,
      volume: 2000,
    });

    // Candle 52: subsequent bar
    candles.push({
      time: 1700000000 + 52 * 3600,
      open: 56400,
      high: 56800,
      low: 56300,
      close: 56700,
      volume: 2000,
    });

    const result = runHistoricalBacktest(candles, baseConfig);
    expect(result.isViable).toBe(true);
    expect(result.totalTrades).toBe(1);

    const trade = result.trades[0];
    // Entry price MUST strictly be candle 51 open (56200), NOT candle 50 close (56000)
    expect(trade.entryPrice).toBe(56200);
    expect(trade.entryTime).toBe(candles[51].time);

    // Verify equity curve at candle 50: before entry at candle 51 open, equity MUST be 10000
    const eqPoint50 = result.equityCurve.find((e) => e.time === candles[50].time);
    expect(eqPoint50).toBeDefined();
    expect(eqPoint50?.equity).toBe(10000);
  });

  // ------------------------------------------------------------------------
  // 4. Exact Fee Accounting & Winning/Losing Trade Math
  // ------------------------------------------------------------------------
  it('calculates entry/exit fees and net profit with exact penny precision', () => {
    // 50 candles with EMA20 < EMA50
    const candles: Candle[] = [];
    for (let i = 0; i < 50; i++) {
      const p = 50000 - i * 10;
      candles.push({
        time: 1700000000 + i * 3600,
        open: p,
        high: p + 5,
        low: p - 5,
        close: p,
        volume: 1000,
      });
    }

    // Candle 50: Golden cross at candle 50 close
    candles.push({
      time: 1700000000 + 50 * 3600,
      open: 50000,
      high: 56000,
      low: 49900,
      close: 56000,
      volume: 5000,
    });

    // Candle 51: Entry executes at open = 56,200
    // Capital = 10,000. Fee = 0.1% = $10.00. Net purchase = $9,990.00.
    // BTC bought = 9,990 / 56,200
    candles.push({
      time: 1700000000 + 51 * 3600,
      open: 56200,
      high: 56800,
      low: 56100,
      close: 56500,
      volume: 2000,
    });

    // Candle 52: Bearish cross down at candle 52 close
    candles.push({
      time: 1700000000 + 52 * 3600,
      open: 56500,
      high: 56600,
      low: 35000,
      close: 35000, // sharp drop triggering death cross
      volume: 5000,
    });

    // Candle 53: Exit executes on candle 53 open = 34,500
    candles.push({
      time: 1700000000 + 53 * 3600,
      open: 34500,
      high: 34800,
      low: 34400,
      close: 34600,
      volume: 2000,
    });

    // Candle 54: follow-up bar
    candles.push({
      time: 1700000000 + 54 * 3600,
      open: 34600,
      high: 34700,
      low: 34500,
      close: 34600,
      volume: 1000,
    });

    const result = runHistoricalBacktest(candles, {
      ...baseConfig,
      tradingFeePct: 0.1,
    });

    expect(result.totalTrades).toBe(1);
    const trade = result.trades[0];
    expect(trade.entryPrice).toBe(56200);
    expect(trade.exitPrice).toBe(34500);
    expect(trade.exitReason).toBe('SIGNAL');

    const expectedBtc = 9990 / 56200;
    expect(trade.positionSizeBtc).toBeCloseTo(expectedBtc, 6);

    const grossExit = expectedBtc * 34500;
    const exitFee = grossExit * 0.001;
    const netExit = grossExit - exitFee;
    const expectedFees = 10.0 + exitFee;
    const expectedNetProfit = netExit - 10000;

    expect(trade.feesPaidUsd).toBeCloseTo(expectedFees, 2);
    expect(trade.netProfitUsd).toBeCloseTo(expectedNetProfit, 2);
    expect(result.losingTrades).toBe(1);
    expect(result.winningTrades).toBe(0);
    expect(result.winRatePct).toBe(0);
  });

  // ------------------------------------------------------------------------
  // 5. Stop Loss Execution: Standard Intraday Touch vs Gap-Down
  // ------------------------------------------------------------------------
  it('executes stop-loss at exact stop price when low crosses intraday without gap', () => {
    const candles = createFlatCandles(50, 50000);
    // Candle 50: Trigger buy signal
    candles.push({
      time: 1700000000 + 50 * 3600,
      open: 50000,
      high: 55000,
      low: 49900,
      close: 55000,
      volume: 5000,
    });

    // Candle 51: Enters at open 55000. Stop loss = 5% = 55000 * 0.95 = 52250.
    candles.push({
      time: 1700000000 + 51 * 3600,
      open: 55000,
      high: 55500,
      low: 54500,
      close: 55000,
      volume: 2000,
    });

    // Candle 52: Opens at 54000 (above 52250), but low drops to 51000 (triggers stop intraday)
    candles.push({
      time: 1700000000 + 52 * 3600,
      open: 54000,
      high: 54200,
      low: 51000,
      close: 53000,
      volume: 3000,
    });

    const result = runHistoricalBacktest(candles, {
      ...baseConfig,
      stopLossPct: 5,
    });

    expect(result.totalTrades).toBe(1);
    const trade = result.trades[0];
    expect(trade.exitReason).toBe('STOP_LOSS');
    // Must fill at exact stop price (52250)
    expect(trade.exitPrice).toBe(52250);
  });

  it('executes stop-loss at open (gap price) when candle gaps down below stop loss', () => {
    const candles = createFlatCandles(50, 50000);
    // Candle 50: Trigger buy signal
    candles.push({
      time: 1700000000 + 50 * 3600,
      open: 50000,
      high: 55000,
      low: 49900,
      close: 55000,
      volume: 5000,
    });

    // Candle 51: Enters at open 55000. Stop loss = 5% = 52250.
    candles.push({
      time: 1700000000 + 51 * 3600,
      open: 55000,
      high: 55200,
      low: 54800,
      close: 55000,
      volume: 2000,
    });

    // Candle 52: GAPS DOWN directly at open = 50000 (below 52250!)
    candles.push({
      time: 1700000000 + 52 * 3600,
      open: 50000,
      high: 50500,
      low: 49000,
      close: 49500,
      volume: 4000,
    });

    const result = runHistoricalBacktest(candles, {
      ...baseConfig,
      stopLossPct: 5,
    });

    expect(result.totalTrades).toBe(1);
    const trade = result.trades[0];
    expect(trade.exitReason).toBe('STOP_LOSS');
    // Stop MUST fill at the gap open price (50000), NOT at the fantasy stop price (52250)
    expect(trade.exitPrice).toBe(50000);
  });

  // ------------------------------------------------------------------------
  // 6. Open Position at Dataset End (DATA_END liquidation)
  // ------------------------------------------------------------------------
  it('properly liquidates open position at the final candle close and syncs final equity', () => {
    const candles = createFlatCandles(50, 50000);
    // Candle 50: Trigger buy signal
    candles.push({
      time: 1700000000 + 50 * 3600,
      open: 50000,
      high: 55000,
      low: 49900,
      close: 55000,
      volume: 5000,
    });

    // Candle 51: Enters at 55000 and dataset finishes at close = 58000
    candles.push({
      time: 1700000000 + 51 * 3600,
      open: 55000,
      high: 58500,
      low: 54800,
      close: 58000,
      volume: 2000,
    });

    const result = runHistoricalBacktest(candles, baseConfig);

    expect(result.totalTrades).toBe(1);
    const trade = result.trades[0];
    expect(trade.exitReason).toBe('DATA_END');
    expect(trade.exitPrice).toBe(58000);
    expect(trade.exitTime).toBe(candles[51].time);
    expect(trade.netProfitUsd).toBeGreaterThan(0);

    // Final point of equity curve must match finalCapital exactly
    const lastEqPoint = result.equityCurve[result.equityCurve.length - 1];
    expect(lastEqPoint.equity).toBe(result.finalCapital);
  });

  // ------------------------------------------------------------------------
  // 7. Maximum Drawdown & Benchmark Comparison
  // ------------------------------------------------------------------------
  it('correctly calculates maximum peak-to-trough drawdown and benchmark returns', () => {
    const candles = createFlatCandles(50, 50000);

    // Create a sequence that rises then drops by 20%
    candles.push({
      time: 1700000000 + 50 * 3600,
      open: 50000,
      high: 60000,
      low: 49900,
      close: 60000,
      volume: 5000,
    });
    // Entry at 60000
    candles.push({
      time: 1700000000 + 51 * 3600,
      open: 60000,
      high: 70000,
      low: 59000,
      close: 70000, // Peak
      volume: 3000,
    });
    // Crash to 56000
    candles.push({
      time: 1700000000 + 52 * 3600,
      open: 70000,
      high: 70000,
      low: 55000,
      close: 56000, // Trough
      volume: 4000,
    });

    const result = runHistoricalBacktest(candles, baseConfig);

    expect(result.maxDrawdownPct).toBeGreaterThan(0);
    expect(result.benchmarkReturnPct).toBeDefined();
    expect(result.alphaPct).toBeCloseTo(result.totalReturnPct - result.benchmarkReturnPct, 2);
  });
});
