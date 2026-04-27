import { describe, expect, it } from 'vitest';
import {
  createSignalRunId,
  isSignalRunIdString,
} from '../../src/market-research/domain/signal-run';
import { startMarketResearchPlaceholder } from '../../src/market-research/application/placeholder';

describe('market-research: SignalRunId', () => {
  it('createSignalRunId returns a v4-like UUID', () => {
    const id = createSignalRunId();
    expect(isSignalRunIdString(id)).toBe(true);
  });

  it('placeholder run registers instruments', () => {
    const meta = startMarketResearchPlaceholder({
      instruments: [{ symbol: 'VWCE.L' }],
    });
    expect(isSignalRunIdString(meta.runId)).toBe(true);
    expect(meta.instruments).toHaveLength(1);
    expect(meta.instruments[0]!.symbol).toBe('VWCE.L');
  });
});
