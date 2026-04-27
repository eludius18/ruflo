import { createSignalRunId, type SignalRunId } from '../domain/signal-run';
import type { MarketInstrument, MarketResearchRunMeta, OpportunityReport } from '../domain/types';
import type { MarketDataProvider } from './ports';
import { buildOpportunityReportFromCandles } from './buildOpportunityReport';

export interface RunMarketResearchInput {
  instruments: MarketInstrument[];
  data: MarketDataProvider;
  /** Bars per symbol (capped by provider) */
  candleLimit?: number;
}

export interface RunMarketResearchResult {
  meta: MarketResearchRunMeta;
  reports: OpportunityReport[];
}

/**
 * First vertical slice: one runId, per-symbol candle fetch, mock-structured report.
 * No external APIs, no LLM — I/O is entirely behind `MarketDataProvider`.
 */
export async function runMarketResearch(
  input: RunMarketResearchInput,
): Promise<RunMarketResearchResult> {
  const runId: SignalRunId = createSignalRunId();
  const createdAt = new Date().toISOString();
  const limit = input.candleLimit ?? 5;
  const reports: OpportunityReport[] = [];
  for (const inst of input.instruments) {
    const candles = await input.data.getRecentCandles(inst.symbol, limit);
    reports.push(buildOpportunityReportFromCandles(runId, inst, candles));
  }
  const meta: MarketResearchRunMeta = {
    runId,
    createdAt,
    instruments: input.instruments,
  };
  return { meta, reports };
}
