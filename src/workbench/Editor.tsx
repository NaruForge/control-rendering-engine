import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, StreamLanguage, bracketMatching, foldGutter } from '@codemirror/language';
import { yaml } from '@codemirror/lang-yaml';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { setDiagnostics } from '@codemirror/lint';
import { searchKeymap } from '@codemirror/search';
import type { Diagnostic, Format } from '../domain/schema.ts';
export interface EditorHandle {
    focusRange(from: number, to: number): void;
}
const grammar = StreamLanguage.define({
    token(stream) {
        if (stream.eatSpace())
            return null;
        if (stream.match('//')) {
            stream.skipToEnd();
            return 'comment';
        }
        if (stream.match(/"(?:[^"\\]|\\.)*"/))
            return 'string';
        if (stream.match(/\b(architecture|quantity|component|power|mode|group|extends|flow|controls|block|owner|port|signal|view|include|focus|depth|direction|note|math|detail|description)\b/))
            return 'keyword';
        if (stream.match(/\b(regulator|inner-loop|command|limit|unspecified|in|out|WEST|EAST|NORTH|SOUTH|RIGHT|DOWN|feedback|exclusive|forward|reverse|bidirectional|off|grouped)\b/))
            return 'atom';
        if (stream.match(/[a-z][a-zA-Z0-9_-]*/))
            return 'variableName';
        stream.next();
        return null;
    },
});
export const SourceEditor = forwardRef<EditorHandle, {
    value: string;
    format: Format;
    diagnostics: Diagnostic[];
    symbols: {
        label: string;
        detail: string;
    }[];
    onChange(value: string): void;
}>((props, ref) => {
    const host = useRef<HTMLDivElement>(null), editor = useRef<EditorView>(null), latest = useRef(props), language = useRef(new Compartment());
    latest.current = props;
    useImperativeHandle(ref, () => ({ focusRange(from, to) {
            const e = editor.current;
            if (!e)
                return;
            const start = Math.max(0, Math.min(e.state.doc.length, from)), end = Math.max(start, Math.min(e.state.doc.length, to));
            e.dispatch({ selection: { anchor: start, head: end }, effects: EditorView.scrollIntoView(start, { y: 'center' }) });
            e.focus();
        } }));
    useEffect(() => {
        if (!host.current)
            return;
        const e = new EditorView({ parent: host.current, state: EditorState.create({ doc: latest.current.value, extensions: [
                    lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(), history(), bracketMatching(), foldGutter(),
                    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...completionKeymap]), syntaxHighlighting(defaultHighlightStyle),
                    language.current.of(latest.current.format === 'control' ? grammar : yaml()),
                    autocompletion({ override: [context => {
                                const word = context.matchBefore(/[\w-]*/);
                                if (!word || (word.from === word.to && !context.explicit))
                                    return null;
                                return { from: word.from, options: latest.current.symbols.map(s => ({ ...s, type: 'variable' })) };
                            }] }),
                    EditorView.updateListener.of(update => { if (update.docChanged)
                        latest.current.onChange(update.state.doc.toString()); }),
                    EditorView.contentAttributes.of({ 'aria-label': 'Architecture source', spellcheck: 'false' }),
                    EditorView.theme({ '&': { height: '100%', fontSize: '12px' }, '.cm-scroller': { overflow: 'auto', fontFamily: 'Cascadia Code, Consolas, monospace', lineHeight: '1.7' }, '.cm-content': { padding: '16px 0' }, '.cm-gutters': { background: '#f7f9fc', color: '#9aa9bb', border: 'none' }, '.cm-activeLine': { background: '#edf5f580' }, '&.cm-focused': { outline: 'none' } }),
                ] }) });
        editor.current = e;
        return () => { editor.current = null; e.destroy(); };
    }, []);
    useEffect(() => { const e = editor.current; if (e && props.value !== e.state.doc.toString())
        e.dispatch({ changes: { from: 0, to: e.state.doc.length, insert: props.value } }); }, [props.value]);
    useEffect(() => { editor.current?.dispatch({ effects: language.current.reconfigure(props.format === 'control' ? grammar : yaml()) }); }, [props.format]);
    useEffect(() => {
        const e = editor.current;
        if (!e)
            return;
        e.dispatch(setDiagnostics(e.state, props.diagnostics.map(d => ({ from: Math.min(e.state.doc.length, d.span?.from ?? 0), to: Math.min(e.state.doc.length, d.span?.to ?? 1), severity: d.severity, message: `${d.code}: ${d.message}` }))));
    }, [props.diagnostics]);
    return <div ref={host} className="code-editor"/>;
});
