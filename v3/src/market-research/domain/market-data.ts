import type { ISODateString } from './types';

/**
 * Single OHLCV bar (daily or intraday).
 */
export interface Candle {
  ts: ISODateString;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Point-in-time quote (optional future use).
 */
export interface PriceSnapshot {
  symbol: string;
  ts: ISODateString;
  mid: number;
  currency?: string;
}
