/**
 * Minimal domain types for the market-research context.
 * Extend as the pipeline (TA, risk, report) is implemented.
 */

import type { SignalRunId } from './signal-run';

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
