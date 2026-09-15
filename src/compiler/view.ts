import type { SemanticModel, ViewDefinition, Port, Mode } from '../domain/schema.ts';
import { traceSignal } from '../domain/query.ts';
import type { EntityRef, SceneEdge } from '../scene/types.ts';
export interface ViewNode {
    id: string;
    ref: EntityRef;
    label: string;
    kind: string;
    detail?: string;
    math?: string;
    ports: Port[];
    parent?: string;
}
export interface ViewGroup {
    id: string;
    label: string;
    ref: EntityRef;
    parent?: string;
}
export interface ViewEdge {
    id: string;
    from: string;
    to: string;
    fromPort: string;
    toPort: string;
    label?: string;
    kind: SceneEdge['kind'];
    startArrow: boolean;
    endArrow: boolean;
    ref: EntityRef;
}
export interface ComputedView {
    definition: ViewDefinition;
    mode?: Mode;
    nodes: ViewNode[];
    edges: ViewEdge[];
    groups: ViewGroup[];
    hiddenConnections: number;
}
const nodeId = (collection: string, id: string) => `${collection}:${id}`;
export function computeView(model: SemanticModel, viewId: string, modeOverride?: string): ComputedView {
    const definition = model.views.find(v => v.id === viewId);
    if (!definition)
        throw new Error(`Unknown view '${viewId}'.`);
    const modeId = modeOverride ?? definition.mode;
    const mode = modeId ? model.modes.find(m => m.id === modeId) : undefined;
    if (modeId && !mode)
        throw new Error(`Unknown mode '${modeId}'.`);
    if (!['control', 'power'].includes(definition.kind))
        return { definition, mode, nodes: [], edges: [], groups: [], hiddenConnections: 0 };
    const isControl = definition.kind === 'control';
    let included = new Set(isControl ? model.blocks.filter(b => !mode || !b.modes.length || b.modes.includes(mode.id)).map(b => b.id) : model.components.filter(c => c.kind !== 'subsystem').map(c => c.id));
    const descendant = (id: string, ancestors: Set<string>) => { let c = model.components.find(c => c.id === id); while (c) {
        if (ancestors.has(c.id))
            return true;
        c = model.components.find(x => x.id === c?.parent);
    } return false; };
    if (definition.include.length) {
        const picks = new Set(definition.include);
        included = new Set([...included].filter(id => isControl ? picks.has(id) : descendant(id, picks)));
    }
    if (definition.focus) {
        let focus = new Set<string>();
        if (isControl)
            focus = new Set(traceSignal(model, definition.focus, 'both', definition.depth).nodes);
        else {
            focus.add(definition.focus);
            for (let i = 0; i < definition.depth; i++) {
                const next = new Set(focus);
                model.powerLinks.forEach(e => { if (focus.has(e.from))
                    next.add(e.to); if (focus.has(e.to))
                    next.add(e.from); });
                focus = next;
            }
        }
        included = new Set([...included].filter(id => focus.has(id)));
    }
    const collection = isControl ? 'blocks' : 'components';
    const parentId = (id?: string) => id ? `group:${id}` : undefined;
    const nodes: ViewNode[] = isControl
        ? model.blocks.filter(b => included.has(b.id)).map(b => ({ id: nodeId(collection, b.id), ref: { collection: 'blocks', id: b.id }, label: b.label, kind: b.kind, detail: b.detail, math: b.math, ports: b.ports, parent: definition.grouped ? parentId(b.owner) : undefined }))
        : model.components.filter(c => included.has(c.id)).map(c => ({ id: nodeId(collection, c.id), ref: { collection: 'components', id: c.id }, label: c.label, kind: c.kind, detail: c.technology, ports: [{ id: 'input', direction: 'in', side: definition.direction === 'RIGHT' ? 'WEST' : 'NORTH' }, { id: 'output', direction: 'out', side: definition.direction === 'RIGHT' ? 'EAST' : 'SOUTH' }], parent: definition.grouped ? parentId(c.parent) : undefined }));
    const groupIds = new Set<string>();
    for (const n of nodes) {
        let c = model.components.find(c => parentId(c.id) === n.parent);
        while (c) {
            groupIds.add(c.id);
            c = model.components.find(x => x.id === c?.parent);
        }
    }
    const groups = model.components.filter(c => groupIds.has(c.id)).map(c => ({ id: parentId(c.id)!, label: c.label, ref: { collection: 'components' as const, id: c.id }, parent: groupIds.has(c.parent ?? '') ? parentId(c.parent) : undefined }));
    let edges: ViewEdge[], hiddenConnections: number;
    if (isControl) {
        edges = model.signals.filter(e => included.has(e.from.block) && included.has(e.to.block)).map(e => ({ id: `signal:${e.id}`, from: nodeId(collection, e.from.block), to: nodeId(collection, e.to.block), fromPort: e.from.port, toPort: e.to.port, label: e.label, kind: e.kind, startArrow: false, endArrow: true, ref: { collection: 'signals', id: e.id } }));
        hiddenConnections = model.signals.filter(e => included.has(e.from.block) !== included.has(e.to.block)).length;
    }
    else {
        edges = model.powerLinks.filter(e => included.has(e.from) && included.has(e.to)).map(e => {
            const flow = mode?.flow[e.id] ?? e.capability;
            return { id: `power:${e.id}`, from: nodeId(collection, e.from), to: nodeId(collection, e.to), fromPort: 'output', toPort: 'input', kind: flow === 'off' ? 'off' : 'power', startArrow: ['reverse', 'bidirectional'].includes(flow), endArrow: ['forward', 'bidirectional'].includes(flow), ref: { collection: 'powerLinks', id: e.id } };
        });
        hiddenConnections = model.powerLinks.filter(e => included.has(e.from) !== included.has(e.to)).length;
    }
    return { definition, mode, nodes, edges, groups, hiddenConnections };
}
