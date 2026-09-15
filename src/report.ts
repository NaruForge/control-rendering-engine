import type { Model } from './model.ts';
const md = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/\r?\n/g, ' ');
// Neutralize spreadsheet formula prefixes without changing the semantic source model.
const csv = (s: string) => `"${(/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
export function matrixMarkdown(model: Model): string {
  const header = ['Control quantity', ...model.modes.map(m => m.label)];
  const rows = model.quantities.map(q => [
    `${q.symbol} — ${q.label}`,
    ...model.modes.map(m => model.stages.flatMap(s => (m.controls[s.id] ?? []).filter(a => a.quantity === q.id).map(a => `${s.label} (${a.role})`)).join('; ') || '—'),
  ]);
  return `# ${md(model.title)}\n\nGenerated control-responsibility matrix. Not a compliance or stability assessment.\n\n` +
    [header, header.map(() => '---'), ...rows].map(row => `| ${row.map(md).join(' | ')} |`).join('\n') +
    '\n\n' + model.notes.map(n => `> ${md(n)}`).join('\n\n') + '\n';
}
export function reviewCsv(model: Model): string {
  const rows = [['mode', 'stage', 'quantity', 'role', 'review_status', 'evidence']];
  for (const m of model.modes) for (const s of model.stages) for (const a of m.controls[s.id] ?? [])
    rows.push([m.label, s.label, a.quantity, a.role, 'NOT_REVIEWED', '']);
  return rows.map(row => row.map(csv).join(',')).join('\r\n') + '\r\n';
}
