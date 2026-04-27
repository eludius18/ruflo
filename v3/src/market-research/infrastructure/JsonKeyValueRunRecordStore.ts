import type { RunRecordStore } from '../application/run-record-ports';
import type { KeyValueStore } from '../application/kv-ports';
import type { RunMarketResearchResult } from '../application/MarketResearchPipeline';

export interface JsonKeyValueRunRecordStoreOptions {
  store: KeyValueStore;
  /** e.g. `market-research/runs` (no leading slash) */
  keyPrefix: string;
}

/**
 * Persists `RunMarketResearchResult` as JSON. Swap `KeyValueStore` for a MemoryService-backed implementation later.
 */
export class JsonKeyValueRunRecordStore implements RunRecordStore {
  private readonly store: KeyValueStore;
  private readonly prefix: string;
  constructor(opts: JsonKeyValueRunRecordStoreOptions) {
    this.store = opts.store;
    this.prefix = opts.keyPrefix.replace(/\/$/, '');
  }

  async put(result: RunMarketResearchResult): Promise<void> {
    const key = `${this.prefix}/${result.meta.runId}`;
    await this.store.set(key, JSON.stringify(result));
  }

  async getByRunId(runId: string): Promise<RunMarketResearchResult | undefined> {
    const key = `${this.prefix}/${runId}`;
    const raw = await this.store.get(key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as RunMarketResearchResult;
    } catch {
      return undefined;
    }
  }
}
