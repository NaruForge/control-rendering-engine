import type { SemanticModel } from '../domain/schema.ts';
import { ownership } from '../domain/query.ts';
const md = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/\r?\n/g, ' ');
const csv = (s: string) => `"${(/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
export function matrixMarkdown(model: SemanticModel): string {
    const header = ['Quantity', ...model.modes.map(m => m.label)];
    const rows = model.quantities.map(q => [q.symbol + (q.unit ? ` [${q.unit}]` : ''), ...model.modes.map(m => Object.entries(m.controls).flatMap(([id, a]) => a.filter(x => x.quantity === q.id).map(x => `${model.components.find(c => c.id === id)!.label} (${x.role})`)).join('; ') || 'Not assigned')]);
    return `# ${md(model.title)}\n\nGenerated from the resolved semantic model. Not a stability or compliance assessment.\n\n` + [header, header.map(() => '---'), ...rows].map(r => `| ${r.map(md).join(' | ')} |`).join('\n') + '\n\n' + model.notes.map(n => `> ${md(n)}`).join('\n\n') + '\n';
}
export function reviewCsv(model: SemanticModel): string {
    return [['mode', 'component', 'quantity', 'role', 'review_status', 'evidence'], ...ownership(model).map(a => [a.mode, a.component, a.quantity, a.role, 'NOT_REVIEWED', ''])].map(r => r.map(csv).join(',')).join('\r\n') + '\r\n';
}
