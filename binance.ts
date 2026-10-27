import type { Candle } from '../lib/types';

export type ErrorKind = 'network' | 'timeout' | 'rate_limit' | 'blocked' | 'http' | 'invalid' | 'empty';
export class MarketDataError extends Error {
  constructor(public kind: ErrorKind, message: string, public retryAfterMs?: number, public status?: number) {
    super(message); this.name = 'MarketDataError';
  }
}
/** Public market-data hosts only. No API key, no private endpoints. */
export const BASES = ['https://data-api.binance.vision', 'https://api.binance.com'];
export const REQUEST_TIMEOUT_MS = 10000;

export interface Ticker { price: number; changePct: number; high: number; low: number; volumeBase: number; volumeQuote: number }

export function classifyStatus(status: number, retryAfter: string | null): MarketDataError {
  const secs = retryAfter ? Number(retryAfter) : NaN;
  const ms = Number.isFinite(secs) && secs > 0 ? secs * 1000 : undefined;
  if (status === 429) return new MarketDataError('rate_limit', 'Rate limited by Binance (HTTP 429)', ms ?? 60_000, status);
  if (status === 418) return new MarketDataError('rate_limit', 'Temporarily blocked by Binance for too many requests (HTTP 418)', ms ?? 300_000, status);
  if (status === 451 || status === 403) return new MarketDataError('blocked', `Binance refused this network or region (HTTP ${status})`, undefined, status);
  return new MarketDataError('http', `Binance returned HTTP ${status}`, undefined, status);
}

export function describeError(e: MarketDataError): string {
  const secs = e.retryAfterMs ? Math.ceil(e.retryAfterMs / 1000) : 0;
  switch (e.kind) {
    case 'rate_limit': return `Binance is rate-limiting requests. Retrying in about ${secs}s.`;
    case 'blocked': return 'Binance market data is not available from this network or region. Try another connection or VPN-free network.';
    case 'timeout': return 'Binance took too long to respond. Retrying automatically.';
    case 'network': return 'Cannot reach Binance. Check your internet connection. Retrying automatically.';
    case 'empty': return 'Binance returned no candles for this pair and timeframe.';
    case 'invalid': return 'Binance returned data in an unexpected format, so it was not used.';
    default: return `${e.message}. Retrying automatically.`;
  }
}

type FetchLike = typeof fetch;
const defaultFetch: FetchLike = (...a) => fetch(...a);

async function requestOnce(base: string, path: string, params: Record<string, string>, signal: AbortSignal | undefined, f: FetchLike): Promise<unknown> {
  const url = `${base}${path}?${new URLSearchParams(params)}`;
  const ctrl = new AbortController(); let timedOut = false;
  const onAbort = () => ctrl.abort(); signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const res = await f(url, { signal: ctrl.signal });
    if (!res.ok) throw classifyStatus(res.status, res.headers.get('Retry-After'));
    return await res.json();
  } catch (e) {
    if (e instanceof MarketDataError) throw e;
    if (signal?.aborted) throw e; // caller cancelled: not an API error
    if (timedOut) throw new MarketDataError('timeout', 'Request timed out');
    if (e instanceof SyntaxError) throw new MarketDataError('invalid', 'Unreadable response');
    throw new MarketDataError('network', 'Network request failed');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}

/** Tries each host in order; rate-limit and invalid-data errors stop immediately (retrying elsewhere would not help). */
export async function getJson(path: string, params: Record<string, string>, signal?: AbortSignal, f: FetchLike = defaultFetch): Promise<unknown> {
  let last: unknown;
  for (const base of BASES) {
    try { return await requestOnce(base, path, params, signal, f); }
    catch (e) {
      last = e;
      if (signal?.aborted) throw e;
      if (e instanceof MarketDataError && (e.kind === 'rate_limit' || e.kind === 'invalid')) throw e;
    }
  }
  throw last;
}

/** Kline row: [openTime ms, open, high, low, close, volume, closeTime ms, ...]. Output: ascending, unique, `time` in UTC seconds.
 *  A candle is `closed` only if its close time has passed on this device's clock (small clock skew can mislabel one candle). */
export function parseKlines(raw: unknown, now = Date.now()): Candle[] {
  if (!Array.isArray(raw)) throw new MarketDataError('invalid', 'Klines response is not a list');
  const byTime = new Map<number, Candle>();
  for (const r of raw) {
    if (!Array.isArray(r) || r.length < 7) continue;
    const time = Math.floor(Number(r[0]) / 1000);
    const [open, high, low, close, volume, closeMs] = [r[1], r[2], r[3], r[4], r[5], r[6]].map(Number);
    if (![time, open, high, low, close, volume, closeMs].every(Number.isFinite)) continue;
    if (time <= 0 || open <= 0 || low <= 0 || volume < 0) continue;
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) continue;
    byTime.set(time, { time, open, high, low, close, volume, closed: closeMs <= now }); // later duplicate wins
  }
  const out = [...byTime.values()].sort((a, b) => a.time - b.time);
  if (raw.length > 0 && out.length === 0) throw new MarketDataError('invalid', 'No valid candles in response');
  return out;
}

/** Merge fresh candles into existing ones by timestamp: replaces the forming candle, appends new ones, never duplicates. */
export function mergeCandles(base: Candle[], incoming: Candle[], max = 1000): Candle[] {
  const m = new Map<number, Candle>();
  for (const c of base) m.set(c.time, c);
  for (const c of incoming) m.set(c.time, c);
  const out = [...m.values()].sort((a, b) => a.time - b.time);
  return out.length > max ? out.slice(out.length - max) : out;
}

export function parseTicker(raw: unknown): Ticker {
  if (typeof raw !== 'object' || raw === null) throw new MarketDataError('invalid', 'Ticker response is not an object');
  const r = raw as Record<string, unknown>; const n = (k: string) => Number(r[k]);
  const t: Ticker = { price: n('lastPrice'), changePct: n('priceChangePercent'), high: n('highPrice'), low: n('lowPrice'), volumeBase: n('volume'), volumeQuote: n('quoteVolume') };
  if (!Object.values(t).every(Number.isFinite) || t.price <= 0) throw new MarketDataError('invalid', 'Ticker contains invalid numbers');
  return t;
}

export async function fetchKlines(symbol: string, interval: string, limit: number, signal?: AbortSignal, f?: FetchLike, now?: number): Promise<Candle[]> {
  const raw = await getJson('/api/v3/klines', { symbol, interval, limit: String(limit) }, signal, f);
  const candles = parseKlines(raw, now);
  if (candles.length === 0) throw new MarketDataError('empty', 'No candles returned');
  return candles;
}
export async function fetchTicker(symbol: string, signal?: AbortSignal, f?: FetchLike): Promise<Ticker> {
  return parseTicker(await getJson('/api/v3/ticker/24hr', { symbol }, signal, f));
}
