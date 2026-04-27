/**
 * Minimal string→string storage for `JsonKeyValueRunRecordStore` (tests, Redis, file, MemoryService adapter).
 */
export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

/**
 * In-memory implementation for dev/tests.
 */
export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly m = new Map<string, string>();
  async get(key: string): Promise<string | undefined> {
    return this.m.get(key);
  }
  async set(key: string, value: string): Promise<void> {
    this.m.set(key, value);
  }
}
