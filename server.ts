import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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

// Helper: fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs = 6000, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
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
  if (cache.ticker && now - cache.ticker.timestamp < CACHE_TTL_MS.ticker) {
    return res.json({ ...cache.ticker.data, cached: true });
  }

  let provider = 'Binance Spot';
  let isFallback = false;

  try {
    // Primary: Binance Spot 24hr ticker
    const binanceRes = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    if (binanceRes.ok) {
      const data = await binanceRes.json();
      const payload = {
        symbol: 'BTC/USDT',
        provider: 'Binance Spot',
        isFallback: false,
        timestamp: now,
        price: parseFloat(data.lastPrice),
        priceChange24h: parseFloat(data.priceChange),
        priceChangePercent24h: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24hBtc: parseFloat(data.volume),
        quoteVolume24hUsd: parseFloat(data.quoteVolume),
        bidPrice: parseFloat(data.bidPrice),
        askPrice: parseFloat(data.askPrice),
        openPrice24h: parseFloat(data.openPrice),
        tradesCount24h: data.count || null,
        status: 'LIVE',
      };
      cache.ticker = { timestamp: now, data: payload };
      return res.json(payload);
    }
  } catch (primaryErr) {
    console.warn('Binance spot ticker failed, trying Coinbase fallback:', (primaryErr as Error).message);
  }

  // Fallback: Coinbase Exchange API
  try {
    provider = 'Coinbase Exchange';
    isFallback = true;
    const [statsRes, tickerRes] = await Promise.all([
      fetchWithTimeout('https://api.exchange.coinbase.com/products/BTC-USDT/stats'),
      fetchWithTimeout('https://api.exchange.coinbase.com/products/BTC-USDT/ticker'),
    ]);

    if (statsRes.ok && tickerRes.ok) {
      const stats = await statsRes.json();
      const ticker = await tickerRes.json();
      const currentPrice = parseFloat(ticker.price);
      const openPrice = parseFloat(stats.open);
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
        high24h: parseFloat(stats.high),
        low24h: parseFloat(stats.low),
        volume24hBtc: parseFloat(stats.volume),
        quoteVolume24hUsd: currentPrice * parseFloat(stats.volume),
        bidPrice: parseFloat(ticker.bid || ticker.price),
        askPrice: parseFloat(ticker.ask || ticker.price),
        openPrice24h: openPrice,
        tradesCount24h: null,
        status: 'LIVE_FALLBACK',
      };
      cache.ticker = { timestamp: now, data: payload };
      return res.json(payload);
    }
  } catch (fallbackErr) {
    console.error('All ticker providers failed:', (fallbackErr as Error).message);
  }

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

  // Validate interval
  if (!['15m', '1h', '4h'].includes(interval)) {
    return res.status(400).json({
      error: "Invalid interval. Allowed intervals are '15m', '1h', '4h'.",
    });
  }

  const cacheKey = `${interval}_${limit}`;
  const now = Date.now();
  if (cache.candles && cache.candles[cacheKey] && now - cache.candles[cacheKey].timestamp < CACHE_TTL_MS.candles) {
    return res.json({ ...cache.candles[cacheKey].data, cached: true });
  }

  // 1. Primary: Binance Spot klines
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
    const resp = await fetchWithTimeout(url);
    if (resp.ok) {
      const raw = await resp.json();
      if (Array.isArray(raw) && raw.length > 0) {
        // Binance kline format:
        // [0: openTime, 1: open, 2: high, 3: low, 4: close, 5: volume, 6: closeTime, 7: quoteVolume, 8: numTrades...]
        const candles = raw.map((k: any[]) => ({
          time: Math.floor(k[0] / 1000), // unix timestamp in seconds for charts
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          quoteVolume: parseFloat(k[7]),
          tradesCount: k[8],
        }));

        const payload = {
          symbol: 'BTC/USDT',
          interval,
          count: candles.length,
          provider: 'Binance Spot',
          isFallback: false,
          timestamp: now,
          candles,
        };

        if (!cache.candles) cache.candles = {};
        cache.candles[cacheKey] = { timestamp: now, data: payload };
        return res.json(payload);
      }
    }
  } catch (err) {
    console.warn('Binance candles request failed, trying Coinbase fallback:', (err as Error).message);
  }

  // 2. Fallback: Coinbase candles
  try {
    // Coinbase granularity: 15m = 900, 1h = 3600, 4h = 14400
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
      if (Array.isArray(raw) && raw.length > 0) {
        // Coinbase candle format: [time, low, high, open, close, volume]
        // Sorted newest to oldest -> reverse for chronological
        const sorted = [...raw].sort((a, b) => a[0] - b[0]).slice(-limit);
        const candles = sorted.map((c: any[]) => ({
          time: c[0],
          low: parseFloat(c[1]),
          high: parseFloat(c[2]),
          open: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5]),
          quoteVolume: parseFloat(c[5]) * parseFloat(c[4]),
          tradesCount: null,
        }));

        const payload = {
          symbol: 'BTC/USDT',
          interval,
          count: candles.length,
          provider: 'Coinbase Exchange (Fallback)',
          isFallback: true,
          timestamp: now,
          candles,
        };

        if (!cache.candles) cache.candles = {};
        cache.candles[cacheKey] = { timestamp: now, data: payload };
        return res.json(payload);
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
  });
});

