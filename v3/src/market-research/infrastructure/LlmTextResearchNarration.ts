import type { ResearchNarrationPort } from '../application/llm-ports';
import type { MarketInstrument, OpportunityReport } from '../domain/types';
import type { OpportunityScore } from '../domain/scoring';
import type { LlmTextClient } from './llm-complete-port';

const DEFAULT_SYSTEM = `You are a research assistant for a non-trading, informational market scan.
Rules: (1) Do not suggest buying or selling; no personal advice. (2) Be consistent with the numeric
facts the user will supply; if you add hypotheses, label them as hypotheses. (3) 2-4 short sentences, plain text, no lists unless essential.`;

export interface LlmTextResearchNarrationOptions {
  client: LlmTextClient;
  /** @default 600 */
  maxOutputChars?: number;
  systemPrompt?: string;
}

/**
 * ADR-011: inject any `LlmTextClient` (often backed by ILLMProvider) for narrative add-ons.
 */
export class LlmTextResearchNarration implements ResearchNarrationPort {
  private readonly client: LlmTextClient;
  private readonly maxOut: number;
  private readonly system: string;
  constructor(opts: LlmTextResearchNarrationOptions) {
    this.client = opts.client;
    this.maxOut = opts.maxOutputChars ?? 600;
    this.system = opts.systemPrompt ?? DEFAULT_SYSTEM;
  }

  async addNarrativeContext(input: {
    instrument: MarketInstrument;
    report: OpportunityReport;
    score: OpportunityScore;
  }): Promise<string> {
    await this.client.ensureReady();
    const facts = [
      `Symbol: ${input.instrument.symbol}`,
      `Deterministic score (0-100): ${input.score.value.toFixed(2)}`,
      `Factors: ${input.score.factors.map((f) => `${f.id}=${f.value}(${f.label})`).join('; ')}`,
      `Report summary: ${input.report.summary}`,
    ].join('\n');
    const { content } = await this.client.complete({
      messages: [
        { role: 'system', content: this.system },
        {
          role: 'user',
          content: `Given these facts, add a brief, grounded commentary (no new numbers):\n\n${facts}`,
        },
      ],
      maxTokens: 256,
      temperature: 0.2,
    });
    const t = (content ?? '').trim().slice(0, this.maxOut);
    return t;
  }
}
