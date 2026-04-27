import { describe, expect, it } from 'vitest';
import { runMarketResearch } from '../../src/market-research/application/MarketResearchPipeline';
import { InMemoryMarketDataProvider } from '../../src/market-research/infrastructure/InMemoryMarketDataProvider';
import { renderMarketResearchRunMd } from '../../src/market-research/application/renderRunMarkdown';
import { InMemoryRunRecordStore } from '../../src/market-research/infrastructure/InMemoryRunRecordStore';

describe('market-research: render + run record store', () => {
  it('renderMarketResearchRunMd includes run id, ranking, and per-symbol sections', async () => {
    const result = await runMarketResearch({
      instruments: [{ symbol: 'AAA' }, { symbol: 'ZZZ' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 3,
    });
    const md = renderMarketResearchRunMd(result);
    expect(md).toMatch(/^# Market research run\n/m);
    expect(md).toContain(result.meta.runId);
    expect(md).toContain('## Ranking');
    expect(md).toContain('AAA');
    expect(md).toContain('ZZZ');
    expect(md).toMatch(/## AAA/);
  });

  it('InMemoryRunRecordStore put/getByRunId roundtrips', async () => {
    const result = await runMarketResearch({
      instruments: [{ symbol: 'K' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 2,
    });
    const store = new InMemoryRunRecordStore();
    await store.put(result);
    const out = await store.getByRunId(result.meta.runId);
    expect(out).toBeDefined();
    expect(out!.meta.runId).toBe(result.meta.runId);
    expect(out!.items).toHaveLength(1);
    expect(out!.items[0]!.instrument.symbol).toBe('K');
  });
});
