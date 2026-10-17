import { BacktestConfig, BacktestEquityPoint, BacktestResult, BacktestTrade, Candle } from '../types/market';
import { calculateEMA, calculateRSI } from './indicators';

/**
 * Execution Assumptions & Accounting Protocol:
 *
 * 1. Signal Generation: Evaluated strictly at the CLOSE of candle `i` using only data
 *    from candle `0` to candle `i`. No look-ahead bias is permitted.
 * 2. Order Execution:
 *    - Signal-based entries and exits execute at the OPEN of candle `i + 1`.
 *    - Intraday Stop Loss: Checked against candle `i + 1`'s low. If triggered:
 *      * If candle `i + 1` opens below the stop price (gap-down), it executes at `open` (the gap price).
 *      * Otherwise, it executes at the exact `stopLossPrice`.
 * 3. Mark-to-Market Equity Curve:
 *    - Each point corresponds to candle `t` close with timestamp `candle[t].time`.
 *    - Position value is marked at `candle[t].close`.
 *    - Reflects only cash and positions held at that exact timestamp.
 * 4. Fee Accounting:
 *    - Entry fee = AllocatedUSD * (tradingFeePct / 100). Net purchase buys BTC at `entryPrice`.
 *    - Exit fee = GrossExitUSD * (tradingFeePct / 100). Net proceeds added back to cash.
 * 5. Open Position at Dataset End:
 *    - Liquidated at the final candle's close price with standard exit fee deducted.
 *    - Marked with `exitReason: 'DATA_END'`.
 * 6. Benchmark:
 *    - Buy-and-hold equivalent initialized at the start of the evaluation window,
 *      accounting for equivalent entry and exit trading fees for a fair comparison.
 */
