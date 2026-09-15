import { z } from 'zod';
export const identifier = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/).refine(s => !['constructor', 'prototype', '__proto__'].includes(s), 'Reserved identifier');
export const text = z.string().min(1).max(160).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s), 'Control characters are not allowed');
export const roleSchema = z.enum(['regulator', 'inner-loop', 'command', 'limit', 'unspecified']);
export const assignmentSchema = z.strictObject({ quantity: identifier, role: roleSchema.default('unspecified') });
export const flowSchema = z.enum(['forward', 'reverse', 'bidirectional', 'off']);
export const componentSchema = z.strictObject({
    id: identifier, label: text, kind: z.enum(['external', 'converter', 'bus', 'subsystem']),
    technology: text.optional(), parent: identifier.optional(),
});
export const quantitySchema = z.strictObject({ id: identifier, symbol: text, label: text, unit: text.optional(), exclusive: z.boolean().default(false) });
export const powerLinkSchema = z.strictObject({ id: identifier, from: identifier, to: identifier, capability: z.enum(['forward', 'bidirectional']).default('bidirectional') });
export const modeSchema = z.strictObject({
    id: identifier, label: text, group: text, extends: identifier.optional(),
    flow: z.record(identifier, flowSchema).optional(),
    controls: z.record(identifier, z.array(assignmentSchema).max(32)).optional(), note: z.string().max(600).optional(),
});
export const portSchema = z.strictObject({
    id: identifier, direction: z.enum(['in', 'out']), side: z.enum(['WEST', 'EAST', 'NORTH', 'SOUTH']),
    quantity: identifier.optional(), sign: z.enum(['+', '-']).optional(),
});
export const blockKinds = ['reference', 'controller', 'sum', 'gain', 'integrator', 'transfer', 'limiter', 'plant', 'measurement', 'junction', 'switch'] as const;
export const blockSchema = z.strictObject({
    id: identifier, label: text, kind: z.enum(blockKinds), owner: identifier.optional(), detail: text.optional(),
    math: z.string().min(1).max(256).optional(), ports: z.array(portSchema).min(1).max(16),
    modes: z.array(identifier).max(32).default([]),
});
export const endpointSchema = z.strictObject({ block: identifier, port: identifier });
export const signalSchema = z.strictObject({
    id: identifier, from: endpointSchema, to: endpointSchema, label: text.optional(),
    kind: z.enum(['signal', 'feedback']).default('signal'), quantity: identifier.optional(),
});
export const viewSchema = z.strictObject({
    id: identifier, title: text, kind: z.enum(['overview', 'power', 'control', 'matrix']),
    mode: identifier.optional(), include: z.array(identifier).max(128).default([]),
    focus: identifier.optional(), depth: z.number().int().min(1).max(12).default(2),
    direction: z.enum(['RIGHT', 'DOWN']).default('RIGHT'), grouped: z.boolean().default(false),
});
export const modelSchema = z.strictObject({
    schemaVersion: z.literal(2), id: identifier, title: text, description: z.string().max(800).default(''),
    quantities: z.array(quantitySchema).max(64).default([]),
    components: z.array(componentSchema).max(64).default([]),
    powerLinks: z.array(powerLinkSchema).max(128).default([]),
    modes: z.array(modeSchema).max(32).default([]),
    blocks: z.array(blockSchema).max(128).default([]),
    signals: z.array(signalSchema).max(256).default([]),
    views: z.array(viewSchema).min(1).max(32),
    notes: z.array(z.string().min(1).max(600)).max(24).default([]),
});
export type ModelSource = z.infer<typeof modelSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Quantity = z.infer<typeof quantitySchema>;
export type Block = z.infer<typeof blockSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type Port = z.infer<typeof portSchema>;
export type ViewDefinition = z.infer<typeof viewSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Mode = Omit<ModelSource['modes'][number], 'extends' | 'flow' | 'controls'> & {
    flow: Record<string, Flow>;
    controls: Record<string, Assignment[]>;
};
export interface SemanticModel extends Omit<ModelSource, 'modes'> {
    modes: Mode[];
}
export interface SourceSpan {
    from: number;
    to: number;
    line: number;
    column: number;
}
export interface Diagnostic {
    severity: 'error' | 'warning';
    code: string;
    message: string;
    path: string;
    span?: SourceSpan;
}
export type SourceMap = Record<string, SourceSpan>;
export type Format = 'control' | 'yaml' | 'json';
export interface Compilation {
    ok: boolean;
    format: Format;
    diagnostics: Diagnostic[];
    sourceMap: SourceMap;
    source?: ModelSource;
    model?: SemanticModel;
    revision?: string;
    migrated: boolean;
}
export function stableJson(value: unknown): string {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(stableJson).join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
}
/** Deterministic revision token for stale edit detection, not a cryptographic signature. */
export function revisionOf(value: unknown): string {
    let hash = 0xcbf29ce484222325n;
    for (const byte of new TextEncoder().encode(stableJson(value)))
        hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
    return hash.toString(16).padStart(16, '0');
}
export function findSpan(sourceMap: SourceMap, path: string): SourceSpan | undefined {
    let key = path;
    while (key) {
        if (sourceMap[key])
            return sourceMap[key];
        key = key.includes('.') ? key.slice(0, key.lastIndexOf('.')) : '';
    }
    return sourceMap[''];
}
