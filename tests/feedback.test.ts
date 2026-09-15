import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseModel, render } from '../src/engine.ts';
import { layoutSignals } from '../src/layout.ts';

const source = await readFile(new URL('../examples/signal-loop.yaml', import.meta.url), 'utf8');
const model = parseModel(source);
const geometry = await layoutSignals(model);
const byId = new Map(geometry.nodes.map(n => [n.id, n]));
const epsilon = 1.1; // ELK's declared ports are 1 SVG unit wide/high.

test('feedback fixture: all ordinary signals advance and feedback returns to the declared controller', () => {
  assert.equal(geometry.nodes.length, model.signals!.nodes.length);
  assert.equal(geometry.edges.length, model.signals!.edges.length);
  for (const edge of model.signals!.edges) {
    const from = byId.get(edge.from.node)!, to = byId.get(edge.to.node)!;
    const routed = geometry.edges.find(e => e.id === edge.id)!;
    assert.equal(routed.paths.length, 1);
    const start = routed.paths[0][0], end = routed.paths[0].at(-1)!;
    assert(start.x >= from.x - epsilon && start.x <= from.x + from.width + epsilon);
    assert(start.y >= from.y - epsilon && start.y <= from.y + from.height + epsilon);
    assert(end.x >= to.x - epsilon && end.x <= to.x + to.width + epsilon);
    assert(end.y >= to.y - epsilon && end.y <= to.y + to.height + epsilon);
    if (edge.kind === 'feedback') {
      assert(from.x > to.x, `${edge.id}: feedback must return in this fixture`);
      assert(Math.abs(end.y - to.y - to.height) <= epsilon, `${edge.id}: preserve SOUTH input port`);
      const prior = routed.paths[0].at(-2)!;
      assert(prior.y > end.y, `${edge.id}: arrow must approach the feedback input from below`);
    } else assert(from.x + from.width < to.x, `${edge.id}: forward path order regressed`);
  }
});

test('feedback fixture: orthogonal routes do not pass through node interiors', () => {
  for (const edge of geometry.edges) for (const path of edge.paths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    assert(Object.values(a).every(Number.isFinite) && Object.values(b).every(Number.isFinite));
    assert(a.x === b.x || a.y === b.y, `${edge.id}: non-orthogonal segment`);
    for (const n of geometry.nodes) {
      const hit = a.y === b.y
        ? a.y > n.y && a.y < n.y + n.height && Math.max(a.x, b.x) > n.x && Math.min(a.x, b.x) < n.x + n.width
        : a.x > n.x && a.x < n.x + n.width && Math.max(a.y, b.y) > n.y && Math.min(a.y, b.y) < n.y + n.height;
      assert(!hit, `${edge.id} crosses ${n.id}`);
    }
  }
});

test('feedback fixture: edge label boxes do not overlap nodes', () => {
  for (const edge of geometry.edges) for (const l of edge.labels) for (const n of geometry.nodes) {
    const overlap = l.x - 3 < n.x + n.width && l.x + l.width + 3 > n.x && l.y - 2 < n.y + n.height && l.y + l.height + 2 > n.y;
    assert(!overlap, `${edge.id} label overlaps ${n.id}`);
  }
});

test('feedback preference is independent of domain-specific node identifiers', async () => {
  const renamed = structuredClone(model);
  const names = new Map(renamed.signals!.nodes.map((n, i) => [n.id, `n${i}`]));
  renamed.signals!.nodes.forEach(n => { n.id = names.get(n.id)!; });
  renamed.signals!.edges.forEach(e => { e.from.node = names.get(e.from.node)!; e.to.node = names.get(e.to.node)!; });
  const output = await layoutSignals(renamed);
  for (const n of geometry.nodes) {
    const other = output.nodes.find(x => x.id === names.get(n.id))!;
    assert.deepEqual({ x: other.x, y: other.y }, { x: n.x, y: n.y });
  }
});

test('a graph with no feedback tags still lays out its ordinary path', async () => {
  const m = structuredClone(model);
  m.signals!.edges = m.signals!.edges.filter(e => e.kind !== 'feedback');
  const output = await layoutSignals(m);
  for (const e of m.signals!.edges) {
    const from = output.nodes.find(n => n.id === e.from.node)!, to = output.nodes.find(n => n.id === e.to.node)!;
    assert(from.x + from.width < to.x);
  }
});

test('feedback styles and SVG geometry remain deterministic in every theme', async () => {
  for (const theme of ['studio', 'midnight', 'paper'] as const) {
    const a = await render(model, { view: 'signals', theme }), b = await render(model, { view: 'signals', theme });
    assert.equal(a.svg, b.svg);
    assert.equal((a.svg.match(/stroke-dasharray="6 4"/g) ?? []).length, 2);
    assert.equal((a.svg.match(/marker-end="url\(#signal-arrow\)"/g) ?? []).length, 7);
  }
});
