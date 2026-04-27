import { describe, expect, it } from 'vitest';
import { runDeterministicAudit } from '../../src/market-research/domain/audit';
import { createSignalRunId, isSignalRunIdString } from '../../src/market-research/domain/signal-run';
import { assessDataQuality } from '../../src/market-research/domain/data-quality';
import type { Candle } from '../../src/market-research/domain/market-data';

describe('market-research: deterministic audit', () => {
  it('rejects when fewer than 2 bars', () => {
    const rid = createSignalRunId();
    const c: Candle[] = [
      { ts: '2026-01-10T00:00:00.000Z', open: 1, high: 1.1, low: 0.9, close: 1 },
    ];
    const q = assessDataQuality(c, { asOf: Date.parse('2026-01-11T00:00:00Z') });
    const a = runDeterministicAudit({ runId: rid, symbol: 'A', dataQuality: q });
    expect(a.verdict).toBe('rejected');
    expect(a.reasons[0]!).toMatch(/insufficient/i);
  });

  it('rejects when data is stale', () => {
    const rid = createSignalRunId();
    const c: Candle[] = [
      { ts: '2020-01-01T00:00:00.000Z', open: 1, high: 1, low: 1, close: 1 },
      { ts: '2020-01-02T00:00:00.000Z', open: 1, high: 1, low: 1, close: 1 },
    ];
    const q = assessDataQuality(c, { asOf: Date.parse('2026-01-10T00:00:00Z'), maxBarAgeMs: 7 * 86_400_000 });
    const a = runDeterministicAudit({ runId: rid, symbol: 'B', dataQuality: q });
    expect(a.verdict).toBe('rejected');
    expect(a.reasons[0]!).toMatch(/stale/i);
  });

  it('approves fresh series of 2+ bars with no gaps and passes runId through', () => {
    const rid = createSignalRunId();
    expect(isSignalRunIdString(rid)).toBe(true);
    const c: Candle[] = [
      { ts: '2026-01-10T00:00:00.000Z', open: 1, high: 1, low: 1, close: 1 },
      { ts: '2026-01-11T00:00:00.000Z', open: 1, high: 1, low: 1, close: 1 },
    ];
    const q = assessDataQuality(c, { asOf: Date.parse('2026-01-12T00:00:00.000Z') });
    const a = runDeterministicAudit({ runId: rid, symbol: 'C', dataQuality: q });
    expect(a.verdict).toBe('approved');
    expect(a.runId).toBe(rid);
  });
});
