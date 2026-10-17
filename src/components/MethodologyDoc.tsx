import React from 'react';
import { BookOpen, Shield, Code, Cpu, LineChart, AlertTriangle } from 'lucide-react';

export const MethodologyDoc: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono text-xs text-slate-300">
      {/* Title Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-amber-400 mb-2">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-100">
            Quantitative Research Methodology & Mathematical Formulations
          </h2>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed">
          Full algorithmic transparency specification for the Bitcoin Spot Analyzer terminal. Every quantitative score, indicator formula, backtest assumption, and weight renormalization logic is deterministic, open, and reproducible.
        </p>
      </div>

      {/* Section 1: Data Acquisition & Integrity Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-xs pb-2 border-b border-slate-800">
          <Cpu className="w-4 h-4" />
          <span>1. Market Data Ingestion & Fallback Architecture</span>
        </div>
        <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
          <p>
            <strong>Primary Exchange Provider:</strong> Binance Spot public REST API (<code className="text-amber-400">api.binance.com/api/v3</code>).
            Retrieves current 24h ticker metrics, OHLCV klines (15m, 1h, 4h), order book top 20 bid/ask depth, and recent trades.
          </p>
          <p>
            <strong>Secondary Fallback Provider:</strong> Coinbase Exchange public API (<code className="text-amber-400">api.exchange.coinbase.com</code>).
            If Binance endpoints encounter upstream rate limits, cloud IP blocks, or outages, the server automatically queries Coinbase for BTC-USDT without breaking the application, labeling the data source explicitly as <code className="text-amber-400">Coinbase Exchange (Fallback)</code>.
          </p>
          <p>
            <strong>Derivatives Data Isolation:</strong> Perpetual futures funding rates and open interest are fetched from Binance Futures public endpoints (<code className="text-amber-400">fapi.binance.com</code>). If derivatives endpoints are blocked or offline, values remain strictly <code className="text-amber-400">null / Unavailable</code>. <em>No fake or fabricated numbers are ever generated.</em>
          </p>
          <p>
            <strong>In-Memory Cache & Rate Limiting:</strong> In-memory server cache protects upstream exchange public endpoints (Ticker: 5s, Candles: 15s, Depth: 4s).
          </p>
        </div>
      </div>

      {/* Section 2: Mathematical Formulations of Indicators */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-xs pb-2 border-b border-slate-800">
          <LineChart className="w-4 h-4" />
          <span>2. Indicator Mathematical Formulations</span>
        </div>

        <div className="space-y-3 text-[11px] leading-relaxed">
          {/* EMA */}
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
            <span className="font-bold text-slate-100 block mb-1">Exponential Moving Average (EMA 20 & EMA 50)</span>
            <p className="text-slate-400">
              Multiplier: <code className="text-amber-400">k = 2 / (N + 1)</code>.<br />
              Initial seed: <code className="text-amber-400">EMA_N = SMA(Price, N)</code>.<br />
              Subsequent values: <code className="text-amber-400">EMA_t = Price_t &times; k + EMA_(t-1) &times; (1 - k)</code>.
            </p>
          </div>

          {/* RSI */}
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
            <span className="font-bold text-slate-100 block mb-1">Relative Strength Index (RSI 14 — Wilder's Smoothing)</span>
            <p className="text-slate-400">
              Price delta: <code className="text-amber-400">&Delta;P_t = P_t - P_(t-1)</code>.<br />
              Smoothed Gains & Losses: <code className="text-amber-400">AvgGain_t = (AvgGain_(t-1) &times; 13 + Gain_t) / 14</code>.<br />
              Relative Strength: <code className="text-amber-400">RS = AvgGain / AvgLoss</code>.<br />
              Oscillator: <code className="text-amber-400">RSI = 100 - [100 / (1 + RS)]</code>.
            </p>
          </div>

          {/* MACD */}
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
            <span className="font-bold text-slate-100 block mb-1">Moving Average Convergence Divergence (MACD 12, 26, 9)</span>
            <p className="text-slate-400">
              MACD Line: <code className="text-amber-400">MACD = EMA(Close, 12) - EMA(Close, 26)</code>.<br />
              Signal Line: <code className="text-amber-400">Signal = EMA(MACD, 9)</code>.<br />
              Histogram: <code className="text-amber-400">Histogram = MACD - Signal</code>.
            </p>
          </div>

          {/* ATR */}
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
            <span className="font-bold text-slate-100 block mb-1">Average True Range (ATR 14)</span>
            <p className="text-slate-400">
              True Range: <code className="text-amber-400">TR_t = max(H_t - L_t, |H_t - C_(t-1)|, |L_t - C_(t-1)|)</code>.<br />
              Smoothed ATR: <code className="text-amber-400">ATR_t = [ATR_(t-1) &times; 13 + TR_t] / 14</code>.
            </p>
          </div>

          {/* Annualized Log Volatility */}
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
            <span className="font-bold text-slate-100 block mb-1">Historical Annualized Log Return Volatility</span>
            <p className="text-slate-400">
              Log returns: <code className="text-amber-400">r_t = ln(P_t / P_(t-1))</code>.<br />
              Sample standard deviation: <code className="text-amber-400">&sigma; = std(r)</code>.<br />
              Annualized: <code className="text-amber-400">&sigma;_annual = &sigma; &times; &radic;(PeriodsPerYear) &times; 100%</code> (e.g. 8,760 hours/year for 1h candles).
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Deterministic Scoring & Renormalization */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2 text-purple-400 font-bold uppercase tracking-wider text-xs pb-2 border-b border-slate-800">
          <Code className="w-4 h-4" />
          <span>3. Quantitative Signal Engine & Weight Renormalization</span>
        </div>

        <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
          <p>
            The engine evaluates six orthogonal quantitative factors with base theoretical weights:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li><strong>Trend Alignment (25%):</strong> Price relative to EMA20 and EMA50, and EMA20/50 cross alignment.</li>
            <li><strong>RSI Momentum (20%):</strong> Momentum regime (55-70 bullish expansion; 30-45 bearish contraction; overbought/oversold boundaries).</li>
            <li><strong>MACD Acceleration (20%):</strong> Direction and expansion of the MACD histogram and signal crossover.</li>
            <li><strong>Volume Confirmation (15%):</strong> Current candle volume relative to the 20-period moving average volume on price moves.</li>
            <li><strong>Order Book Microstructure (10%):</strong> Top-of-book bid vs. ask resting depth imbalance and spread health.</li>
            <li><strong>Derivatives Context (10%):</strong> Perpetual 8h funding rate positioning (contrarian headwind for crowded leverage).</li>
          </ul>

          <div className="bg-slate-950/60 p-3 rounded border border-slate-800 mt-2">
            <span className="font-bold text-amber-400 block mb-1">Dynamic Weight Renormalization Formula</span>
            <p className="text-slate-400">
              When any factor <code className="text-slate-200">f</code> is unavailable (e.g. derivatives endpoint blocked or orderbook filtered):<br />
              <code className="text-slate-200">W_active = &Sigma; W_base(f_active)</code><br />
              <code className="text-slate-200">W_effective(i) = W_base(i) / W_active</code><br />
              <code className="text-slate-200">Composite Score = &Sigma; [s_i &times; W_effective(i)] &isin; [-1.0, +1.0]</code><br />
              Missing factors are strictly neutral (0 contribution) and do NOT impart bullish or bearish bias.
            </p>
          </div>

          <div className="bg-slate-950/60 p-3 rounded border border-slate-800 mt-2">
            <span className="font-bold text-amber-400 block mb-1">Evidence-Strength Confidence Score</span>
            <p className="text-slate-400">
              <code className="text-slate-200">EvidenceStrength = [0.35 + 0.65 &times; |CompositeScore|] &times; (W_active / 1.0) &times; FreshnessFactor &times; (1.0 - 0.4 &times; ConflictRatio)</code><br />
              This metric represents factual data completeness, observation freshness, and factor unanimity. <strong>It is NOT an empirical win probability</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Backtesting Integrity */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs pb-2 border-b border-slate-800">
          <Shield className="w-4 h-4" />
          <span>4. Historical Backtesting Assumptions & Look-Ahead Prevention</span>
        </div>

        <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
          <p>
            <strong>Zero Look-Ahead Bias Guarantee:</strong> All indicator values (EMA, RSI) at historical candle <code className="text-amber-400">t</code> are computed strictly using candles up to <code className="text-amber-400">t</code>. Signals are evaluated at the official candle close, and order execution is recorded on the open price of subsequent candle <code className="text-amber-400">t + 1</code>.
          </p>
          <p>
            <strong>Friction & Fee Deduction:</strong> Every trade deducts user-specified fees (default 0.075% taker fee) on both entry and exit, deducting the exact dollar cost from the cash ledger.
          </p>
          <p>
            <strong>Mark-to-Market Equity:</strong> Open positions are marked to market at each candle's close price, ensuring that the peak-to-trough Maximum Drawdown calculation accounts for unrealized intra-trade pullbacks.
          </p>
        </div>
      </div>

      {/* Section 5: Risk Calculator Sizing */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider text-xs pb-2 border-b border-slate-800">
          <AlertTriangle className="w-4 h-4" />
          <span>5. Fixed Fractional Position Risk Formulation</span>
        </div>

        <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
          <p>
            Given Account Equity <code className="text-amber-400">E</code>, Risk Percentage <code className="text-amber-400">R%</code>, Entry Price <code className="text-amber-400">P_entry</code>, and Stop Loss Price <code className="text-amber-400">P_stop</code>:
          </p>
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800">
            <code className="text-slate-200">Maximum Planned Loss ($) = E &times; (R% / 100)</code><br />
            <code className="text-slate-200">Risk Per Coin ($) = |P_entry - P_stop|</code><br />
            <code className="text-slate-200">Position Size (BTC) = Maximum Planned Loss / Risk Per Coin</code><br />
            <code className="text-slate-200">Notional Position Value ($) = Position Size &times; P_entry</code><br />
            <code className="text-slate-200">Effective Leverage = Notional Position Value / E</code>
          </div>
        </div>
      </div>
    </div>
  );
};
