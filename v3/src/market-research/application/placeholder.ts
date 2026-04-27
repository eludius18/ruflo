import { createSignalRunId, type SignalRunId } from '../domain/signal-run';
import type { MarketInstrument, MarketResearchRunMeta } from '../domain/types';

/**
 * Placeholder for future orchestration (workflow / swarm).
 * Exposes a stable contract for early integration tests and CLI wiring.
 */
export function startMarketResearchPlaceholder(input: {
  instruments: MarketInstrument[];
}): MarketResearchRunMeta {
  const runId: SignalRunId = createSignalRunId();
  return {
    runId,
    createdAt: new Date().toISOString(),
    instruments: input.instruments,
  };
}
