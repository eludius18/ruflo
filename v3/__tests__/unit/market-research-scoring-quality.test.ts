import { describe, expect, it } from 'vitest';
import { assessDataQuality } from '../../src/market-research/domain/data-quality';
import { createSignalRunId, isSignalRunIdString } from '../../src/market-research/domain/signal-run';
import { scoreFromCandles } from '../../src/market-research/domain/scoring';
import type { Candle } from '../../src/market-research/domain/market-data';

const mkCandle = (day: string, o: number, c: number): Candle => ({
  ts: `${day}T00:00:00.000Z`,
  open: o,
  high: Math.max(o, c) + 0.5,
  low: Math.min(o, c) - 0.5,
  close: c,
  volume: 1e6,
});

describe('market-research: data quality', () => {
  it('empty series is stale and zero bars', () => {
    const q = assessDataQuality([], { asOf: Date.parse('2026-01-20T00:00:00Z') });
    expect(q.barCount).toBe(0);
    expect(q.isStale).toBe(true);
  });

  it('flags gap when a jump is >2 days (daily heuristics)', () => {
    const c: Candle[] = [
      mkCandle('2026-01-01', 100, 101),
      mkCandle('2026-01-10', 101, 99),
    ];
    const asOf = Date.parse('2026-01-11T00:00:00Z');
    const q = assessDataQuality(c, { asOf, maxBarAgeMs: 7 * 86_400_000 });
    expect(q.hasGaps).toBe(true);
    expect(q.isStale).toBe(false);
  });
});

describe('market-research: scoring', () => {
  it('rises when price trends up and produces bounded value', () => {
    const rid = createSignalRunId();
    const candles: Candle[] = [
      mkCandle('2026-01-01', 100, 100),
      mkCandle('2026-01-02', 100, 102),
      mkCandle('2026-01-03', 102, 105),
    ];
    const s = scoreFromCandles(rid, 'T.TEST', candles);
    expect(s.symbol).toBe('T.TEST');
    expect(s.value).toBeGreaterThan(50);
    expect(s.factors[0]!.id).toBe('return');
    expect(s.runId).toBe(rid);
  });

  it('returns 0 and minimal factors when <2 bars', () => {
    const rid = createSignalRunId();
    const s = scoreFromCandles(rid, 'X', [mkCandle('2026-01-01', 1, 1)]);
    expect(s.value).toBe(0);
    expect(s.factors[0]!.label).toBe('insufficient_bars');
  });

  it('createSignalRunId is valid', () => {
    expect(isSignalRunIdString(createSignalRunId())).toBe(true);
  });
});
