import { describe, it, expect } from 'vitest';
import { ema, rsi, macd } from './indicators';
import { planTrade } from './risk';
import { assess } from './signal';
import type { Candle } from './types';
const mk = (cl: number[], closed = true): Candle[] => cl.map((c, i) => ({ time: i, open: c, high: c + 1, low: c - 1, close: c, volume: 100, closed }));
describe('indicators', () => {
  it('EMA seeds with SMA and smooths', () => { const e = ema([1,2,3,4,5], 3); expect(e[1]).toBeNaN(); expect(e[2]).toBe(2); expect(e[3]).toBe(3); expect(e[4]).toBe(4); });
  it('RSI is 100 on pure gains and low on pure losses', () => {
    const up = Array.from({ length: 30 }, (_, i) => i + 1); expect(rsi(up)[29]).toBe(100);
    expect(rsi([...up].reverse())[29]).toBeCloseTo(0, 5); });
  it('MACD line = EMA12 - EMA26 and is NaN before 26 values', () => { const v = Array.from({ length: 60 }, (_, i) => i); const m = macd(v); expect(m.line[24]).toBeNaN(); expect(m.line[40]).toBeGreaterThan(0); });
});
describe('planTrade', () => {
  it('sizes a long so a stop-out loses the risk amount', () => {
    const r = planTrade({ balance: 1000, entry: 100, stop: 95, target: 110, riskPct: 1, feePct: 0.1 }) as any;
    expect(r.riskAmount).toBe(10); expect(r.size).toBe(2); expect(r.rr).toBe(2); expect(r.fees).toBeCloseTo(0.42, 5); expect(r.netProfit).toBeCloseTo(19.58, 5); });
  it('rejects bad inputs', () => {
    expect(planTrade({ balance: 1000, entry: 100, stop: 100, target: 110, riskPct: 1, feePct: 0.1 })).toHaveProperty('error');
    expect(planTrade({ balance: 1000, entry: 100, stop: 95, target: 90, riskPct: 1, feePct: 0.1 })).toHaveProperty('error');
    expect(planTrade({ balance: 100, entry: 100, stop: 99.9, target: 110, riskPct: 5, feePct: 0.1 })).toHaveProperty('error'); });
});
describe('assess', () => {
  it('waits on insufficient data and stale data', () => {
    expect(assess(mk([1, 2, 3])).verdict).toMatch(/Wait/); expect(assess(mk(Array(200).fill(5)), { stale: true }).verdict).toMatch(/Wait/); });
  it('ignores the forming candle', () => { const c = mk(Array.from({ length: 130 }, (_, i) => 100 + i)); c[129].closed = false; expect(assess(c).notes.length).toBeGreaterThan(0); });
  it('flat market is Wait', () => expect(assess(mk(Array(200).fill(100))).verdict).toMatch(/Wait/));
});
