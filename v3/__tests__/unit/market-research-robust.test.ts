import { describe, expect, it, vi, afterEach } from 'vitest';
import { InMemoryMarketDataProvider } from '../../src/market-research/infrastructure/InMemoryMarketDataProvider';
import { assessDataQuality } from '../../src/market-research/domain/data-quality';
import { createSignalRunId, isSignalRunIdString } from '../../src/market-research/domain/signal-run';
import { scoreFromCandles } from '../../src/market-research/domain/scoring';
import { runDeterministicAudit } from '../../src/market-research/domain/audit';
import { runMarketResearch } from '../../src/market-research/application/MarketResearchPipeline';
import type { RunMarketResearchResult } from '../../src/market-research/application/MarketResearchPipeline';
import { renderMarketResearchRunMd } from '../../src/market-research/application/renderRunMarkdown';
import { escapeForMarkdownInline } from '../../src/market-research/application/renderMarkdownUtil';
import { InMemoryRunRecordStore } from '../../src/market-research/infrastructure/InMemoryRunRecordStore';
import type { Candle } from '../../src/market-research/domain/market-data';
import { buildOpportunityReportFromCandles } from '../../src/market-research/application/buildOpportunityReport';

const day = (d: string, close: number): Candle => ({
  ts: `${d}T00:00:00.000Z`,
  open: close,
  high: close + 0.1,
  low: close - 0.1,
  close,
  volume: 1e6,
});

describe('InMemoryMarketDataProvider', () => {
  it('returns [] for limit 0; caps at 100 bars; preserves ascending time order (oldest first)', async () => {
    const p = new InMemoryMarketDataProvider();
    expect(await p.getRecentCandles('A', 0)).toEqual([]);
    const h = await p.getRecentCandles('A', 120);
    expect(h).toHaveLength(100);
    for (let i = 1; i < h.length; i++) {
      expect(new Date(h[i]!.ts).getTime()).toBeGreaterThanOrEqual(
        new Date(h[i - 1]!.ts).getTime(),
      );
    }
  });

  it('same symbol+limit yields the same series (deterministic across calls)', async () => {
    const p = new InMemoryMarketDataProvider();
    const a = await p.getRecentCandles('DETERM', 5);
    const b = await p.getRecentCandles('DETERM', 5);
    expect(a).toEqual(b);
  });
});

describe('assessDataQuality (boundaries)', () => {
  it('no gap for consecutive daily bars; gap when >2d between bars', () => {
    const ok = [day('2026-01-01', 1), day('2026-01-02', 1), day('2026-01-03', 1)];
    const asOf = Date.parse('2026-01-04T12:00:00Z');
    const q1 = assessDataQuality(ok, { asOf, maxBarAgeMs: 7 * 86_400_000 });
    expect(q1.hasGaps).toBe(false);
    expect(q1.isStale).toBe(false);
    const gap: Candle[] = [day('2026-01-01', 1), day('2026-01-05', 1)];
    expect(assessDataQuality(gap, { asOf, maxBarAgeMs: 365 * 86_400_000 }).hasGaps).toBe(true);
  });

  it('rangeToMeanClose is defined for 2+ bars with positive mean close', () => {
    const c: Candle[] = [day('2026-01-01', 10), day('2026-01-02', 11)];
    const q = assessDataQuality(c, { asOf: Date.parse('2026-01-10T00:00:00Z') });
    expect(q.rangeToMeanClose).toBeDefined();
    expect(q.rangeToMeanClose!).toBeGreaterThan(0);
  });
});

describe('scoreFromCandles (edge cases)', () => {
  it('when first close is 0, return factor is 0 (no division by first)', () => {
    const rid = createSignalRunId();
    const c: Candle[] = [
      { ts: '2026-01-01T00:00:00.000Z', open: 0, high: 0, low: 0, close: 0, volume: 1 },
      { ts: '2026-01-02T00:00:00.000Z', open: 0, high: 1, low: 0, close: 1, volume: 1 },
    ];
    const s = scoreFromCandles(rid, 'Z', c);
    expect(s.factors[0]!.value).toBe(0);
    expect(s.value).toBeGreaterThanOrEqual(0);
  });

  it('stronger uptrend scores higher than comparable downtrend', () => {
    const rid = createSignalRunId();
    const up: Candle[] = [day('2026-01-01', 100), day('2026-01-02', 100), day('2026-01-03', 120)];
    const down: Candle[] = [day('2026-01-01', 100), day('2026-01-02', 100), day('2026-01-03', 80)];
    expect(scoreFromCandles(rid, 'U', up).value).toBeGreaterThan(
      scoreFromCandles(rid, 'D', down).value,
    );
  });
});

