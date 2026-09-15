import type { AuditIssue, Scene, Point } from '../scene/types.ts';
const inside = (p: Point, r: {
    x: number;
    y: number;
    width: number;
    height: number;
}) => p.x > r.x + .01 && p.x < r.x + r.width - .01 && p.y > r.y + .01 && p.y < r.y + r.height - .01;
export function auditScene(scene: Pick<Scene, 'nodes' | 'edges'>): AuditIssue[] {
    const issues: AuditIssue[] = [], boxes = scene.nodes.filter(n => n.shape !== 'group' && n.shape !== 'text');
    for (let i = 0; i < boxes.length; i++)
        for (const b of boxes.slice(i + 1)) {
            const a = boxes[i];
            if (a.x < b.x + b.width - .01 && a.x + a.width > b.x + .01 && a.y < b.y + b.height - .01 && a.y + a.height > b.y + .01)
                issues.push({ code: 'NODE_OVERLAP', severity: 'error', ids: [a.id, b.id], message: `${a.label} overlaps ${b.label}.` });
        }
    for (const edge of scene.edges)
        for (const path of edge.paths) {
            if (path.length < 2)
                issues.push({ code: 'MISSING_ROUTE', severity: 'error', ids: [edge.id], message: 'An edge has no complete route.' });
            for (let i = 1; i < path.length; i++) {
                const a = path[i - 1], b = path[i];
                if (Math.abs(a.x - b.x) > .01 && Math.abs(a.y - b.y) > .01)
                    issues.push({ code: 'NON_ORTHOGONAL', severity: 'error', ids: [edge.id], message: 'A routed edge is not orthogonal.' });
                for (const n of boxes) {
                    const hit = Math.abs(a.y - b.y) < .01
                        ? a.y > n.y + .01 && a.y < n.y + n.height - .01 && Math.max(a.x, b.x) > n.x + .01 && Math.min(a.x, b.x) < n.x + n.width - .01
                        : a.x > n.x + .01 && a.x < n.x + n.width - .01 && Math.max(a.y, b.y) > n.y + .01 && Math.min(a.y, b.y) < n.y + n.height - .01;
                    if (hit)
                        issues.push({ code: 'EDGE_THROUGH_NODE', severity: 'error', ids: [edge.id, n.id], message: `${edge.id} passes through ${n.label}.` });
                }
            }
            for (const [endpoint, id, portId] of [[path[0], edge.from, edge.fromPort], [path.at(-1)!, edge.to, edge.toPort]] as const) {
                const n = scene.nodes.find(n => n.id === id), p = n?.ports.find(p => p.id === portId);
                if (n && p && Math.hypot(endpoint.x - n.x - p.x, endpoint.y - n.y - p.y) > 1.1)
                    issues.push({ code: 'ENDPOINT_MISMATCH', severity: 'error', ids: [edge.id, id], message: `${edge.id} does not meet its declared port.` });
            }
        }
    const labels = scene.edges.flatMap(e => e.labels.map(l => ({ ...l, id: e.id })));
    for (const l of labels)
        for (const n of boxes)
            if (l.x < n.x + n.width && l.x + l.width > n.x && l.y < n.y + n.height && l.y + l.height > n.y)
                issues.push({ code: 'LABEL_OVERLAP', severity: 'error', ids: [l.id, n.id], message: `Label '${l.text}' overlaps ${n.label}.` });
    for (let i = 0; i < labels.length; i++)
        for (const b of labels.slice(i + 1)) {
            const a = labels[i];
            if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y)
                issues.push({ code: 'LABEL_LABEL_OVERLAP', severity: 'warning', ids: [a.id, b.id], message: `Labels '${a.text}' and '${b.text}' overlap.` });
        }
    // De-duplicate an issue encountered on adjacent polyline segments.
    return issues.filter((x, i) => issues.findIndex(y => y.code === x.code && y.ids.join() === x.ids.join()) === i);
}
