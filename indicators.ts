/** All functions return arrays aligned to input; NaN where not enough history. Only past values are used (no look-ahead). */
import type { Candle } from './types';
export function ema(v: number[], p: number): number[] {
  const out = v.map(() => NaN); if (v.length < p) return out;
  const k = 2 / (p + 1); let prev = v.slice(0, p).reduce((a, b) => a + b, 0) / p; out[p - 1] = prev;
  for (let i = p; i < v.length; i++) { prev = v[i] * k + prev * (1 - k); out[i] = prev; }
  return out;
}
/** Wilder-smoothed RSI. */
export function rsi(v: number[], p = 14): number[] {
  const out = v.map(() => NaN); if (v.length <= p) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = v[i] - v[i - 1]; d >= 0 ? (g += d) : (l -= d); }
  g /= p; l /= p; out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = p + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1]; g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
export function macd(v: number[], f = 12, s = 26, sig = 9) {
  const ef = ema(v, f), es = ema(v, s), line = v.map((_, i) => ef[i] - es[i]);
  const start = line.findIndex(x => !isNaN(x)); const signal = v.map(() => NaN);
  if (start >= 0) ema(line.slice(start), sig).forEach((x, i) => (signal[start + i] = x));
  return { line, signal, hist: line.map((x, i) => x - signal[i]) };
}
/** Swing = high (low) strictly greater (lower) than `n` candles on each side. Confirmed only n candles later. */
export function swings(c: Candle[], n = 3) {
  const highs: number[] = [], lows: number[] = [];
  for (let i = n; i < c.length - n; i++) {
    const w = c.slice(i - n, i + n + 1);
    if (w.every((x, j) => j === n || x.high < c[i].high)) highs.push(c[i].high);
    if (w.every((x, j) => j === n || x.low > c[i].low)) lows.push(c[i].low);
  }
  return { highs, lows };
}
/** Estimated S/R zones: swing prices within `tol` (fraction) of each other are clustered; zone = min..max of cluster. */
export function zones(prices: number[], tol = 0.005) {
  const s = [...prices].sort((a, b) => a - b), out: { low: number; high: number; touches: number }[] = [];
  for (const p of s) { const z = out[out.length - 1];
    if (z && p <= z.high * (1 + tol)) { z.high = p; z.touches++; } else out.push({ low: p, high: p, touches: 1 }); }
  return out;
}
export const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
