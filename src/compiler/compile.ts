import { parseDocument, LineCounter, isMap, isSeq, isScalar } from 'yaml';
import { parseControl } from '../language/frontend.ts';
import { validate } from '../domain/validate.ts';
import { migrateV1 } from './migrate.ts';
import type { Compilation, Format, SourceMap } from '../domain/schema.ts';
export function detectFormat(source: string): Format {
    return /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*architecture\b/.test(source) ? 'control' : source.trimStart().startsWith('{') ? 'json' : 'yaml';
}
export function compile(source: string, requested?: Format): Compilation {
    const format = requested ?? detectFormat(source), sourceMap: SourceMap = {};
    const fail = (code: string, message: string): Compilation => ({ ok: false, format, sourceMap, migrated: false, diagnostics: [{ severity: 'error', code, path: '', message }] });
    if (new TextEncoder().encode(source).length > 131072)
        return fail('SOURCE_LIMIT', 'Source exceeds 128 KiB. Split it into smaller views/models.');
    try {
        if (format === 'control') {
            const parsed = parseControl(source);
            if (parsed.diagnostics.length)
                return { ok: false, format, sourceMap: parsed.sourceMap, migrated: false, diagnostics: parsed.diagnostics };
            return validate(parsed.value, format, parsed.sourceMap);
        }
        if (format === 'json')
            JSON.parse(source);
        const lineCounter = new LineCounter();
        const doc = parseDocument(source, { uniqueKeys: true, strict: true, lineCounter });
        if (doc.errors.length || doc.warnings.length)
            return {
                ok: false, format, sourceMap, migrated: false,
                diagnostics: [...doc.errors, ...doc.warnings].map(e => ({ severity: 'error', code: 'YAML_SYNTAX', path: '', message: e.message, span: { from: e.pos[0], to: e.pos[1], line: lineCounter.linePos(e.pos[0]).line, column: lineCounter.linePos(e.pos[0]).col } })),
            };
        const visit = (node: unknown, path: string) => {
            if (node && typeof node === 'object' && 'range' in node && Array.isArray(node.range)) {
                const [from, to] = node.range as number[];
                const loc = lineCounter.linePos(from);
                sourceMap[path] = { from, to, line: loc.line, column: loc.col };
            }
            if (isMap(node)) {
                for (const pair of node.items)
                    if (isScalar(pair.key))
                        visit(pair.value, path ? `${path}.${pair.key.value}` : String(pair.key.value));
            }
            else if (isSeq(node))
                node.items.forEach((item, i) => visit(item, `${path}.${i}`));
        };
        visit(doc.contents, '');
        const value = doc.toJS({ maxAliasCount: 30 });
        const migrated = value?.schemaVersion === 1;
        return validate(migrated ? migrateV1(value) : value, format, sourceMap, migrated);
    }
    catch (error) {
        return fail('PARSE', error instanceof Error ? error.message : String(error));
    }
}
export function requireModel(source: string, format?: Format) {
    const c = compile(source, format);
    if (!c.ok)
        throw new Error(c.diagnostics.map(d => `${d.code}${d.span ? ` (${d.span.line}:${d.span.column})` : ''}: ${d.message}`).join('\n'));
    return { ...c, source: c.source!, model: c.model!, revision: c.revision! };
}
