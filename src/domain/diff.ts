import { stableJson } from './schema.ts';
import type { SemanticModel } from './schema.ts';
export interface Change {
    collection: string;
    id: string;
    kind: 'added' | 'removed' | 'changed';
    fields: string[];
    before?: unknown;
    after?: unknown;
}
export function diffModels(before: SemanticModel, after: SemanticModel): Change[] {
    const changes: Change[] = [];
    for (const key of ['id', 'title', 'description', 'notes'] as const)
        if (stableJson(before[key]) !== stableJson(after[key]))
            changes.push({ collection: 'model', id: key, kind: 'changed', fields: [key], before: before[key], after: after[key] });
    for (const collection of ['quantities', 'components', 'powerLinks', 'modes', 'blocks', 'signals', 'views'] as const) {
        const a = new Map(before[collection].map(e => [e.id, e])), b = new Map(after[collection].map(e => [e.id, e]));
        for (const id of new Set([...a.keys(), ...b.keys()])) {
            const prev = a.get(id), next = b.get(id);
            if (stableJson(prev) === stableJson(next))
                continue;
            const fields = prev && next ? [...new Set([...Object.keys(prev), ...Object.keys(next)])].filter(k => stableJson((prev as unknown as Record<string, unknown>)[k]) !== stableJson((next as unknown as Record<string, unknown>)[k])) : [];
            changes.push({ collection, id, kind: !prev ? 'added' : !next ? 'removed' : 'changed', fields, before: prev, after: next });
        }
        if (a.size === b.size && [...a.keys()].every(id => b.has(id)) && stableJson([...a.keys()]) !== stableJson([...b.keys()]))
            changes.push({ collection, id: '$order', kind: 'changed', fields: ['order'], before: [...a.keys()], after: [...b.keys()] });
    }
    return changes;
}
