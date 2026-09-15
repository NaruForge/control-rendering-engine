import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compile, requireModel } from '../src/compiler/compile.ts';
import { validate } from '../src/domain/validate.ts';
import { serialize } from '../src/compiler/serialize.ts';
import { validateModel as legacyValidate } from '../src/legacy/model.ts';
import { parse } from 'yaml';
import { modelSchema } from '../src/domain/schema.ts';
import { z } from 'zod';
const obcm = await readFile('examples/obcm.control', 'utf8'), cascade = await readFile('examples/cascade.control', 'utf8');
const m = requireModel(obcm), c = requireModel(cascade);
const fresh = () => structuredClone(m.source), control = () => structuredClone(c.source);
function rejects(value: unknown, code: string) { const r = validate(value); assert(!r.ok); assert(r.diagnostics.some(d => d.code === code), JSON.stringify(r.diagnostics)); }
for (const file of ['obcm', 'cascade', 'branched', 'symbols'])
    test(`${file}: Langium/YAML/JSON roundtrip preserves semantic revision`, async () => {
        const a = requireModel(await readFile(`examples/${file}.control`, 'utf8'));
        for (const format of ['control', 'yaml', 'json'] as const) {
            const b = requireModel(serialize(a.source, format), format);
            assert.equal(b.revision, a.revision);
            assert.deepEqual(b.model, a.model);
        }
    });
for (const file of ['obcm', 'signal-loop'])
    test(`${file}: v1 migration preserves flows, roles, directions and mode scope`, async () => {
        const source = await readFile(`examples/${file}.yaml`, 'utf8');
        const old = legacyValidate(parse(source)), n = requireModel(source);
        assert(n.migrated);
        assert.deepEqual(n.model.modes.map(m => m.controls), old.modes.map(m => m.controls));
        assert.deepEqual(n.model.modes.map(m => m.flow), old.modes.map(m => m.flow));
        assert.equal(n.model.signals.length, old.signals?.edges.length ?? 0);
        for (const e of old.signals?.edges ?? []) {
            const next = n.model.signals.find(s => s.id === e.id)!;
            assert.equal(next.from.block, e.from.node);
            assert.equal(next.to.block, e.to.node);
            assert.equal(next.kind, e.kind);
        }
        assert.equal(requireModel(serialize(n.source, 'control')).revision, n.revision);
    });
