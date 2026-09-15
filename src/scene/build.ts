import type { SemanticModel, Mode } from '../domain/schema.ts';
import { revisionOf } from '../domain/schema.ts';
import { computeView } from '../compiler/view.ts';
import { layoutGraph } from '../layout/elk.ts';
import { auditScene } from '../layout/audit.ts';
import type { Scene, SceneNode, SceneEdge, TextLine, EntityRef, Tone } from './types.ts';
import { lines, wrap } from './text.ts';
const node = (id: string, x: number, y: number, width: number, height: number, label: string, texts: TextLine[], shape: SceneNode['shape'] = 'text', ref?: EntityRef, tone: Tone = 'ink'): SceneNode => ({ id, x, y, width, height, label, texts, shape, ref, tone, ports: [] });
function translated(graph: {
    nodes: SceneNode[];
    edges: SceneEdge[];
}, dx: number, dy: number) {
    return { nodes: graph.nodes.map(n => ({ ...n, x: n.x + dx, y: n.y + dy })), edges: graph.edges.map(e => ({ ...e, paths: e.paths.map(p => p.map(pt => ({ x: pt.x + dx, y: pt.y + dy }))), labels: e.labels.map(l => ({ ...l, x: l.x + dx, y: l.y + dy })) })) };
}
function header(scene: Scene, width: number) {
    const titleLines = lines(scene.title, 0, 45, width - 100, 30, 'ink', 600, 38);
    const subtitle = lines(scene.description, 0, titleLines.length * 38 + 31, width - 100, 14, 'muted', 400, 20);
    const h = titleLines.length * 38 + subtitle.length * 20 + 55;
    scene.nodes.push(node('heading', 40, 24, width - 80, h, scene.title, [{ text: 'CONTROL STUDIO / MODEL-FIRST ENGINEERING', x: 0, y: 0, size: 10, tone: 'accent', weight: 700 }, ...titleLines, ...subtitle]));
    return h + 36;
}
function footer(scene: Scene, y: number) {
    const all = [...scene.notes, ...(scene.hiddenConnections ? [`This view omits ${scene.hiddenConnections} connections at its boundary; absence from this projection is not absence from the model.`] : []), 'Structural checks are not control-stability or compliance validation.'];
    const texts: TextLine[] = [];
    let next = 20;
    all.forEach(s => { const l = lines(s, 0, next, scene.width - 80, 11, 'muted', 400, 16); texts.push(...l); next += l.length * 16 + 7; });
    texts.push({ text: `${scene.viewId} · MODEL ${scene.revision.slice(0, 8)} · SOURCE → SEMANTICS → VIEW → SCENE`, x: 0, y: next + 12, size: 10, tone: 'accent', weight: 600 });
    scene.nodes.push(node('footer', 40, y, scene.width - 80, next + 30, 'Scope notes', texts));
    scene.height = y + next + 64;
}
export async function buildScene(model: SemanticModel, viewId: string, modeId?: string): Promise<Scene> {
    const view = computeView(model, viewId, modeId);
    const scene: Scene = { schemaVersion: 1, title: view.definition.kind === 'overview' ? model.title : view.definition.title, description: model.description, viewId, viewKind: view.definition.kind, mode: view.mode?.id, width: 1400, height: 900, nodes: [], edges: [], notes: [...model.notes], hiddenConnections: view.hiddenConnections, revision: revisionOf(model), audit: [] };
    if (view.definition.kind === 'control' || view.definition.kind === 'power') {
        const graph = await layoutGraph(view);
        scene.width = Math.max(880, graph.width + 80);
        let y = header(scene, scene.width);
        const scope = view.definition.kind === 'power' ? (view.mode ? `${view.mode.label.toUpperCase()} / DECLARED POWER FLOW` : 'HARDWARE CAPABILITY / NOT SIMULTANEOUS POWER FLOW') : 'EXPLICIT SIGNAL CONNECTIONS / DASHED LINES ARE FEEDBACK, NOT AN IMPLIED SIGN';
        scene.nodes.push(node('scope', 40, y, scene.width - 80, 24, scope, [{ text: scope, x: 0, y: 14, size: 10, tone: 'accent', weight: 600 }]));
        y += 38;
        const content = translated(graph, (scene.width - graph.width) / 2, y);
        scene.nodes.push(...content.nodes);
        scene.edges.push(...content.edges);
        if (!graph.nodes.length)
            scene.nodes.push(node('empty-view', 60, y + 20, 640, 60, 'Empty view', lines('No elements match this view and mode. Adjust include, focus or mode filters.', 0, 20, 620, 17, 'muted')));
        footer(scene, y + graph.height + 24);
    }
    else if (view.definition.kind === 'matrix') {
        const modes = view.mode ? [view.mode] : model.modes, first = 230, cell = 208, gap = 8;
        scene.width = Math.max(1000, 80 + first + modes.length * (cell + gap));
        let y = header(scene, scene.width);
        scene.nodes.push(node('matrix-key', 40, y, first, 60, 'CONTROL QUANTITY', [{ text: 'CONTROL QUANTITY', x: 8, y: 30, size: 12, tone: 'muted', weight: 600 }]));
        modes.forEach((m, i) => scene.nodes.push(node(`mode:${m.id}`, 40 + first + i * (cell + gap), y, cell, 62, m.label, [...lines(m.label, 16, 26, cell - 32, 16, 'ink', 600), { text: m.group, x: 16, y: 48, size: 11, tone: 'muted' }], 'card', { collection: 'modes', id: m.id })));
        y += 74;
        for (const q of model.quantities) {
            const owners = modes.map(m => model.components.flatMap(c => (m.controls[c.id] ?? []).filter(a => a.quantity === q.id).map(a => ({ c, a }))));
            const h = Math.max(82, ...owners.map(list => list.reduce((n, { c }) => n + wrap(c.label, cell - 30, 14).length * 19 + 24, 18)));
            scene.nodes.push(node(`quantity:${q.id}`, 40, y, first - gap, h, q.label, [{ text: q.symbol, x: 16, y: 31, size: 25, tone: q.exclusive ? 'accent' : 'ink', weight: 600 }, ...lines(q.label, 16, 55, first - 40, 12, 'muted', 400, 16)], 'card', { collection: 'quantities', id: q.id }, q.exclusive ? 'accent' : 'ink'));
            modes.forEach((m, i) => {
                const texts: TextLine[] = [];
                let yy = 27;
                for (const { c, a } of owners[i]) {
                    const l = lines(c.label, 16, yy, cell - 30, 14, 'ink', 600, 19);
                    texts.push(...l);
                    yy += l.length * 19;
                    texts.push({ text: a.role, x: 16, y: yy, size: 11, tone: a.role === 'regulator' ? 'accent' : 'muted' });
                    yy += 24;
                }
                if (!texts.length)
                    texts.push({ text: 'Not assigned', x: 16, y: 36, size: 13, tone: 'muted' });
                scene.nodes.push(node(`assignment:${m.id}:${q.id}`, 40 + first + i * (cell + gap), y, cell, h, `${m.label} / ${q.label}`, texts, 'card', { collection: 'quantities', id: q.id }));
            });
            y += h + 8;
        }
        footer(scene, y + 20);
    }
    else {
        // Curated page composition; only the power-path subgraph needs ELK.
        const powerView = { ...view, definition: { ...view.definition, kind: 'power' as const, grouped: true } };
        const virtualModel = { ...model, views: [powerView.definition] };
        const graph = model.components.length ? await layoutGraph(computeView(virtualModel, viewId)) : { nodes: [], edges: [], width: 0, height: 0 };
        scene.width = Math.max(1400, graph.width + 80);
        let y = header(scene, scene.width);
        const groups = [...new Set(model.modes.map(m => m.group))];
        const cardWidth = (scene.width - 80 - 20 * (Math.min(2, groups.length) - 1)) / Math.min(2, Math.max(1, groups.length));
        for (let row = 0; row < groups.length; row += 2) {
            let rowH = 120;
            groups.slice(row, row + 2).forEach((g, col) => {
                const labels = model.modes.filter(m => m.group === g).map(m => m.label).join('  ·  ');
                const textLines = lines(labels, 22, 85, cardWidth - 44, 16, row + col ? 'violet' : 'accent', 500, 24);
                const h = Math.max(118, 88 + textLines.length * 24);
                rowH = Math.max(rowH, h);
                scene.nodes.push(node(`mode-group:${row + col}`, 40 + col * (cardWidth + 20), y, cardWidth, h, g, [{ text: `${model.modes.filter(m => m.group === g).length} OPERATING MODES`, x: 22, y: 24, size: 10, tone: 'muted', weight: 600 }, { text: g, x: 22, y: 58, size: 23, tone: 'ink', weight: 600 }, ...textLines], 'card', undefined, row + col ? 'violet' : 'accent'));
            });
            y += rowH + 20;
        }
        scene.nodes.push(node('power-heading', 40, y + 10, scene.width - 80, 24, 'Power conversion', [{ text: '01 / POWER CONVERSION', x: 0, y: 14, size: 12, tone: 'muted', weight: 600 }, { text: 'BIDIRECTIONAL CAPABILITY ≠ EVERY MODE IS BIDIRECTIONAL', x: scene.width - 80, y: 14, size: 10, tone: 'muted', anchor: 'end' }]));
        y += 56;
        const content = translated(graph, (scene.width - graph.width) / 2, y);
        scene.nodes.push(...content.nodes);
        scene.edges.push(...content.edges);
        y += graph.height + 34;
        scene.nodes.push(node('ownership-heading', 40, y, scene.width - 80, 24, 'Control responsibility', [{ text: '02 / CONTROL RESPONSIBILITY', x: 0, y: 14, size: 12, tone: 'muted', weight: 600 }, { text: 'FUNCTION ASSIGNMENTS, NOT INDEPENDENT SETPOINTS', x: scene.width - 80, y: 14, size: 10, tone: 'muted', anchor: 'end' }]));
        y += 38;
        for (let row = 0; row < groups.length; row += 2) {
            const panels = groups.slice(row, row + 2).map((group, col) => {
                const modes = model.modes.filter(m => m.group === group), texts: TextLine[] = [{ text: group.toUpperCase(), x: 22, y: 25, size: 11, tone: col ? 'violet' : 'accent', weight: 600 }];
                let yy = 64;
                for (const c of model.components.filter(c => c.kind === 'converter')) {
                    texts.push({ text: c.label, x: 22, y: yy, size: 18, weight: 600 });
                    yy += 27;
                    for (const q of model.quantities.filter(q => modes.some(m => m.controls[c.id]?.some(a => a.quantity === q.id)))) {
                        const enabled = modes.filter(m => m.controls[c.id]?.some(a => a.quantity === q.id));
                        texts.push({ text: q.symbol, x: 22, y: yy, size: 16, tone: q.exclusive ? 'accent' : 'ink', weight: 600 });
                        const l = lines(`${q.label}${enabled.length === modes.length ? '' : '  ·  ' + enabled.map(m => m.label).join(', ') + ' only'}`, 100, yy, cardWidth - 122, 13, 'muted', 400, 19);
                        texts.push(...l);
                        yy += Math.max(26, l.length * 19);
                    }
                    yy += 21;
                }
                return { col, group, texts, h: yy + 4 };
            });
            const h = Math.max(...panels.map(p => p.h));
            for (const p of panels)
                scene.nodes.push(node(`owners:${row + p.col}`, 40 + p.col * (cardWidth + 20), y, cardWidth, h, p.group, p.texts, 'card', undefined, p.col ? 'violet' : 'accent'));
            y += h + 20;
        }
        const exclusive = model.quantities.find(q => q.exclusive);
        if (exclusive) {
            const texts = [{ text: `${exclusive.symbol.toUpperCase()} / DECLARED REGULATION OWNER`, x: 22, y: 25, size: 11, tone: 'accent' as const, weight: 700 }];
            const owners = new Map<string, string[]>();
            for (const m of model.modes) {
                const owner = model.components.filter(c => m.controls[c.id]?.some(a => a.quantity === exclusive.id && a.role === 'regulator')).map(c => c.label).join(' + ') || 'Not declared';
                owners.set(owner, [...(owners.get(owner) ?? []), m.label]);
            }
            let yy = 54;
            for (const [owner, names] of owners) {
                const l = lines(`${names.join(' / ')}  →  ${owner}`, 22, yy, scene.width - 124, 16, 'ink', 500, 22);
                texts.push(...l as typeof texts);
                yy += l.length * 22 + 5;
            }
            scene.nodes.push(node('focus-ownership', 40, y, scene.width - 80, yy + 14, exclusive.label, texts, 'card', { collection: 'quantities', id: exclusive.id }, 'accent'));
            y += yy + 30;
        }
        footer(scene, y);
    }
    scene.audit = auditScene(scene);
    return scene;
}
