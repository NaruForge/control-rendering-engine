import { useState } from 'react';
import { ArrowUpRight, Crosshair, PencilLine, Trash2 } from 'lucide-react';
import type { Compilation } from '../domain/schema.ts';
import type { EntityRef } from '../scene/types.ts';
import type { Operation } from '../domain/operations.ts';
import { ownership } from '../domain/query.ts';
export function Inspector({ compilation, selected, mode, onEdit, onSource, onTrace }: {
    compilation: Compilation;
    selected: EntityRef;
    mode?: string;
    onEdit(ops: Operation[]): void;
    onSource(ref: EntityRef): void;
    onTrace(id: string): void;
}) {
    const model = compilation.model!, entity = model[selected.collection].find(e => e.id === selected.id);
    const [label, setLabel] = useState(entity && 'label' in entity ? entity.label ?? '' : '');
    const signal = selected.collection === 'signals' ? model.signals.find(s => s.id === selected.id) : undefined;
    const block = selected.collection === 'blocks' ? model.blocks.find(b => b.id === selected.id) : undefined;
    const [math, setMath] = useState(block?.math ?? '');
    const [assignmentMode, setAssignmentMode] = useState(mode ?? model.modes[0]?.id ?? '');
    const [quantity, setQuantity] = useState(model.quantities[0]?.id ?? '');
    const [role, setRole] = useState<'regulator' | 'inner-loop' | 'command' | 'limit' | 'unspecified'>('unspecified');
    if (!entity)
        return <p className="empty-copy">Element no longer exists.</p>;
    const editableLabel = ['blocks', 'components', 'quantities', 'modes'].includes(selected.collection);
    const assignments = selected.collection === 'components' ? ownership(model).filter(a => a.component === selected.id) : [];
    return <div className="inspector-content">
    <div className="entity-badge">{selected.collection.replace(/s$/, '').toUpperCase()}</div>
    <h2>{'label' in entity ? entity.label : 'title' in entity ? entity.title : entity.id}</h2>
    <code className="entity-id">{entity.id}</code>
    <div className="inline-actions"><button onClick={() => onSource(selected)}><ArrowUpRight size={13}/> Source</button>{block && <button onClick={() => onTrace(block.id)}><Crosshair size={13}/> Trace</button>}</div>
    {editableLabel && <form onSubmit={e => { e.preventDefault(); onEdit([{ op: 'label', collection: selected.collection as 'blocks' | 'components' | 'quantities' | 'modes', id: selected.id, label }]); }}>
      <label>Display label<input aria-label="Element label" value={label} onChange={e => setLabel(e.target.value)} required maxLength={160}/></label>
      <button type="submit" className="small-primary"><PencilLine size={12}/> Apply label</button>
    </form>}
    {block && <>
      <dl className="properties"><dt>Symbol</dt><dd>{block.kind}</dd><dt>Owner</dt><dd>{block.owner ?? 'Not declared'}</dd><dt>Mode scope</dt><dd>{block.modes.length ? block.modes.join(', ') : 'All modes'}</dd></dl>
      <h3>DECLARED PORTS</h3><div className="port-list">{block.ports.map(p => <div key={p.id}><span className={`port-dot ${p.direction}`}/><code>{p.id}</code><small>{p.sign ? p.sign + ' · ' : ''}{p.direction} / {p.side.toLowerCase()}</small>{p.quantity && <em>{p.quantity}</em>}</div>)}</div>
      <form onSubmit={e => { e.preventDefault(); onEdit([{ op: 'set_math', block: block.id, math }]); }}><label>Mathematical label <small>TeX · local SVG glyphs</small><textarea aria-label="Mathematical label" value={math} onChange={e => setMath(e.target.value)} rows={3} maxLength={256}/></label><button type="submit">Apply expression</button></form>
      <h3>SIGNAL CONNECTIONS</h3><div className="relationship-list">{model.signals.filter(s => s.from.block === block.id || s.to.block === block.id).map(s => <div key={s.id}><span className={s.kind === 'feedback' ? 'feedback-text' : ''}>{s.label ?? s.id}</span><small>{s.from.block}.{s.from.port} → {s.to.block}.{s.to.port}</small></div>)}</div>
    </>}
    {selected.collection === 'components' && <>
      <dl className="properties"><dt>Type</dt><dd>{'kind' in entity ? entity.kind : ''}</dd><dt>Parent</dt><dd>{'parent' in entity ? entity.parent ?? 'Root' : 'Root'}</dd></dl>
      <h3>CONTROL RESPONSIBILITY</h3>
      <div className="assignment-list">{assignments.length ? assignments.map((a, i) => <div key={i}><div><strong>{a.quantity}</strong><small>{a.modeLabel} · {a.role}</small></div><button aria-label={`Remove ${a.quantity} from ${a.mode}`} onClick={() => onEdit([{ op: 'remove_control', mode: a.mode, component: a.component, quantity: a.quantity }])}><Trash2 size={12}/></button></div>) : <p className="empty-copy">No control assignments.</p>}</div>
      {'kind' in entity && entity.kind === 'converter' && model.modes.length > 0 && model.quantities.length > 0 && <form onSubmit={e => { e.preventDefault(); onEdit([{ op: 'assign_control', mode: assignmentMode, component: selected.id, quantity, role }]); }}>
        <label>Mode<select aria-label="Assignment mode" value={assignmentMode} onChange={e => setAssignmentMode(e.target.value)}>{model.modes.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        <div className="two-fields"><label>Quantity<select aria-label="Assignment quantity" value={quantity} onChange={e => setQuantity(e.target.value)}>{model.quantities.map(q => <option key={q.id} value={q.id}>{q.symbol}</option>)}</select></label><label>Role<select value={role} onChange={e => setRole(e.target.value as typeof role)}>{['unspecified', 'regulator', 'inner-loop', 'command', 'limit'].map(r => <option key={r}>{r}</option>)}</select></label></div>
        <button type="submit">Assign control</button>
      </form>}
    </>}
    {signal && <><dl className="properties"><dt>From</dt><dd>{signal.from.block}.{signal.from.port}</dd><dt>To</dt><dd>{signal.to.block}.{signal.to.port}</dd><dt>Kind</dt><dd>{signal.kind}</dd></dl><button className="danger-button" onClick={() => onEdit([{ op: 'disconnect', signal: entity.id }])}><Trash2 size={13}/> Remove connection</button></>}
    {['views', 'quantities', 'modes', 'powerLinks'].includes(selected.collection) && <pre className="entity-json">{JSON.stringify(entity, null, 2)}</pre>}
    <p className="normalization-note">Inspector edits use the same validated operations as MCP. They normalize source formatting; comments are not preserved. Undo restores the original text.</p>
  </div>;
}
