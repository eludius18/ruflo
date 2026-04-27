import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KeyValueStore } from '../application/kv-ports';

/**
 * Splits a logical key into path segments. Empty or unsafe parts are dropped.
 */
export function keyToSafeSegments(key: string): string[] {
  return key
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '.' && s !== '..');
}

/**
 * String KV backed by a directory (one file per key path, nested directories).
 * Suitable for `JsonKeyValueRunRecordStore` and ad-hoc persistence without AgentDB.
 */
export class FileKeyValueStore implements KeyValueStore {
  constructor(private readonly baseDir: string) {}

  async get(key: string): Promise<string | undefined> {
    const segs = keyToSafeSegments(key);
    if (segs.length === 0) return undefined;
    const p = join(this.baseDir, ...segs);
    try {
      return await readFile(p, 'utf8');
    } catch (e) {
      const c = (e as NodeJS.ErrnoException).code;
      if (c === 'ENOENT') return undefined;
      throw e;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const segs = keyToSafeSegments(key);
    if (segs.length === 0) {
      throw new Error('FileKeyValueStore: key must have at least one path segment');
    }
    const filePath = join(this.baseDir, ...segs);
    const dir = join(this.baseDir, ...segs.slice(0, -1));
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, value, 'utf8');
  }
}