// -------------------------------------------------------------
// 3. Order Book Depth & Bid/Ask Imbalance
// -------------------------------------------------------------
app.get('/api/market/orderbook', async (req: Request, res: Response) => {
  const limitParam = parseInt((req.query.limit as string) || '20', 10);
  const limit = Math.min(Math.max(limitParam, 5), 50);

  const now = Date.now();
  if (cache.orderbook && now - cache.orderbook.timestamp < CACHE_TTL_MS.orderbook) {
    return res.json({ ...cache.orderbook.data, cached: true });
  }

  try {
    const resp = await fetchWithTimeout(`https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=${limit}`);
    if (resp.ok) {
      const data = await resp.json();
      const bids: [number, number][] = data.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]);
      const asks: [number, number][] = data.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]);

      const bestBid = bids.length > 0 ? bids[0][0] : null;
      const bestAsk = asks.length > 0 ? asks[0][0] : null;
      const spread = (bestBid !== null && bestAsk !== null) ? bestAsk - bestBid : null;
      const spreadBps = (spread !== null && bestBid !== null && bestBid > 0) ? (spread / bestBid) * 10000 : null;

      const totalBidVolume = bids.reduce((acc, curr) => acc + curr[1], 0);
      const totalAskVolume = asks.reduce((acc, curr) => acc + curr[1], 0);
      const totalVol = totalBidVolume + totalAskVolume;
      const imbalanceRatio = totalVol > 0 ? (totalBidVolume - totalAskVolume) / totalVol : 0; // -1 to +1

      const payload = {
        symbol: 'BTC/USDT',
        provider: 'Binance Spot',
        isFallback: false,
        timestamp: now,
        bestBid,
        bestAsk,
        spread,
        spreadBps,
        totalBidVolume,
        totalAskVolume,
        imbalanceRatio, // > 0 = more bids, < 0 = more asks
        bids: bids.slice(0, 15),
        asks: asks.slice(0, 15),
      };

      cache.orderbook = { timestamp: now, data: payload };
      return res.json(payload);
    }
  } catch (err) {
    console.warn('Binance orderbook failed, trying Coinbase fallback:', (err as Error).message);
  }

  // Coinbase fallback
  try {
    const cbResp = await fetchWithTimeout('https://api.exchange.coinbase.com/products/BTC-USDT/book?level=2');
    if (cbResp.ok) {
      const data = await cbResp.json();
      const bids: [number, number][] = (data.bids || []).slice(0, limit).map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]);
      const asks: [number, number][] = (data.asks || []).slice(0, limit).map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]);

      const bestBid = bids.length > 0 ? bids[0][0] : null;
      const bestAsk = asks.length > 0 ? asks[0][0] : null;
      const spread = (bestBid !== null && bestAsk !== null) ? bestAsk - bestBid : null;
      const spreadBps = (spread !== null && bestBid !== null && bestBid > 0) ? (spread / bestBid) * 10000 : null;

      const totalBidVolume = bids.reduce((acc, curr) => acc + curr[1], 0);
      const totalAskVolume = asks.reduce((acc, curr) => acc + curr[1], 0);
      const totalVol = totalBidVolume + totalAskVolume;
      const imbalanceRatio = totalVol > 0 ? (totalBidVolume - totalAskVolume) / totalVol : 0;

      const payload = {
        symbol: 'BTC/USDT',
        provider: 'Coinbase Exchange (Fallback)',
        isFallback: true,
        timestamp: now,
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

      cache.orderbook = { timestamp: now, data: payload };
      return res.json(payload);
    }
  } catch (cbErr) {
    console.error('All orderbook providers failed:', (cbErr as Error).message);
  }

  return res.status(503).json({
    error: 'Order book depth is currently unavailable from public exchange endpoints.',
    symbol: 'BTC/USDT',
    timestamp: now,
  });
});

