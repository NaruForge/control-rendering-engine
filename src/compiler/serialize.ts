import { stringify } from 'yaml';
import type { ModelSource, Format } from '../domain/schema.ts';
const q = JSON.stringify;
/** Canonical serialization is explicit. Source editing itself preserves the user's original text. */
export function serialize(model: ModelSource, format: Format = 'control'): string {
    const m = JSON.parse(JSON.stringify(model)) as ModelSource;
    if (format === 'json')
        return JSON.stringify(m, null, 2) + '\n';
    if (format === 'yaml')
        return stringify(m, { lineWidth: 0, indent: 2 });
    const out = [`architecture ${m.id} ${q(m.title)} {`, ...(m.description ? [`  description ${q(m.description)}`] : [])];
    const section = (lines: string[]) => { if (lines.length)
        out.push('', ...lines); };
    section(m.quantities.map(x => `  quantity ${x.id} ${q(x.symbol)} ${q(x.label)}${x.unit ? ` unit ${q(x.unit)}` : ''}${x.exclusive ? ' exclusive' : ''}`));
    section(m.components.map(x => `  component ${x.id} ${x.kind} ${q(x.label)}${x.technology ? ` technology ${q(x.technology)}` : ''}${x.parent ? ` in ${x.parent}` : ''}`));
    section(m.powerLinks.map(x => `  power ${x.id} ${x.from} -> ${x.to} ${x.capability}`));
    for (const x of m.modes)
        section([
            `  mode ${x.id} ${q(x.label)} group ${q(x.group)}${x.extends ? ` extends ${x.extends}` : ''} {`,
            ...(x.note ? [`    note ${q(x.note)}`] : []),
            ...Object.entries(x.flow ?? {}).map(([link, flow]) => `    flow ${link} ${flow}`),
            ...Object.entries(x.controls ?? {}).flatMap(([owner, assignments]) => [`    controls ${owner} {`, ...assignments.map(a => `      ${a.quantity} ${a.role}`), '    }']), '  }',
        ]);
    for (const x of m.blocks)
        section([
            `  block ${x.id} ${x.kind} ${q(x.label)}${x.owner ? ` owner ${x.owner}` : ''}${x.modes.length ? ` modes ${x.modes.join(', ')}` : ''} {`,
            ...(x.detail ? [`    detail ${q(x.detail)}`] : []), ...(x.math ? [`    math ${q(x.math)}`] : []),
            ...x.ports.map(p => `    port ${p.id} ${p.direction} ${p.side}${p.quantity ? ` quantity ${p.quantity}` : ''}${p.sign ? ` sign ${p.sign}` : ''}`), '  }',
        ]);
    section(m.signals.map(x => `  signal ${x.id} ${x.from.block}.${x.from.port} -> ${x.to.block}.${x.to.port}${x.label ? ` label ${q(x.label)}` : ''}${x.kind === 'feedback' ? ' feedback' : ''}${x.quantity ? ` quantity ${x.quantity}` : ''}`));
    for (const x of m.views)
        section([
            `  view ${x.id} ${x.kind} ${q(x.title)}${x.mode ? ` mode ${x.mode}` : ''} {`,
            ...(x.include.length ? [`    include ${x.include.join(', ')}`] : []),
            ...(x.focus ? [`    focus ${x.focus} depth ${x.depth}`] : []),
            `    direction ${x.direction}`, ...(x.grouped ? ['    grouped'] : []), '  }',
        ]);
    section(m.notes.map(x => `  note ${q(x)}`));
    out.push('}', '');
    return out.join('\n');
}
