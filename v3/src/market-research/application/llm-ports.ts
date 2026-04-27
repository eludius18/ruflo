import type { MarketInstrument, OpportunityReport } from '../domain/types';
import type { OpportunityScore } from '../domain/scoring';

/**
 * Pluggable text layer. Production wiring: adapt from `@claude-flow/providers` (ADR-011);
 * the domain only sees this small surface.
 */
export interface ResearchNarrationPort {
  /**
   * Optional second paragraph: grounded by caller (facts passed in), no live trading claims.
   * @returns Extra text, or empty string. Implementations may call an LLM with strict system prompt.
   */
  addNarrativeContext(input: {
    instrument: MarketInstrument;
    report: OpportunityReport;
    score: OpportunityScore;
  }): Promise<string>;
}

/**
 * No remote calls; useful for headless tests and local runs.
 */
export class NoOpResearchNarration implements ResearchNarrationPort {
  async addNarrativeContext(): Promise<string> {
    return '';
  }
}

/**
 * One-line non-LLM addendum so UX shows something when a narrators port is set.
 */
export class ShortHintResearchNarration implements ResearchNarrationPort {
  async addNarrativeContext(input: {
    instrument: MarketInstrument;
    report: OpportunityReport;
    score: OpportunityScore;
  }): Promise<string> {
    if (input.score.factors[0]?.label === 'insufficient_bars') {
      return 'Hint: more history improves scoring reliability.';
    }
    return 'Hint: when wiring an LLM, use ResearchNarrationPort with fact-grounding only (see docs/trading-llm-and-repo-strategy).';
  }
}