describe('runDeterministicAudit', () => {
  it('approves with a gap warning when 2+ bars, fresh, but hasGaps', () => {
    const rid = createSignalRunId();
    expect(isSignalRunIdString(rid)).toBe(true);
    const a = runDeterministicAudit({
      runId: rid,
      symbol: 'G',
      dataQuality: { barCount: 2, hasGaps: true, isStale: false },
    });
    expect(a.verdict).toBe('approved');
    expect(a.reasons.some((r) => r.includes('data_gap'))).toBe(true);
  });
});

describe('buildOpportunityReportFromCandles (context wiring)', () => {
  it('injects score and audit when context provided', () => {
    const rid = createSignalRunId();
    const inst = { symbol: 'S' };
    const c: Candle[] = [day('2026-01-01', 1), day('2026-01-02', 1)];
    const score = {
      symbol: 'S',
      runId: rid,
      value: 42,
      factors: [{ id: 'return', value: 0, label: 'l' }],
    };
    const audit = { runId: rid, symbol: 'S', verdict: 'rejected' as const, reasons: [] as string[] };
    const r = buildOpportunityReportFromCandles(rid, inst, c, { score, audit });
    expect(r.summary).toMatch(/42/);
    expect(r.summary).toMatch(/rejected/);
  });
});

describe('runMarketResearch (integration invariants)', () => {
  it('ranking is non-increasing by score (best first)', async () => {
    const { ranking } = await runMarketResearch({
      instruments: [{ symbol: 'A' }, { symbol: 'B' }, { symbol: 'C' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 8,
    });
    expect(ranking).toHaveLength(3);
    for (let i = 0; i < ranking.length - 1; i++) {
      expect(ranking[i]!.score + 1e-9).toBeGreaterThanOrEqual(ranking[i + 1]!.score);
    }
  });

  it('marks data stale and rejects audit when asOf is far in the future vs recent bars', async () => {
    const { items } = await runMarketResearch({
      instruments: [{ symbol: 'ST' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 5,
      asOfForQuality: new Date('2040-01-01T00:00:00.000Z').getTime(),
    });
    expect(items[0]!.dataQuality.isStale).toBe(true);
    expect(items[0]!.audit.verdict).toBe('rejected');
  });

  it('markdown export contains escaped pipe in symbol and remains parse-friendly', async () => {
    const r = await runMarketResearch({
      instruments: [{ symbol: 'A|B' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 2,
    });
    const md = renderMarketResearchRunMd(r);
    const esc = escapeForMarkdownInline('A|B');
    expect(esc).toMatch(/\\\|/);
    expect(md).toContain(esc);
  });
});

describe('escapeForMarkdownInline', () => {
  it('removes newlines; escapes backslashes and pipes in order', () => {
    const e = escapeForMarkdownInline('a|b\nc\\');
    expect(e).not.toMatch(/\n/);
    expect(e).toMatch(/\\\|/);
  });
});

describe('InMemoryRunRecordStore (cloning & overwrite)', () => {
  it('returns undefined for missing runId; get returns a deep clone; put overwrites by runId', async () => {
    const store = new InMemoryRunRecordStore();
    expect(await store.getByRunId('not-there')).toBeUndefined();

    const r1 = await runMarketResearch({
      instruments: [{ symbol: 'C' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 2,
    });
    await store.put(r1);
    const a = await store.getByRunId(r1.meta.runId);
    expect(a).toBeDefined();
    a!.items[0]!.instrument.symbol = 'MUT';
    const b = await store.getByRunId(r1.meta.runId);
    expect(b!.items[0]!.instrument.symbol).toBe('C');

    const r2 = await runMarketResearch({
      instruments: [{ symbol: 'D' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 2,
    });
    const over: RunMarketResearchResult = {
      ...r2,
      meta: { ...r2.meta, runId: r1.meta.runId },
    };
    await store.put(over);
    const c = await store.getByRunId(r1.meta.runId);
    expect(c!.items[0]!.instrument.symbol).toBe('D');
  });
});

describe('createSignalRunId (guard)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws if globalThis.crypto.randomUUID is not a function', () => {
    const fake = { randomUUID: 42 };
    vi.stubGlobal('crypto', fake as unknown as Crypto);
    expect(() => createSignalRunId()).toThrow(/randomUUID/);
  });
});

describe('concurrent getRecentCandles', () => {
  it('parallel same-params calls return equal arrays (time frozen — Date.now() otherwise races by 1ms)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
    try {
      const p = new InMemoryMarketDataProvider();
      const [a, b, c] = await Promise.all([
        p.getRecentCandles('C', 4),
        p.getRecentCandles('C', 4),
        p.getRecentCandles('C', 4),
      ]);
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    } finally {
      vi.useRealTimers();
    }
  });
});
