import type { Candle } from './types';
import { ema, rsi, macd, swings, zones, avg } from './indicators';
export type Verdict = 'Potential Bullish Setup' | 'Potential Bearish Setup' | 'Wait / No Clear Setup';
export interface Assessment { verdict: Verdict; score: number; supporting: string[]; contradicting: string[]; notes: string[] }
export const MIN_CANDLES = 120;
/** Heuristic score: each factor gives +1 (bullish) / -1 (bearish) / 0. Score = sum (range -5..5). Not a probability.
 *  Bullish/Bearish needs |score| >= 3 AND no more than 1 opposing factor. Else Wait. Uses completed candles only. */
export function assess(all: Candle[], opts: { stale?: boolean } = {}): Assessment {
  const wait = (n: string): Assessment => ({ verdict: 'Wait / No Clear Setup', score: 0, supporting: [], contradicting: [], notes: [n] });
  const c = all.filter(x => x.closed);
  if (opts.stale) return wait('Data is stale; no assessment made.');
  if (c.length < MIN_CANDLES) return wait(`Need ${MIN_CANDLES} completed candles; have ${c.length}.`);
  const cl = c.map(x => x.close), last = c.length - 1, price = cl[last];
  const e20 = ema(cl, 20), e50 = ema(cl, 50), r = rsi(cl, 14), m = macd(cl);
  const f: { s: number; t: string }[] = [];
  f.push(e20[last] > e50[last] ? { s: 1, t: 'EMA20 is above EMA50 (uptrend)' } : { s: -1, t: 'EMA20 is below EMA50 (downtrend)' });
  f.push(r[last] >= 50 && r[last] < 70 ? { s: 1, t: `RSI ${r[last].toFixed(0)}: bullish momentum, not overbought` }
    : r[last] <= 50 && r[last] > 30 ? { s: -1, t: `RSI ${r[last].toFixed(0)}: bearish momentum, not oversold` }
    : { s: 0, t: `RSI ${r[last].toFixed(0)}: stretched (over 70 or under 30); reversal risk` });
  f.push(m.hist[last] > 0 && m.hist[last] >= m.hist[last - 1] ? { s: 1, t: 'MACD histogram positive and rising' }
    : m.hist[last] < 0 && m.hist[last] <= m.hist[last - 1] ? { s: -1, t: 'MACD histogram negative and falling' } : { s: 0, t: 'MACD momentum is fading or mixed' });
  const sw = swings(c.slice(-100)), z = zones([...sw.highs, ...sw.lows]);
  const near = z.find(q => price >= q.low * 0.997 && price <= q.high * 1.003);
  f.push(near ? { s: 0, t: 'Price is inside an estimated support/resistance zone; wait for a break or rejection' }
    : { s: price > e50[last] ? 1 : -1, t: `Price is ${price > e50[last] ? 'above' : 'below'} EMA50 and clear of estimated zones` });
  const vr = c[last].volume / avg(c.slice(-21, -1).map(x => x.volume));
  f.push(vr > 1.2 ? { s: price >= c[last].open ? 1 : -1, t: `Volume ${vr.toFixed(1)}x average, backing the last candle's direction` } : { s: 0, t: `Volume ${vr.toFixed(1)}x average: no strong participation` });
  const score = f.reduce((a, b) => a + b.s, 0), pos = f.filter(x => x.s > 0).length, neg = f.filter(x => x.s < 0).length;
  const verdict: Verdict = score >= 3 && neg <= 1 ? 'Potential Bullish Setup' : score <= -3 && pos <= 1 ? 'Potential Bearish Setup' : 'Wait / No Clear Setup';
  const dir = verdict.includes('Bull') ? 1 : verdict.includes('Bear') ? -1 : 0;
  return { verdict, score,
    supporting: f.filter(x => dir && x.s === dir || !dir && x.s !== 0 && Math.sign(x.s) === Math.sign(score)).map(x => x.t),
    contradicting: f.filter(x => x.s !== 0 && dir && x.s === -dir || !dir && x.s !== 0 && Math.sign(x.s) !== Math.sign(score)).map(x => x.t),
    notes: ['Heuristic score, not a probability. A potential setup is never a guaranteed profit.'] };
}
