import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseCandleCsvText } from '../../src/market-research/infrastructure/parseCandleCsv';
import { CsvFileMarketDataProvider } from '../../src/market-research/infrastructure/CsvFileMarketDataProvider';
import { runMarketResearch } from '../../src/market-research/application/MarketResearchPipeline';

const thisDir = dirname(fileURLToPath(import.meta.url));
const fixture = join(thisDir, '../fixtures/market-research/TESTSYM.csv');

describe('parseCandleCsvText', () => {
  it('parses header + 3 daily rows, sorted by time', async () => {
    const raw = await readFile(fixture, 'utf8');
    const c = parseCandleCsvText(raw);
    expect(c).toHaveLength(3);
    expect(c[0]!.ts).toContain('2026-01-01');
    expect(c[2]!.close).toBe(10.3);
    expect(new Date(c[1]!.ts).getTime()).toBeLessThan(new Date(c[2]!.ts).getTime());
  });

  it('returns [] for empty or unparseable lines', () => {
    expect(parseCandleCsvText('')).toEqual([]);
    expect(parseCandleCsvText('a,b\n')).toEqual([]);
  });

  it('parses data-only rows in fixed order (ts, o, h, l, c, vol)', () => {
    const t = `2026-01-01T00:00:00.000Z,1,1.1,0.9,1,10
2026-01-02T00:00:00.000Z,1,1.1,0.9,1.1,20`;
    const c = parseCandleCsvText(t);
    expect(c).toHaveLength(2);
    expect(c[1]!.close).toBe(1.1);
  });
});

describe('CsvFileMarketDataProvider', () => {
  it('loads last N bars from a fixture and integrates with the pipeline', async () => {
    const data = new CsvFileMarketDataProvider({
      resolveFile: (sym) => (sym === 'TESTSYM' ? fixture : join(thisDir, 'missing.csv')),
    });
    const { items, reports } = await runMarketResearch({
      instruments: [{ symbol: 'TESTSYM' }],
      data,
      candleLimit: 2,
    });
    expect(items[0]!.dataQuality.barCount).toBe(2);
    expect(reports[0]!.summary).toMatch(/2 bars/);
  });

  it('returns [] when file missing (symbol maps to non-existent path)', async () => {
    const data = new CsvFileMarketDataProvider({
      resolveFile: () => join(thisDir, 'does-not-exist-xyz.csv'),
    });
    const c = await data.getRecentCandles('ANY', 5);
    expect(c).toEqual([]);
  });
});
