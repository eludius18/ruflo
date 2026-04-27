/**
 * Correlation id for a single market-research scan / pipeline run (audit + replay).
 * Branded type avoids accidental string mixing.
 */
export type SignalRunId = string & { readonly __brand: 'SignalRunId' };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @returns A new v4 UUID as SignalRunId (Node 20+ globalThis.crypto)
 */
export function createSignalRunId(): SignalRunId {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('createSignalRunId requires globalThis.crypto.randomUUID (Node 20+)');
  }
  return globalThis.crypto.randomUUID() as SignalRunId;
}

/**
 * @internal test helper — validates format without claiming cryptographic strength
 */
export function isSignalRunIdString(value: string): value is SignalRunId {
  return UUID_RE.test(value);
}
