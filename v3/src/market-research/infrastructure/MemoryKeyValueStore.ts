import type { UnifiedMemoryService } from '@claude-flow/memory';
import type { KeyValueStore } from '../application/kv-ports';

/**
 * Adapts `UnifiedMemoryService` to `KeyValueStore` (string value = entry content).
 * Call `memory.initialize()` once before use (e.g. right after creating the service).
 * Namespace isolates this store from other memory use (e.g. `market-research` / `agents`).
 */
export class MemoryKeyValueStore implements KeyValueStore {
  constructor(
    private readonly memory: Pick<UnifiedMemoryService, 'getByKey' | 'storeEntry' | 'update'>,
    private readonly namespace: string,
  ) {}

  async get(key: string): Promise<string | undefined> {
    const entry = await this.memory.getByKey(this.namespace, key);
    if (!entry) return undefined;
    return entry.content;
  }

  async set(key: string, value: string): Promise<void> {
    const existing = await this.memory.getByKey(this.namespace, key);
    if (existing) {
      await this.memory.update(existing.id, { content: value });
    } else {
      await this.memory.storeEntry({
        namespace: this.namespace,
        key,
        content: value,
        type: 'cache',
      });
    }
  }
}
