import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Model } from './model.ts';
import type { SignalLayout } from './render.ts';
import { textWidth, wrap } from './svg.ts';
/** Layout only. No themes or SVG strings enter ELK. */
export async function layoutSignals(model: Model): Promise<SignalLayout> {
  const spec = model.signals;
  if (!spec) throw new Error('The model has no signal graph.');
  const endpoint = (e: { node: string; port?: string }) => e.port ? `${e.node}:${e.port}` : e.node;
  const graph: ElkNode = {
    id: 'signal-root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.randomSeed': '1', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.spacing.nodeNodeBetweenLayers': '64', 'elk.spacing.nodeNode': '38',
      'elk.spacing.edgeNode': '24', 'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: spec.nodes.map(n => ({
      id: n.id, width: 220,
      height: 60 + wrap(n.label, 188, 17).length * 23 + wrap(n.detail ?? '', 188, 12).length * 17,
      layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
      ports: n.ports.map(p => ({ id: `${n.id}:${p.id}`, width: 1, height: 1, layoutOptions: { 'elk.port.side': p.side } })),
    })),
    edges: spec.edges.map(e => ({ id: e.id, sources: [endpoint(e.from)], targets: [endpoint(e.to)],
      labels: e.label ? [{ text: e.label, width: textWidth(e.label, 12), height: 18 }] : [],
    })),
  };
  const elk = new ELK();
  try {
    const output = await elk.layout(graph);
    return {
      width: output.width ?? 0, height: output.height ?? 0,
      nodes: (output.children ?? []).map(n => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0, width: n.width ?? 220, height: n.height ?? 100 })),
      edges: (output.edges ?? []).map(e => ({ id: e.id,
        paths: (e.sections ?? []).map(s => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]),
        labels: (e.labels ?? []).map(l => ({ text: l.text ?? '', x: l.x ?? 0, y: l.y ?? 0, width: l.width ?? 0, height: l.height ?? 18 })),
      })),
    };
  } finally { elk.terminateWorker(); }
}