// -------------------------------------------------------------
// 4. Recent Trades
// -------------------------------------------------------------
app.get('/api/market/trades', async (req: Request, res: Response) => {
  const limitParam = parseInt((req.query.limit as string) || '25', 10);
  const limit = Math.min(Math.max(limitParam, 5), 50);

  const now = Date.now();
  if (cache.trades && now - cache.trades.timestamp < CACHE_TTL_MS.trades) {
    return res.json({ ...cache.trades.data, cached: true });
  }

  try {
    const resp = await fetchWithTimeout(`https://api.binance.com/api/v3/trades?symbol=BTCUSDT&limit=${limit}`);
    if (resp.ok) {
      const data = await resp.json();
      const trades = data.map((t: any) => ({
        id: t.id,
        price: parseFloat(t.price),
        qty: parseFloat(t.qty),
        quoteQty: parseFloat(t.quoteQty),
        time: t.time,
        isBuyerMaker: t.isBuyerMaker, // if true, sell side market order; if false, buyer taker
      }));

      const payload = {
        symbol: 'BTC/USDT',
        provider: 'Binance Spot',
        isFallback: false,
        timestamp: now,
        trades,
      };

      cache.trades = { timestamp: now, data: payload };
      return res.json(payload);
    }
  } catch (err) {
    console.warn('Binance trades failed:', (err as Error).message);
  }

  return res.status(503).json({
    error: 'Recent trades are currently unavailable from public exchange endpoints.',
    symbol: 'BTC/USDT',
    timestamp: now,
  });
});

// -------------------------------------------------------------
// 5. Perpetual Derivatives Context (Funding Rate & Open Interest)
// -------------------------------------------------------------
app.get('/api/market/derivatives', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (cache.derivatives && now - cache.derivatives.timestamp < CACHE_TTL_MS.derivatives) {
    return res.json({ ...cache.derivatives.data, cached: true });
  }

  try {
    // Binance public futures endpoints (no auth required)
    const [fundingRes, oiRes] = await Promise.allSettled([
      fetchWithTimeout('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1'),
      fetchWithTimeout('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT'),
    ]);

    let latestFundingRate: number | null = null;
    let fundingTime: number | null = null;
    let openInterestBtc: number | null = null;

    if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
      const fundingData = await fundingRes.value.json();
      if (Array.isArray(fundingData) && fundingData.length > 0) {
        latestFundingRate = parseFloat(fundingData[0].fundingRate);
        fundingTime = fundingData[0].fundingTime;
      }
    }

    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      const oiData = await oiRes.value.json();
      if (oiData && oiData.openInterest) {
        openInterestBtc = parseFloat(oiData.openInterest);
      }
    }

    const isAvailable = latestFundingRate !== null || openInterestBtc !== null;

    const payload = {
      marketType: 'Derivatives / Perpetual Futures (BTCUSDT)',
      provider: isAvailable ? 'Binance Futures Public' : 'Unavailable',
      timestamp: now,
      isAvailable,
      fundingRate8h: latestFundingRate,
      annualizedFundingRatePct: latestFundingRate !== null ? latestFundingRate * 3 * 365 * 100 : null,
      fundingTime,
      openInterestBtc,
      interpretation: latestFundingRate !== null
        ? latestFundingRate > 0.0003
          ? 'Crowded Long: high positive funding fee paid by longs'
          : latestFundingRate < -0.0001
          ? 'Crowded Short: negative funding fee paid by shorts'
          : 'Neutral: balanced perpetual funding environment'
        : 'Derivatives data unavailable from public endpoints',
    };

    cache.derivatives = { timestamp: now, data: payload };
    return res.json(payload);
  } catch (err) {
    console.warn('Derivatives endpoint error:', (err as Error).message);
    return res.json({
      marketType: 'Derivatives / Perpetual Futures (BTCUSDT)',
      provider: 'Unavailable',
      timestamp: now,
      isAvailable: false,
      fundingRate8h: null,
      annualizedFundingRatePct: null,
      fundingTime: null,
      openInterestBtc: null,
      interpretation: 'Public derivatives endpoint timed out or geo-restricted; quantitative weights will renormalize over available spot factors.',
    });
  }
});

// -------------------------------------------------------------
// Dev & Production Middleware Setup
// -------------------------------------------------------------
async function startServer() {
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

  app.listen(PORT, () => {
    console.log(`Bitcoin Spot Analyzer server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
