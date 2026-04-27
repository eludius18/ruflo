import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileKeyValueStore, keyToSafeSegments } from '../../src/market-research/infrastructure/FileKeyValueStore';

describe('market-research: FileKeyValueStore', () => {
  it('round-trips nested keys', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mr-kv-'));
    try {
      const kv = new FileKeyValueStore(base);
      await kv.set('mr/runs/run-1', '{"a":1}');
      expect(await kv.get('mr/runs/run-1')).toBe('{"a":1}');
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('get returns undefined for missing key', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mr-kv-'));
    try {
      const kv = new FileKeyValueStore(base);
      expect(await kv.get('nope/nope')).toBeUndefined();
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('keyToSafeSegments drops unsafe parts', () => {
    expect(keyToSafeSegments('a/b/c')).toEqual(['a', 'b', 'c']);
    expect(keyToSafeSegments('/x/../y')).toEqual(['x', 'y']);
  });
});
