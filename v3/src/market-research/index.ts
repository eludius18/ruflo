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
export { CsvFileMarketDataProvider, type CsvFileMarketDataProviderOptions } from './infrastructure/CsvFileMarketDataProvider';
export { parseCandleCsvText } from './infrastructure/parseCandleCsv';
export { runMarketResearch, type RunMarketResearchInput, type RunMarketResearchResult } from './application/MarketResearchPipeline';
export { renderMarketResearchRunMd } from './application/renderRunMarkdown';
export type { RunRecordStore } from './application/run-record-ports';
export type { KeyValueStore } from './application/kv-ports';
export { InMemoryKeyValueStore } from './application/kv-ports';
export { JsonKeyValueRunRecordStore, type JsonKeyValueRunRecordStoreOptions } from './infrastructure/JsonKeyValueRunRecordStore';
export { InMemoryRunRecordStore } from './infrastructure/InMemoryRunRecordStore';
export { CallbackResearchNarration } from './application/CallbackResearchNarration';
export type { LlmTextClient, LlmTextRequest, LlmTextResult, ChatRole } from './infrastructure/llm-complete-port';
export { LlmTextResearchNarration, type LlmTextResearchNarrationOptions } from './infrastructure/LlmTextResearchNarration';
export { createLlmTextClientFromIllmProvider } from './infrastructure/illmTextClientAdapter';
export { buildOpportunityReportFromCandles, type BuildReportContext } from './application/buildOpportunityReport';
export {
  NoOpResearchNarration,
  ShortHintResearchNarration,
  type ResearchNarrationPort,
} from './application/llm-ports';
export { startMarketResearchPlaceholder } from './application/placeholder';
