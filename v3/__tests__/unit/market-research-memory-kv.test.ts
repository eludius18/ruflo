import { describe, expect, it, vi } from 'vitest';
import { MemoryKeyValueStore } from '../../src/market-research/infrastructure/MemoryKeyValueStore';

describe('market-research: MemoryKeyValueStore', () => {
  it('set then get', async () => {
    const mem = {
      getByKey: vi.fn(),
      storeEntry: vi.fn().mockResolvedValue({ id: 'e1' }),
      update: vi.fn(),
    };
    mem.getByKey.mockResolvedValueOnce(null);
    const kv = new MemoryKeyValueStore(mem, 'ns1');
    await kv.set('k1', 'v1');
    expect(mem.storeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'ns1', key: 'k1', content: 'v1' }),
    );
    mem.getByKey.mockResolvedValueOnce({ id: 'e1', content: 'v1' });
    expect(await kv.get('k1')).toBe('v1');
  });

  it('set updates when entry exists', async () => {
    const mem = {
      getByKey: vi.fn(),
      storeEntry: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    };
    mem.getByKey.mockResolvedValue({ id: 'e2', content: 'old' });
    const kv = new MemoryKeyValueStore(mem, 'ns');
    await kv.set('k', 'new');
    expect(mem.update).toHaveBeenCalledWith('e2', { content: 'new' });
    expect(mem.storeEntry).not.toHaveBeenCalled();
  });
});
