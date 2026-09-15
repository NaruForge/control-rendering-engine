import { modelSchema, findSpan, revisionOf } from './schema.ts';
import type { Compilation, Diagnostic, Format, ModelSource, Mode, SourceMap, SemanticModel } from './schema.ts';
export function validate(value: unknown, format: Format = 'yaml', sourceMap: SourceMap = {}, migrated = false): Compilation {
    const diagnostics: Diagnostic[] = [];
    const report = (code: string, path: string, message: string, severity: Diagnostic['severity'] = 'error') => diagnostics.push({ code, path, message, severity, span: findSpan(sourceMap, path) });
    const parsed = modelSchema.safeParse(value);
    if (!parsed.success) {
        for (const error of parsed.error.issues)
            report('SCHEMA', error.path.join('.'), error.message);
        return { ok: false, format, diagnostics, sourceMap, migrated };
    }
    // Normalize optional undefined properties at the frontend boundary. All IR is JSON-compatible.
    const source = JSON.parse(JSON.stringify(parsed.data)) as ModelSource;
    const collections = ['quantities', 'components', 'powerLinks', 'modes', 'blocks', 'signals', 'views'] as const;
    for (const collection of collections) {
        const seen = new Set<string>();
        source[collection].forEach((entry, i) => { if (seen.has(entry.id))
            report('DUPLICATE_ID', `${collection}.${i}.id`, `Duplicate ${collection} id '${entry.id}'.`); seen.add(entry.id); });
    }
    const componentMap = new Map(source.components.map(c => [c.id, c]));
    const quantities = new Set(source.quantities.map(q => q.id));
    const blockMap = new Map(source.blocks.map(b => [b.id, b]));
    const modeMap = new Map(source.modes.map(m => [m.id, m]));
    const links = new Map(source.powerLinks.map(l => [l.id, l]));
    source.components.forEach((c, i) => {
        if (c.parent && componentMap.get(c.parent)?.kind !== 'subsystem')
            report('PARENT', `components.${i}.parent`, `Parent '${c.parent}' must be an existing subsystem.`);
        const seen = new Set<string>();
        let next: string | undefined = c.id;
        while (next) {
            if (seen.has(next)) {
                report('PARENT_CYCLE', `components.${i}`, `Component hierarchy contains a cycle at '${next}'.`);
                break;
            }
            seen.add(next);
            next = componentMap.get(next)?.parent;
        }
        if (seen.size > 8)
            report('DEPTH', `components.${i}`, 'Component hierarchy is limited to eight levels.');
    });
    source.powerLinks.forEach((l, i) => {
        for (const key of ['from', 'to'] as const) {
            const c = componentMap.get(l[key]);
            if (!c || c.kind === 'subsystem')
                report('POWER_ENDPOINT', `powerLinks.${i}.${key}`, `Power link endpoint '${l[key]}' must be a leaf component.`);
        }
        if (l.from === l.to)
            report('POWER_SELF_LINK', `powerLinks.${i}`, 'A power link must join two different components.');
    });
    const resolved = new Map<string, Mode>(), visiting = new Set<string>();
    function resolve(id: string): Mode | undefined {
        if (resolved.has(id))
            return resolved.get(id);
        const raw = modeMap.get(id);
        if (!raw)
            return undefined;
        const index = source.modes.indexOf(raw), path = `modes.${index}`;
        if (visiting.has(id)) {
            report('MODE_CYCLE', path, `Mode inheritance cycle at '${id}'.`);
            return undefined;
        }
        visiting.add(id);
        let parent: Mode | undefined;
        if (raw.extends) {
            if (!modeMap.has(raw.extends))
                report('UNKNOWN_PARENT', `${path}.extends`, `Unknown parent mode '${raw.extends}'.`);
            else
                parent = resolve(raw.extends);
        }
        const flow = { ...parent?.flow, ...raw.flow };
        const controls = structuredClone({ ...parent?.controls, ...raw.controls });
        for (const key of Object.keys(flow))
            if (!links.has(key))
                report('UNKNOWN_LINK', `${path}.flow`, `Unknown power link '${key}'.`);
        for (const l of source.powerLinks) {
            if (!flow[l.id])
                report('MISSING_FLOW', `${path}.flow`, `Mode '${id}' must declare a flow for '${l.id}'.`);
            else if (l.capability === 'forward' && ['reverse', 'bidirectional'].includes(flow[l.id]))
                report('FLOW_CAPABILITY', `${path}.flow`, `Mode '${id}' requests reverse flow on forward-only link '${l.id}'.`);
        }
        for (const [owner, assignments] of Object.entries(controls)) {
            if (componentMap.get(owner)?.kind !== 'converter')
                report('CONTROL_OWNER', `${path}.controls.${owner}`, `Control owner '${owner}' must be a converter component.`);
            const seen = new Set<string>();
            assignments.forEach((a, j) => {
                if (!quantities.has(a.quantity))
                    report('UNKNOWN_QUANTITY', `${path}.controls.${owner}.${j}`, `Unknown quantity '${a.quantity}'.`);
                if (seen.has(a.quantity))
                    report('DUPLICATE_CONTROL', `${path}.controls.${owner}.${j}`, `Quantity '${a.quantity}' is assigned twice on '${owner}'.`);
                seen.add(a.quantity);
            });
        }
        for (const q of source.quantities.filter(q => q.exclusive)) {
            const owners = Object.entries(controls).filter(([, a]) => a.some(x => x.quantity === q.id && x.role === 'regulator')).map(([owner]) => owner);
            if (owners.length > 1)
                report('EXCLUSIVE_REGULATOR', `${path}.controls`, `Multiple exclusive regulators for '${q.id}' in '${id}': ${owners.join(', ')}.`);
        }
        const result: Mode = { id: raw.id, label: raw.label, group: raw.group, flow, controls, note: raw.note ?? parent?.note };
        visiting.delete(id);
        resolved.set(id, result);
        return result;
    }
    const modes = source.modes.map(m => resolve(m.id)).filter((m): m is Mode => !!m);
    source.blocks.forEach((b, i) => {
        if (b.owner && !componentMap.has(b.owner))
            report('BLOCK_OWNER', `blocks.${i}.owner`, `Unknown component '${b.owner}'.`);
        b.modes.forEach(m => { if (!modeMap.has(m))
            report('BLOCK_MODE', `blocks.${i}.modes`, `Unknown mode '${m}'.`); });
        const seen = new Set<string>();
        b.ports.forEach((p, j) => {
            const path = `blocks.${i}.ports.${j}`;
            if (seen.has(p.id))
                report('DUPLICATE_PORT', path, `Duplicate port '${b.id}.${p.id}'.`);
            seen.add(p.id);
            if (p.quantity && !quantities.has(p.quantity))
                report('PORT_QUANTITY', path, `Unknown quantity '${p.quantity}'.`);
            if (p.sign && (p.direction !== 'in' || b.kind !== 'sum'))
                report('INPUT_SIGN', path, 'An input sign is only valid on a summing block input.');
        });
        if (b.kind === 'sum' && b.ports.filter(p => p.direction === 'in').some(p => !p.sign))
            report('UNSPECIFIED_SIGN', `blocks.${i}`, `Summing block '${b.id}' has an input without a declared sign.`, 'warning');
    });
    const drivers = new Set<string>();
    source.signals.forEach((s, i) => {
        const endpoints = [s.from, s.to].map((end, side) => {
            const b = blockMap.get(end.block);
            const p = b?.ports.find(p => p.id === end.port);
            if (!b || !p)
                report('SIGNAL_ENDPOINT', `signals.${i}.${side ? 'to' : 'from'}`, `Unknown endpoint '${end.block}.${end.port}'.`);
            else if (p.direction !== (side ? 'in' : 'out'))
                report('PORT_DIRECTION', `signals.${i}`, `Signal '${s.id}' must connect an output to an input.`);
            return p;
        });
        const target = `${s.to.block}.${s.to.port}`;
        if (drivers.has(target))
            report('MULTIPLE_DRIVERS', `signals.${i}`, `Input '${target}' has multiple drivers; use an explicit summing/junction block.`);
        drivers.add(target);
        const declared = [s.quantity, ...endpoints.map(p => p?.quantity)].filter((q): q is string => !!q);
        if (s.quantity && !quantities.has(s.quantity))
            report('SIGNAL_QUANTITY', `signals.${i}`, `Unknown quantity '${s.quantity}'.`);
        if (new Set(declared).size > 1)
            report('QUANTITY_MISMATCH', `signals.${i}`, `Quantity declarations disagree on '${s.id}': ${declared.join(', ')}. Add an explicit conversion block.`);
    });
    source.views.forEach((v, i) => {
        const path = `views.${i}`;
        if (v.mode && !modeMap.has(v.mode))
            report('VIEW_MODE', path, `Unknown view mode '${v.mode}'.`);
        if (v.kind === 'control' && !source.blocks.length)
            report('EMPTY_CONTROL_VIEW', path, 'A control view needs a declared block graph.');
        const allowed = v.kind === 'control' ? blockMap : componentMap;
        for (const id of [...v.include, ...(v.focus ? [v.focus] : [])])
            if (!allowed.has(id))
                report('VIEW_REFERENCE', path, `Unknown ${v.kind === 'control' ? 'block' : 'component'} '${id}' in view '${v.id}'.`);
        if (!['control', 'power'].includes(v.kind) && (v.include.length || v.focus || v.grouped))
            report('VIEW_OPTIONS', path, 'Filtering, focus and grouping are supported on graph views only.');
    });
    if (!source.blocks.length && !source.components.length)
        report('EMPTY_MODEL', '', 'Declare at least one component or control block.');
    const model: SemanticModel = { ...source, modes };
    const ok = !diagnostics.some(d => d.severity === 'error');
    return { ok, format, source, model: ok ? model : undefined, diagnostics, sourceMap, revision: ok ? revisionOf(model) : undefined, migrated };
}
export function assertValid(value: unknown): {
    source: ModelSource;
    model: SemanticModel;
} {
    const c = validate(value);
    if (!c.ok)
        throw new Error(c.diagnostics.map(d => `${d.code}: ${d.message}`).join('\n'));
    return { source: c.source!, model: c.model! };
}
