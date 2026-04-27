import type { SignalRunId } from '../domain/signal-run';
import type { Candle } from '../domain/market-data';
import type { OpportunityScore } from '../domain/scoring';
import type { SignalAudit } from '../domain/audit';
import type { MarketInstrument, OpportunityReport } from '../domain/types';

const DISCLAIMER =
  'Informational research only. Not investment advice. No live trading or order execution.';

export interface BuildReportContext {
  score?: OpportunityScore;
  audit?: SignalAudit;
}

/**
 * Composes a report from in-domain data (mock-friendly) plus optional score/audit lines.
 */
export function buildOpportunityReportFromCandles(
  runId: SignalRunId,
  instrument: MarketInstrument,
  candles: Candle[],
  context?: BuildReportContext,
): OpportunityReport {
  const last = candles[candles.length - 1];
  const first = candles[0];
  let summary =
    candles.length === 0
      ? `No bar data for ${instrument.symbol}.`
      : `Mock research run: ${instrument.symbol} — ${candles.length} bars, ` +
        `last close ${last?.close.toFixed(4) ?? 'n/a'} (from open ${first?.open.toFixed(4) ?? 'n/a'}).`;
  if (context?.score) {
    summary += ` Deterministic score (0–100): ${context.score.value.toFixed(1)}.`;
  }
  if (context?.audit) {
    summary += ` Audit: ${context.audit.verdict}.`;
  }
  const evidenceRefs = [
    `synthetic://candles/${runId}/${encodeURIComponent(instrument.symbol)}/raw`,
  ];
  if (context?.audit) {
    evidenceRefs.push(`synthetic://audit/${runId}/${encodeURIComponent(instrument.symbol)}`);
  }
  const riskNotes: string[] = [];
  if (candles.length) {
    riskNotes.push('Data may be synthetic or from a test provider; validate with a real source before any decision.');
  } else {
    riskNotes.push('No price series — cannot assess volatility or drawdown.');
  }
  if (context?.audit?.verdict === 'rejected') {
    riskNotes.push('This candidate did not pass the deterministic pre-publish gate.');
  }
  return {
    runId,
    symbol: instrument.symbol,
    summary,
    evidenceRefs,
    riskNotes,
    disclaimer: DISCLAIMER,
  };
}
