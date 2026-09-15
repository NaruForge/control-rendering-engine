import type { SemanticModel } from './schema.ts';
export interface Trace {
    nodes: string[];
    edges: string[];
    boundaryEdges: string[];
}
export function traceSignal(model: SemanticModel, start: string, direction: 'upstream' | 'downstream' | 'both' = 'both', depth = 3, feedback = true): Trace {
    if (!model.blocks.some(b => b.id === start))
        throw new Error(`Unknown block '${start}'.`);
    if (!Number.isInteger(depth) || depth < 0 || depth > 12)
        throw new Error('Trace depth must be between 0 and 12.');
    const included = new Set([start]);
    let front = [start];
    const edges = model.signals.filter(e => feedback || e.kind !== 'feedback');
    for (let i = 0; i < depth && front.length; i++) {
        const next = new Set<string>();
        for (const id of front)
            for (const e of edges) {
                if (direction !== 'upstream' && e.from.block === id && !included.has(e.to.block))
                    next.add(e.to.block);
                if (direction !== 'downstream' && e.to.block === id && !included.has(e.from.block))
                    next.add(e.from.block);
            }
        front = [...next];
        front.forEach(id => included.add(id));
    }
    return {
        nodes: model.blocks.filter(b => included.has(b.id)).map(b => b.id),
        edges: edges.filter(e => included.has(e.from.block) && included.has(e.to.block)).map(e => e.id),
        boundaryEdges: edges.filter(e => included.has(e.from.block) !== included.has(e.to.block)).map(e => e.id),
    };
}
export function ownership(model: SemanticModel, quantity?: string) {
    if (quantity && !model.quantities.some(q => q.id === quantity))
        throw new Error(`Unknown quantity '${quantity}'.`);
    return model.modes.flatMap(m => Object.entries(m.controls).flatMap(([component, assignments]) => assignments.filter(a => !quantity || a.quantity === quantity).map(a => ({ mode: m.id, modeLabel: m.label, component, ...a }))));
}
export function inspectElement(model: SemanticModel, collection: 'components' | 'blocks' | 'signals' | 'quantities' | 'modes' | 'views', id: string) {
    const element = model[collection].find(e => e.id === id);
    if (!element)
        throw new Error(`Unknown ${collection} id '${id}'.`);
    return { collection, element, ...(collection === 'components' ? { controls: ownership(model).filter(c => c.component === id) } : {}), ...(collection === 'blocks' ? { incoming: model.signals.filter(e => e.to.block === id), outgoing: model.signals.filter(e => e.from.block === id) } : {}) };
}
