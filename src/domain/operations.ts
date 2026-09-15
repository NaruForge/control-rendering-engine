import { z } from 'zod';
import { identifier, text, roleSchema, blockSchema, signalSchema, viewSchema, flowSchema, stableJson } from './schema.ts';
import type { SemanticModel, ModelSource, Format } from './schema.ts';
import { compile, requireModel } from '../compiler/compile.ts';
import { serialize } from '../compiler/serialize.ts';
export const operationSchema = z.discriminatedUnion('op', [
    z.strictObject({ op: z.literal('label'), collection: z.enum(['components', 'blocks', 'quantities', 'modes']), id: identifier, label: text }),
    z.strictObject({ op: z.literal('assign_control'), mode: identifier, component: identifier, quantity: identifier, role: roleSchema }),
    z.strictObject({ op: z.literal('remove_control'), mode: identifier, component: identifier, quantity: identifier }),
    z.strictObject({ op: z.literal('set_flow'), mode: identifier, link: identifier, flow: flowSchema }),
    z.strictObject({ op: z.literal('set_math'), block: identifier, math: z.string().max(256) }),
    z.strictObject({ op: z.literal('add_block'), block: blockSchema }),
    z.strictObject({ op: z.literal('connect'), signal: signalSchema }),
    z.strictObject({ op: z.literal('disconnect'), signal: identifier }),
    z.strictObject({ op: z.literal('add_view'), view: viewSchema }),
]);
export type Operation = z.infer<typeof operationSchema>;
export { diffModels } from './diff.ts';
import { diffModels } from './diff.ts';
/** A transaction returns new source, never writes files. Every intermediate operation sees resolved controls. */
export function applyOperations(sourceText: string, operations: unknown[], expectedRevision?: string, outputFormat?: Format) {
    const base = requireModel(sourceText);
    if (expectedRevision && expectedRevision !== base.revision)
        throw new Error('STALE_REVISION: the model changed; inspect it again before proposing edits.');
    const ops = z.array(operationSchema).min(1).max(32).parse(operations);
    let value = structuredClone(base.source);
    for (const op of ops) {
        if (op.op === 'label') {
            const target = value[op.collection].find(e => e.id === op.id);
            if (!target)
                throw new Error(`Unknown ${op.collection} '${op.id}'.`);
            target.label = op.label;
        }
        else if (op.op === 'assign_control' || op.op === 'remove_control') {
            const raw = value.modes.find(m => m.id === op.mode);
            if (!raw)
                throw new Error(`Unknown mode '${op.mode}'.`);
            // Resolve parent lists before replacement; preserve sibling quantities.
            const inherited = (id: string): NonNullable<ModelSource['modes'][number]['controls']> => {
                const m = value.modes.find(m => m.id === id)!;
                return { ...(m.extends ? inherited(m.extends) : {}), ...m.controls };
            };
            const list = (inherited(op.mode)[op.component] ?? []).filter(a => a.quantity !== op.quantity);
            if (op.op === 'assign_control')
                list.push({ quantity: op.quantity, role: op.role });
            raw.controls = { ...raw.controls, [op.component]: list };
        }
        else if (op.op === 'set_flow') {
            const raw = value.modes.find(m => m.id === op.mode);
            if (!raw)
                throw new Error(`Unknown mode '${op.mode}'.`);
            raw.flow = { ...raw.flow, [op.link]: op.flow };
        }
        else if (op.op === 'set_math') {
            const b = value.blocks.find(b => b.id === op.block);
            if (!b)
                throw new Error(`Unknown block '${op.block}'.`);
            if (op.math)
                b.math = op.math;
            else
                delete b.math;
        }
        else if (op.op === 'add_block')
            value.blocks.push(op.block);
        else if (op.op === 'connect')
            value.signals.push(op.signal);
        else if (op.op === 'disconnect') {
            if (!value.signals.some(s => s.id === op.signal))
                throw new Error(`Unknown signal '${op.signal}'.`);
            value.signals = value.signals.filter(s => s.id !== op.signal);
        }
        else
            value.views.push(op.view);
    }
    const output = serialize(value, outputFormat ?? base.format);
    const result = requireModel(output, outputFormat ?? base.format);
    return { source: output, format: result.format, revision: result.revision, changes: diffModels(base.model, result.model), diagnostics: result.diagnostics };
}
