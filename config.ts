/** Add a pair by appending one line here. `symbol` must be a Binance spot symbol. */
export interface Pair { symbol: string; label: string }
export const PAIRS: Pair[] = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
];
export const DEFAULT_PAIR = PAIRS[0];

export type TimeframeId = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export interface Timeframe { id: TimeframeId; label: string; seconds: number }
export const TIMEFRAMES: Timeframe[] = [
  { id: '1m', label: '1m', seconds: 60 }, { id: '5m', label: '5m', seconds: 300 },
  { id: '15m', label: '15m', seconds: 900 }, { id: '1h', label: '1h', seconds: 3600 },
  { id: '4h', label: '4h', seconds: 14400 }, { id: '1d', label: '1d', seconds: 86400 },
];
export const DEFAULT_TIMEFRAME = TIMEFRAMES[3];

export const HISTORY_LIMIT = 500;   // candles loaded per pair/timeframe
export const POLL_MS = 5000;        // refresh interval (well under Binance public limits)
export const ERROR_RETRY_MS = 10000;
export const STALE_AFTER_MS = 20000; // no successful update for this long => "Stale"
