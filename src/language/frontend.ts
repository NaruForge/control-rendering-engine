import { createDefaultCoreModule, createDefaultSharedCoreModule, EmptyFileSystem, inject } from 'langium';
import type { AstNode } from 'langium';
import { ControlGeneratedModule, ControlGeneratedSharedModule } from './generated/module.ts';
import type { Architecture } from './generated/ast.ts';
import type { Diagnostic, SourceMap } from '../domain/schema.ts';
const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), ControlGeneratedSharedModule);
export const controlServices = inject(createDefaultCoreModule({ shared }), ControlGeneratedModule);
shared.ServiceRegistry.register(controlServices);
export function parseControl(source: string): {
    value?: unknown;
    sourceMap: SourceMap;
    diagnostics: Diagnostic[];
} {
    const result = controlServices.parser.LangiumParser.parse<Architecture>(source);
    const sourceMap: SourceMap = {}, diagnostics: Diagnostic[] = [];
    function span(path: string, node: AstNode) {
        const cst = node.$cstNode;
        if (cst)
            sourceMap[path] = { from: cst.offset, to: cst.end, line: cst.range.start.line + 1, column: cst.range.start.character + 1 };
    }
    const at = (offset: number, length: number) => { const before = source.slice(0, offset); return { from: offset, to: offset + length, line: before.split('\n').length, column: offset - before.lastIndexOf('\n') }; };
    for (const e of result.lexerErrors)
        diagnostics.push({ severity: 'error', code: 'LEXER', path: '', message: e.message, span: at(e.offset, e.length) });
    for (const e of result.parserErrors) {
        const token = e.token;
        diagnostics.push({ severity: 'error', code: 'SYNTAX', path: '', message: e.message, span: at(Number.isFinite(token.startOffset) ? token.startOffset : source.length, Math.max(1, token.image?.length ?? 1)) });
    }
    if (diagnostics.length)
        return { diagnostics, sourceMap };
    const ast = result.value;
    span('', ast);
    const duplicate = (path: string, label: string) => diagnostics.push({ severity: 'error', code: 'DUPLICATE_DECLARATION', path, message: `Duplicate ${label}; explicit declarations must not overwrite each other.`, span: sourceMap[path] });
    const value = {
        schemaVersion: 2, id: ast.name, title: ast.title, description: ast.description,
        quantities: ast.quantities.map((q, i) => { span(`quantities.${i}`, q); return { id: q.name, symbol: q.symbol, label: q.label, unit: q.unit, exclusive: q.exclusive }; }),
        components: ast.components.map((c, i) => { span(`components.${i}`, c); return { id: c.name, label: c.label, kind: c.kind, technology: c.technology, parent: c.parent?.$refText }; }),
        powerLinks: ast.powerLinks.map((l, i) => { span(`powerLinks.${i}`, l); return { id: l.name, from: l.from.$refText, to: l.to.$refText, capability: l.capability }; }),
        modes: ast.modes.map((m, i) => {
            span(`modes.${i}`, m);
            const flow: Record<string, string> = {}, controls: Record<string, {
                quantity: string;
                role: string;
            }[]> = {};
            m.flows.forEach(f => { if (Object.hasOwn(flow, f.link.$refText))
                duplicate(`modes.${i}`, `flow '${f.link.$refText}'`); flow[f.link.$refText] = f.direction; });
            m.controls.forEach(c => {
                span(`modes.${i}.controls.${c.owner.$refText}`, c);
                if (Object.hasOwn(controls, c.owner.$refText))
                    duplicate(`modes.${i}`, `controls for '${c.owner.$refText}'`);
                controls[c.owner.$refText] = c.assignments.map(a => ({ quantity: a.quantity.$refText, role: a.role }));
            });
            return { id: m.name, label: m.label, group: m.group, extends: m.parent?.$refText, note: m.note, flow, controls };
        }),
        blocks: ast.blocks.map((b, i) => {
            span(`blocks.${i}`, b);
            return { id: b.name, label: b.label, kind: b.kind, owner: b.owner?.$refText, detail: b.detail, math: b.math, modes: b.modes.map(m => m.$refText), ports: b.ports.map((p, j) => {
                    span(`blocks.${i}.ports.${j}`, p);
                    return { id: p.name, direction: p.direction, side: p.side, quantity: p.quantity?.$refText, sign: p.sign };
                }) };
        }),
        signals: ast.signals.map((s, i) => { span(`signals.${i}`, s); return { id: s.name, from: { block: s.from.block.$refText, port: s.from.port }, to: { block: s.to.block.$refText, port: s.to.port }, label: s.label, kind: s.feedback ? 'feedback' : 'signal', quantity: s.quantity?.$refText }; }),
        views: ast.views.map((v, i) => { span(`views.${i}`, v); return { id: v.name, title: v.title, kind: v.kind, mode: v.mode?.$refText, include: v.include, focus: v.focus, depth: v.depth || undefined, direction: v.direction, grouped: v.grouped }; }),
        notes: ast.notes,
    };
    return { value, sourceMap, diagnostics };
}
