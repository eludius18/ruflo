import type { Candle } from './market-data';

export interface DataQuality {
  barCount: number;
  /** True if calendar gaps are detected between consecutive bars (daily ≈ 1d). */
  hasGaps: boolean;
  /** True if the last bar is older than the configured window from `asOf`. */
  isStale: boolean;
  /**
   * Simple range volatility proxy: (max high − min low) / mean(close), when bars exist.
   * Used for risk flags, not a formal annualized vol.
   */
  rangeToMeanClose?: number;
}

export interface AssessDataQualityOptions {
  /**
   * Reference "now" for stale checks (tests may freeze time).
   * @default Date.now()
   */
  asOf?: number;
  /**
   * Max age of the most recent bar for the series to be considered current.
   * @default 14 days
   */
  maxBarAgeMs?: number;
}

/**
 * Heuristic data-quality assessment for a sorted OHLCV series (oldest → newest).
 * Deterministic; no I/O.
 */
export function assessDataQuality(
  candles: readonly Candle[],
  options?: AssessDataQualityOptions,
): DataQuality {
  const asOf = options?.asOf ?? Date.now();
  const maxBarAgeMs = options?.maxBarAgeMs ?? 14 * 86_400_000;
  const n = candles.length;
  if (n === 0) {
    return { barCount: 0, hasGaps: false, isStale: true };
  }
  const last = new Date(candles[n - 1]!.ts).getTime();
  const isStale = asOf - last > maxBarAgeMs;
  let hasGaps = false;
  const oneDay = 86_400_000;
  const twoDays = 2 * oneDay;
  for (let i = 1; i < n; i++) {
    const a = new Date(candles[i - 1]!.ts).getTime();
    const b = new Date(candles[i]!.ts).getTime();
    if (b > a + twoDays) {
      hasGaps = true;
      break;
    }
  }
  if (n === 1) {
    return { barCount: 1, hasGaps, isStale, rangeToMeanClose: 0 };
  }
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const maxH = Math.max(...highs);
  const minL = Math.min(...lows);
  const meanC = closes.reduce((s, x) => s + x, 0) / closes.length;
  const rangeToMeanClose = meanC > 0 ? (maxH - minL) / meanC : undefined;
  return { barCount: n, hasGaps, isStale, rangeToMeanClose };
}
