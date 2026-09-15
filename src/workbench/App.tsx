import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Blocks, BookOpen, Braces, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Code2, Columns3, Download, FilePlus2, FolderOpen, GitCompareArrows, Layers, LoaderCircle, Network, PanelLeftClose, PanelRightClose, Plus, Redo2, Save, Search, Settings2, Sparkles, Undo2, X } from 'lucide-react';
import type { Connection } from '@xyflow/react';
import obcm from '../../examples/obcm.control?raw';
import cascade from '../../examples/cascade.control?raw';
import branched from '../../examples/branched.control?raw';
import symbolsExample from '../../examples/symbols.control?raw';
import type { Compilation, Format, SemanticModel } from '../domain/schema.ts';
import { blockKinds } from '../domain/schema.ts';
import type { Operation } from '../domain/operations.ts';
import { diffModels } from '../domain/diff.ts';
import { traceSignal } from '../domain/query.ts';
import { serialize } from '../compiler/serialize.ts';
import { toSvg } from '../scene/export.ts';
import type { EntityRef, Scene } from '../scene/types.ts';
import type { ThemeName } from '../scene/theme.ts';
import { Diagram } from './Diagram.tsx';
import { SourceEditor } from './Editor.tsx';
import type { EditorHandle } from './Editor.tsx';
import { Inspector } from './Inspector.tsx';
import './studio.css';
const examples = { obcm: { label: 'OBCM architecture', text: obcm }, cascade: { label: 'Cascaded control study', text: cascade }, branched: { label: 'Branched power system', text: branched }, symbols: { label: 'Control symbol library', text: symbolsExample } };
type Snapshot = {
    text: string;
    format: Format;
};
type Modal = 'ai' | 'review' | 'add-block' | 'add-view' | 'connection' | 'trace' | undefined;
function download(content: BlobPart, name: string, type: string) { const u = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
const keywords = ['architecture', 'quantity', 'component', 'power', 'mode', 'controls', 'block', 'port', 'signal', 'feedback', 'view', 'include', 'focus', 'note'].map(label => ({ label, detail: 'Control language' }));
export function App() {
    const [history, setHistory] = useState<Snapshot[]>([{ text: obcm, format: 'control' }]), [cursor, setCursor] = useState(0);
    const current = history[cursor];
    const currentRef = useRef(current);
    currentRef.current = current;
    const [example, setExample] = useState<keyof typeof examples>('obcm'), [filename, setFilename] = useState('obcm.control');
    const [saved, setSaved] = useState(obcm), [compilation, setCompilation] = useState<Compilation>(), [scene, setScene] = useState<Scene>();
    const [baseline, setBaseline] = useState<SemanticModel>(), [busy, setBusy] = useState(true), [error, setError] = useState('');
    const [view, setView] = useState<string>(), [mode, setMode] = useState(''), [theme, setTheme] = useState<ThemeName>('studio');
    const [sourceOpen, setSourceOpen] = useState(false), [sidebar, setSidebar] = useState(true), [inspectorOpen, setInspectorOpen] = useState(false), [selected, setSelected] = useState<EntityRef>();
    const [search, setSearch] = useState(''), [modal, setModal] = useState<Modal>(), [pendingConnection, setPendingConnection] = useState<Connection>();
    const [notice, setNotice] = useState(''), [diagnosticsOpen, setDiagnosticsOpen] = useState(false), [trace, setTrace] = useState<ReturnType<typeof traceSignal>>();
    const worker = useRef<Worker>(null), seq = useRef(0), editor = useRef<EditorHandle>(null), input = useRef<HTMLInputElement>(null), first = useRef(true), editPending = useRef(false);
    const baselineRef = useRef(baseline);
    baselineRef.current = baseline;
    const sourceCurrent = useRef({ history, cursor });
    sourceCurrent.current = { history, cursor };
    function replace(next: Snapshot, mergeTyping = false) {
        if (next.text === currentRef.current.text && next.format === currentRef.current.format)
            return;
        seq.current++;
        setBusy(true);
        setScene(undefined);
        setError('');
        const { history: h, cursor: c } = sourceCurrent.current;
        const past = h.slice(0, c + 1), nextHistory = [...past, next].slice(-80);
        setHistory(nextHistory);
        setCursor(nextHistory.length - 1);
    }
    const handleReplace = useRef(replace);
    handleReplace.current = replace;
    useEffect(() => {
        const w = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
        worker.current = w;
        w.onmessage = event => {
            const m = event.data;
            if (m.id !== seq.current)
                return;
            if (m.error) {
                if (m.compilation)
                    setCompilation(m.compilation);
                setError(m.error);
                setBusy(false);
                editPending.current = false;
                if (m.kind === 'compile')
                    setScene(undefined);
                return;
            }
            if (m.kind === 'operation') {
                editPending.current = false;
                setModal(undefined);
                setNotice(`Applied ${m.result.changes.length} semantic change${m.result.changes.length === 1 ? '' : 's'}. Formatting normalized; Undo is available.`);
                handleReplace.current({ text: m.result.source, format: m.result.format });
                return;
            }
            setCompilation(m.compilation);
            setScene(m.scene);
            setBusy(false);
            if (m.compilation.ok && !baselineRef.current) {
                setBaseline(m.compilation.model);
                baselineRef.current = m.compilation.model;
            }
            if (!m.compilation.ok)
                setDiagnosticsOpen(true);
        };
        w.onerror = e => { setError(e.message); setBusy(false); };
        return () => { worker.current = null; w.terminate(); };
    }, []);
    useEffect(() => {
        const id = ++seq.current;
        setBusy(true);
        setError('');
        setScene(undefined);
        const timer = setTimeout(() => worker.current?.postMessage({ id, kind: 'compile', source: current.text, format: current.format, view, mode: mode || undefined }), first.current ? 0 : 240);
        first.current = false;
        return () => clearTimeout(timer);
    }, [current, view, mode]);
    const dirty = current.text !== saved;
    useEffect(() => { const f = (e: BeforeUnloadEvent) => { if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f); }, [dirty]);
    const model = compilation?.model, valid = !!compilation?.ok && !busy;
    const canExport = valid && !!scene && !scene.audit.some(a => a.severity === 'error');
    const changes = useMemo(() => baseline && model ? diffModels(baseline, model) : [], [baseline, model]);
    const symbols = useMemo(() => model ? [...keywords, ...(['quantities', 'components', 'modes', 'blocks', 'views'] as const).flatMap(c => model[c].map(e => ({ label: e.id, detail: c })))] : keywords, [model]);
    const diagnostics = compilation?.diagnostics ?? [];
    const diagnosticCount = diagnostics.length + (scene?.audit.length ?? 0) + (error ? 1 : 0);
    function load(text: string, format: Format, name: string) { seq.current++; setHistory([{ text, format }]); setCursor(0); setSaved(text); setFilename(name); setView(undefined); setMode(''); setSelected(undefined); setInspectorOpen(false); setBaseline(undefined); baselineRef.current = undefined; setCompilation(undefined); setScene(undefined); setModal(undefined); setNotice(''); }
    function select(ref?: EntityRef) { setSelected(ref); if (ref)
        setInspectorOpen(true); }
    function edit(operations: Operation[]) {
        if (!valid || !compilation?.revision || editPending.current)
            return;
        editPending.current = true;
        const id = ++seq.current;
        setBusy(true);
        setError('');
        worker.current?.postMessage({ id, kind: 'operation', source: current.text, revision: compilation.revision, operations, outputFormat: current.format });
    }
    function showSource(ref: EntityRef) {
        if (!model || !compilation)
            return;
        const i = model[ref.collection].findIndex(e => e.id === ref.id);
        const span = compilation.sourceMap[`${ref.collection}.${i}`];
        setSourceOpen(true);
        if (span)
            setTimeout(() => editor.current?.focusRange(span.from, span.to), 50);
    }
    function diagnostic(d: typeof diagnostics[number]) { setSourceOpen(true); if (d.span)
        setTimeout(() => editor.current?.focusRange(d.span!.from, d.span!.to), 50); }
    function traceBlock(id: string) { if (model) {
        setTrace(traceSignal(model, id, 'both', 2));
        setModal('trace');
    } }
    async function png() {
        if (!scene || !canExport)
            return;
        try {
            const url = URL.createObjectURL(new Blob([toSvg(scene, theme)], { type: 'image/svg+xml' }));
            try {
                const image = new Image();
                image.src = url;
                await image.decode();
                const scale = Math.min(2, Math.sqrt(32000000 / (scene.width * scene.height)), 16000 / Math.max(scene.width, scene.height));
                const c = document.createElement('canvas');
                c.width = Math.ceil(scene.width * scale);
                c.height = Math.ceil(scene.height * scale);
                const ctx = c.getContext('2d');
                if (!ctx)
                    throw new Error('Canvas is unavailable');
                ctx.drawImage(image, 0, 0, c.width, c.height);
                const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('PNG failed')), 'image/png'));
                download(blob, `${scene.viewId}.png`, 'image/png');
            }
            finally {
                URL.revokeObjectURL(url);
            }
        }
        catch (e) {
            setNotice(`Export error: ${String(e)}`);
        }
    }
    const leftViews = model?.views ?? [];
    return <div className={`studio-app ${!sidebar ? 'sidebar-closed' : ''} ${inspectorOpen ? 'inspector-open' : ''}`}>
    <header className="topbar"><a className="brand" href="#" onClick={e => e.preventDefault()}><div className="brand-icon"><Activity size={23}/></div><div><strong>Control Studio<span> / NaruForge</span></strong><small>MODEL FIRST. ENGINEERING VIEWS.</small></div></a><div className="header-right"><span className="local-status"><i /> LOCAL WORKSPACE</span><button onClick={() => input.current?.click()}><FolderOpen size={14}/> Open</button><button onClick={() => { download(current.text, filename.replace(/\.[^.]+$/, '') + '.' + current.format, 'text/plain;charset=utf-8'); setSaved(current.text); }} data-testid="save-source"><Save size={14}/> Save source {dirty && <b className="dirty-dot"/>}</button><button className="agent-button" data-testid="agent-tools" onClick={() => setModal('ai')}><Sparkles size={14}/> Agent tools</button></div>
      <input ref={input} type="file" hidden accept=".control,.yaml,.yml,.json" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f)
        return; if (f.size > 131072) {
        setNotice('Input limit is 128 KiB.');
        return;
    } if (dirty && !confirm('Replace the unsaved source?'))
        return; load(await f.text(), f.name.endsWith('.control') ? 'control' : f.name.endsWith('.json') ? 'json' : 'yaml', f.name); }}/>
    </header>
    <aside className="sidebar"><div className="sidebar-caption">WORKSPACE <span>02</span></div><div className="example-picker"><Layers size={15}/><select aria-label="Example model" value={example} onChange={e => { const key = e.target.value as keyof typeof examples; if (dirty && !confirm('Replace the unsaved source?'))
        return; setExample(key); load(examples[key].text, 'control', `${key}.control`); }}>{Object.entries(examples).map(([id, e]) => <option key={id} value={id}>{e.label}</option>)}</select></div><div className="sidebar-separator"/>
      <div className="sidebar-caption">COMPUTED VIEWS <button aria-label="Add view" disabled={!valid} onClick={() => setModal('add-view')}><Plus size={13}/></button></div>
      <nav className="view-list">{leftViews.map((v, i) => <button key={v.id} data-testid={`view-${v.id}`} className={(scene?.viewId ?? view ?? leftViews[0]?.id) === v.id ? 'active' : ''} onClick={() => { setView(v.id); setMode(''); setSelected(undefined); }}><span className="view-icon">{v.kind === 'control' ? <Activity size={16}/> : v.kind === 'matrix' ? <Columns3 size={16}/> : v.kind === 'power' ? <Network size={16}/> : <Blocks size={16}/>}</span><span>{v.title}</span><small>{String(i + 1).padStart(2, '0')}</small></button>)}</nav>
      <div className="sidebar-caption">MODEL EXPLORER <small>{(model?.components.length ?? 0) + (model?.blocks.length ?? 0)}</small></div><label className="search"><Search size={13}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an element…" aria-label="Find element"/></label>
      <div className="explorer">{model && (['components', 'blocks', 'quantities'] as const).map(c => <details key={c} open={c === (model.blocks.length ? 'blocks' : 'components') || !!search}><summary>{c}<small>{model[c].length}</small></summary>{model[c].filter(e => `${e.id} ${e.label}`.toLowerCase().includes(search.toLowerCase())).map(e => <button key={e.id} data-testid={`element-${c}-${e.id}`} className={selected?.collection === c && selected.id === e.id ? 'selected' : ''} onClick={() => select({ collection: c, id: e.id })}><span className="tiny-square"/>{e.label}<small>{e.id}</small></button>)}</details>)}</div>
      <div className="sidebar-foot"><span>AUTHORING LANGUAGE</span><strong>{current.format === 'control' ? 'Control DSL' : current.format.toUpperCase()} <code>v{compilation?.migrated ? '1 → 2' : '2'}</code></strong><p>One model. Consistent views.<br />No cloud rendering or telemetry.</p></div>
    </aside>
    <main className="studio-main"><div className="document-toolbar"><div className="document-title"><button className="icon-button" aria-label="Toggle sidebar" onClick={() => setSidebar(!sidebar)}><PanelLeftClose size={17}/></button><div><h1>{scene?.viewId ? leftViews.find(v => v.id === scene.viewId)?.title : 'Architecture workspace'}</h1><small>{filename}{dirty ? ' · modified' : ''}</small></div></div><div className="document-actions"><select aria-label="Operating mode" value={mode} disabled={!model?.modes.length || !valid || scene?.viewKind === 'overview'} onChange={e => setMode(e.target.value)}><option value="">{scene?.viewKind === 'matrix' || scene?.viewKind === 'overview' ? 'Compare all modes' : 'Hardware capability'}</option>{model?.modes.map(m => <option value={m.id} key={m.id}>{m.label}</option>)}</select><select aria-label="Theme" value={theme} onChange={e => setTheme(e.target.value as ThemeName)}><option value="studio">Studio</option><option value="midnight">Midnight</option><option value="paper">Paper</option></select><button className="icon-button" aria-label="Undo model change" disabled={!cursor} onClick={() => setCursor(cursor - 1)}><Undo2 size={15}/></button><button className="icon-button" aria-label="Redo model change" disabled={cursor === history.length - 1} onClick={() => setCursor(cursor + 1)}><Redo2 size={15}/></button><button className={sourceOpen ? 'active' : ''} data-testid="toggle-source" onClick={() => setSourceOpen(!sourceOpen)}><Code2 size={14}/> Source</button><button data-testid="review-changes" disabled={!valid} onClick={() => setModal('review')}><GitCompareArrows size={14}/><span className="responsive-label"> Review</span>{changes.length > 0 && <b className="count-badge">{changes.length}</b>}</button><button onClick={png} disabled={!canExport}>PNG</button><button className="primary" data-testid="export-svg" disabled={!canExport} onClick={() => scene && download(toSvg(scene, theme), `${scene.viewId}.svg`, 'image/svg+xml')}><Download size={14}/> SVG</button><button className="icon-button" aria-label="Toggle inspector" onClick={() => setInspectorOpen(!inspectorOpen)}><PanelRightClose size={17}/></button></div></div>
      {notice && <div className="notice"><CheckCircle2 size={14}/><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={13}/></button></div>}
      <div className={`content-grid ${sourceOpen ? 'has-source' : ''}`}>
        {sourceOpen && <section className="source-panel"><div className="panel-title"><span><Braces size={13}/> SEMANTIC SOURCE</span><select aria-label="Source format" value={current.format} disabled={!valid} onChange={e => { if (compilation?.source)
        replace({ text: serialize(compilation.source, e.target.value as Format), format: e.target.value as Format }); }}><option value="control">.control</option><option value="yaml">.yaml</option><option value="json">.json</option></select></div><SourceEditor ref={editor} value={current.text} format={current.format} diagnostics={diagnostics} symbols={symbols} onChange={text => replace({ text, format: current.format }, true)}/><div className="source-footer">Langium parser · Semantic validation · Local worker</div></section>}
        <div className="diagram-column">{scene && <Diagram scene={scene} theme={theme} selected={selected} onSelect={select} onConnect={c => { setPendingConnection(c); setModal('connection'); }}/>}
          {!scene && <div className={`empty-diagram ${busy ? 'loading' : ''}`}>{busy ? <><LoaderCircle className="spin" size={27}/><h2>Compiling your model</h2><p>Source → semantic model → computed view → scene</p></> : <><CircleAlert size={27}/><h2>{error ? 'View could not be rendered' : 'Source needs attention'}</h2><p>{error || `${diagnostics.filter(d => d.severity === 'error').length} diagnostic${diagnostics.length === 1 ? '' : 's'} prevent compilation. The previous diagram is not shown as current.`}</p><button onClick={() => { setSourceOpen(true); setDiagnosticsOpen(true); }}>Open source and diagnostics</button></>}</div>}
          {scene?.viewKind === 'control' && <button className="add-block-float" data-testid="add-block" onClick={() => setModal('add-block')} disabled={!valid}><Plus size={14}/> Add block</button>}
        </div>
        {inspectorOpen && <aside className="inspector"><div className="panel-title"><span><Settings2 size={13}/> INSPECTOR</span><button aria-label="Close inspector" onClick={() => setInspectorOpen(false)}><X size={13}/></button></div>{selected && model && compilation ? <Inspector key={`${selected.collection}:${selected.id}:${compilation.revision}`} compilation={compilation} selected={selected} mode={mode || undefined} onEdit={edit} onSource={showSource} onTrace={traceBlock}/> : <div className="inspector-empty"><CrosshairIcon /><h3>Inspect the model</h3><p>Select a block, signal or component. Its declared properties and source are available here.</p><small>Canvas geometry is generated; semantic edits stay in the source.</small></div>}</aside>}
      </div>
      <section className={`diagnostics-panel ${diagnosticsOpen ? 'expanded' : ''}`}><button className="diagnostics-toggle" data-testid="diagnostics-toggle" onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}>{diagnosticsOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}{diagnosticCount ? <CircleAlert size={12}/> : <Check size={12}/>}<span>DIAGNOSTICS</span><b>{diagnosticCount}</b><small>{busy ? 'Compiling…' : valid ? 'Model valid · Layout audit is structural, not an engineering approval' : 'Validation required'}</small></button>{diagnosticsOpen && <div className="diagnostics-body">{error && <div className="diagnostic error"><CircleAlert size={14}/><strong>RENDER / OPERATION</strong><span>{error}</span></div>}{diagnostics.map((d, i) => <button className={`diagnostic ${d.severity}`} key={i} onClick={() => diagnostic(d)}><CircleAlert size={13}/><code>{d.code}</code><span>{d.message}</span><small>{d.span ? `L${d.span.line}:${d.span.column}` : d.path}</small></button>)}{scene?.audit.map((a, i) => <div className={`diagnostic ${a.severity}`} key={`a${i}`}><CircleAlert size={13}/><code>{a.code}</code><span>{a.message}</span></div>)}{!diagnosticCount && <p className="empty-copy">No syntax, reference or layout diagnostics for this view. Stability, timing and compliance are not evaluated.</p>}</div>}</section>
      <footer className="statusbar"><span className={valid ? 'success' : 'muted'}>{busy ? <LoaderCircle className="spin" size={11}/> : valid ? <CheckCircle2 size={11}/> : <CircleAlert size={11}/>}{busy ? 'Compiling model' : valid ? 'Model valid · Preview up to date' : 'Not rendered'}</span><span>{model?.blocks.length ?? 0} blocks · {model?.signals.length ?? 0} signals · {model?.modes.length ?? 0} modes</span><code>{compilation?.revision?.slice(0, 10) ?? '—'}</code></footer>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
            setModal(undefined); }}><section className={`modal ${modal === 'review' ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" onClick={() => setModal(undefined)}><X size={19}/></button>
      {modal === 'review' && <><div className="eyebrow">SEMANTIC CHANGE REVIEW</div><h2 id="modal-title">Changes since opening this model</h2><p className="modal-intro">Stable identifiers and resolved mode assignments are compared, not SVG coordinates. {changes.length} semantic changes.</p><div className="change-list">{!changes.length && <div className="no-changes"><CheckCircle2 size={24}/><p>No semantic changes.</p><small>Whitespace and formatting alone do not change the model.</small></div>}{changes.map((c, i) => <article key={i} className={`change ${c.kind}`}><header><b>{c.kind}</b><code>{c.collection}.{c.id}</code><small>{c.fields.join(', ')}</small></header><div className="diff-columns"><pre>{JSON.stringify(c.before, null, 2) ?? '(absent)'}</pre><pre>{JSON.stringify(c.after, null, 2) ?? '(absent)'}</pre></div></article>)}</div></>}
      {modal === 'ai' && <><div className="eyebrow">AI-NATIVE, WITHOUT A CLOUD DEPENDENCY</div><h2 id="modal-title">Give your agent the compiler</h2><p className="modal-intro">These are actual MCP tools using the same model compiler as this workspace. Your coding agent chooses its own model provider. No built-in chatbot or API key is required.</p><div className="tool-grid">{['validate_model', 'list_views', 'inspect_element', 'trace_signal', 'get_control_owners', 'render_view', 'compare_models', 'propose_operations'].map(t => <code key={t}>{t}</code>)}</div><h3>STDIO SERVER</h3><pre className="command">node scripts/mcp.mjs</pre><p className="modal-intro">Use an absolute path to scripts/mcp.mjs in your client configuration. Generate the correct entry with npm run mcp:config. The server accepts source text and returns results. It does not write files.</p><h3>AGENT WORKFLOW</h3><div className="agent-steps"><span>Inspect</span><ChevronRight size={13}/><span>Propose</span><ChevronRight size={13}/><span>Validate</span><ChevronRight size={13}/><span>Render & review</span></div><p className="normalization-note">Read <code>.agents/skills/control-authoring/SKILL.md</code> for the schema and editing contract. Proposed operations require an expected model revision. Approve file changes in your agent before saving or committing.</p></>}
      {modal === 'add-block' && <><div className="eyebrow">SEMANTIC EDIT</div><h2 id="modal-title">Add a control block</h2><p className="modal-intro">Adds an unconnected block with one explicit input and output. Define additional ports, sum signs and quantities in source before connecting.</p><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); edit([{ op: 'add_block', block: { id: String(f.get('id')), label: String(f.get('label')), kind: String(f.get('kind')) as typeof blockKinds[number], ports: [{ id: 'input', direction: 'in', side: 'WEST' }, { id: 'output', direction: 'out', side: 'EAST' }], modes: [] } }]); }}><label>Stable ID<input name="id" required pattern="[a-z][a-z0-9_-]*" placeholder="feedforward"/></label><label>Label<input name="label" required placeholder="Feedforward gain"/></label><label>Symbol<select name="kind">{blockKinds.map(k => <option key={k}>{k}</option>)}</select></label><button className="primary" type="submit" disabled={!valid}>Add and validate</button></form></>}
      {modal === 'add-view' && <><div className="eyebrow">ONE MODEL, ANOTHER PERSPECTIVE</div><h2 id="modal-title">Create a computed view</h2><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const include = String(f.get('include')).split(',').map(s => s.trim()).filter(Boolean); edit([{ op: 'add_view', view: { id: String(f.get('id')), title: String(f.get('title')), kind: String(f.get('kind')) as 'overview' | 'power' | 'control' | 'matrix', include, grouped: f.get('grouped') === 'on', depth: 2, direction: 'RIGHT' } }]); }}><label>Stable ID<input required name="id" pattern="[a-z][a-z0-9_-]*"/></label><label>Title<input required name="title"/></label><label>View kind<select name="kind"><option>control</option><option>power</option><option>overview</option><option>matrix</option></select></label><label>Included element IDs <small>comma separated; empty means all</small><input name="include"/></label><label className="checkbox"><input type="checkbox" name="grouped"/> Show component boundaries</label><button className="primary" disabled={!valid}>Create view</button></form></>}
      {modal === 'connection' && pendingConnection && <><div className="eyebrow">EXPLICIT SIGNAL CONNECTION</div><h2 id="modal-title">Connect declared ports</h2><p className="connection-path">{pendingConnection.source}.{pendingConnection.sourceHandle}<br />↓<br />{pendingConnection.target}.{pendingConnection.targetHandle}</p><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); edit([{ op: 'connect', signal: { id: String(f.get('id')), from: { block: pendingConnection.source.replace(/^blocks:/, ''), port: pendingConnection.sourceHandle! }, to: { block: pendingConnection.target.replace(/^blocks:/, ''), port: pendingConnection.targetHandle! }, kind: String(f.get('kind')) as 'signal' | 'feedback', label: String(f.get('label')) || undefined } }]); }}><label>Stable signal ID<input required name="id" pattern="[a-z][a-z0-9_-]*" placeholder="s_new"/></label><label>Signal label<input name="label"/></label><label>Connection meaning<select name="kind"><option value="signal">Ordinary signal</option><option value="feedback">Feedback return</option></select></label><p className="normalization-note">Feedback means a return connection, not an inferred negative sign. Input direction, quantity compatibility and duplicate drivers are validated.</p><button className="primary" disabled={!valid}>Connect and validate</button></form></>}
      {modal === 'trace' && trace && <><div className="eyebrow">BOUNDED GRAPH QUERY</div><h2 id="modal-title">Signal neighbourhood</h2><p className="modal-intro">Two connection steps upstream and downstream, including explicitly declared feedback.</p><h3>BLOCKS</h3><div className="tag-list">{trace.nodes.map(n => <button key={n} onClick={() => { select({ collection: 'blocks', id: n }); setModal(undefined); }}>{n}</button>)}</div><h3>INCLUDED SIGNALS</h3><pre className="command">{trace.edges.join('\n') || '(none)'}</pre><h3>BOUNDARY CONNECTIONS</h3><p className="modal-intro">{trace.boundaryEdges.join(', ') || 'No connections beyond this neighbourhood.'}</p></>}
      {error && <pre className="modal-error">{error}</pre>}
    </section></div>}
  </div>;
}
function CrosshairIcon() { return <div className="inspector-symbol"><Settings2 size={28}/></div>; }
