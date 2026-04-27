import type { RunMarketResearchResult } from './MarketResearchPipeline';
import { escapeForMarkdownInline } from './renderMarkdownUtil';

/**
 * Renders a full run as research-only Markdown (export / logs / PR attachments).
 * Deterministic from structured inputs; no external I/O.
 */
export function renderMarketResearchRunMd(result: RunMarketResearchResult): string {
  const { meta, items, ranking } = result;
  const lines: string[] = [];
  lines.push(`# Market research run`);
  lines.push('');
  lines.push(`- **Run ID:** \`${escapeForMarkdownInline(meta.runId)}\``);
  lines.push(`- **Created:** ${escapeForMarkdownInline(meta.createdAt)}`);
  lines.push(`- **Universe:** ${meta.instruments.length} instrument(s)`);
  lines.push('');
  lines.push(`> Not investment advice. No order execution. Research / informational use only.`);
  lines.push('');
  lines.push(`## Ranking (this run)`);
  lines.push('');
  lines.push(`| Rank | Symbol | Score (0–100) |`);
  lines.push(`| ---- | ------ | --------------- |`);
  for (const r of ranking) {
    lines.push(
      `| ${r.rank} | ${escapeForMarkdownInline(r.symbol)} | ${r.score.toFixed(2)} |`,
    );
  }
  if (ranking.length === 0) {
    lines.push(`| — | — | — |`);
  }
  lines.push('');

  for (const b of items) {
    const sym = escapeForMarkdownInline(b.instrument.symbol);
    lines.push(`## ${sym}`);
    lines.push('');
    lines.push(`- **Data quality:** ${b.dataQuality.barCount} bar(s); stale=${b.dataQuality.isStale}; gaps=${b.dataQuality.hasGaps}`);
    lines.push(`- **Score:** ${b.score.value.toFixed(2)} (${b.score.factors.map((f) => `${f.id}=${f.value}`).join(', ')})`);
    lines.push(`- **Audit:** **${b.audit.verdict}**`);
    for (const re of b.audit.reasons) {
      lines.push(`  - ${escapeForMarkdownInline(re)}`);
    }
    lines.push(`- **Summary**`);
    lines.push('');
    lines.push(b.report.summary);
    lines.push('');
    if (b.report.riskNotes.length) {
      lines.push(`- **Risk notes**`);
      for (const n of b.report.riskNotes) {
        lines.push(`  - ${escapeForMarkdownInline(n)}`);
      }
      lines.push('');
    }
    if (b.report.evidenceRefs.length) {
      lines.push(`- **Evidence refs**`);
      for (const e of b.report.evidenceRefs) {
        lines.push(`  - \`${escapeForMarkdownInline(e)}\``);
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }
  if (items.length === 0) {
    lines.push('*(no instruments in this run)*');
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}
