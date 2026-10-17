# Quantitative Research Methodology & Architectural Specification

**Application:** Bitcoin Spot Analyzer — Quantitative Research Terminal  
**Asset:** Bitcoin (BTC/USDT)  
**Standard:** Deterministic, Transparent, Explainable Quantitative Modeling

---

## 1. Core Principles

1. **Deterministic & Explainable:** All assessments, scores, and indicators are computed from pure mathematical formulas over actual retrieved market data. No subjective AI hallucinations or black-box predictive models.
2. **Data Integrity & Honesty:** Missing market factors remain strictly `Unavailable`. Missing metrics are never replaced with zero, fabricated defaults, or simulated data.
3. **Weight Renormalization:** Missing factors do not bias directional assessments. Available factor weights are dynamically renormalized to sum to 100%, with a corresponding transparency penalty applied to the Evidence-Strength score.
4. **Zero Look-Ahead Bias:** Historical backtesting strictly computes signals at candle $t$ close and simulates execution on candle $t+1$ open prices with trading fees and slippage accounted for.

---

## 2. Technical Indicator Formulations

### 2.1 Exponential Moving Average (EMA 20 & EMA 50)
For period $N$:
- Smoothing multiplier: $k = \frac{2}{N + 1}$
- Initial seed: $EMA_N = \frac{1}{N} \sum_{i=0}^{N-1} P_i$
- Subsequent values: $EMA_t = P_t \cdot k + EMA_{t-1} \cdot (1 - k)$

### 2.2 Relative Strength Index (RSI 14 — Wilder's Smoothed)
- Price change: $\Delta P_t = P_t - P_{t-1}$
- Gains $G_t = \max(\Delta P_t, 0)$, Losses $L_t = \max(-\Delta P_t, 0)$
- Initial average: $AvgGain_{14} = \frac{1}{14} \sum_{i=1}^{14} G_i$, $AvgLoss_{14} = \frac{1}{14} \sum_{i=1}^{14} L_i$
- Wilder's Smoothing:
  $$AvgGain_t = \frac{AvgGain_{t-1} \cdot 13 + G_t}{14}$$
  $$AvgLoss_t = \frac{AvgLoss_{t-1} \cdot 13 + L_t}{14}$$
- Relative Strength: $RS = \frac{AvgGain}{AvgLoss}$
- Oscillator: $RSI = 100 - \frac{100}{1 + RS}$

### 2.3 Moving Average Convergence Divergence (MACD 12, 26, 9)
- Fast EMA: $EMA_{12}(Close)$
- Slow EMA: $EMA_{26}(Close)$
- MACD Line: $MACD = EMA_{12} - EMA_{26}$
- Signal Line: $Signal = EMA_9(MACD)$
- Histogram: $Hist = MACD - Signal$

### 2.4 Average True Range (ATR 14)
- True Range:
  $$TR_t = \max(H_t - L_t, |H_t - C_{t-1}|, |L_t - C_{t-1}|)$$
- Smoothed with Wilder's period 14:
  $$ATR_t = \frac{ATR_{t-1} \cdot 13 + TR_t}{14}$$

### 2.5 Historical Annualized Log Return Volatility
- Continuous log return: $r_t = \ln\left(\frac{P_t}{P_{t-1}}\right)$
- Sample standard deviation of returns: $\sigma = \sqrt{\frac{1}{M-1} \sum_{t=1}^M (r_t - \bar{r})^2}$
- Annualization factor $K$ ($K = 8,760$ for 1h candles):
  $$\sigma_{annual} = \sigma \cdot \sqrt{K} \cdot 100\%$$

---

## 3. Quantitative Signal Engine & Weight Renormalization

### 3.1 Base Theoretical Factor Weights
| Factor Dimension | ID | Base Weight ($W_{base}$) | Evaluation Domain |
| :--- | :--- | :--- | :--- |
| **Trend Alignment** | `trend_alignment` | 25% (0.25) | Price vs. EMA20, Price vs. EMA50, EMA20 vs. EMA50 |
| **RSI Momentum** | `momentum_rsi` | 20% (0.20) | RSI 14 zone (expansion, neutral, overbought, oversold) |
| **MACD Acceleration** | `macd_acceleration` | 20% (0.20) | MACD vs. Signal cross & Histogram expansion |
| **Volume Confirmation** | `volume_confirmation` | 15% (0.15) | Current volume relative to 20-period moving average |
| **Order Book Microstructure** | `orderbook_imbalance` | 10% (0.10) | Top 20 depth bid vs. ask resting imbalance & spread |
| **Derivatives Funding Context** | `derivatives_funding` | 10% (0.10) | 8h perpetual funding rate & basis crowdedness |

