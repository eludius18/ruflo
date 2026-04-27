import type { RunRecordStore } from '../application/run-record-ports';
import type { RunMarketResearchResult } from '../application/MarketResearchPipeline';

/**
 * In-process snapshot; processes restart clears. Replace with `MemoryService` in prod.
 */
export class InMemoryRunRecordStore implements RunRecordStore {
  private readonly byRunId = new Map<string, RunMarketResearchResult>();

  async put(result: RunMarketResearchResult): Promise<void> {
    this.byRunId.set(result.meta.runId, this.clone(result));
  }

  async getByRunId(runId: string): Promise<RunMarketResearchResult | undefined> {
    const v = this.byRunId.get(runId);
    return v ? this.clone(v) : undefined;
  }

  private clone(result: RunMarketResearchResult): RunMarketResearchResult {
    if (typeof structuredClone === 'function') {
      return structuredClone(result) as RunMarketResearchResult;
    }
    return JSON.parse(JSON.stringify(result)) as RunMarketResearchResult;
  }
}
