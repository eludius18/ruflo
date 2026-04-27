import type { SignalRunId } from './signal-run';
import type { DataQuality } from './data-quality';

/**
 * Outcome of the deterministic pre-publish gate.
 */
export interface SignalAudit {
  runId: SignalRunId;
  symbol: string;
  verdict: 'approved' | 'rejected';
  /** Human-auditable reasons. */
  reasons: string[];
}

/**
 * No LLM: automatic checks on structured inputs only. Stricter for insufficient/stale data.
 */
export function runDeterministicAudit(input: {
  runId: SignalRunId;
  symbol: string;
  dataQuality: DataQuality;
}): SignalAudit {
  const { runId, symbol, dataQuality } = input;
  const reasons: string[] = [];
  if (dataQuality.barCount < 2) {
    return {
      runId,
      symbol,
      verdict: 'rejected',
      reasons: ['insufficient_bars: need at least 2 to compute a return.'],
    };
  }
  if (dataQuality.isStale) {
    return {
      runId,
      symbol,
      verdict: 'rejected',
      reasons: ['stale_data: most recent bar too old for fresh scan.'],
    };
  }
  if (dataQuality.hasGaps) {
    reasons.push('data_gap: calendar gap between bars — verify feed continuity.');
  }
  reasons.push('deterministic checks passed; no order-execution path present in market-research.');
  return { runId, symbol, verdict: 'approved', reasons };
}
