# Bitcoin Spot Analyzer — Quantitative Research Terminal

A professional, high-density quantitative research terminal for Bitcoin (BTC/USDT). Built with React, TypeScript, Vite, Express, and TradingView's lightweight-charts.

---

## Features

- **Live Public Market Feeds:** Real-time spot price, 24-hour volume, spread in basis points, and high/low ranges from Binance Spot with automatic failover to Coinbase Exchange.
- **Interactive Multi-Timeframe Candlestick Charts:** High-performance canvas chart supporting 15m, 1h, and 4h intervals with EMA 20, EMA 50, and Volume sub-panel overlays.
- **Deterministic Quantitative Signal Engine:** Transparent multi-factor assessment (EMA 20/50 Trend, RSI 14 Momentum, MACD Acceleration, Relative Volume, Order Book Imbalance, Perpetual Funding).
- **Dynamic Weight Renormalization:** When an upstream factor is unavailable, weights automatically renormalize over active factors without artificial bullish or bearish bias.
- **Evidence-Strength Confidence Score:** Rigorous consensus metric accounting for factor unanimity, data completeness, freshness, and directional conflicts (explicitly uncalibrated as a naive win probability).
- **Microstructure & Order Book Depth:** Live top-10 bid/ask depth visualizer with imbalance gauge and spread tracking in USD and basis points.
- **Derivatives Basis Isolation:** Public perpetual futures funding rate and open interest tracking, kept isolated from spot calculations if unavailable.
- **Historical Backtesting Lab:** Realistic candle-by-candle strategy simulation without look-ahead bias (signals generated on candle close, executed on subsequent candle open with configurable maker/taker fees and stop losses).
- **Position Risk Calculator:** Disciplined fixed-fractional risk modeling calculating exact BTC sizing, planned loss, notional value, leverage, and risk-to-reward ratios.
- **Sourced Macro Research Ledger:** Manual evidentiary log for spot Bitcoin ETF flows, FOMC announcements, and regulatory events with verifiable links and analyst notes.

---

## Architecture & Project Structure

```
.
├── server.ts                    # Express server with public exchange endpoints & caching
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Main terminal workspace and state orchestration
│   ├── index.css                # Global styles with Tailwind CSS
│   ├── types/
│   │   └── market.ts            # Core TypeScript interfaces for market data and quant models
│   ├── lib/
│   │   ├── indicators.ts        # Pure mathematical indicators (EMA, RSI, MACD, ATR, Vol)
│   │   ├── signalEngine.ts      # Deterministic multi-factor scoring & weight renormalization
│   │   ├── backtester.ts        # Historical backtesting engine (zero look-ahead bias)
│   │   └── riskCalculator.ts    # Position sizing & capital preservation math
│   └── components/
│       ├── Header.tsx           # Terminal top bar (follows Top Bar Contract)
│       ├── MarketOverviewBar.tsx# Live BTC ticker & 24h stats matrix
│       ├── CandlestickChart.tsx # Financial chart with EMA & volume overlays
│       ├── IndicatorPanels.tsx  # RSI, MACD, ATR, and Volume ratio cards
│       ├── OrderBookWidget.tsx  # Bid/Ask depth ladder and imbalance meter
│       ├── DerivativesWidget.tsx# Perpetual funding rate and open interest
│       ├── SignalEngineView.tsx # Master assessment, factor matrix, conflicts & limitations
│       ├── BacktestingView.tsx  # Backtest controls, KPI strip, equity curves & trade logs
│       ├── RiskCalculatorView.tsx # Interactive position risk management workspace
│       ├── MacroResearchPanel.tsx # Sourced manual macro & ETF research ledger
│       └── MethodologyDoc.tsx   # Interactive mathematical documentation
├── test/
│   ├── indicators.test.ts       # Mathematical unit tests for indicators
│   ├── signalEngine.test.ts     # Weight renormalization and scoring tests
│   ├── backtester.test.ts       # Look-ahead prevention and trade execution tests
│   ├── riskCalculator.test.ts   # Position risk and input validation tests
│   └── apiValidation.test.ts    # Backend endpoint input validation tests
├── METHODOLOGY.md               # Complete mathematical formulations & derivations
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Setup & Running

### Requirements
- Node.js 18+ or 20+
- npm or pnpm

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The terminal dev server starts on `http://localhost:3000` with Express running the API endpoints and mounting Vite middlewares.

### 3. Run Automated Tests
```bash
npm run test
```
Executes the full Vitest suite covering indicators, signal math, weight renormalization, backtest look-ahead prevention, and risk calculations.

### 4. Build for Production
```bash
npm run build
npm run start
```

---

## Data Sources & Fallback Policy

- **Primary:** Binance Spot Public API (`api.binance.com/api/v3`) — Ticker, klines, depth, trades.
- **Fallback:** Coinbase Exchange Public API (`api.exchange.coinbase.com`) — Automatic fallback if Binance is rate-limited or geo-restricted. Clearly labeled in the UI as `Coinbase Exchange (Fallback)`.
- **Derivatives:** Binance Futures Public API (`fapi.binance.com`) — 8h funding rate and open interest.
- **Integrity Rule:** No synthetic or fabricated prices are ever generated. Missing factors remain `Unavailable` and their weights are renormalized transparently.

---

## Quantitative Limitations

1. Model assessments reflect historical and instantaneous spot data; they are not forward predictive guarantees.
2. Sudden macroeconomic announcements (CPI, FOMC), ETF redemption shocks, and regulatory actions can invalidate technical regimes instantaneously.
3. Live execution slippage and exchange fee structures will cause real trade fills to diverge from backtest assumptions.
