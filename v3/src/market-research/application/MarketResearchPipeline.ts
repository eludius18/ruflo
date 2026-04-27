import { createSignalRunId, type SignalRunId } from '../domain/signal-run';
import { assessDataQuality } from '../domain/data-quality';
import { scoreFromCandles } from '../domain/scoring';
import { runDeterministicAudit } from '../domain/audit';
import type {
  InstrumentResearchBundle,
  MarketInstrument,
  MarketResearchRunMeta,
  OpportunityReport,
  RankedOpportunity,
} from '../domain/types';
import type { MarketDataProvider } from './ports';
import { buildOpportunityReportFromCandles } from './buildOpportunityReport';
import type { ResearchNarrationPort } from './llm-ports';
import { NoOpResearchNarration } from './llm-ports';

function buildRanking(bundles: readonly InstrumentResearchBundle[]): RankedOpportunity[] {
  return [...bundles]
    .sort((a, b) => b.score.value - a.score.value)
    .map((b, i) => ({
      symbol: b.instrument.symbol,
      rank: i + 1,
      score: b.score.value,
    }));
}

export interface RunMarketResearchInput {
  instruments: MarketInstrument[];
  data: MarketDataProvider;
  /** Bars per symbol (capped by provider) */
  candleLimit?: number;
  /**
   * For deterministic stale checks; defaults to `Date.now()`. Tests may freeze.
   */
  asOfForQuality?: number;
  /**
   * Pluggable text layer; default is no network (ADR-011 wiring comes later).
   */
  narration?: ResearchNarrationPort;
}

export interface RunMarketResearchResult {
  meta: MarketResearchRunMeta;
  items: InstrumentResearchBundle[];
  /** Shorthand: `items[i].report` in order */
  reports: OpportunityReport[];
  /** Best (rank 1) = max score in this run. */
  ranking: RankedOpportunity[];
}

/**
 * Pipeline: data → quality → score → audit → report, optional `ResearchNarrationPort`.
 * No order execution, no real broker I/O.
 */
export async function runMarketResearch(
  input: RunMarketResearchInput,
): Promise<RunMarketResearchResult> {
  const runId: SignalRunId = createSignalRunId();
  const createdAt = new Date().toISOString();
  const limit = input.candleLimit ?? 5;
  const asOf = input.asOfForQuality ?? Date.now();
  const narr = input.narration ?? new NoOpResearchNarration();
  const items: InstrumentResearchBundle[] = [];
  for (const inst of input.instruments) {
    const candles = await input.data.getRecentCandles(inst.symbol, limit);
    const dataQuality = assessDataQuality(candles, { asOf, maxBarAgeMs: 14 * 86_400_000 });
    const score = scoreFromCandles(runId, inst.symbol, candles);
    const audit = runDeterministicAudit({ runId, symbol: inst.symbol, dataQuality });
    let report = buildOpportunityReportFromCandles(runId, inst, candles, { score, audit });
    const extra = await narr.addNarrativeContext({ instrument: inst, report, score });
    if (extra.trim().length) {
      report = { ...report, summary: `${report.summary}\n\n${extra.trim()}` };
    }
    items.push({ instrument: inst, dataQuality, score, audit, report });
  }
  const meta: MarketResearchRunMeta = {
    runId,
    createdAt,
    instruments: input.instruments,
  };
  return {
    meta,
    items,
    reports: items.map((b) => b.report),
    ranking: buildRanking(items),
  };
}
