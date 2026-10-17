/**
 * Type definitions for Bitcoin Spot Analyzer — Quantitative Research Terminal
 */

export interface MarketTicker {
  symbol: string;
  provider: string;
  isFallback: boolean;
  timestamp: number;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24hBtc: number;
  quoteVolume24hUsd: number;
  bidPrice: number;
  askPrice: number;
  openPrice24h: number;
  tradesCount24h: number | null;
  status: 'LIVE' | 'LIVE_FALLBACK' | 'UNAVAILABLE';
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
  tradesCount?: number | null;
}

export interface CandleDataResponse {
  symbol: string;
  interval: '15m' | '1h' | '4h';
  count: number;
  provider: string;
  isFallback: boolean;
  timestamp: number;
  candles: Candle[];
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  total?: number;
}

export interface OrderBookData {
  symbol: string;
  provider: string;
  isFallback: boolean;
  timestamp: number;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  spreadBps: number | null;
  totalBidVolume: number;
  totalAskVolume: number;
  imbalanceRatio: number; // -1 to +1
  bids: [number, number][];
  asks: [number, number][];
}

export interface RecentTrade {
  id: number | string;
  price: number;
  qty: number;
  quoteQty: number;
  time: number;
  isBuyerMaker: boolean;
}

export interface DerivativesContext {
  marketType: string;
  provider: string;
  timestamp: number;
  isAvailable: boolean;
  fundingRate8h: number | null;
  annualizedFundingRatePct: number | null;
  fundingTime: number | null;
  openInterestBtc: number | null;
  interpretation: string;
}

export interface IndicatorResults {
  ema20: (number | null)[];
  ema50: (number | null)[];
  rsi14: (number | null)[];
  macd: {
    macd: (number | null)[];
    signal: (number | null)[];
    histogram: (number | null)[];
  };
  atr14: (number | null)[];
  volumeRatio: {
    ratio: number | null;
    maVolume: number | null;
  };
  priceStats: {
    return20PeriodPct: number | null;
    annualizedVolatilityPct: number | null;
  };
}

export type SignalAssessment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface FactorContribution {
  id: string;
  name: string;
  category: 'Trend' | 'Momentum' | 'Volatility' | 'Volume' | 'Microstructure' | 'Derivatives';
  metricValue: string;
  rawScore: number; // -1.0 (strongly bearish) to +1.0 (strongly bullish)
  baseWeight: number; // e.g. 0.25
  effectiveWeight: number; // normalized weight when missing factors exist
  contribution: number; // rawScore * effectiveWeight
  status: 'ACTIVE' | 'UNAVAILABLE';
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'N/A';
  explanation: string;
}

export interface SignalAnalysis {
  assessment: SignalAssessment;
  compositeScore: number; // -1.0 to +1.0
  evidenceStrengthPct: number; // 0 to 100%
  dataCompletenessPct: number; // 0 to 100%
  activeFactorsCount: number;
  totalFactorsCount: number;
  factors: FactorContribution[];
  plainLanguageSummary: string;
  conflictingEvidence: string[];
  limitations: string[];
  calculatedAt: number;
}

// Backtesting Types
export interface BacktestConfig {
  strategy: 'ema_cross' | 'rsi_mean_reversion' | 'quant_composite';
  initialCapital: number;
  positionSizePct: number; // 10 to 100
  tradingFeePct: number; // e.g. 0.075 for 0.075%
  stopLossPct?: number; // optional stop loss percentage
}

export interface BacktestTrade {
  id: number;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  type: 'LONG';
  positionSizeBtc: number;
  grossProfitUsd: number;
  feesPaidUsd: number;
  netProfitUsd: number;
  returnPct: number;
  exitReason: 'SIGNAL' | 'STOP_LOSS' | 'DATA_END';
}

export interface BacktestEquityPoint {
  time: number;
  equity: number;
  benchmarkEquity: number;
  drawdownPct: number;
}

export interface BacktestResult {
  strategyName: string;
  candleCount: number;
  interval: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturnPct: number;
  benchmarkReturnPct: number;
  alphaPct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number | null;
  trades: BacktestTrade[];
  equityCurve: BacktestEquityPoint[];
  isViable: boolean;
  unavailableReason?: string;
}

// Risk Calculator Types
export interface RiskCalculationInputs {
  accountEquity: number;
  riskPct: number;
  entryPrice: number;
  stopLossPrice: number;
  direction: 'LONG' | 'SHORT';
  targetPrice?: number;
}

export interface RiskCalculationResult {
  isValid: boolean;
  validationError?: string;
  maxLossUsd: number;
  riskPerBtc: number;
  riskPctOfPrice: number;
  positionSizeBtc: number;
  notionalValueUsd: number;
  effectiveLeverage: number;
  expectedRewardUsd: number | null;
  riskRewardRatio: number | null;
}

// Sourced Macro Research
export interface SourcedMacroItem {
  id: string;
  date: string;
  title: string;
  category: 'ETF Flows' | 'Macroeconomic' | 'Regulatory' | 'On-Chain';
  value: string;
  sourceUrl: string;
  sourceName: string;
  analystNotes: string;
  verificationStatus: 'User Sourced - Verified Link' | 'Pending Verification';
}