export function runHistoricalBacktest(
  candles: Candle[],
  config: BacktestConfig
): BacktestResult {
  const {
    strategy,
    initialCapital,
    positionSizePct,
    tradingFeePct,
    stopLossPct,
  } = config;

  const minRequiredCandles = 52;
  if (!candles || candles.length < minRequiredCandles) {
    return {
      strategyName: getStrategyDisplayName(strategy),
      candleCount: candles ? candles.length : 0,
      interval: 'N/A',
      startDate: 'N/A',
      endDate: 'N/A',
      initialCapital,
      finalCapital: initialCapital,
      totalReturnPct: 0,
      benchmarkReturnPct: 0,
      alphaPct: 0,
      maxDrawdownPct: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRatePct: 0,
      profitFactor: null,
      trades: [],
      equityCurve: [],
      isViable: false,
      unavailableReason: `Insufficient candle history (${candles ? candles.length : 0}/${minRequiredCandles} minimum required). Fetch more periods to run backtest.`,
    };
  }

  // Precompute indicators over all candles
  const closePrices = candles.map((c) => c.close);
  const ema20 = calculateEMA(closePrices, 20);
  const ema50 = calculateEMA(closePrices, 50);
  const rsi14 = calculateRSI(closePrices, 14);

  let cash = initialCapital;
  let currentPosition: {
    entryTime: number;
    entryPrice: number;
    btcAmount: number;
    investedUsd: number; // total capital allocated including entry fee
    entryFeeUsd: number;
    stopLossPrice?: number;
  } | null = null;

  // Pending order generated at candle close, to be executed at NEXT candle open
  let pendingOrder: 'ENTER' | 'EXIT' | null = null;

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];

  let peakEquity = initialCapital;
  let maxDrawdownPct = 0;

  // Evaluation window starts when EMA50 has at least two valid points (index 50)
  const startIdx = 50;

  // Benchmark Buy & Hold initialized on first tradeable candle
  const benchmarkEntryPrice = candles[startIdx].open;
  const benchmarkEntryFee = initialCapital * (tradingFeePct / 100);
  const benchmarkBtc = (initialCapital - benchmarkEntryFee) / benchmarkEntryPrice;

  for (let i = startIdx; i < candles.length; i++) {
    const candle = candles[i];

    // -------------------------------------------------------------
    // Step 1: Execute Pending Orders at Candle Open (O_i)
    // -------------------------------------------------------------
    if (pendingOrder === 'EXIT' && currentPosition) {
      const exitPrice = candle.open;
      const grossExitUsd = currentPosition.btcAmount * exitPrice;
      const exitFeeUsd = grossExitUsd * (tradingFeePct / 100);
      const netExitUsd = grossExitUsd - exitFeeUsd;
      const netProfit = netExitUsd - currentPosition.investedUsd;
      const returnPct = ((exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;

      cash += netExitUsd;
      trades.push({
        id: trades.length + 1,
        entryTime: currentPosition.entryTime,
        entryPrice: currentPosition.entryPrice,
        exitTime: candle.time,
        exitPrice,
        type: 'LONG',
        positionSizeBtc: currentPosition.btcAmount,
        grossProfitUsd: grossExitUsd - (currentPosition.investedUsd - currentPosition.entryFeeUsd),
        feesPaidUsd: currentPosition.entryFeeUsd + exitFeeUsd,
        netProfitUsd: netProfit,
        returnPct,
        exitReason: 'SIGNAL',
      });

      currentPosition = null;
      pendingOrder = null;
    } else if (pendingOrder === 'ENTER' && !currentPosition) {
      const entryPrice = candle.open;
      const allocatedUsd = cash * (positionSizePct / 100);

      if (allocatedUsd >= 10 && entryPrice > 0) {
        const entryFeeUsd = allocatedUsd * (tradingFeePct / 100);
        const netPurchaseUsd = allocatedUsd - entryFeeUsd;
        const btcAmount = netPurchaseUsd / entryPrice;

        cash -= allocatedUsd;
        let stopLossPrice: number | undefined;
        if (stopLossPct && stopLossPct > 0) {
          stopLossPrice = entryPrice * (1 - stopLossPct / 100);
        }

        currentPosition = {
          entryTime: candle.time,
          entryPrice,
          btcAmount,
          investedUsd: allocatedUsd,
          entryFeeUsd,
          stopLossPrice,
        };
      }
      pendingOrder = null;
    } else {
      pendingOrder = null;
    }

    // -------------------------------------------------------------
    // Step 2: Intraday Stop Loss Check during Candle `i`
    // -------------------------------------------------------------
    if (currentPosition && currentPosition.stopLossPrice !== undefined) {
      if (candle.low <= currentPosition.stopLossPrice) {
        // Gap-down handling: if candle opened below stop, fill at open (gap price)
        const exitPrice = candle.open <= currentPosition.stopLossPrice
          ? candle.open
          : currentPosition.stopLossPrice;

        const grossExitUsd = currentPosition.btcAmount * exitPrice;
        const exitFeeUsd = grossExitUsd * (tradingFeePct / 100);
        const netExitUsd = grossExitUsd - exitFeeUsd;
        const netProfit = netExitUsd - currentPosition.investedUsd;
        const returnPct = ((exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;

        cash += netExitUsd;
        trades.push({
          id: trades.length + 1,
          entryTime: currentPosition.entryTime,
          entryPrice: currentPosition.entryPrice,
          exitTime: candle.time,
          exitPrice,
          type: 'LONG',
          positionSizeBtc: currentPosition.btcAmount,
          grossProfitUsd: grossExitUsd - (currentPosition.investedUsd - currentPosition.entryFeeUsd),
          feesPaidUsd: currentPosition.entryFeeUsd + exitFeeUsd,
          netProfitUsd: netProfit,
          returnPct,
          exitReason: 'STOP_LOSS',
        });

        currentPosition = null;
      }
    }

    // -------------------------------------------------------------
    // Step 3: Mark-to-Market Equity at Candle Close (C_i)
    // -------------------------------------------------------------
    const markPrice = candle.close;
    const positionValue = currentPosition ? currentPosition.btcAmount * markPrice : 0;
    const currentEquity = cash + positionValue;

    // Benchmark equity at candle close (accounting for exit fee)
    const benchmarkGross = benchmarkBtc * markPrice;
    const benchmarkExitFee = benchmarkGross * (tradingFeePct / 100);
    const benchmarkEquity = benchmarkGross - benchmarkExitFee;

    peakEquity = Math.max(peakEquity, currentEquity);
    const drawdownPct = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct);

    equityCurve.push({
      time: candle.time,
      equity: parseFloat(currentEquity.toFixed(2)),
      benchmarkEquity: parseFloat(benchmarkEquity.toFixed(2)),
      drawdownPct: parseFloat(drawdownPct.toFixed(2)),
    });

    // -------------------------------------------------------------
    // Step 4: Evaluate Strategy Signals on Closed Candle `i`
    // -------------------------------------------------------------
    const e20 = ema20[i];
    const e50 = ema50[i];
    const prevE20 = ema20[i - 1];
    const prevE50 = ema50[i - 1];
    const rsi = rsi14[i];

    if (strategy === 'ema_cross') {
      if (e20 !== null && e50 !== null && prevE20 !== null && prevE50 !== null) {
        const isBullishCross = prevE20 <= prevE50 && e20 > e50;
        const isBearishCross = prevE20 >= prevE50 && e20 < e50;

        if (isBullishCross && !currentPosition) {
          pendingOrder = 'ENTER';
        } else if (isBearishCross && currentPosition) {
          pendingOrder = 'EXIT';
        }
      }
    } else if (strategy === 'rsi_mean_reversion') {
      if (rsi !== null && e50 !== null) {
        if (rsi < 35 && markPrice >= e50 && !currentPosition) {
          pendingOrder = 'ENTER';
        } else if (rsi > 68 && currentPosition) {
          pendingOrder = 'EXIT';
        }
      }
    } else if (strategy === 'quant_composite') {
      if (e20 !== null && e50 !== null && rsi !== null) {
        const isStrongTrend = markPrice > e20 && e20 > e50 && rsi >= 48 && rsi <= 68;
        const isTrendBroken = markPrice < e50 || rsi > 76 || rsi < 40;

        if (isStrongTrend && !currentPosition) {
          pendingOrder = 'ENTER';
        } else if (isTrendBroken && currentPosition) {
          pendingOrder = 'EXIT';
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Step 5: Liquidate Open Position at End of Dataset
  // -------------------------------------------------------------
  if (currentPosition) {
    const lastCandle = candles[candles.length - 1];
    const exitPrice = lastCandle.close;
    const grossExitUsd = currentPosition.btcAmount * exitPrice;
    const exitFeeUsd = grossExitUsd * (tradingFeePct / 100);
    const netExitUsd = grossExitUsd - exitFeeUsd;
    const netProfit = netExitUsd - currentPosition.investedUsd;
    const returnPct = ((exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;

    cash += netExitUsd;
    trades.push({
      id: trades.length + 1,
      entryTime: currentPosition.entryTime,
      entryPrice: currentPosition.entryPrice,
      exitTime: lastCandle.time,
      exitPrice,
      type: 'LONG',
      positionSizeBtc: currentPosition.btcAmount,
      grossProfitUsd: grossExitUsd - (currentPosition.investedUsd - currentPosition.entryFeeUsd),
      feesPaidUsd: currentPosition.entryFeeUsd + exitFeeUsd,
      netProfitUsd: netProfit,
      returnPct,
      exitReason: 'DATA_END',
    });

    // Update the final equity curve point to match liquidated cash
    if (equityCurve.length > 0) {
      const lastPoint = equityCurve[equityCurve.length - 1];
      lastPoint.equity = parseFloat(cash.toFixed(2));
      const finalDd = peakEquity > 0 ? ((peakEquity - cash) / peakEquity) * 100 : 0;
      lastPoint.drawdownPct = parseFloat(finalDd.toFixed(2));
      maxDrawdownPct = Math.max(maxDrawdownPct, finalDd);
    }

    currentPosition = null;
  }

  const finalCapital = cash;
  const totalReturnPct = ((finalCapital - initialCapital) / initialCapital) * 100;

  // Final Benchmark Buy & Hold Return
  const lastCandle = candles[candles.length - 1];
  const finalBenchmarkGross = benchmarkBtc * lastCandle.close;
  const finalBenchmarkExitFee = finalBenchmarkGross * (tradingFeePct / 100);
  const finalBenchmarkEquity = finalBenchmarkGross - finalBenchmarkExitFee;
  const benchmarkReturnPct = ((finalBenchmarkEquity - initialCapital) / initialCapital) * 100;
  const alphaPct = totalReturnPct - benchmarkReturnPct;

  const winningTrades = trades.filter((t) => t.netProfitUsd > 0).length;
  const losingTrades = trades.filter((t) => t.netProfitUsd < 0).length;
  const winRatePct = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  const totalGains = trades.filter((t) => t.netProfitUsd > 0).reduce((acc, t) => acc + t.netProfitUsd, 0);
  const totalLosses = Math.abs(
    trades.filter((t) => t.netProfitUsd < 0).reduce((acc, t) => acc + t.netProfitUsd, 0)
  );
  // Profit factor is undefined if totalLosses is 0
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : null;

  const startDate = new Date(candles[0].time * 1000).toISOString().split('T')[0];
  const endDate = new Date(candles[candles.length - 1].time * 1000).toISOString().split('T')[0];

  return {
    strategyName: getStrategyDisplayName(strategy),
    candleCount: candles.length,
    interval: 'Fetched OHLCV',
    startDate,
    endDate,
    initialCapital,
    finalCapital: parseFloat(finalCapital.toFixed(2)),
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    benchmarkReturnPct: parseFloat(benchmarkReturnPct.toFixed(2)),
    alphaPct: parseFloat(alphaPct.toFixed(2)),
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRatePct: parseFloat(winRatePct.toFixed(1)),
    profitFactor: profitFactor !== null ? parseFloat(profitFactor.toFixed(2)) : null,
    trades: [...trades].reverse(), // most recent trades first in log
    equityCurve,
    isViable: true,
  };
}

function getStrategyDisplayName(strategy: BacktestConfig['strategy']): string {
  switch (strategy) {
    case 'ema_cross':
      return 'EMA 20 / 50 Trend Crossover';
    case 'rsi_mean_reversion':
      return 'RSI Oversold Mean Reversion with Trend Filter';
    case 'quant_composite':
      return 'Multi-Factor Trend + Momentum Model';
    default:
      return 'Quantitative Strategy';
  }
}
