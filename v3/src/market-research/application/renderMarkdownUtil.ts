/**
 * Backticks / pipes can break table columns; keep copy-paste safe for Markdown.
 */
export function escapeForMarkdownInline(s: string): string {
  return s
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}
