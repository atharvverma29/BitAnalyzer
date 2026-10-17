import { RiskCalculationInputs, RiskCalculationResult } from '../types/market';

/**
 * Calculates risk-managed position sizing for Bitcoin spot or perpetual positions.
 * Ensures disciplined capital preservation based on fixed fractional risk modeling.
 */
export function calculatePositionRisk(inputs: RiskCalculationInputs): RiskCalculationResult {
  const { accountEquity, riskPct, entryPrice, stopLossPrice, direction, targetPrice } = inputs;

  // Validation
  if (accountEquity <= 0) {
    return createInvalidResult('Account equity must be greater than 0.');
  }
  if (riskPct <= 0 || riskPct > 100) {
    return createInvalidResult('Risk percentage must be between 0.01% and 100%.');
  }
  if (entryPrice <= 0) {
    return createInvalidResult('Entry price must be greater than 0.');
  }
  if (stopLossPrice <= 0) {
    return createInvalidResult('Stop loss price must be greater than 0.');
  }

  if (direction === 'LONG' && stopLossPrice >= entryPrice) {
    return createInvalidResult('For LONG positions, Stop Loss must be strictly below Entry Price.');
  }

  if (direction === 'SHORT' && stopLossPrice <= entryPrice) {
    return createInvalidResult('For SHORT positions, Stop Loss must be strictly above Entry Price.');
  }

  // Risk per BTC unit
  const riskPerBtc = Math.abs(entryPrice - stopLossPrice);
  const riskPctOfPrice = (riskPerBtc / entryPrice) * 100;

  if (riskPerBtc === 0) {
    return createInvalidResult('Stop loss price cannot equal entry price.');
  }

  // Maximum planned loss in USD
  const maxLossUsd = accountEquity * (riskPct / 100);

  // Position sizing
  // Formula: Position Size (BTC) = Max Loss (USD) / Risk Per Unit (USD)
  const positionSizeBtc = maxLossUsd / riskPerBtc;
  const notionalValueUsd = positionSizeBtc * entryPrice;
  const effectiveLeverage = notionalValueUsd / accountEquity;

  let expectedRewardUsd: number | null = null;
  let riskRewardRatio: number | null = null;

  if (targetPrice && targetPrice > 0) {
    const isTargetValid =
      direction === 'LONG' ? targetPrice > entryPrice : targetPrice < entryPrice;
    if (isTargetValid) {
      const rewardPerBtc = Math.abs(targetPrice - entryPrice);
      expectedRewardUsd = positionSizeBtc * rewardPerBtc;
      riskRewardRatio = rewardPerBtc / riskPerBtc;
    }
  }

  return {
    isValid: true,
    maxLossUsd: parseFloat(maxLossUsd.toFixed(2)),
    riskPerBtc: parseFloat(riskPerBtc.toFixed(2)),
    riskPctOfPrice: parseFloat(riskPctOfPrice.toFixed(2)),
    positionSizeBtc: parseFloat(positionSizeBtc.toFixed(6)),
    notionalValueUsd: parseFloat(notionalValueUsd.toFixed(2)),
    effectiveLeverage: parseFloat(effectiveLeverage.toFixed(2)),
    expectedRewardUsd: expectedRewardUsd !== null ? parseFloat(expectedRewardUsd.toFixed(2)) : null,
    riskRewardRatio: riskRewardRatio !== null ? parseFloat(riskRewardRatio.toFixed(2)) : null,
  };
}

function createInvalidResult(error: string): RiskCalculationResult {
  return {
    isValid: false,
    validationError: error,
    maxLossUsd: 0,
    riskPerBtc: 0,
    riskPctOfPrice: 0,
    positionSizeBtc: 0,
    notionalValueUsd: 0,
    effectiveLeverage: 0,
    expectedRewardUsd: null,
    riskRewardRatio: null,
  };
}
