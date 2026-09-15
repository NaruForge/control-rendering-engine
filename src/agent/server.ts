import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { compile, requireModel } from '../compiler/compile.ts';
import { buildScene } from '../scene/build.ts';
import { toSvg } from '../scene/export.ts';
import { inspectElement, traceSignal, ownership } from '../domain/query.ts';
import { applyOperations, operationSchema } from '../domain/operations.ts';
import { diffModels } from '../domain/diff.ts';
import { modelSchema } from '../domain/schema.ts';
const source = z.string().max(131072).describe('Complete .control, YAML or JSON source text. No file paths or URLs.'), id = z.string().max(64);
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const server = new McpServer({ name: 'control-studio', version: '0.2.0' }, { instructions: 'Model-first control diagrams. All tools are local pure computations: no filesystem writes or network requests. Inspect, propose edits with an expected revision, validate, render and review. No stability, safety or certification judgment is performed.' });
function result(value: Record<string, unknown>) {
    const text = JSON.stringify(value);
    if (new TextEncoder().encode(text).length > 4 * 1024 * 1024)
        throw new Error('OUTPUT_LIMIT: result exceeds 4 MiB; narrow the view or query.');
    return { content: [{ type: 'text' as const, text }], structuredContent: value };
}
async function guarded(run: () => Promise<Record<string, unknown>> | Record<string, unknown>) {
    try {
        return result(await run());
    }
    catch (error) {
        return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }] };
    }
}
server.registerTool('validate_model', { description: 'Parse and validate source with source-linked diagnostics. Does not infer stability or engineering conformance.', inputSchema: { source }, annotations }, ({ source }) => guarded(() => {
    const c = compile(source);
    return { ok: c.ok, revision: c.revision, format: c.format, migrated: c.migrated, diagnostics: c.diagnostics };
}));
server.registerTool('list_views', { description: 'List computed view definitions and mode IDs from the validated semantic model.', inputSchema: { source }, annotations }, ({ source }) => guarded(() => {
    const c = requireModel(source);
    return { revision: c.revision, views: c.model.views, modes: c.model.modes.map(m => ({ id: m.id, label: m.label })) };
}));
server.registerTool('inspect_element', { description: 'Inspect a declared element, its source span and explicit relations.', inputSchema: { source, collection: z.enum(['components', 'blocks', 'signals', 'quantities', 'modes', 'views']), id }, annotations }, args => guarded(() => {
    const c = requireModel(args.source);
    const i = c.model[args.collection].findIndex(e => e.id === args.id);
    return { revision: c.revision, ...inspectElement(c.model, args.collection, args.id), span: c.sourceMap[`${args.collection}.${i}`] };
}));
server.registerTool('trace_signal', { description: 'Bounded graph traversal with cycle handling and explicit boundary connections.', inputSchema: { source, block: id, direction: z.enum(['upstream', 'downstream', 'both']).default('both'), depth: z.number().int().min(0).max(12).default(3), includeFeedback: z.boolean().default(true) }, annotations }, args => guarded(() => {
    const c = requireModel(args.source);
    return { revision: c.revision, ...traceSignal(c.model, args.block, args.direction, args.depth, args.includeFeedback) };
}));
server.registerTool('get_control_owners', { description: 'Query resolved mode-dependent assignments, without interpreting unspecified roles.', inputSchema: { source, quantity: id.optional() }, annotations }, args => guarded(() => {
    const c = requireModel(args.source);
    return { revision: c.revision, assignments: ownership(c.model, args.quantity) };
}));
server.registerTool('render_view', { description: 'Compile a view to the same scene used by the UI and deterministic SVG export. Includes structural layout audit, not engineering approval.', inputSchema: { source, view: id, mode: id.optional(), theme: z.enum(['studio', 'midnight', 'paper']).default('studio'), includeScene: z.boolean().default(false) }, annotations }, args => guarded(async () => {
    const c = requireModel(args.source);
    const scene = await buildScene(c.model, args.view, args.mode);
    return { revision: c.revision, width: scene.width, height: scene.height, audit: scene.audit, svg: toSvg(scene, args.theme), ...(args.includeScene ? { scene } : {}) };
}));
server.registerTool('compare_models', { description: 'Compare validated semantic models by stable ID; includes inherited effects but excludes whitespace and canvas coordinates.', inputSchema: { before: source, after: source }, annotations }, args => guarded(() => {
    const a = requireModel(args.before), b = requireModel(args.after);
    return { beforeRevision: a.revision, afterRevision: b.revision, changes: diffModels(a.model, b.model) };
}));
server.registerTool('propose_operations', { description: 'Apply a bounded atomic semantic edit proposal to supplied source and return newly validated text plus diff. Never writes files. expectedRevision detects stale input; formatting/comments are normalized, so review before saving.', inputSchema: { source, expectedRevision: z.string().regex(/^[0-9a-f]{16}$/), operations: z.array(operationSchema).min(1).max(32), outputFormat: z.enum(['control', 'yaml', 'json']).optional() }, annotations }, args => guarded(() => applyOperations(args.source, args.operations, args.expectedRevision, args.outputFormat)));
server.registerResource('semantic-schema', 'control://schema/v2', { description: 'Canonical semantic interchange schema; referential checks also run in the compiler.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, text: JSON.stringify(z.toJSONSchema(modelSchema, { target: 'draft-7' })), mimeType: 'application/json' }] }));
server.registerPrompt('edit-control-architecture', { description: 'Safe model-first authoring workflow', argsSchema: { task: z.string().max(2000) } }, ({ task }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Task: ${task}\nInspect the current source with validate_model and inspect_element. Preserve undeclared facts as unknown. Use propose_operations with the returned expectedRevision. Never infer feedback signs, mode power directions, loop hierarchy, stability or compliance. Run compare_models and render_view and inspect the resulting diagram before approving a file change. The tool returns proposed source but does not save or commit it.` } }] }));
await server.connect(new StdioServerTransport());
