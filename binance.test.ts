import { describe, it, expect, vi } from 'vitest';
import { classifyStatus, describeError, fetchKlines, mergeCandles, MarketDataError, parseKlines, parseTicker } from './binance';
import { toCandlePoint, toVolumePoint, COLORS } from '../chart/chartData';
import type { Candle } from '../lib/types';

const k = (t: number, o: string, h: string, l: string, c: string, v: string, ct: number) => [t, o, h, l, c, v, ct, '0', 0, '0', '0', '0'];
const cd = (time: number, close = 1, closed = true): Candle => ({ time, open: 1, high: 2, low: 0.5, close, volume: 1, closed });

describe('parseKlines', () => {
  it('converts types, sorts, dedupes (later wins), drops invalid rows, flags the forming candle', () => {
    const raw = [k(2_000_000, '1', '2', '1', '1.5', '10', 2_999_999), k(1_000_000, '1', '2', '1', '1.2', '5', 1_999_999),
      k(1_000_000, '1', '2', '1', '1.7', '6', 1_999_999), k(3_000_000, '1', '0.5', '2', '1', '1', 3_999_999), ['bad']];
    const out = parseKlines(raw, 2_500_000);
    expect(out.map(c => c.time)).toEqual([1000, 2000]);
    expect(out[0].close).toBe(1.7); expect(out[0].closed).toBe(true); expect(out[1].closed).toBe(false);
  });
  it('throws on non-lists and on lists with no valid rows', () => {
    expect(() => parseKlines({})).toThrow(MarketDataError);
    expect(() => parseKlines([['x']])).toThrow(MarketDataError);
    expect(parseKlines([])).toEqual([]);
  });
});
describe('mergeCandles', () => {
  it('replaces the forming candle, appends new ones, never duplicates', () => {
    const out = mergeCandles([cd(1), cd(2, 1, false)], [cd(2, 9, true), cd(3, 1, false)]);
    expect(out.map(c => c.time)).toEqual([1, 2, 3]); expect(out[1].close).toBe(9); expect(out[1].closed).toBe(true);
  });
});
describe('parseTicker', () => {
  it('parses valid and rejects invalid data', () => {
    const t = parseTicker({ lastPrice: '100.5', priceChangePercent: '-1.2', highPrice: '110', lowPrice: '99', volume: '5', quoteVolume: '500' });
    expect(t.price).toBe(100.5); expect(t.changePct).toBe(-1.2);
    expect(() => parseTicker({ lastPrice: 'abc' })).toThrow(MarketDataError);
    expect(() => parseTicker(null)).toThrow(MarketDataError);
  });
});
describe('errors', () => {
  it('classifies rate limits with Retry-After', () => {
    const e = classifyStatus(429, '30'); expect(e.kind).toBe('rate_limit'); expect(e.retryAfterMs).toBe(30_000);
    expect(classifyStatus(418, null).retryAfterMs).toBe(300_000); expect(classifyStatus(451, null).kind).toBe('blocked'); expect(classifyStatus(500, null).kind).toBe('http');
    expect(describeError(e)).toContain('30s');
  });
  it('fetchKlines surfaces network failure, 429 and empty results instead of inventing data', async () => {
    await expect(fetchKlines('BTCUSDT', '1h', 5, undefined, vi.fn().mockRejectedValue(new TypeError('x')))).rejects.toMatchObject({ kind: 'network' });
    await expect(fetchKlines('BTCUSDT', '1h', 5, undefined, vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '7' } })))).rejects.toMatchObject({ kind: 'rate_limit', retryAfterMs: 7000 });
    await expect(fetchKlines('BTCUSDT', '1h', 5, undefined, vi.fn().mockResolvedValue(new Response('[]')))).rejects.toMatchObject({ kind: 'empty' });
  });
});
describe('chart data', () => {
  it('styles forming candles differently from closed ones', () => {
    expect(toCandlePoint(cd(1, 1, true))).not.toHaveProperty('color');
    expect(toCandlePoint(cd(1, 1, false))).toHaveProperty('borderColor', COLORS.forming);
    expect(toVolumePoint(cd(1, 1, false)).color).toBe(COLORS.formingVol);
    expect(toVolumePoint({ ...cd(1), close: 3 }).color).toBe(COLORS.upVol);
  });
});
