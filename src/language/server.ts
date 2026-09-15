/** Stdio LSP adapter over the same Langium front-end and semantic compiler as CLI/UI/MCP. */
import { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind, CompletionItemKind, SymbolKind, DiagnosticSeverity } from 'vscode-languageserver/node.js';
import type { Range } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { compile } from '../compiler/compile.ts';
import { serialize } from '../compiler/serialize.ts';
import type { Compilation } from '../domain/schema.ts';
const connection = createConnection(ProposedFeatures.all), documents = new TextDocuments(TextDocument), models = new Map<string, Compilation>();
const range = (d: TextDocument, from: number, to: number): Range => ({ start: d.positionAt(from), end: d.positionAt(to) });
connection.onInitialize(() => ({ capabilities: { textDocumentSync: TextDocumentSyncKind.Full, completionProvider: { triggerCharacters: ['.'] }, documentSymbolProvider: true, definitionProvider: true, hoverProvider: true, documentFormattingProvider: true }, serverInfo: { name: 'control-studio-language', version: '0.2.0' } }));
documents.onDidChangeContent(({ document }) => {
    const c = compile(document.getText(), document.languageId === 'control' ? 'control' : undefined);
    models.set(document.uri, c);
    connection.sendDiagnostics({ uri: document.uri, version: document.version, diagnostics: c.diagnostics.map(d => ({ message: d.message, code: d.code, severity: d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning, source: 'control-studio', range: range(document, d.span?.from ?? 0, d.span?.to ?? 1) })) });
});
documents.onDidClose(({ document }) => { models.delete(document.uri); connection.sendDiagnostics({ uri: document.uri, diagnostics: [] }); });
function symbols(uri: string) {
    const c = models.get(uri);
    if (!c?.model)
        return [];
    return (['components', 'blocks', 'signals', 'quantities', 'modes', 'views', 'powerLinks'] as const).flatMap(key => c.model![key].map((e, i) => ({ id: e.id, label: 'label' in e ? e.label : 'title' in e ? e.title : e.id, kind: key, element: e, span: c.sourceMap[`${key}.${i}`] })));
}
function word(uri: string, position: {
    line: number;
    character: number;
}) {
    const doc = documents.get(uri);
    if (!doc)
        return '';
    const source = doc.getText(), offset = doc.offsetAt(position), before = source.slice(0, offset).match(/[a-z0-9_-]*$/)?.[0] ?? '', after = source.slice(offset).match(/^[a-z0-9_-]*/)?.[0] ?? '';
    return before + after;
}
connection.onCompletion(({ textDocument }) => [...['architecture', 'component', 'quantity', 'block', 'port', 'signal', 'mode', 'controls', 'view', 'note'].map(label => ({ label, kind: CompletionItemKind.Keyword })), ...symbols(textDocument.uri).map(s => ({ label: s.id, detail: `${s.kind}: ${s.label}`, kind: CompletionItemKind.Reference }))]);
connection.onDocumentSymbol(({ textDocument }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc)
        return [];
    return symbols(doc.uri).filter(s => s.span).map(s => ({ name: s.id, detail: `${s.kind} · ${s.label}`, kind: SymbolKind.Object, range: range(doc, s.span!.from, s.span!.to), selectionRange: range(doc, s.span!.from, s.span!.to) }));
});
connection.onDefinition(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc)
        return null;
    const token = word(doc.uri, position);
    return symbols(doc.uri).filter(s => s.id === token && s.span).map(s => ({ uri: doc.uri, range: range(doc, s.span!.from, s.span!.to) }));
});
connection.onHover(({ textDocument, position }) => {
    const token = word(textDocument.uri, position), matches = symbols(textDocument.uri).filter(s => s.id === token);
    return matches.length ? { contents: { kind: 'plaintext', value: matches.map(s => `${s.kind}: ${s.id}\n${JSON.stringify(s.element, null, 2)}`).join('\n\n') } } : null;
});
connection.onDocumentFormatting(({ textDocument }) => {
    const d = documents.get(textDocument.uri), c = models.get(textDocument.uri);
    return d && c?.ok ? [{ range: range(d, 0, d.getText().length), newText: serialize(c.source!, c.format) }] : [];
});
documents.listen(connection);
connection.listen();
