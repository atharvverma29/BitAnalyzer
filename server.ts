import express, { Request, Response, Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  fetchFn?: typeof fetch;
  enableCache?: boolean;
}

export function createApp(options: ServerOptions = {}): Express {
  const app = express();
  const fetchFn = options.fetchFn || fetch;
  const enableCache = options.enableCache !== false;

  app.use(express.json());

  // In-memory cache for exchange data to prevent rate limits and ensure resilience
  interface CacheEntry<T> {
    timestamp: number;
    data: T;
  }

  const cache: {
    ticker?: CacheEntry<any>;
    candles?: Record<string, CacheEntry<any>>;
    orderbook?: CacheEntry<any>;
    trades?: CacheEntry<any>;
    derivatives?: CacheEntry<any>;
  } = {
    candles: {},
  };

  const CACHE_TTL_MS = {
    ticker: 5000,       // 5 seconds
    candles: 15000,     // 15 seconds
    orderbook: 4000,    // 4 seconds
    trades: 6000,       // 6 seconds
    derivatives: 30000, // 30 seconds
  };

  // Helper: fetch with timeout using provided fetchFn
  async function fetchWithTimeout(url: string, timeoutMs = 6000, headers: Record<string, string> = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'BitcoinSpotAnalyzer/1.0 (Quantitative Research Terminal)',
          'Accept': 'application/json',
          ...headers,
        },
      });
      clearTimeout(id);
      return response;
    } catch (err: any) {
      clearTimeout(id);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // 1. BTC Spot Ticker & 24h Stats
  // -------------------------------------------------------------
  app.get('/api/market/ticker', async (_req: Request, res: Response) => {
    const now = Date.now();
    if (enableCache && cache.ticker && now - cache.ticker.timestamp < CACHE_TTL_MS.ticker) {
      return res.json({ ...cache.ticker.data, cached: true });
    }

    // 1. Primary: Binance Spot 24hr ticker
    try {
      const binanceRes = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      if (binanceRes.ok) {
        const data = await binanceRes.json();
        const price = parseFloat(data.lastPrice);
        const priceChange = parseFloat(data.priceChange);
        const priceChangePercent = parseFloat(data.priceChangePercent);
        const high24h = parseFloat(data.highPrice);
        const low24h = parseFloat(data.lowPrice);
        const volume24hBtc = parseFloat(data.volume);
        const quoteVolume24hUsd = parseFloat(data.quoteVolume);
        const bidPrice = parseFloat(data.bidPrice);
        const askPrice = parseFloat(data.askPrice);
        const openPrice24h = parseFloat(data.openPrice);

        // Strict numeric validation: Reject non-finite prices
        if (
          Number.isFinite(price) &&
          price > 0 &&
          Number.isFinite(high24h) &&
          high24h > 0 &&
          Number.isFinite(low24h) &&
          low24h > 0 &&
          high24h >= low24h &&
          Number.isFinite(volume24hBtc) &&
          volume24hBtc >= 0 &&
          Number.isFinite(quoteVolume24hUsd) &&
          quoteVolume24hUsd >= 0
        ) {
          const payload = {
            symbol: 'BTC/USDT',
            provider: 'Binance Spot',
            isFallback: false,
            timestamp: now,
            price,
            priceChange24h: Number.isFinite(priceChange) ? priceChange : 0,
            priceChangePercent24h: Number.isFinite(priceChangePercent) ? priceChangePercent : 0,
            high24h,
            low24h,
            volume24hBtc,
            quoteVolume24hUsd,
            bidPrice: Number.isFinite(bidPrice) ? bidPrice : price,
            askPrice: Number.isFinite(askPrice) ? askPrice : price,
            openPrice24h: Number.isFinite(openPrice24h) ? openPrice24h : price,
            tradesCount24h: Number.isInteger(data.count) ? data.count : null,
            status: 'LIVE',
          };
          if (enableCache) cache.ticker = { timestamp: now, data: payload };
          return res.json(payload);
        } else {
          console.warn('Binance ticker returned non-finite numeric values; attempting fallback');
        }
      }
    } catch (primaryErr) {
      console.warn('Binance spot ticker failed, trying Coinbase fallback:', (primaryErr as Error).message);
    }

    // 2. Fallback: Coinbase Exchange API
    try {
      const [statsRes, tickerRes] = await Promise.all([
        fetchWithTimeout('https://api.exchange.coinbase.com/products/BTC-USDT/stats'),
        fetchWithTimeout('https://api.exchange.coinbase.com/products/BTC-USDT/ticker'),
      ]);

      if (statsRes.ok && tickerRes.ok) {
        const stats = await statsRes.json();
        const ticker = await tickerRes.json();
        const currentPrice = parseFloat(ticker.price);
        const openPrice = parseFloat(stats.open);
        const high24h = parseFloat(stats.high);
        const low24h = parseFloat(stats.low);
        const volume24hBtc = parseFloat(stats.volume);

        if (
          Number.isFinite(currentPrice) &&
          currentPrice > 0 &&
          Number.isFinite(openPrice) &&
          openPrice > 0 &&
          Number.isFinite(high24h) &&
          high24h > 0 &&
          Number.isFinite(low24h) &&
          low24h > 0 &&
          high24h >= low24h &&
          Number.isFinite(volume24hBtc) &&
          volume24hBtc >= 0
        ) {
          const change = currentPrice - openPrice;
          const changePct = openPrice > 0 ? (change / openPrice) * 100 : 0;

          const payload = {
            symbol: 'BTC/USDT',
            provider: 'Coinbase Exchange (Fallback)',
            isFallback: true,
            timestamp: now,
            price: currentPrice,
            priceChange24h: change,
            priceChangePercent24h: changePct,
            high24h,
            low24h,
            volume24hBtc,
            quoteVolume24hUsd: currentPrice * volume24hBtc,
            bidPrice: parseFloat(ticker.bid || ticker.price),
            askPrice: parseFloat(ticker.ask || ticker.price),
            openPrice24h: openPrice,
            tradesCount24h: null,
            status: 'LIVE_FALLBACK',
          };
          if (enableCache) cache.ticker = { timestamp: now, data: payload };
          return res.json(payload);
        }
      }
    } catch (fallbackErr) {
      console.error('All ticker providers failed:', (fallbackErr as Error).message);
    }

    // Never label invalid data as LIVE; clearly return 503 UNAVAILABLE
    return res.status(503).json({
      error: 'Market ticker data is currently unavailable from public exchange endpoints.',
      symbol: 'BTC/USDT',
      timestamp: now,
      status: 'UNAVAILABLE',
    });
  });

  // -------------------------------------------------------------
  // 2. Historical OHLCV Candles (15m, 1h, 4h)
  // -------------------------------------------------------------
  app.get('/api/market/candles', async (req: Request, res: Response) => {
    const interval = (req.query.interval as string) || '1h';
    const limitParam = parseInt((req.query.limit as string) || '150', 10);
    const limit = Math.min(Math.max(limitParam, 30), 300);

    // Validate interval parameter strictly
    if (!['15m', '1h', '4h'].includes(interval)) {
      return res.status(400).json({
        error: "Invalid interval. Allowed intervals are '15m', '1h', '4h'.",
        status: 'BAD_REQUEST',
      });
    }

    const cacheKey = `${interval}_${limit}`;
    const now = Date.now();
    if (enableCache && cache.candles && cache.candles[cacheKey] && now - cache.candles[cacheKey].timestamp < CACHE_TTL_MS.candles) {
      return res.json({ ...cache.candles[cacheKey].data, cached: true });
    }

    // 1. Primary: Binance Spot klines
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
      const resp = await fetchWithTimeout(url);
      if (resp.ok) {
        const raw = await resp.json();
        if (Array.isArray(raw)) {
          const validCandles = raw
            .filter((k) => Array.isArray(k) && k.length >= 6)
            .map((k: any[]) => {
              const time = Math.floor(k[0] / 1000);
              const open = parseFloat(k[1]);
              const high = parseFloat(k[2]);
              const low = parseFloat(k[3]);
              const close = parseFloat(k[4]);
              const volume = parseFloat(k[5]);
              const quoteVolume = parseFloat(k[7] || '0');

              if (
                Number.isFinite(time) &&
                time > 0 &&
                Number.isFinite(open) &&
                open > 0 &&
                Number.isFinite(high) &&
                high > 0 &&
                Number.isFinite(low) &&
                low > 0 &&
                high >= low &&
                Number.isFinite(close) &&
                close > 0 &&
                Number.isFinite(volume) &&
                volume >= 0
              ) {
                return {
                  time,
                  open,
                  high,
                  low,
                  close,
                  volume,
                  quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : open * volume,
                  tradesCount: k[8] || null,
                };
              }
              return null;
            })
            .filter((c): c is NonNullable<typeof c> => c !== null);

          if (validCandles.length >= 10) {
            const payload = {
              symbol: 'BTC/USDT',
              interval,
              count: validCandles.length,
              provider: 'Binance Spot',
              isFallback: false,
              timestamp: now,
              status: 'LIVE',
              candles: validCandles,
            };

            if (enableCache) {
              if (!cache.candles) cache.candles = {};
              cache.candles[cacheKey] = { timestamp: now, data: payload };
            }
            return res.json(payload);
          }
        }
      }
    } catch (err) {
      console.warn('Binance candles request failed, trying Coinbase fallback:', (err as Error).message);
    }

    // 2. Fallback: Coinbase candles
    try {
      const granularityMap: Record<string, number> = {
        '15m': 900,
        '1h': 3600,
        '4h': 14400,
      };
      const granularity = granularityMap[interval] || 3600;
      const cbUrl = `https://api.exchange.coinbase.com/products/BTC-USDT/candles?granularity=${granularity}`;
      const cbResp = await fetchWithTimeout(cbUrl);

      if (cbResp.ok) {
        const raw = await cbResp.json();
        if (Array.isArray(raw)) {
          const sorted = [...raw].sort((a, b) => a[0] - b[0]).slice(-limit);
          const validCandles = sorted
            .filter((c) => Array.isArray(c) && c.length >= 6)
            .map((c: any[]) => {
              const time = c[0];
              const low = parseFloat(c[1]);
              const high = parseFloat(c[2]);
              const open = parseFloat(c[3]);
              const close = parseFloat(c[4]);
              const volume = parseFloat(c[5]);

              if (
                Number.isFinite(time) &&
                time > 0 &&
                Number.isFinite(open) &&
                open > 0 &&
                Number.isFinite(high) &&
                high > 0 &&
                Number.isFinite(low) &&
                low > 0 &&
                high >= low &&
                Number.isFinite(close) &&
                close > 0 &&
                Number.isFinite(volume) &&
                volume >= 0
              ) {
                return {
                  time,
                  low,
                  high,
                  open,
                  close,
                  volume,
                  quoteVolume: volume * close,
                  tradesCount: null,
                };
              }
              return null;
            })
            .filter((c): c is NonNullable<typeof c> => c !== null);

          if (validCandles.length >= 10) {
            const payload = {
              symbol: 'BTC/USDT',
              interval,
              count: validCandles.length,
              provider: 'Coinbase Exchange (Fallback)',
              isFallback: true,
              timestamp: now,
              status: 'LIVE_FALLBACK',
              candles: validCandles,
            };

            if (enableCache) {
              if (!cache.candles) cache.candles = {};
              cache.candles[cacheKey] = { timestamp: now, data: payload };
            }
            return res.json(payload);
          }
        }
      }
    } catch (cbErr) {
      console.error('All candles providers failed:', (cbErr as Error).message);
    }

    return res.status(503).json({
      error: 'Historical candle data is currently unavailable from public exchange endpoints.',
      symbol: 'BTC/USDT',
      interval,
      timestamp: now,
      status: 'UNAVAILABLE',
    });
  });

  // -------------------------------------------------------------
  // 3. Order Book Depth & Bid/Ask Imbalance
  // -------------------------------------------------------------
  app.get('/api/market/orderbook', async (req: Request, res: Response) => {
    const limitParam = parseInt((req.query.limit as string) || '20', 10);
    const limit = Math.min(Math.max(limitParam, 5), 50);

    const now = Date.now();
    if (enableCache && cache.orderbook && now - cache.orderbook.timestamp < CACHE_TTL_MS.orderbook) {
      return res.json({ ...cache.orderbook.data, cached: true });
    }

    try {
      const resp = await fetchWithTimeout(`https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=${limit}`);
      if (resp.ok) {
        const data = await resp.json();
        const rawBids = Array.isArray(data?.bids) ? data.bids : [];
        const rawAsks = Array.isArray(data?.asks) ? data.asks : [];

        const bids: [number, number][] = rawBids
          .map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])] as [number, number])
          .filter(([p, a]: [number, number]) => Number.isFinite(p) && p > 0 && Number.isFinite(a) && a >= 0);

        const asks: [number, number][] = rawAsks
          .map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])] as [number, number])
          .filter(([p, a]: [number, number]) => Number.isFinite(p) && p > 0 && Number.isFinite(a) && a >= 0);

        if (bids.length > 0 && asks.length > 0) {
          const bestBid = bids[0][0];
          const bestAsk = asks[0][0];
          const spread = bestAsk - bestBid;
          const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;

          const totalBidVolume = bids.reduce((acc, curr) => acc + curr[1], 0);
          const totalAskVolume = asks.reduce((acc, curr) => acc + curr[1], 0);
          const totalVol = totalBidVolume + totalAskVolume;
          const imbalanceRatio = totalVol > 0 ? (totalBidVolume - totalAskVolume) / totalVol : 0;

          const payload = {
            symbol: 'BTC/USDT',
            provider: 'Binance Spot',
            isFallback: false,
            timestamp: now,
            status: 'LIVE',
            bestBid,
            bestAsk,
            spread,
            spreadBps,
            totalBidVolume,
            totalAskVolume,
            imbalanceRatio,
            bids: bids.slice(0, 15),
            asks: asks.slice(0, 15),
          };

          if (enableCache) cache.orderbook = { timestamp: now, data: payload };
          return res.json(payload);
        }
      }
    } catch (err) {
      console.warn('Binance orderbook failed, trying Coinbase fallback:', (err as Error).message);
    }

    // Coinbase fallback
    try {
      const cbResp = await fetchWithTimeout('https://api.exchange.coinbase.com/products/BTC-USDT/book?level=2');
      if (cbResp.ok) {
        const data = await cbResp.json();
        const rawBids = Array.isArray(data?.bids) ? data.bids : [];
        const rawAsks = Array.isArray(data?.asks) ? data.asks : [];

        const bids: [number, number][] = rawBids
          .slice(0, limit)
          .map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])] as [number, number])
          .filter(([p, a]: [number, number]) => Number.isFinite(p) && p > 0 && Number.isFinite(a) && a >= 0);

        const asks: [number, number][] = rawAsks
          .slice(0, limit)
          .map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])] as [number, number])
          .filter(([p, a]: [number, number]) => Number.isFinite(p) && p > 0 && Number.isFinite(a) && a >= 0);

        if (bids.length > 0 && asks.length > 0) {
          const bestBid = bids[0][0];
          const bestAsk = asks[0][0];
          const spread = bestAsk - bestBid;
          const spreadBps = bestBid > 0 ? (spread / bestBid) * 10000 : 0;

          const totalBidVolume = bids.reduce((acc, curr) => acc + curr[1], 0);
          const totalAskVolume = asks.reduce((acc, curr) => acc + curr[1], 0);
          const totalVol = totalBidVolume + totalAskVolume;
          const imbalanceRatio = totalVol > 0 ? (totalBidVolume - totalAskVolume) / totalVol : 0;

          const payload = {
            symbol: 'BTC/USDT',
            provider: 'Coinbase Exchange (Fallback)',
            isFallback: true,
            timestamp: now,
            status: 'LIVE_FALLBACK',
            bestBid,
            bestAsk,
            spread,
            spreadBps,
            totalBidVolume,
            totalAskVolume,
            imbalanceRatio,
            bids: bids.slice(0, 15),
            asks: asks.slice(0, 15),
          };

          if (enableCache) cache.orderbook = { timestamp: now, data: payload };
          return res.json(payload);
        }
      }
    } catch (cbErr) {
      console.error('All orderbook providers failed:', (cbErr as Error).message);
    }

    return res.status(503).json({
      error: 'Order book depth is currently unavailable from public exchange endpoints.',
      symbol: 'BTC/USDT',
      timestamp: now,
      status: 'UNAVAILABLE',
    });
  });

  // -------------------------------------------------------------
  // 4. Recent Trades
  // -------------------------------------------------------------
  app.get('/api/market/trades', async (req: Request, res: Response) => {
    const limitParam = parseInt((req.query.limit as string) || '25', 10);
    const limit = Math.min(Math.max(limitParam, 5), 50);

    const now = Date.now();
    if (enableCache && cache.trades && now - cache.trades.timestamp < CACHE_TTL_MS.trades) {
      return res.json({ ...cache.trades.data, cached: true });
    }

    try {
      const resp = await fetchWithTimeout(`https://api.binance.com/api/v3/trades?symbol=BTCUSDT&limit=${limit}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          const trades = data
            .map((t: any) => {
              const price = parseFloat(t.price);
              const qty = parseFloat(t.qty);
              const quoteQty = parseFloat(t.quoteQty || '0');
              if (Number.isFinite(price) && price > 0 && Number.isFinite(qty) && qty > 0) {
                return {
                  id: t.id,
                  price,
                  qty,
                  quoteQty: Number.isFinite(quoteQty) ? quoteQty : price * qty,
                  time: t.time,
                  isBuyerMaker: Boolean(t.isBuyerMaker),
                };
              }
              return null;
            })
            .filter((t): t is NonNullable<typeof t> => t !== null);

          const payload = {
            symbol: 'BTC/USDT',
            provider: 'Binance Spot',
            isFallback: false,
            timestamp: now,
            status: 'LIVE',
            trades,
          };

          if (enableCache) cache.trades = { timestamp: now, data: payload };
          return res.json(payload);
        }
      }
    } catch (err) {
      console.warn('Binance trades failed:', (err as Error).message);
    }

    return res.status(503).json({
      error: 'Recent trades are currently unavailable from public exchange endpoints.',
      symbol: 'BTC/USDT',
      timestamp: now,
      status: 'UNAVAILABLE',
    });
  });

  // -------------------------------------------------------------
  // 5. Perpetual Derivatives Context (Funding Rate & Open Interest)
  // -------------------------------------------------------------
  app.get('/api/market/derivatives', async (_req: Request, res: Response) => {
    const now = Date.now();
    if (enableCache && cache.derivatives && now - cache.derivatives.timestamp < CACHE_TTL_MS.derivatives) {
      return res.json({ ...cache.derivatives.data, cached: true });
    }

    try {
      const [fundingRes, oiRes] = await Promise.allSettled([
        fetchWithTimeout('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1'),
        fetchWithTimeout('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT'),
      ]);

      let latestFundingRate: number | null = null;
      let fundingTime: number | null = null;
      let openInterestBtc: number | null = null;

      if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
        try {
          const fundingData = await fundingRes.value.json();
          if (Array.isArray(fundingData) && fundingData.length > 0 && fundingData[0]?.fundingRate !== undefined) {
            const parsedRate = parseFloat(fundingData[0].fundingRate);
            if (Number.isFinite(parsedRate)) {
              latestFundingRate = parsedRate;
              fundingTime = fundingData[0].fundingTime || now;
            }
          }
        } catch (e) {
          // ignore malformed json
        }
      }

      if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
        try {
          const oiData = await oiRes.value.json();
          if (oiData?.openInterest !== undefined) {
            const parsedOi = parseFloat(oiData.openInterest);
            if (Number.isFinite(parsedOi) && parsedOi >= 0) {
              openInterestBtc = parsedOi;
            }
          }
        } catch (e) {
          // ignore malformed json
        }
      }

      const isAvailable = latestFundingRate !== null || openInterestBtc !== null;

      const payload = {
        marketType: 'Derivatives / Perpetual Futures (BTCUSDT)',
        provider: isAvailable ? 'Binance Futures Public' : 'Unavailable',
        timestamp: now,
        status: isAvailable ? 'LIVE' : 'UNAVAILABLE',
        isAvailable,
        fundingRate8h: latestFundingRate,
        annualizedFundingRatePct:
          latestFundingRate !== null ? latestFundingRate * 3 * 365 * 100 : null,
        fundingTime,
        openInterestBtc,
        interpretation:
          latestFundingRate !== null
            ? latestFundingRate > 0.0003
              ? 'Crowded Long: high positive funding fee paid by longs'
              : latestFundingRate < -0.0001
              ? 'Crowded Short: negative funding fee paid by shorts'
              : 'Neutral: balanced perpetual funding environment'
            : 'Derivatives funding data unavailable from public endpoints; quantitative weights will renormalize over spot factors.',
      };

      if (enableCache) cache.derivatives = { timestamp: now, data: payload };
      return res.json(payload);
    } catch (err) {
      console.warn('Derivatives endpoint error:', (err as Error).message);
      return res.json({
        marketType: 'Derivatives / Perpetual Futures (BTCUSDT)',
        provider: 'Unavailable',
        timestamp: now,
        status: 'UNAVAILABLE',
        isAvailable: false,
        fundingRate8h: null,
        annualizedFundingRatePct: null,
        fundingTime: null,
        openInterestBtc: null,
        interpretation:
          'Public derivatives endpoint timed out or geo-restricted; quantitative weights will renormalize over available spot factors.',
      });
    }
  });

  return app;
}

// -------------------------------------------------------------
// Server Runner for Dev and Production
// -------------------------------------------------------------
export const app = createApp();
const PORT = process.env.PORT || 3000;

export async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // In dev: mount vite.middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In prod: serve built dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      console.log(`Bitcoin Spot Analyzer server running on http://localhost:${PORT}`);
      resolve();
    });
  });
}

// Only start the server if this file is executed directly and not running in test mode
const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
if (!isTestEnv) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
