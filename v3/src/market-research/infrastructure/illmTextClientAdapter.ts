import type { LlmTextClient, LlmTextRequest, LlmTextResult } from './llm-complete-port';

/**
 * Duck-typed bridge for `@claude-flow/providers` `ILLMProvider` (or any object with the same `initialize` + `complete`).
 * Avoids a hard import of provider types in this module.
 */
export function createLlmTextClientFromIllmProvider(provider: {
  initialize(): Promise<void>;
  complete(request: unknown): Promise<{ content: string; model?: string }>;
}): LlmTextClient {
  return {
    ensureReady: () => provider.initialize(),
    complete: async (req: LlmTextRequest): Promise<LlmTextResult> => {
      const res = await provider.complete(req);
      return { content: res.content ?? '' };
    },
  };
}
