import type { Candle } from '../domain/market-data';

const NUMERIC_KEYS = ['open', 'high', 'low', 'close'] as const;

/**
 * Minimal OHLCV CSV: comma-separated cells, no embedded commas in fields.
 * Optional header line with columns ts, open, high, low, close [, volume] (any order on header row).
 * Without a header, rows must be: ts,open,high,low,close[,volume].
 */
export function parseCandleCsvText(content: string): Candle[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const firstLower = lines[0]!.split(',').map((c) => c.trim().toLowerCase());
  const isHeader = ['ts', ...NUMERIC_KEYS].every((c) => firstLower.includes(c));
  const header: Record<string, number> = {};
  if (isHeader) {
    for (const k of ['ts', 'open', 'high', 'low', 'close', 'volume'] as const) {
      const i = firstLower.indexOf(k);
      if (i >= 0) header[k] = i;
    }
  }
  const start = isHeader ? 1 : 0;
  const out: Candle[] = [];
  for (let i = start; i < lines.length; i++) {
    const row = lines[i]!.split(',').map((c) => c.trim());
    if (row.length < 5) continue;
    let ts: string;
    let open: number;
    let high: number;
    let low: number;
    let close: number;
    let volume: number | undefined;
    if (isHeader) {
      const gi = (k: string) => {
        const idx = header[k];
        if (idx === undefined) return '';
        return row[idx] ?? '';
      };
      ts = gi('ts');
      open = Number(gi('open'));
      high = Number(gi('high'));
      low = Number(gi('low'));
      close = Number(gi('close'));
      const vs = header.volume !== undefined ? row[header.volume!] : '';
      volume = vs !== undefined && vs !== '' ? Number(vs) : undefined;
    } else {
      ts = row[0]!;
      open = Number(row[1]);
      high = Number(row[2]);
      low = Number(row[3]);
      close = Number(row[4]);
      volume = row[5] !== undefined && row[5] !== '' ? Number(row[5]) : undefined;
    }
    if (!ts || NUMERIC_KEYS.some((_, j) => !Number.isFinite([open, high, low, close][j]!))) {
      continue;
    }
    out.push({
      ts,
      open,
      high,
      low,
      close,
      volume: volume !== undefined && Number.isFinite(volume) ? volume : undefined,
    });
  }
  out.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  return out;
}
