import { describe, expect, it } from 'vitest';
import { runMarketResearch } from '../../src/market-research/application/MarketResearchPipeline';
import { InMemoryMarketDataProvider } from '../../src/market-research/infrastructure/InMemoryMarketDataProvider';
import { isSignalRunIdString } from '../../src/market-research/domain/signal-run';
import { ShortHintResearchNarration } from '../../src/market-research/application/llm-ports';

describe('market-research: runMarketResearch pipeline', () => {
  it('produces meta, items, reports, ranking, score and audit in-memory', async () => {
    const data = new InMemoryMarketDataProvider();
    const { meta, items, reports, ranking } = await runMarketResearch({
      instruments: [{ symbol: 'VWCE.L' }, { symbol: 'CSPX.AS' }],
      data,
      candleLimit: 3,
    });
    expect(isSignalRunIdString(meta.runId)).toBe(true);
    expect(meta.instruments).toHaveLength(2);
    expect(items).toHaveLength(2);
    expect(reports).toHaveLength(2);
    expect(ranking).toHaveLength(2);
    expect(reports[0]!.summary).toContain('3 bars');
    expect(reports[0]!.summary).toMatch(/Deterministic score/);
    expect(reports[0]!.summary).toMatch(/Audit: approved/);
    expect(new Set(ranking.map((r) => r.symbol)).size).toBe(2);
    expect(ranking[0]!.rank).toBe(1);
    for (const r of items) {
      expect(r.audit.runId).toBe(meta.runId);
      expect(r.report.runId).toBe(meta.runId);
      expect(r.dataQuality.barCount).toBe(3);
    }
  });

  it('empty instruments yields empty vectors', async () => {
    const { reports, items, meta, ranking } = await runMarketResearch({
      instruments: [],
      data: new InMemoryMarketDataProvider(),
    });
    expect(reports).toEqual([]);
    expect(items).toEqual([]);
    expect(ranking).toEqual([]);
    expect(isSignalRunIdString(meta.runId)).toBe(true);
  });

  it('rejects audit with insufficient bars when limit is 1', async () => {
    const { items } = await runMarketResearch({
      instruments: [{ symbol: 'X' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 1,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.audit.verdict).toBe('rejected');
    expect(items[0]!.report.summary).toMatch(/Audit: rejected/);
  });

  it('optional ShortHint narrators port appends a hint paragraph', async () => {
    const { reports } = await runMarketResearch({
      instruments: [{ symbol: 'Z' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 3,
      narration: new ShortHintResearchNarration(),
    });
    expect(reports[0]!.summary).toMatch(/wiring an LLM|grounding/);
  });
});
