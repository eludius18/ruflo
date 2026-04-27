import type { SignalRunId } from '../domain/signal-run';
import type { Candle } from '../domain/market-data';
import type { MarketInstrument, OpportunityReport } from '../domain/types';

const DISCLAIMER =
  'Informational research only. Not investment advice. No live trading or order execution.';

/**
 * Composes a minimal report from in-domain data (mock-friendly).
 */
export function buildOpportunityReportFromCandles(
  runId: SignalRunId,
  instrument: MarketInstrument,
  candles: Candle[],
): OpportunityReport {
  const last = candles[candles.length - 1];
  const first = candles[0];
  const summary =
    candles.length === 0
      ? `No bar data for ${instrument.symbol}.`
      : `Mock research run: ${instrument.symbol} — ${candles.length} bars, ` +
        `last close ${last?.close.toFixed(4) ?? 'n/a'} (from open ${first?.open.toFixed(4) ?? 'n/a'}).`;
  return {
    runId,
    symbol: instrument.symbol,
    summary,
    evidenceRefs: [`synthetic://candles/${runId}/${encodeURIComponent(instrument.symbol)}/raw`],
    riskNotes: candles.length
      ? ['Data are synthetic; validate against a real source before any decision.']
      : ['No price series — cannot assess volatility or drawdown.'],
    disclaimer: DISCLAIMER,
  };
}
