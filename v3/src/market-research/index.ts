/**
 * Market research — public surface for the bounded context
 */

export { createSignalRunId, isSignalRunIdString, type SignalRunId } from './domain/signal-run';
export { assessDataQuality, type DataQuality, type AssessDataQualityOptions } from './domain/data-quality';
export { scoreFromCandles, type OpportunityScore, type ScoreFactor } from './domain/scoring';
export type { Candle, PriceSnapshot } from './domain/market-data';
export type {
  AuditVerdict,
  ISODateString,
  MarketInstrument,
  MarketResearchRunMeta,
  OpportunityReport,
} from './domain/types';
export type { MarketDataProvider } from './application/ports';
export { InMemoryMarketDataProvider } from './infrastructure/InMemoryMarketDataProvider';
export { runMarketResearch, type RunMarketResearchInput, type RunMarketResearchResult } from './application/MarketResearchPipeline';
export { buildOpportunityReportFromCandles } from './application/buildOpportunityReport';
export { startMarketResearchPlaceholder } from './application/placeholder';
