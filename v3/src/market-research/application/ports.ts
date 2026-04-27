import type { Candle } from '../domain/market-data';

/**
 * Abstraction for price / series data. Real connectors live in infrastructure.
 * Research-only: no order book or execution endpoints.
 */
export interface MarketDataProvider {
  /**
   * @param symbol — instrument ticker
   * @param limit — max bars (newest last)
   */
  getRecentCandles(symbol: string, limit: number): Promise<Candle[]>;
}
