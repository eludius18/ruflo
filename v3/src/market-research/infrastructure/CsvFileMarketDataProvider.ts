import { readFile } from 'node:fs/promises';
import type { MarketDataProvider } from '../application/ports';
import type { Candle } from '../domain/market-data';
import { parseCandleCsvText } from './parseCandleCsv';

export interface CsvFileMarketDataProviderOptions {
  /**
   * Map ticker → absolute or cwd-relative file path. Unknown symbols should resolve to
   * a path that will 404, yielding [] from `getRecentCandles` (no throw).
   */
  resolveFile: (symbol: string) => string;
  /** @default 10_000 */
  maxBars?: number;
}

/**
 * Read OHLCV from local CSV (offline backtests, fixtures, one-file-per-symbol).
 */
export class CsvFileMarketDataProvider implements MarketDataProvider {
  private readonly resolveFile: (symbol: string) => string;
  private readonly maxBars: number;
  constructor(opts: CsvFileMarketDataProviderOptions) {
    this.resolveFile = opts.resolveFile;
    this.maxBars = opts.maxBars ?? 10_000;
  }

  async getRecentCandles(symbol: string, limit: number): Promise<Candle[]> {
    const n = Math.max(0, Math.min(this.maxBars, Math.floor(limit)));
    if (n === 0) return [];
    const path = this.resolveFile(symbol);
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch {
      return [];
    }
    const all = parseCandleCsvText(text);
    if (all.length === 0) return [];
    return all.slice(-n);
  }
}
