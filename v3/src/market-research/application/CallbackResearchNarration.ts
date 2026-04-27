import type { ResearchNarrationPort } from './llm-ports';
import type { MarketInstrument, OpportunityReport } from '../domain/types';
import type { OpportunityScore } from '../domain/scoring';

/**
 * Injects a test double or a thin custom completion without pulling `@claude-flow/providers`.
 */
export class CallbackResearchNarration implements ResearchNarrationPort {
  constructor(
    private readonly fn: (input: {
      instrument: MarketInstrument;
      report: OpportunityReport;
      score: OpportunityScore;
    }) => Promise<string> | string,
  ) {}

  async addNarrativeContext(input: {
    instrument: MarketInstrument;
    report: OpportunityReport;
    score: OpportunityScore;
  }): Promise<string> {
    const s = await this.fn(input);
    return typeof s === 'string' ? s : '';
  }
}
