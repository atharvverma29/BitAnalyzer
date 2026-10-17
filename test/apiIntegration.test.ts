import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server';

describe('Express API Integration & Resilience Tests', () => {
  // ------------------------------------------------------------------------
  // 1. Invalid Parameters
  // ------------------------------------------------------------------------
  it('returns 400 Bad Request for unsupported candle intervals', async () => {
    const app = createApp({ enableCache: false });

    const resInvalid = await request(app).get('/api/market/candles?interval=1d');
    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.error).toContain('Invalid interval');

    const resUnknown = await request(app).get('/api/market/candles?interval=xyz');
    expect(resUnknown.status).toBe(400);
    expect(resUnknown.body.error).toContain('Allowed intervals');
  });

  // ------------------------------------------------------------------------
  // 2. Malformed Upstream JSON Handling
  // ------------------------------------------------------------------------
  it('gracefully handles malformed upstream JSON without crashing', async () => {
    // Mock fetch returning non-JSON HTML (e.g. Cloudflare error)
    const mockFetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
        text: async () => '<html>Error 502 Bad Gateway</html>',
      } as unknown as Response;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });

    const resTicker = await request(app).get('/api/market/ticker');
    expect(resTicker.status).toBe(503);
    expect(resTicker.body.status).toBe('UNAVAILABLE');

    const resCandles = await request(app).get('/api/market/candles?interval=1h');
    expect(resCandles.status).toBe(503);
    expect(resCandles.body.status).toBe('UNAVAILABLE');
  });

  // ------------------------------------------------------------------------
  // 3. Non-Success HTTP Responses & Automatic Fallback
  // ------------------------------------------------------------------------
  it('fails over from Binance 429/500 to Coinbase fallback successfully', async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      // Binance fails with 429 Rate Limit
      if (urlStr.includes('api.binance.com')) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ msg: 'Too many requests' }),
        } as unknown as Response;
      }

      // Coinbase fallback succeeds
      if (urlStr.includes('api.exchange.coinbase.com/products/BTC-USDT/ticker')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            price: '85000.50',
            bid: '85000.00',
            ask: '85001.00',
          }),
        } as unknown as Response;
      }

      if (urlStr.includes('api.exchange.coinbase.com/products/BTC-USDT/stats')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            open: '84000.00',
            high: '86000.00',
            low: '83500.00',
            volume: '1250.75',
          }),
        } as unknown as Response;
      }

      return { ok: false, status: 404 } as unknown as Response;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });
    const res = await request(app).get('/api/market/ticker');

    expect(res.status).toBe(200);
    expect(res.body.provider).toContain('Coinbase');
    expect(res.body.isFallback).toBe(true);
    expect(res.body.status).toBe('LIVE_FALLBACK');
    expect(res.body.price).toBe(85000.50);
  });

  it('returns 503 UNAVAILABLE when all providers fail', async () => {
    const mockFetch = async () => {
      return { ok: false, status: 503 } as unknown as Response;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });

    const resTicker = await request(app).get('/api/market/ticker');
    expect(resTicker.status).toBe(503);
    expect(resTicker.body.status).toBe('UNAVAILABLE');

    const resOrderbook = await request(app).get('/api/market/orderbook');
    expect(resOrderbook.status).toBe(503);
    expect(resOrderbook.body.status).toBe('UNAVAILABLE');
  });

  // ------------------------------------------------------------------------
  // 4. Request Timeouts (AbortError)
  // ------------------------------------------------------------------------
  it('handles request timeouts cleanly without hanging', async () => {
    const mockFetch = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });
    const res = await request(app).get('/api/market/ticker');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('UNAVAILABLE');
  });

  // ------------------------------------------------------------------------
  // 5. Non-Finite & Invalid Numeric Data Rejection
  // ------------------------------------------------------------------------
  it('rejects non-finite/NaN prices and never labels invalid data as LIVE', async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      // Binance returns corrupt data: NaN or null strings
      if (urlStr.includes('api.binance.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            lastPrice: 'NaN',
            highPrice: 'Infinity',
            lowPrice: '-100',
            volume: 'invalid',
            quoteVolume: 'null',
          }),
        } as unknown as Response;
      }
      // Coinbase also fails
      return { ok: false, status: 500 } as unknown as Response;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });
    const res = await request(app).get('/api/market/ticker');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('UNAVAILABLE');
    expect(res.body.status).not.toBe('LIVE');
  });

  it('filters out corrupt candles and returns 503 if zero valid candles exist', async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => [
          // Corrupt candle items (NaN values, high < low)
          [1700000000000, 'NaN', '100', '110', '90', '10'],
          [1700003600000, '100', '90', '110', '100', '10'], // high < low!
        ],
      } as unknown as Response;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });
    const res = await request(app).get('/api/market/candles?interval=1h');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('UNAVAILABLE');
  });

  // ------------------------------------------------------------------------
  // 6. Missing Funding Rate & Derivatives Isolation
  // ------------------------------------------------------------------------
  it('marks derivatives as unavailable when funding rate endpoint is empty or fails', async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('fapi.binance.com')) {
        // Return 404 / unavailable
        return { ok: false, status: 404 } as unknown as Response;
      }
      return { ok: false, status: 500 } as unknown as Response;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });
    const res = await request(app).get('/api/market/derivatives');

    expect(res.status).toBe(200);
    expect(res.body.isAvailable).toBe(false);
    expect(res.body.provider).toBe('Unavailable');
    expect(res.body.fundingRate8h).toBeNull();
    expect(res.body.openInterestBtc).toBeNull();
    expect(res.body.interpretation).toContain('unavailable');
  });

  // ------------------------------------------------------------------------
  // 7. Happy Path: Valid Live Data Delivery
  // ------------------------------------------------------------------------
  it('delivers valid parsed live market ticker and orderbook', async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/ticker/24hr')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            symbol: 'BTCUSDT',
            lastPrice: '82000.50',
            priceChange: '1500.00',
            priceChangePercent: '1.86',
            highPrice: '83500.00',
            lowPrice: '80200.00',
            volume: '15200.5',
            quoteVolume: '1246441000',
            bidPrice: '82000.00',
            askPrice: '82001.00',
            openPrice: '80500.50',
            count: 450000,
          }),
        } as unknown as Response;
      }

      if (urlStr.includes('/depth')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            bids: [
              ['82000.00', '1.5'],
              ['81995.00', '2.0'],
            ],
            asks: [
              ['82001.00', '1.2'],
              ['82005.00', '3.0'],
            ],
          }),
        } as unknown as Response;
      }

      return { ok: false, status: 404 } as unknown as Response;
    };

    const app = createApp({ fetchFn: mockFetch as any, enableCache: false });

    // Test Ticker
    const resTicker = await request(app).get('/api/market/ticker');
    expect(resTicker.status).toBe(200);
    expect(resTicker.body.status).toBe('LIVE');
    expect(resTicker.body.price).toBe(82000.50);
    expect(resTicker.body.high24h).toBe(83500.00);

    // Test Orderbook
    const resOrderbook = await request(app).get('/api/market/orderbook');
    expect(resOrderbook.status).toBe(200);
    expect(resOrderbook.body.status).toBe('LIVE');
    expect(resOrderbook.body.bestBid).toBe(82000.00);
    expect(resOrderbook.body.bestAsk).toBe(82001.00);
    expect(resOrderbook.body.spread).toBeCloseTo(1.00, 2);
  });
});
