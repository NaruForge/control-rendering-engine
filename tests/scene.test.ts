import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { requireModel } from '../src/compiler/compile.ts';
import { computeView } from '../src/compiler/view.ts';
import { buildScene } from '../src/scene/build.ts';
import { toSvg } from '../src/scene/export.ts';
import { nodeMarkup } from '../src/scene/primitives.ts';
import { themes } from '../src/scene/theme.ts';
import { auditScene } from '../src/layout/audit.ts';
import { typeset } from '../src/scene/math.ts';
const cascade = requireModel(await readFile('examples/cascade.control', 'utf8')).model;
for (const file of ['obcm.control', 'cascade.control', 'branched.control', 'symbols.control', 'signal-loop.yaml'])
    test(`${file}: every view has a clean structural layout audit`, async () => { const m = requireModel(await readFile('examples/' + file, 'utf8')).model; for (const v of m.views) {
        const s = await buildScene(m, v.id);
        assert.deepEqual(s.audit, [], JSON.stringify(s.audit));
        assert(s.width > 0 && s.height > 0);
        assert(!/NaN|undefined/.test(toSvg(s)));
    } });
test('ordinary control signals advance; both feedback edges target the declared sum inputs', async () => { const s = await buildScene(cascade, 'cascade'), nodes = new Map(s.nodes.map(n => [n.id, n])); for (const e of s.edges) {
    const from = nodes.get(e.from)!, to = nodes.get(e.to)!;
    if (e.kind === 'feedback') {
        assert(from.x > to.x);
        const end = e.paths.at(-1)!.at(-1)!, port = to.ports.find(p => p.id === e.toPort)!;
        assert.equal(port.side, 'SOUTH');
        assert.equal(port.sign, '-');
        assert(Math.abs(end.x - to.x - port.x) < 1.1 && Math.abs(end.y - to.y - port.y) < 1.1);
    }
    else
        assert(from.x < to.x);
} });
test('model renaming does not activate hidden node-specific layout rules', async () => { const original = await buildScene(cascade, 'cascade'); const model = structuredClone(cascade); const ids = new Map(model.blocks.map((b, i) => [b.id, `b${i}`])); model.blocks.forEach(b => b.id = ids.get(b.id)!); model.signals.forEach(e => { e.from.block = ids.get(e.from.block)!; e.to.block = ids.get(e.to.block)!; }); model.views = model.views.filter(v => v.id === 'cascade'); const renamed = await buildScene(model, 'cascade'); for (const n of original.nodes.filter(n => n.ref?.collection === 'blocks')) {
    const r = renamed.nodes.find(r => r.ref?.id === ids.get(n.ref!.id))!;
    assert.equal(n.x, r.x);
    assert.equal(n.y, r.y);
} });
test('subset and focus views report connection boundaries', () => { const v = computeView(cascade, 'current_loop'); assert(v.hiddenConnections > 0); assert(v.nodes.length < cascade.blocks.length); const t = computeView(cascade, 'measurement_trace'); assert(t.nodes.some(n => n.ref.id === 'sense')); assert.throws(() => computeView(cascade, 'absent'), /Unknown view/); });
test('mode projection does not leak blocks or dangling edges from other modes', () => { const m = structuredClone(cascade); m.modes.push({ ...m.modes[0], id: 'other', label: 'Other' }); m.blocks.find(b => b.id === 'v_ctrl')!.modes = ['other']; const v = computeView(m, 'cascade', m.modes[0].id); assert(!v.nodes.some(n => n.ref.id === 'v_ctrl')); assert(!v.edges.some(e => e.from === 'blocks:v_ctrl' || e.to === 'blocks:v_ctrl')); assert(v.hiddenConnections > 0); });
test('scene and SVG are deterministic; exported node primitives are exactly those used by the UI', async () => { const a = await buildScene(cascade, 'cascade'), b = await buildScene(cascade, 'cascade'); assert.deepEqual(a, b); for (const theme of ['studio', 'midnight', 'paper'] as const) {
    assert.equal(toSvg(a, theme), toSvg(b, theme));
    for (const n of a.nodes)
        assert(toSvg(a, theme).includes(nodeMarkup(n, themes[theme])));
} });
test('typesetting produces portable glyph paths, rejects unsupported and invalid input', async () => { const m = await typeset('\\frac{K_i}{s}'); assert(m.body.includes('<path')); assert(!m.body.includes('href=')); assert.deepEqual(m, await typeset('\\frac{K_i}{s}')); await assert.rejects(typeset('\\href{https://example.com}{x}'), /Unsupported/); await assert.rejects(typeset('\\unknowncommand{x}'), /Invalid/); });
test('SVG text is escaped and never interpreted as HTML or a script', async () => { const m = structuredClone(cascade); m.title = '<script>alert(1)</script>'; m.blocks[0].label = '<img src=x onerror=x>'; const svg = toSvg(await buildScene(m, 'cascade')); assert(!svg.includes('<script>')); assert(!svg.includes('<img ')); assert(svg.includes('&lt;img')); assert(!svg.includes('foreignObject')); assert(!svg.includes('<image ')); });
test('audit catches broken endpoints and node overlap instead of only checking SVG existence', async () => { const s = await buildScene(cascade, 'cascade'); const nodes = s.nodes.filter(n => n.ref?.collection === 'blocks'); nodes[1].x = nodes[0].x; nodes[1].y = nodes[0].y; const errors = auditScene(s); assert(errors.some(a => a.code.includes('OVERLAP'))); assert(errors.some(a => a.code.includes('ENDPOINT'))); });
