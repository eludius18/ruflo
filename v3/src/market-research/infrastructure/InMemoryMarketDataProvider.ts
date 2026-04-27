import type { MarketDataProvider } from '../application/ports';
import type { Candle } from '../domain/market-data';

/**
 * Deterministic mock candles for tests and local dry-runs (no network).
 * Same symbol + limit yields the same series for stable assertions.
 */
export class InMemoryMarketDataProvider implements MarketDataProvider {
  async getRecentCandles(symbol: string, limit: number): Promise<Candle[]> {
    const n = Math.max(0, Math.min(100, Math.floor(limit)));
    if (n === 0) return [];
    const base = this.hashToUnit(symbol);
    const oneDay = 86_400_000;
    const end = Date.now();
    const t0 = end - (n - 1) * oneDay;
    const out: Candle[] = [];
    for (let i = 0; i < n; i++) {
      const t = new Date(t0 + i * oneDay).toISOString();
      const o = 100 + base * 0.1 + i * 0.05;
      const c = o + 0.2 * Math.sin(i + base);
      out.push({
        ts: t,
        open: o,
        high: Math.max(o, c) + 0.1,
        low: Math.min(o, c) - 0.1,
        close: c,
        volume: 1_000_000 + i * 1000,
      });
    }
    return out;
  }

  /** 0..1 float from string */
  private hashToUnit(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return (Math.abs(h) % 10_000) / 10_000;
  }
}