### 3.2 Dynamic Weight Renormalization
When any factor $j$ is unavailable (due to upstream endpoint unavailability, insufficient historical candles, or API timeouts):
1. Compute the sum of active base weights:
   $$W_{active} = \sum_{i \in \text{Active}} W_{base, i}$$
2. Renormalize effective weights:
   $$W_{effective, i} = \frac{W_{base, i}}{W_{active}}$$
3. Missing factor contributions are set strictly to $0.000$ (neutral).
4. Composite Score:
   $$S_{composite} = \sum_{i \in \text{Active}} s_i \cdot W_{effective, i} \quad \in [-1.0, +1.0]$$

### 3.3 Assessment Classification Thresholds
- **BULLISH:** $S_{composite} \ge +0.22$
- **BEARISH:** $S_{composite} \le -0.22$
- **NEUTRAL:** $-0.22 < S_{composite} < +0.22$

### 3.4 Evidence-Strength Score (Confidence)
The evidence score is an objective mathematical index of consensus and data completeness, **not an empirical trade win probability**:
$$\text{Evidence Strength} = 100 \cdot \left[0.35 + 0.65 \cdot |S_{composite}|\right] \cdot \left(\frac{W_{active}}{\sum W_{base}}\right) \cdot F_{freshness} \cdot (1 - 0.4 \cdot C_{conflict})$$
Where:
- Consensus factor: $|S_{composite}|$ measures factor unanimity.
- Completeness penalty: $\frac{W_{active}}{1.0}$ penalizes missing upstream data feeds.
- Freshness penalty: $F_{freshness} = 1.0$ if data age $< 45$s; $0.9$ if $< 120$s; $0.7$ if older.
- Conflict ratio: $C_{conflict} = \frac{\min(\text{BullishFactors}, \text{BearishFactors})}{\text{ActiveFactors}}$.

---

## 4. Historical Backtester Specification

### 4.1 Look-Ahead Bias Prevention
All signal logic evaluated on bar $i$ uses only data available through bar $i$ close ($C_i, H_i, L_i, O_i$). Orders are recorded and filled at the open of bar $i+1$ ($O_{i+1}$). No bar look-ahead is mathematically possible.

### 4.2 Fee & Friction Accounting
For allocated capital $C$:
- Entry fee: $Fee_{entry} = C \cdot \text{FeeRate}$
- Net BTC purchased: $BTC = \frac{C - Fee_{entry}}{O_{i+1}}$
- Exit gross proceeds: $Gross = BTC \cdot O_{exit}$
- Exit fee: $Fee_{exit} = Gross \cdot \text{FeeRate}$
- Realized Net PnL: $PnL_{net} = (Gross - Fee_{exit}) - C$

### 4.3 Peak-to-Trough Maximum Drawdown
At each candle $t$:
$$Equity_t = Cash_t + BTC_t \cdot C_t$$
$$Peak_t = \max(Peak_{t-1}, Equity_t)$$
$$Drawdown_t = \frac{Peak_t - Equity_t}{Peak_t} \cdot 100\%$$
$$MaxDrawdown = \max_{t} (Drawdown_t)$$

---

## 5. Position Sizing & Risk Management

Fixed Fractional Risk Model:
- Maximum Planned Dollar Loss: $L_{max} = \text{AccountEquity} \cdot \left(\frac{\text{RiskPct}}{100}\right)$
- Stop Distance per BTC: $D_{stop} = |P_{entry} - P_{stop}|$
- Recommended Position Size: $Size_{BTC} = \frac{L_{max}}{D_{stop}}$
- Position Notional Value: $V_{notional} = Size_{BTC} \cdot P_{entry}$
- Effective Leverage: $Lev = \frac{V_{notional}}{\text{AccountEquity}}$

*Disclaimer:* Execution slippage, weekend CME gaps, and exchange liquidation fees can cause actual realized loss to exceed planned $L_{max}$.
