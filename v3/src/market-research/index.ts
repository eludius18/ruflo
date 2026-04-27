/**
 * Market research — public surface for the bounded context
 */

export { createSignalRunId, isSignalRunIdString, type SignalRunId } from './domain/signal-run';
export type {
  AuditVerdict,
  ISODateString,
  MarketInstrument,
  MarketResearchRunMeta,
  OpportunityReport,
} from './domain/types';
export { startMarketResearchPlaceholder } from './application/placeholder';
