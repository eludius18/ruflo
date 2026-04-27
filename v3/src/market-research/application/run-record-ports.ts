import type { RunMarketResearchResult } from './MarketResearchPipeline';

/**
 * Persistence boundary for a completed scan. Production: MemoryService (ADR-006) or plugin.
 * Tests and local: `InMemoryRunRecordStore`.
 */
export interface RunRecordStore {
  put(result: RunMarketResearchResult): Promise<void>;
  getByRunId(runId: string): Promise<RunMarketResearchResult | undefined>;
}
