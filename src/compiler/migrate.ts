import { validateModel } from '../legacy/model.ts';
import type { ModelSource, Port, Block, Signal } from '../domain/schema.ts';
/** Import the documented v1 format. No guessed loop roles or changed power directions. */
export function migrateV1(value: unknown): ModelSource {
    const old = validateModel(value);
    const nodes = old.signals?.nodes ?? [], edges = old.signals?.edges ?? [];
    const blocks: Block[] = nodes.map(n => {
        const ports: Port[] = [];
        const incoming = edges.filter(e => e.to.node === n.id), outgoing = edges.filter(e => e.from.node === n.id);
        for (const p of n.ports) {
            const usedIn = incoming.some(e => e.to.port === p.id), usedOut = outgoing.some(e => e.from.port === p.id);
            if (usedIn && usedOut)
                throw new Error(`V1 port '${n.id}.${p.id}' is used as both input and output; declare separate v2 ports.`);
            if (!usedIn && !usedOut)
                throw new Error(`V1 port '${n.id}.${p.id}' has no inferable direction; declare its v2 direction explicitly.`);
            ports.push({ id: p.id, side: p.side, direction: usedIn ? 'in' : 'out' });
        }
        if (incoming.some(e => !e.to.port)) {
            if (ports.some(p => p.id === 'input'))
                throw new Error(`V1 default input conflicts on ${n.id}`);
            ports.push({ id: 'input', direction: 'in', side: 'WEST' });
        }
        if (outgoing.some(e => !e.from.port)) {
            if (ports.some(p => p.id === 'output'))
                throw new Error(`V1 default output conflicts on ${n.id}`);
            ports.push({ id: 'output', direction: 'out', side: 'EAST' });
        }
        if (!ports.length)
            ports.push({ id: 'output', direction: 'out', side: 'EAST' });
        return { id: n.id, label: n.label, kind: n.kind, detail: n.detail, modes: [], ports };
    });
    const signals: Signal[] = edges.map(e => ({ id: e.id, from: { block: e.from.node, port: e.from.port ?? 'output' }, to: { block: e.to.node, port: e.to.port ?? 'input' }, label: e.label, kind: e.kind }));
    const components: ModelSource['components'] = old.stages.map(s => ({ ...s }));
    if (old.boundary) {
        let id = 'boundary';
        while (components.some(c => c.id === id))
            id += '_';
        components.unshift({ id, label: old.boundary.label, kind: 'subsystem' });
        components.forEach(c => { if (old.boundary!.members.includes(c.id))
            c.parent = id; });
    }
    return {
        schemaVersion: 2, id: 'imported', title: old.title, description: old.description,
        quantities: old.quantities, components, powerLinks: old.links,
        modes: old.modes.map(m => ({ ...m, group: old.groups.find(g => g.id === m.group)!.label })),
        blocks, signals, views: [
            { id: 'overview', title: 'Architecture overview', kind: 'overview', include: [], depth: 2, direction: 'RIGHT', grouped: false },
            { id: 'power', title: 'Power conversion', kind: 'power', include: [], depth: 2, direction: 'RIGHT', grouped: !!old.boundary },
            { id: 'matrix', title: 'Control ownership', kind: 'matrix', include: [], depth: 2, direction: 'RIGHT', grouped: false },
            ...(blocks.length ? [{ id: 'signals', title: old.signals!.title, kind: 'control' as const, include: [], depth: 2, direction: 'RIGHT' as const, grouped: false }] : []),
        ], notes: old.notes,
    };
}
