import { BacktestConfig, BacktestEquityPoint, BacktestResult, BacktestTrade, Candle } from '../types/market';
import { calculateEMA, calculateRSI } from './indicators';

/**
 * Runs a deterministic backtest on historical OHLCV candles without look-ahead bias.
 * Decisions use strictly past and current closed candle info.
 * Execution occurs on the subsequent candle's open price (or explicit close with fee).
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

  const minRequiredCandles = 55;
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

  const closePrices = candles.map((c) => c.close);
  const ema20 = calculateEMA(closePrices, 20);
  const ema50 = calculateEMA(closePrices, 50);
  const rsi14 = calculateRSI(closePrices, 14);

  let cash = initialCapital;
  let currentPosition: {
    entryTime: number;
    entryPrice: number;
    btcAmount: number;
    investedUsd: number;
    entryFeeUsd: number;
    stopLossPrice?: number;
  } | null = null;

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];

  let peakEquity = initialCapital;
  let maxDrawdownPct = 0;

  // Initial benchmark setup (buy and hold equivalent on first tradeable candle)
  const firstPrice = candles[minRequiredCandles - 1].close;
  const benchmarkBtc = (initialCapital * (1 - tradingFeePct / 100)) / firstPrice;

  // Loop through candles starting from index where indicators are valid
  for (let i = minRequiredCandles - 1; i < candles.length; i++) {
    const currentCandle = candles[i];
    const nextCandle = i + 1 < candles.length ? candles[i + 1] : null;

    // Current price for mark-to-market equity evaluation
    const markPrice = currentCandle.close;

    // Check Stop Loss on existing position during current candle
    if (currentPosition && currentPosition.stopLossPrice) {
      if (currentCandle.low <= currentPosition.stopLossPrice) {
        // Stop loss triggered
        const exitPrice = Math.min(currentPosition.stopLossPrice, currentCandle.open);
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
          exitTime: currentCandle.time,
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

    // Evaluate Strategy Signal strictly on closed candle `i`
    const e20 = ema20[i];
    const e50 = ema50[i];
    const prevE20 = ema20[i - 1];
    const prevE50 = ema50[i - 1];
    const rsi = rsi14[i];

    let shouldEnterLong = false;
    let shouldExitLong = false;

    if (strategy === 'ema_cross') {
      // Golden cross: EMA20 crosses above EMA50
      if (e20 !== null && e50 !== null && prevE20 !== null && prevE50 !== null) {
        const isBullishCross = prevE20 <= prevE50 && e20 > e50;
        const isBearishCross = prevE20 >= prevE50 && e20 < e50;
        if (isBullishCross && !currentPosition) {
          shouldEnterLong = true;
        } else if (isBearishCross && currentPosition) {
          shouldExitLong = true;
        }
      }
    } else if (strategy === 'rsi_mean_reversion') {
      // RSI oversold bounce (< 35) with trend filter (close > EMA50)
      if (rsi !== null && e50 !== null) {
        if (rsi < 35 && markPrice >= e50 && !currentPosition) {
          shouldEnterLong = true;
        } else if (rsi > 68 && currentPosition) {
          shouldExitLong = true;
        }
      }
    } else if (strategy === 'quant_composite') {
      // Multi-factor alignment: Uptrend (Close > EMA20 > EMA50) + Healthy RSI (50-70)
      if (e20 !== null && e50 !== null && rsi !== null) {
        const isStrongTrend = markPrice > e20 && e20 > e50 && rsi >= 48 && rsi <= 68;
        const isTrendBroken = markPrice < e50 || rsi > 76 || rsi < 40;
        if (isStrongTrend && !currentPosition) {
          shouldEnterLong = true;
        } else if (isTrendBroken && currentPosition) {
          shouldExitLong = true;
        }
      }
    }

    // Execute Exit on NEXT candle's open (preventing look-ahead bias)
    if (shouldExitLong && currentPosition && nextCandle) {
      const exitPrice = nextCandle.open;
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
        exitTime: nextCandle.time,
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
    }

    // Execute Enter on NEXT candle's open
    if (shouldEnterLong && !currentPosition && nextCandle) {
      const entryPrice = nextCandle.open;
      const allocatedUsd = cash * (positionSizePct / 100);

      if (allocatedUsd >= 50 && entryPrice > 0) {
        const entryFeeUsd = allocatedUsd * (tradingFeePct / 100);
        const netPurchaseUsd = allocatedUsd - entryFeeUsd;
        const btcAmount = netPurchaseUsd / entryPrice;

        cash -= allocatedUsd;
        let stopLossPrice: number | undefined;
        if (stopLossPct && stopLossPct > 0) {
          stopLossPrice = entryPrice * (1 - stopLossPct / 100);
        }

        currentPosition = {
          entryTime: nextCandle.time,
          entryPrice,
          btcAmount,
          investedUsd: allocatedUsd,
          entryFeeUsd,
          stopLossPrice,
        };
      }
    }

    // Compute Mark-to-Market Total Equity for current candle
    const positionValue = currentPosition ? currentPosition.btcAmount * markPrice : 0;
    const currentEquity = cash + positionValue;
    const benchmarkEquity = benchmarkBtc * markPrice * (1 - tradingFeePct / 100);

    peakEquity = Math.max(peakEquity, currentEquity);
    const drawdownPct = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;
    maxDrawdownPct = Math.max(maxDrawdownPct, drawdownPct);

    equityCurve.push({
      time: currentCandle.time,
      equity: parseFloat(currentEquity.toFixed(2)),
      benchmarkEquity: parseFloat(benchmarkEquity.toFixed(2)),
      drawdownPct: parseFloat(drawdownPct.toFixed(2)),
    });
  }

  // Close open position at end of backtest data
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
  }

  const finalCapital = cash;
  const totalReturnPct = ((finalCapital - initialCapital) / initialCapital) * 100;
  const finalBenchmarkPrice = candles[candles.length - 1].close;
  const benchmarkReturnPct = ((finalBenchmarkPrice - firstPrice) / firstPrice) * 100;
  const alphaPct = totalReturnPct - benchmarkReturnPct;

  const winningTrades = trades.filter((t) => t.netProfitUsd > 0).length;
  const losingTrades = trades.filter((t) => t.netProfitUsd <= 0).length;
  const winRatePct = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  const totalGains = trades.filter((t) => t.netProfitUsd > 0).reduce((acc, t) => acc + t.netProfitUsd, 0);
  const totalLosses = Math.abs(
    trades.filter((t) => t.netProfitUsd < 0).reduce((acc, t) => acc + t.netProfitUsd, 0)
  );
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 99.9 : null;

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
    trades: trades.reverse(), // most recent trades first in log
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
