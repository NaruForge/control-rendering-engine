import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { requireModel } from '../src/compiler/compile.ts';
const source = await readFile('examples/obcm.control', 'utf8'), cascade = await readFile('examples/cascade.control', 'utf8');
const run = promisify(execFile);
test('CLI validates, renders, migrates and reports semantic differences using real files', async () => {
    const out = await mkdtemp(join(tmpdir(), 'control-studio-'));
    try {
        const cli = (...args: string[]) => run(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', ...args], { maxBuffer: 8 * 1024 * 1024 });
        const v = await cli('validate', '--json');
        assert(JSON.parse(v.stdout).ok);
        await cli('render', '--input', 'examples/cascade.control', '--view', 'current_loop', '--out', out);
        assert((await readFile(join(out, 'current_loop.svg'), 'utf8')).includes('<svg'));
        await cli('migrate', '--input', 'examples/obcm.yaml', '--out', join(out, 'migrated.control'));
        assert(requireModel(await readFile(join(out, 'migrated.control'), 'utf8')).ok);
        await writeFile(join(out, 'after.control'), source.replace('"Inverter"', '"Edited inverter"'));
        const d = await cli('diff', '--before', 'examples/obcm.control', '--after', join(out, 'after.control'), '--json');
        assert(JSON.parse(d.stdout).changes.length > 0);
        await assert.rejects(cli('render', '--view', 'missing', '--out', out));
        await assert.rejects(cli('migrate', '--input', 'examples/obcm.yaml'));
    }
    finally {
        await rm(out, { recursive: true, force: true });
    }
});
test('MCP official client performs actual stdio handshake, semantic tools, proposals and rendering', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../scripts/mcp.mjs', import.meta.url))], cwd: tmpdir(), stderr: 'pipe' });
    const client = new Client({ name: 'studio-integration-test', version: '1.0.0' });
    let stderr = '';
    transport.stderr?.on('data', c => { stderr += c; });
    try {
        await client.connect(transport);
        const tools = await client.listTools();
        assert.equal(tools.tools.length, 8);
        assert(tools.tools.every(t => t.annotations?.readOnlyHint === true));
        const call = async (name: string, args: Record<string, unknown>) => { const r = await client.callTool({ name, arguments: args }); if (r.isError)
            throw new Error(JSON.stringify(r.content)); return r.structuredContent as Record<string, any>; };
        const v = await call('validate_model', { source });
        assert(v.ok);
        assert.equal(v.revision, requireModel(source).revision);
        const views = await call('list_views', { source });
        assert(views.views.length >= 3);
        const owners = await call('get_control_owners', { source, quantity: 'vdc' });
        assert.equal(owners.assignments.length, 5);
        const inspect = await call('inspect_element', { source: cascade, collection: 'blocks', id: 'i_ctrl' });
        assert.equal(inspect.element.kind, 'controller');
        assert(inspect.span.line > 1);
        const trace = await call('trace_signal', { source: cascade, block: 'sense', depth: 1 });
        assert(trace.boundaryEdges.length > 0);
        const edit = await call('propose_operations', { source, expectedRevision: v.revision, operations: [{ op: 'label', collection: 'components', id: 'inverter', label: 'Edited converter' }] });
        assert(edit.source.includes('Edited converter'));
        assert(edit.changes.length > 0);
        const diff = await call('compare_models', { before: source, after: edit.source });
        assert.equal(diff.changes.length, edit.changes.length);
        const image = await call('render_view', { source: cascade, view: 'current_loop' });
        assert(image.svg.includes('<svg'));
        assert.deepEqual(image.audit, []);
        await assert.rejects(call('propose_operations', { source, expectedRevision: '0000000000000000', operations: [{ op: 'label', collection: 'components', id: 'inverter', label: 'stale' }] }), /STALE_REVISION/);
        const resources = await client.listResources();
        assert(resources.resources.some(r => r.uri === 'control://schema/v2'));
        const schema = await client.readResource({ uri: 'control://schema/v2' });
        assert(schema.contents.length === 1);
        const prompts = await client.listPrompts();
        assert(prompts.prompts.length === 1);
        assert(!stderr.includes('Error'));
    }
    finally {
        await client.close();
        await transport.close();
    }
});
// Minimal LSP client tests wire framing, not direct calls to server handlers.
test('Language server sends diagnostics, symbols, completion, definitions and formatting over stdio', async () => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/lsp.mjs', import.meta.url)), '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let id = 0, buffer = Buffer.alloc(0), stderr = '';
    const pending = new Map<number, {
        resolve: (v: any) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }>();
    const notifications: any[] = [];
    child.stderr.on('data', c => { stderr += c; });
    child.stdout.on('data', data => { buffer = Buffer.concat([buffer, data]); while (true) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0)
            return;
        const length = Number(buffer.subarray(0, end).toString().match(/Content-Length: (\d+)/i)?.[1]);
        if (!length || buffer.length < end + 4 + length)
            return;
        const m = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString());
        buffer = buffer.subarray(end + 4 + length);
        if (m.id !== undefined) {
            const p = pending.get(m.id);
            if (p) {
                clearTimeout(p.timer);
                pending.delete(m.id);
                m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
            }
        }
        else
            notifications.push(m);
    } });
    const send = (m: any) => { const b = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...m })); child.stdin.write(`Content-Length: ${b.length}\r\n\r\n`); child.stdin.write(b); };
    const request = (method: string, params: any) => new Promise<any>((resolve, reject) => { const n = ++id; const timer = setTimeout(() => { pending.delete(n); reject(new Error(`LSP timeout: ${method}\n${stderr}`)); }, 10000); pending.set(n, { resolve, reject, timer }); send({ id: n, method, params }); });
    const waitFor = async (fn: () => boolean) => { for (let i = 0; i < 100; i++) {
        if (fn())
            return;
        await new Promise(r => setTimeout(r, 20));
    } throw new Error('Expected LSP notification'); };
    const uri = 'file:///workspace/example.control';
    try {
        const initialize = await request('initialize', { processId: null, rootUri: null, capabilities: {} });
        assert(initialize.capabilities.definitionProvider);
        send({ method: 'initialized', params: {} });
        send({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'control', version: 1, text: cascade } } });
        await waitFor(() => notifications.some(n => n.method === 'textDocument/publishDiagnostics'));
        assert.deepEqual(notifications.find(n => n.method === 'textDocument/publishDiagnostics').params.diagnostics, []);
        const complete = await request('textDocument/completion', { textDocument: { uri }, position: { line: 1, character: 0 } });
        assert(complete.some((x: any) => x.label === 'i_ctrl'));
        const symbols = await request('textDocument/documentSymbol', { textDocument: { uri } });
        assert(symbols.some((s: any) => s.name === 'sense'));
        const offset = cascade.indexOf('i_ctrl.input'), before = cascade.slice(0, offset), position = { line: before.split('\n').length - 1, character: offset - before.lastIndexOf('\n') - 1 };
        const def = await request('textDocument/definition', { textDocument: { uri }, position });
        assert(def.length > 0);
        const hover = await request('textDocument/hover', { textDocument: { uri }, position });
        assert(hover.contents.value.includes('i_ctrl'));
        const formatted = await request('textDocument/formatting', { textDocument: { uri }, options: { tabSize: 2, insertSpaces: true } });
        assert(requireModel(formatted[0].newText).ok);
        send({ method: 'textDocument/didChange', params: { textDocument: { uri, version: 2 }, contentChanges: [{ text: cascade.replace('sum_v.feedback', 'sum_v.missing') }] } });
        await waitFor(() => notifications.some(n => n.params?.version === 2 && n.params.diagnostics.length > 0));
        await request('shutdown', null);
        send({ method: 'exit' });
    }
    finally {
        for (const p of pending.values())
            clearTimeout(p.timer);
        child.kill();
    }
});
