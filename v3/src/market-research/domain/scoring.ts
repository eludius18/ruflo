import type { SignalRunId } from './signal-run';
import type { Candle } from './market-data';

/**
 * Decomposed sub-scores (deterministic, auditable).
 */
export interface ScoreFactor {
  id: string;
  /** Value in a stable band for the factor; interpretation depends on id. */
  value: number;
  label: string;
}

/**
 * Summary score for an instrument in one run.
 */
export interface OpportunityScore {
  symbol: string;
  runId: SignalRunId;
  /** 0 (weak) – 100 (strong) — MVP: linear map from return + vol penalty */
  value: number;
  factors: ScoreFactor[];
}

function clamp100(x: number): number {
  if (x <= 0) return 0;
  if (x >= 100) return 100;
  return x;
}

/**
 * Simple momentum + mild volatility penalty from a sorted candle series.
 * If fewer than 2 bars, value is 0 and one factor documents insufficiency.
 */
export function scoreFromCandles(
  runId: SignalRunId,
  symbol: string,
  candles: readonly Candle[],
): OpportunityScore {
  if (candles.length < 2) {
    return {
      symbol,
      runId,
      value: 0,
      factors: [
        { id: 'return', value: 0, label: 'insufficient_bars' },
        { id: 'vol', value: 0, label: 'na' },
      ],
    };
  }
  const first = Number(candles[0]!.close);
  const last = Number(candles[candles.length - 1]!.close);
  let ret = first !== 0 && Number.isFinite(first) ? (last - first) / Math.abs(first) : 0;
  if (!Number.isFinite(ret)) {
    ret = 0;
  }
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const maxH = Math.max(...highs);
  const minL = Math.min(...lows);
  const range = maxH - minL;
  const meanC = candles.reduce((s, c) => s + c.close, 0) / candles.length;
  const vol = meanC > 0 ? range / meanC : 0;
  // Map return ~[-0.2,0.2] to contribution; cap vol impact
  const retScore = 50 + ret * 150;
  const volPenalty = Math.min(20, vol * 40);
  const value = clamp100(retScore - volPenalty);
  return {
    symbol,
    runId,
    value,
    factors: [
      { id: 'return', value: ret, label: 'first_to_last' },
      { id: 'vol', value: vol, label: 'range_over_mean_close' },
    ],
  };
}
