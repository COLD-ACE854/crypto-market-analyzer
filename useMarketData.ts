import { useEffect, useState } from 'react';
import type { Candle } from '../lib/types';
import { fetchKlines, fetchTicker, mergeCandles, MarketDataError, type Ticker } from '../data/binance';
import { ERROR_RETRY_MS, HISTORY_LIMIT, POLL_MS, STALE_AFTER_MS, type Timeframe } from '../data/config';

export interface MarketState {
  key: string; // `${symbol}:${timeframe}` this data belongs to
  status: 'loading' | 'live' | 'error';
  candles: Candle[]; ticker: Ticker | null; error: MarketDataError | null; lastUpdate: number | null;
}
const blank = (key: string): MarketState => ({ key, status: 'loading', candles: [], ticker: null, error: null, lastUpdate: null });

/** Loads history once per pair/timeframe, then polls the latest candles and merges them by timestamp.
 *  On failure the last good data is kept (never replaced with invented values) and the error is exposed. */
export function useMarketData(symbol: string, tf: Timeframe) {
  const key = `${symbol}:${tf.id}`;
  const [state, setState] = useState<MarketState>(() => blank(''));
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let candles: Candle[] = [];
    setState(blank(key));

    const run = async () => {
      let delay = POLL_MS;
      try {
        const [fresh, ticker] = await Promise.all([
          fetchKlines(symbol, tf.id, candles.length ? 5 : HISTORY_LIMIT, ac.signal),
          fetchTicker(symbol, ac.signal),
        ]);
        let next = fresh;
        if (candles.length && fresh[0].time - candles[candles.length - 1].time > tf.seconds) {
          next = await fetchKlines(symbol, tf.id, HISTORY_LIMIT, ac.signal); // gap (e.g. tab was asleep): reload
          candles = [];
        }
        candles = candles.length ? mergeCandles(candles, next) : next;
        if (ac.signal.aborted) return;
        setState({ key, status: 'live', candles, ticker, error: null, lastUpdate: Date.now() });
      } catch (e) {
        if (ac.signal.aborted) return;
        const err = e instanceof MarketDataError ? e : new MarketDataError('network', 'Unexpected error');
        delay = err.retryAfterMs ?? ERROR_RETRY_MS;
        setState(s => ({ ...s, status: 'error', error: err }));
      }
      if (!ac.signal.aborted) timer = setTimeout(run, delay);
    };
    run();
    return () => { ac.abort(); clearTimeout(timer); };
  }, [symbol, tf.id, tf.seconds, key]);

  const stale = state.lastUpdate !== null && now - state.lastUpdate > STALE_AFTER_MS;
  return { ...state, stale };
}
