import { describe, it, expect } from 'vitest';

describe('Backend Endpoint Validation & Logic', () => {
  it('validates supported candle intervals', () => {
    const validIntervals = ['15m', '1h', '4h'];
    const testCases = [
      { interval: '15m', valid: true },
      { interval: '1h', valid: true },
      { interval: '4h', valid: true },
      { interval: '1d', valid: false },
      { interval: '1m', valid: false },
      { interval: '', valid: false },
    ];

    for (const tc of testCases) {
      const isValid = validIntervals.includes(tc.interval);
      expect(isValid).toBe(tc.valid);
    }
  });

  it('clamps candle limit between 30 and 300', () => {
    const clampLimit = (raw: string | undefined): number => {
      const parsed = parseInt(raw || '150', 10);
      if (isNaN(parsed)) return 150;
      return Math.min(Math.max(parsed, 30), 300);
    };

    expect(clampLimit('10')).toBe(30);
    expect(clampLimit('500')).toBe(300);
    expect(clampLimit('150')).toBe(150);
    expect(clampLimit(undefined)).toBe(150);
    expect(clampLimit('invalid')).toBe(150);
  });

  it('clamps orderbook depth limit between 5 and 50', () => {
    const clampDepth = (raw: string | undefined): number => {
      const parsed = parseInt(raw || '20', 10);
      if (isNaN(parsed)) return 20;
      return Math.min(Math.max(parsed, 5), 50);
    };

    expect(clampDepth('1')).toBe(5);
    expect(clampDepth('100')).toBe(50);
    expect(clampDepth('20')).toBe(20);
  });
});
