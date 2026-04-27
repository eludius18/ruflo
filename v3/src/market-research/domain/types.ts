/**
 * Minimal domain types for the market-research context.
 * Extend as the pipeline (TA, risk, report) is implemented.
 */

import type { DataQuality } from './data-quality';
import type { OpportunityScore } from './scoring';
import type { SignalRunId } from './signal-run';
import type { SignalAudit } from './audit';

export type ISODateString = string;

/**
 * One instrument under analysis (MVP: simplified).
 */
export interface MarketInstrument {
  /** Exchange ticker, e.g. AAPL, VWCE.L */
  symbol: string;
  /** Optional ISIN for EU instruments */
  isin?: string;
  currency?: string;
}

/**
 * Outcome of an audit gate (synthesis → publish).
 */
export type AuditVerdict = 'pending' | 'approved' | 'rejected';

export interface MarketResearchRunMeta {
  runId: SignalRunId;
  createdAt: ISODateString;
  /** e.g. list of symbols scanned */
  instruments: MarketInstrument[];
}

/**
 * Placeholder for the final artefact; fields will be filled in by ReportWriter.
 */
export interface OpportunityReport {
  runId: SignalRunId;
  symbol: string;
  summary: string;
  /** References to evidence artifacts (ids, uris) — to be defined with storage */
  evidenceRefs: string[];
  riskNotes: string[];
  disclaimer: string;
}

/**
 * End-to-end artefact for one instrument in a run.
 */
export interface InstrumentResearchBundle {
  instrument: MarketInstrument;
  dataQuality: DataQuality;
  score: OpportunityScore;
  audit: SignalAudit;
  report: OpportunityReport;
}

/**
 * Per-run ranking: best (rank 1) = highest `score` value in this result set.
 */
export interface RankedOpportunity {
  symbol: string;
  /** 1 = best in this run */
  rank: number;
  /** Same scale as `OpportunityScore.value` (0–100) */
  score: number;
}
