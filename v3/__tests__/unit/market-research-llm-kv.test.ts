import { describe, expect, it, vi } from 'vitest';
import { runMarketResearch } from '../../src/market-research/application/MarketResearchPipeline';
import { InMemoryMarketDataProvider } from '../../src/market-research/infrastructure/InMemoryMarketDataProvider';
import { InMemoryKeyValueStore } from '../../src/market-research/application/kv-ports';
import { JsonKeyValueRunRecordStore } from '../../src/market-research/infrastructure/JsonKeyValueRunRecordStore';
import { LlmTextResearchNarration } from '../../src/market-research/infrastructure/LlmTextResearchNarration';
import { createLlmTextClientFromIllmProvider } from '../../src/market-research/infrastructure/illmTextClientAdapter';
import { CallbackResearchNarration } from '../../src/market-research/application/CallbackResearchNarration';

describe('JsonKeyValueRunRecordStore', () => {
  it('roundtrips JSON against InMemoryKeyValueStore', async () => {
    const kv = new InMemoryKeyValueStore();
    const store = new JsonKeyValueRunRecordStore({ store: kv, keyPrefix: 'mr/test' });
    const r = await runMarketResearch({
      instruments: [{ symbol: 'Z' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 2,
    });
    await store.put(r);
    const out = await store.getByRunId(r.meta.runId);
    expect(out).toBeDefined();
    expect(out!.meta.runId).toBe(r.meta.runId);
    expect(out!.items[0]!.instrument.symbol).toBe('Z');
  });

  it('getByRunId returns undefined for corrupt JSON', async () => {
    const kv: import('../../src/market-research/application/kv-ports').KeyValueStore = {
      get: async (k) => (k === 'mr/x/bad' ? '{ not json' : undefined),
      set: async () => {},
    };
    const store = new JsonKeyValueRunRecordStore({ store: kv, keyPrefix: 'mr/x' });
    expect(await store.getByRunId('bad')).toBeUndefined();
  });
});

describe('LlmTextResearchNarration', () => {
  it('calls client with system+user and trims output', async () => {
    const complete = vi.fn().mockResolvedValue({ content: '  Analytical note.  ' });
    const init = vi.fn().mockResolvedValue(undefined);
    const client = { ensureReady: init, complete };
    const narr = new LlmTextResearchNarration({ client, maxOutputChars: 50 });
    const { items } = await runMarketResearch({
      instruments: [{ symbol: 'Q' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 2,
    });
    const b = items[0]!;
    const extra = await narr.addNarrativeContext({
      instrument: b.instrument,
      report: b.report,
      score: b.score,
    });
    expect(complete).toHaveBeenCalled();
    expect(complete.mock.calls[0]![0].messages[0]!.role).toBe('system');
    expect(init).toHaveBeenCalled();
    expect(extra).toBe('Analytical note.');
  });
});

describe('createLlmTextClientFromIllmProvider', () => {
  it('forwards to initialize and complete', async () => {
    const provider = {
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue({ content: 'ok' }),
    };
    const c = createLlmTextClientFromIllmProvider(provider);
    await c.ensureReady();
    const r = await c.complete({ messages: [{ role: 'user', content: 'h' }] });
    expect(r.content).toBe('ok');
    expect(provider.initialize).toHaveBeenCalled();
    expect(provider.complete).toHaveBeenCalled();
  });
});

describe('CallbackResearchNarration (pipeline smoke)', () => {
  it('injects string from callback', async () => {
    const { reports } = await runMarketResearch({
      instruments: [{ symbol: 'CB' }],
      data: new InMemoryMarketDataProvider(),
      candleLimit: 2,
      narration: new CallbackResearchNarration(() => 'from-callback'),
    });
    expect(reports[0]!.summary).toMatch(/from-callback/);
  });
});
