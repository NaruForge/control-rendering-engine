import { runElk } from './runtime.ts';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { ComputedView, ViewNode } from '../compiler/view.ts';
import type { SceneNode, SceneEdge, ScenePort } from '../scene/types.ts';
import { lines, width, wrap } from '../scene/text.ts';
import { typeset } from '../scene/math.ts';
async function measure(node: ViewNode): Promise<SceneNode> {
    const compact = ['sum', 'gain', 'junction'].includes(node.kind);
    const w = node.kind === 'sum' ? 76 : node.kind === 'gain' ? 120 : node.kind === 'junction' ? 24 : Math.max(180, Math.min(270, width(node.label, 16) + 36));
    const label = lines(node.label, 16, 62, w - 32, 16, 'ink', 600, 22);
    const detail = node.detail ? lines(node.detail, 16, 72 + label.length * 22, w - 32, 12, 'muted', 400, 17) : [];
    const math = node.math ? await typeset(node.math) : undefined;
    let h = compact ? node.kind === 'gain' ? 96 : node.kind === 'sum' ? 92 : 24 : 62 + label.length * 22 + (math ? 58 : detail.length * 17) + 14;
    const maxSide = Math.max(...['WEST', 'EAST'].map(side => node.ports.filter(p => p.side === side).length));
    h = Math.max(h, (maxSide + 1) * 25);
    const ports: ScenePort[] = node.ports.map(p => {
        const sidePorts = node.ports.filter(x => x.side === p.side), index = sidePorts.indexOf(p);
        const proportion = (index + 1) / (sidePorts.length + 1);
        return { ...p, x: p.side === 'WEST' ? 0 : p.side === 'EAST' ? w : w * proportion, y: p.side === 'NORTH' ? 0 : p.side === 'SOUTH' ? h : h * proportion };
    });
    const tone = ['controller', 'sum', 'integrator', 'gain', 'transfer'].includes(node.kind) ? 'accent' : node.kind === 'measurement' ? 'violet' : node.kind === 'limiter' ? 'amber' : 'ink';
    const texts = compact ? node.kind === 'sum' ? [{ text: node.label, x: w / 2, y: 10, size: 11, tone: 'muted' as const, anchor: 'middle' as const }] : [] : [
        { text: node.kind.replace('-', ' ').toUpperCase(), x: 16, y: 24, size: 10, tone, weight: 700 } as const,
        ...label, ...(math ? [] : detail),
    ];
    return { id: node.id, ref: node.ref, x: 0, y: 0, width: w, height: h, label: node.label, kind: node.kind, parent: node.parent, shape: (['sum', 'gain', 'junction', 'limiter', 'switch'].includes(node.kind) ? node.kind : 'card') as SceneNode['shape'], tone, texts, ports,
        math, mathBox: math ? { x: compact ? 20 : 16, y: compact ? 25 : 70 + label.length * 22, width: w - (compact ? 50 : 32), height: compact ? 45 : 44 } : undefined };
}
export async function layoutGraph(view: ComputedView): Promise<{
    nodes: SceneNode[];
    edges: SceneEdge[];
    width: number;
    height: number;
}> {
    if (!view.nodes.length)
        return { nodes: [], edges: [], width: 600, height: 180 };
    const visuals = await Promise.all(view.nodes.map(measure));
    const elkNodes = new Map<string, ElkNode>();
    for (const g of view.groups)
        elkNodes.set(g.id, { id: g.id, children: [], layoutOptions: { 'elk.padding': '[top=50,left=24,bottom=24,right=24]', 'elk.nodeLabels.placement': 'INSIDE H_LEFT V_TOP' } });
    for (const n of visuals)
        elkNodes.set(n.id, {
            id: n.id, width: n.width, height: n.height,
            layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
            ports: n.ports.map(p => ({ id: `${n.id}:${p.id}`, x: p.x, y: p.y, width: 0, height: 0, layoutOptions: { 'elk.port.side': p.side } })),
        });
    const roots: ElkNode[] = [];
    for (const item of [...view.groups, ...visuals]) {
        const node = elkNodes.get(item.id)!;
        if (item.parent && elkNodes.has(item.parent))
            elkNodes.get(item.parent)!.children!.push(node);
        else
            roots.push(node);
    }
    const graph: ElkNode = { id: 'root', children: roots,
        layoutOptions: {
            'elk.algorithm': 'layered', 'elk.direction': view.definition.direction, 'elk.edgeRouting': 'ORTHOGONAL',
            'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.randomSeed': '1',
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
            'elk.layered.spacing.nodeNodeBetweenLayers': '48', 'elk.spacing.nodeNode': '36',
            'elk.spacing.edgeNode': '20', 'elk.spacing.edgeEdge': '16',
            'elk.padding': '[top=24,left=24,bottom=24,right=24]',
        },
        edges: view.edges.map(e => ({ id: e.id, sources: [`${e.from}:${e.fromPort}`], targets: [`${e.to}:${e.toPort}`],
            layoutOptions: { 'elk.layered.priority.direction': e.kind === 'feedback' ? '0' : '1' },
            labels: e.label ? [{ text: e.label, width: width(e.label, 12), height: 18 }] : [],
        })),
    };
    const output = await runElk(graph);
    const positions = new Map<string, {
        x: number;
        y: number;
        width: number;
        height: number;
    }>();
    const edges: SceneEdge[] = [];
    function locate(node: ElkNode, ox = 0, oy = 0) {
        const x = ox + (node.x ?? 0), y = oy + (node.y ?? 0);
        positions.set(node.id, { x, y, width: node.width ?? 0, height: node.height ?? 0 });
        node.children?.forEach(c => locate(c, x, y));
    }
    locate(output);
    function collect(node: ElkNode) {
        for (const e of node.edges ?? []) {
            const spec = view.edges.find(s => s.id === e.id);
            if (!spec)
                throw new Error(`Unexpected layout edge '${e.id}'.`);
            if (!e.sections?.length)
                throw new Error(`ELK did not route '${e.id}'.`);
            // ELK may retain edges in the root array but report geometry relative to a nested container.
            const origin = positions.get(e.container ?? node.id);
            if (!origin)
                throw new Error(`Unknown edge coordinate frame '${e.container}'.`);
            edges.push({ ...spec, paths: e.sections.map(s => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map(p => ({ x: p.x + origin.x, y: p.y + origin.y }))),
                labels: (e.labels ?? []).map(l => ({ text: l.text ?? '', x: (l.x ?? 0) + origin.x, y: (l.y ?? 0) + origin.y, width: l.width ?? 0, height: l.height ?? 18 })) });
        }
        node.children?.forEach(collect);
    }
    collect(output);
    const groups: SceneNode[] = view.groups.map(g => ({ id: g.id, ref: g.ref, ...positions.get(g.id)!, label: g.label, shape: 'group', tone: 'accent', ports: [], texts: [{ text: g.label, x: 20, y: 30, size: 14, tone: 'accent', weight: 600 }] }));
    const nodes = [...groups, ...visuals.map(n => ({ ...n, ...positions.get(n.id)! }))];
    if (nodes.some(n => !Number.isFinite(n.x + n.y + n.width + n.height)))
        throw new Error('Layout produced non-finite geometry.');
    // Preserve model ordering independently of ELK's hierarchy traversal.
    edges.sort((a, b) => view.edges.findIndex(e => e.id === a.id) - view.edges.findIndex(e => e.id === b.id));
    return { nodes, edges, width: output.width ?? 0, height: output.height ?? 0 };
}
