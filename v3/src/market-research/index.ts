/**
 * Market research — public surface for the bounded context
 */

export { createSignalRunId, isSignalRunIdString, type SignalRunId } from './domain/signal-run';
export { assessDataQuality, type DataQuality, type AssessDataQualityOptions } from './domain/data-quality';
export { scoreFromCandles, type OpportunityScore, type ScoreFactor } from './domain/scoring';
export type { Candle, PriceSnapshot } from './domain/market-data';
export { runDeterministicAudit, type SignalAudit } from './domain/audit';
export type {
  AuditVerdict,
  InstrumentResearchBundle,
  ISODateString,
  MarketInstrument,
  MarketResearchRunMeta,
  OpportunityReport,
  RankedOpportunity,
} from './domain/types';
export type { MarketDataProvider } from './application/ports';
export { InMemoryMarketDataProvider } from './infrastructure/InMemoryMarketDataProvider';
export { runMarketResearch, type RunMarketResearchInput, type RunMarketResearchResult } from './application/MarketResearchPipeline';
export { buildOpportunityReportFromCandles, type BuildReportContext } from './application/buildOpportunityReport';
export {
  NoOpResearchNarration,
  ShortHintResearchNarration,
  type ResearchNarrationPort,
} from './application/llm-ports';
export { startMarketResearchPlaceholder } from './application/placeholder';
