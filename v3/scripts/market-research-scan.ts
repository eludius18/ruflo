/**
 * CLI: scan → Markdown (and optional JSON persistence / LLM narrative).
 *
 * Usage (from v3/):
 *   pnpm exec tsx scripts/market-research-scan.ts --demo
 *   pnpm exec tsx scripts/market-research-scan.ts --csv-dir ./data --symbols A,B
 *   MARKET_RESEARCH_LLM=1 OPENAI_API_KEY=... pnpm exec tsx scripts/market-research-scan.ts --demo
 *
 * Env: OPENAI_API_KEY, OPENAI_MODEL (default gpt-4o-mini), MARKET_RESEARCH_LLM=1 to enable LLM.
 * LLM and --memory-path need @claude-flow/* packages built: `pnpm --filter @claude-flow/providers build`
 * and `pnpm --filter @claude-flow/memory build` (or use only --demo / --persist-dir, no built deps).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, dirname } from 'node:path';
import { runMarketResearch } from '../src/market-research/application/MarketResearchPipeline';
import { NoOpResearchNarration, type ResearchNarrationPort } from '../src/market-research/application/llm-ports';
import { LlmTextResearchNarration } from '../src/market-research/infrastructure/LlmTextResearchNarration';
import { createLlmTextClientFromIllmProvider } from '../src/market-research/infrastructure/illmTextClientAdapter';
import { InMemoryMarketDataProvider } from '../src/market-research/infrastructure/InMemoryMarketDataProvider';
import { CsvFileMarketDataProvider } from '../src/market-research/infrastructure/CsvFileMarketDataProvider';
import { FileKeyValueStore } from '../src/market-research/infrastructure/FileKeyValueStore';
import { JsonKeyValueRunRecordStore } from '../src/market-research/infrastructure/JsonKeyValueRunRecordStore';
import { renderMarketResearchRunMd } from '../src/market-research/application/renderRunMarkdown';

function parseArgs(argv: string[]): {
  demo: boolean;
  csvDir: string | null;
  symbols: string[];
  out: string | null;
  persistDir: string | null;
  memoryPath: string | null;
  memoryNamespace: string;
  candleLimit: number;
} {
  const rest = [...argv];
  let demo = false;
  let csvDir: string | null = null;
  let out: string | null = null;
  let persistDir: string | null = null;
  let memoryPath: string | null = null;
  let memoryNamespace = 'market-research';
  let candleLimit = 20;
  const symbols: string[] = [];

  while (rest.length) {
    const a = rest.shift()!;
    if (a === '--demo') {
      demo = true;
    } else if (a === '--csv-dir' && rest[0]) {
      csvDir = rest.shift()!;
    } else if (a === '--symbols' && rest[0]) {
      symbols.push(...rest.shift()!.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
    } else if (a === '--out' && rest[0]) {
      out = rest.shift()!;
    } else if (a === '--persist-dir' && rest[0]) {
      persistDir = rest.shift()!;
    } else if (a === '--memory-path' && rest[0]) {
      memoryPath = rest.shift()!;
    } else if (a === '--memory-namespace' && rest[0]) {
      memoryNamespace = rest.shift()!;
    } else if (a === '--candle-limit' && rest[0]) {
      candleLimit = Math.max(1, Math.floor(Number(rest.shift())));
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return { demo, csvDir, symbols, out, persistDir, memoryPath, memoryNamespace, candleLimit };
}

function printHelp(): void {
  const lines = [
    'market-research-scan — informational scan → Markdown',
    '',
    '  --demo                 Use in-memory market data (default symbols AAPL,MSFT if none)',
    '  --csv-dir DIR         Load SYMBOL.csv from DIR',
    '  --symbols S1,S2        Instruments (default with --demo: AAPL,MSFT)',
    '  --candle-limit N      Bars per symbol (default 20)',
    '  --out FILE            Write report (default: stdout)',
    '  --persist-dir DIR     Save run JSON under DIR (file KV)',
    '  --memory-path FILE    Use UnifiedMemoryService persistence (SQLite) + MemoryKeyValueStore',
    '  --memory-namespace NS  Namespace for memory store (default market-research)',
    '  Mark MARKET_RESEARCH_LLM=1 and set OPENAI_API_KEY for LLM narrative.',
  ];
  console.log(lines.join('\n'));
}

async function loadLlmNarration(): Promise<ResearchNarrationPort> {
  if (process.env.MARKET_RESEARCH_LLM !== '1' && !process.env.OPENAI_API_KEY) {
    return new NoOpResearchNarration();
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('MARKET_RESEARCH_LLM/OPENAI: OPENAI_API_KEY missing, using no-op narration');
    return new NoOpResearchNarration();
  }
  try {
    const { OpenAIProvider } = await import('@claude-flow/providers');
    const p = new OpenAIProvider({
      config: { provider: 'openai', apiKey: key, model: (process.env.OPENAI_MODEL || 'gpt-4o-mini') as 'gpt-4o-mini' },
    });
    const client = createLlmTextClientFromIllmProvider(p);
    return new LlmTextResearchNarration({ client });
  } catch (e) {
    console.error(
      'LLM: failed to load @claude-flow/providers (build the package: pnpm --filter @claude-flow/providers build).',
      e,
    );
    return new NoOpResearchNarration();
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const args = parseArgs(process.argv.slice(2));

  if (!args.demo && !args.csvDir) {
    printHelp();
    process.stderr.write('Error: pass --demo and/or --csv-dir DIR\n');
    process.exit(1);
  }

  const symList =
    args.symbols.length > 0
      ? args.symbols
      : args.demo
        ? ['AAPL', 'MSFT']
        : [];

  if (symList.length === 0) {
    process.stderr.write('Error: --symbols required with --csv-dir (comma-separated)\n');
    process.exit(1);
  }

  const instruments = symList.map((symbol) => ({ symbol }));
  const resolveCsv = (symbol: string) => {
    const d = args.csvDir!;
    const p = isAbsolute(d) ? d : resolve(cwd, d);
    return join(p, `${symbol}.csv`);
  };

  const data = args.csvDir
    ? new CsvFileMarketDataProvider({ resolveFile: resolveCsv })
    : new InMemoryMarketDataProvider();

  const narration = await loadLlmNarration();

  const result = await runMarketResearch({
    instruments,
    data,
    candleLimit: args.candleLimit,
    narration,
  });

  if (args.persistDir) {
    const dir = isAbsolute(args.persistDir) ? args.persistDir : resolve(cwd, args.persistDir);
    const kv = new FileKeyValueStore(dir);
    const runStore = new JsonKeyValueRunRecordStore({ store: kv, keyPrefix: 'market-research/runs' });
    await runStore.put(result);
  }

  if (args.memoryPath) {
    const p = isAbsolute(args.memoryPath) ? args.memoryPath : resolve(cwd, args.memoryPath);
    try {
      await mkdir(dirname(p), { recursive: true });
      const { UnifiedMemoryService } = await import('@claude-flow/memory');
      const { MemoryKeyValueStore } = await import(
        '../src/market-research/infrastructure/MemoryKeyValueStore',
      );
      const memory = new UnifiedMemoryService({
        persistenceEnabled: true,
        persistencePath: p,
        autoEmbed: false,
      });
      await memory.initialize();
      const kv = new MemoryKeyValueStore(memory, args.memoryNamespace);
      const runStore = new JsonKeyValueRunRecordStore({ store: kv, keyPrefix: 'market-research/runs' });
      await runStore.put(result);
      await memory.shutdown();
    } catch (e) {
      console.error(
        'memory-path: failed to persist via UnifiedMemoryService (build @claude-flow/memory: pnpm --filter @claude-flow/memory build).',
        e,
      );
      process.exit(1);
    }
  }

  const md = renderMarketResearchRunMd(result);
  if (args.out) {
    const p = isAbsolute(args.out) ? args.out : resolve(cwd, args.out);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, md, 'utf8');
  } else {
    process.stdout.write(md);
    if (!md.endsWith('\n')) process.stdout.write('\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