test('V2G-specific P/Q and V2H flow remain explicit', () => {
    const charge = m.model.modes.find(m => m.id === 'charging')!, grid = m.model.modes.find(m => m.id === 'v2g')!, home = m.model.modes.find(m => m.id === 'v2h')!;
    assert(!charge.controls.inverter.some(a => a.quantity === 'q'));
    assert(grid.controls.inverter.some(a => a.quantity === 'q'));
    assert(grid.controls.cllc.some(a => a.quantity === 'p'));
    assert.equal(home.flow.ac_inv, 'reverse');
    assert(home.note?.includes('not inferred'));
    assert.equal(home.controls.inverter.find(a => a.quantity === 'iac')?.role, 'unspecified');
});
test('validation does not mutate input and rejects unknown keys', () => { const v = fresh(), before = structuredClone(v); validate(v); assert.deepEqual(v, before); rejects({ ...v, typo: true }, 'SCHEMA'); });
test('empty explicit child controls clear the inherited stage', () => { const v = fresh(); v.modes.find(m => m.id === 'v2g')!.controls = { inverter: [] }; assert.deepEqual(validate(v).model?.modes.find(m => m.id === 'v2g')?.controls.inverter, []); });
test('rejects duplicate collection and port IDs', () => { let v = fresh(); v.components.push(v.components[0]); rejects(v, 'DUPLICATE_ID'); const b = control(); b.blocks[0].ports.push(b.blocks[0].ports[0]); rejects(b, 'DUPLICATE_PORT'); });
test('rejects reserved identifiers and control characters', () => { const v = fresh(); v.id = 'constructor'; rejects(v, 'SCHEMA'); v.id = 'fine'; v.title = 'bad\u0001'; rejects(v, 'SCHEMA'); });
test('checks parent existence, kind, cycle and depth', () => { const v = fresh(); v.components[0].parent = 'missing'; rejects(v, 'PARENT'); const b = control(); b.components[0].parent = b.components[0].id; rejects(b, 'PARENT_CYCLE'); const chain = fresh(); chain.components = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, label: `Level ${i}`, kind: 'subsystem' as const, ...(i ? { parent: `n${i - 1}` } : {}) })); rejects(chain, 'DEPTH'); });
test('requires leaf power endpoints and no self links', () => { const v = fresh(); v.powerLinks[0].to = 'missing'; rejects(v, 'POWER_ENDPOINT'); v.powerLinks[0].to = v.powerLinks[0].from; rejects(v, 'POWER_SELF_LINK'); });
test('requires complete, capability-compatible mode flows', () => { const v = fresh(); delete v.modes[0].flow!.ac_inv; rejects(v, 'MISSING_FLOW'); const b = fresh(); b.powerLinks[0].capability = 'forward'; rejects(b, 'FLOW_CAPABILITY'); });
test('checks mode cycles, unknown parent and unknown flow link', () => { const v = fresh(); v.modes[0].extends = 'v2g'; rejects(v, 'MODE_CYCLE'); v.modes[0].extends = 'unknown'; rejects(v, 'UNKNOWN_PARENT'); const b = fresh(); b.modes[0].flow!.unknown = 'forward'; rejects(b, 'UNKNOWN_LINK'); });
test('checks control owner, quantities, duplicates and exclusive regulator', () => { const v = fresh(); v.modes[0].controls!.missing = [{ quantity: 'vdc', role: 'regulator' }]; rejects(v, 'CONTROL_OWNER'); const b = fresh(); b.modes[0].controls!.cllc = [{ quantity: 'vdc', role: 'regulator' }]; rejects(b, 'EXCLUSIVE_REGULATOR'); const d = fresh(); d.modes[0].controls!.inverter.push({ quantity: 'missing', role: 'limit' }); rejects(d, 'UNKNOWN_QUANTITY'); d.modes[0].controls!.inverter.push(d.modes[0].controls!.inverter[0]); rejects(d, 'DUPLICATE_CONTROL'); });
test('checks source/target ports, directions and quantity compatibility', () => { const v = control(); v.signals[0].to.port = 'missing'; rejects(v, 'SIGNAL_ENDPOINT'); const b = control(); b.signals[0].to = b.signals[0].from; rejects(b, 'PORT_DIRECTION'); const d = control(); d.signals[0].quantity = 'il'; rejects(d, 'QUANTITY_MISMATCH'); });
test('rejects multiple drivers rather than silently merging signals', () => { const v = control(); v.signals.push({ ...v.signals[0], id: 'duplicate' }); rejects(v, 'MULTIPLE_DRIVERS'); });
test('input signs only apply to sum inputs; unknown signs warn rather than inventing minus', () => { const v = control(); v.blocks[0].ports[0].sign = '-'; rejects(v, 'INPUT_SIGN'); const b = control(); const sum = b.blocks.find(b => b.kind === 'sum')!; delete sum.ports.find(p => p.direction === 'in')!.sign; const r = validate(b); assert(r.ok); assert(r.diagnostics.some(d => d.code === 'UNSPECIFIED_SIGN' && d.severity === 'warning')); });
test('view filters are validated and mode references must exist', () => { const v = control(); v.views[0].include = ['missing']; rejects(v, 'VIEW_REFERENCE'); v.views[0].mode = 'missing'; rejects(v, 'VIEW_MODE'); });
test('source-linked semantic diagnostics identify the declaration', () => { const invalid = cascade.replace('sum_v.feedback', 'sum_v.missing'); const r = compile(invalid); assert(!r.ok); const d = r.diagnostics.find(d => d.code === 'SIGNAL_ENDPOINT')!; assert(d.span && d.span.line > 1); assert(invalid.slice(d.span.from, d.span.to).includes('sum_v.missing')); });
test('Langium rejects syntax errors and duplicate scalar declarations', () => { assert(!compile('architecture x "Broken" { block', 'control').ok); const r = compile('architecture a "A" { description "first" description "second" }', 'control'); assert(r.diagnostics.some(d => d.code === 'SYNTAX')); });
test('Langium rejects repeated flow/control declarations instead of overwriting', () => { const text = obcm.replace('flow ac_inv forward', 'flow ac_inv forward\n flow ac_inv reverse'); assert(compile(text).diagnostics.some(d => d.code === 'DUPLICATE_DECLARATION')); });
test('YAML duplicate keys, excessive aliases, JSON errors and source size are rejected', () => { assert(!compile('schemaVersion: 2\nschemaVersion: 2').ok); assert(!compile('{"schemaVersion":2,}').ok); assert.equal(compile('x'.repeat(131073)).diagnostics[0].code, 'SOURCE_LIMIT'); assert(!compile('a: &a [1,2]\nb: &b [*a,*a,*a,*a,*a,*a]\nc: [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]').ok); });
test('interchange schema is generated from the actual strict runtime schema', () => { const schema = z.toJSONSchema(modelSchema, { target: 'draft-7' }); assert.equal(schema.additionalProperties, false); assert(schema.properties?.blocks); assert(schema.properties?.views); });
