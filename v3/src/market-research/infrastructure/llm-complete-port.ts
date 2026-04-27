/**
 * Smallest async surface to call a chat model (maps to ILLMProvider.complete in the app layer).
 * Keeps `market-research` free of a hard runtime dependency on built `@claude-flow/providers` dist.
 */
export type ChatRole = 'system' | 'user' | 'assistant';

export interface LlmTextRequest {
  messages: Array<{ role: ChatRole; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmTextResult {
  content: string;
}

/**
 * Pluggable completer. Wire an adapter from `@claude-flow/providers` in application bootstrap.
 */
export interface LlmTextClient {
  ensureReady(): Promise<void>;
  complete(req: LlmTextRequest): Promise<LlmTextResult>;
}
