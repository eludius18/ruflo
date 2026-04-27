import { describe, expect, it } from 'vitest';
import { runMarketResearch } from '../../src/market-research/application/MarketResearchPipeline';
import { InMemoryMarketDataProvider } from '../../src/market-research/infrastructure/InMemoryMarketDataProvider';
import { isSignalRunIdString } from '../../src/market-research/domain/signal-run';

describe('market-research: runMarketResearch pipeline', () => {
  it('produces meta + one report per instrument with in-memory data', async () => {
    const data = new InMemoryMarketDataProvider();
    const { meta, reports } = await runMarketResearch({
      instruments: [{ symbol: 'VWCE.L' }, { symbol: 'CSPX.AS' }],
      data,
      candleLimit: 3,
    });
    expect(isSignalRunIdString(meta.runId)).toBe(true);
    expect(meta.instruments).toHaveLength(2);
    expect(reports).toHaveLength(2);
    expect(reports[0]!.symbol).toBe('VWCE.L');
    expect(reports[1]!.symbol).toBe('CSPX.AS');
    for (const r of reports) {
      expect(r.runId).toBe(meta.runId);
      expect(r.summary).toContain('3 bars');
      expect(r.evidenceRefs[0]).toMatch(/^synthetic:\/\/candles\//);
      expect(r.disclaimer).toMatch(/not investment advice/i);
    }
  });

  it('empty instruments yields empty reports', async () => {
    const { reports, meta } = await runMarketResearch({
      instruments: [],
      data: new InMemoryMarketDataProvider(),
    });
    expect(reports).toEqual([]);
    expect(isSignalRunIdString(meta.runId)).toBe(true);
  });
});
