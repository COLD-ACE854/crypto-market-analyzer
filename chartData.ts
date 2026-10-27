import type { CandlestickData, HistogramData, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../lib/types';

export const COLORS = {
  up: '#2ebd85', down: '#f6465d', forming: '#8b949e',
  upVol: 'rgba(46,189,133,0.40)', downVol: 'rgba(246,69,93,0.40)', formingVol: 'rgba(139,148,158,0.30)',
};
/** Closed candles use the series colours; the forming candle is grey with a hollow-looking body so it reads as "not final". */
export function toCandlePoint(c: Candle): CandlestickData {
  const p = { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close };
  return c.closed ? p : { ...p, color: 'rgba(139,148,158,0.20)', borderColor: COLORS.forming, wickColor: COLORS.forming };
}
export function toVolumePoint(c: Candle): HistogramData {
  const color = !c.closed ? COLORS.formingVol : c.close >= c.open ? COLORS.upVol : COLORS.downVol;
  return { time: c.time as UTCTimestamp, value: c.volume, color };
}
