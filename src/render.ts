import type { Model, Mode } from './model.ts';
import { Canvas, escapeXml, textWidth, wrap } from './svg.ts';
import { themes } from './theme.ts';
import type { ThemeName } from './theme.ts';
export const views = ['overview', 'topology', 'matrix', 'mode', 'signals'] as const;
export type View = typeof views[number];
export interface RenderOptions { view?: View; mode?: string; theme?: ThemeName }
export interface Diagram { svg: string; width: number; height: number }
export interface SignalLayout {
  width: number; height: number;
  nodes: { id: string; x: number; y: number; width: number; height: number }[];
  edges: { id: string; paths: { x: number; y: number }[][]; labels: { text: string; x: number; y: number; width: number; height: number }[] }[];
}
const M = 48;
function labelSection(c: Canvas, index: string, label: string, y: number, right = '') {
  c.text(index, M, y, 12, c.theme.accent, 700);
  c.text(label, M + 32, y, 13, c.theme.muted, 600, 'letter-spacing="1"');
  if (right) c.text(right, c.width - M, y, 12, c.theme.muted, 400, 'text-anchor="end"');
}
function modeBand(c: Canvas, model: Model, y: number): number {
  const cols = Math.min(2, model.groups.length), w = (c.width - 2 * M - (cols - 1) * 20) / cols;
  const heights = model.groups.map(g => {
    const modes = model.modes.filter(m => m.group === g.id);
    let x = 0, rows = 1;
    for (const m of modes) { const pw = textWidth(m.label, 13) + 32; if (x + pw > w - 48) { x = 0; rows++; } x += pw; }
    return 75 + rows * 37;
  });
  for (let i = 0; i < model.groups.length; i += cols) {
    const h = Math.max(...heights.slice(i, i + cols));
    model.groups.slice(i, i + cols).forEach((g, j) => {
      const x = M + j * (w + 20), color = (i + j) % 2 ? c.theme.second : c.theme.accent;
      const fill = (i + j) % 2 ? c.theme.secondTint : c.theme.tint;
      c.rect(x, y, w, h); c.rect(x, y + 21, 3, h - 42, color, color, 1);
      c.text(g.label, x + 24, y + 36, 21, c.theme.ink, 600);
      const modes = model.modes.filter(m => m.group === g.id);
      c.text(`${String(modes.length).padStart(2, '0')} MODES`, x + w - 24, y + 35, 11, c.theme.muted, 600, 'text-anchor="end"');
      let px = x + 24, py = y + 57;
      modes.forEach(m => { const pw = textWidth(m.label, 13) + 24; if (px + pw > x + w - 24) { px = x + 24; py += 37; } px += c.pill(m.label, px, py, color, fill) + 8; });
    });
    y += h + 20;
  }
  return y;
}
function topology(c: Canvas, model: Model, y: number, mode?: Mode): number {
  const gap = 38, count = model.stages.length, w = (c.width - M * 2 - (count - 1) * gap) / count;
  const technologyLines = Math.max(...model.stages.map(s => wrap(s.technology ?? '', w - 28, 13).length));
  const nameLines = Math.max(...model.stages.map(s => wrap(s.label, w - 28, 18).length));
  const h = 53 + nameLines * 23 + technologyLines * 18;
  if (model.boundary) {
    const indexes = model.boundary.members.map(id => model.stages.findIndex(s => s.id === id));
    const min = Math.min(...indexes), max = Math.max(...indexes);
    const x = M + min * (w + gap) - 13;
    c.rect(x, y - 27, (max - min + 1) * w + (max - min) * gap + 26, h + 43, c.theme.tint, c.theme.line, 12);
    c.text(model.boundary.label, x + 13, y - 10, 11, c.theme.accent, 700, 'letter-spacing="1.5"');
  }
  model.links.forEach((link, i) => {
    const direction = mode?.flow[link.id] ?? link.capability;
    const start = ['bidirectional', 'reverse'].includes(direction), end = ['bidirectional', 'forward'].includes(direction);
    c.line(M + i * (w + gap) + w + 3, y + h / 2, M + (i + 1) * (w + gap) - 3, y + h / 2, c.theme.power, 2,
      `${start ? 'marker-start="url(#arrow)"' : ''} ${end ? 'marker-end="url(#arrow)"' : ''} ${direction === 'off' ? 'stroke-dasharray="4 5" opacity="0.35"' : ''}`);
  });
  model.stages.forEach((s, i) => {
    const x = M + i * (w + gap);
    c.rect(x, y, w, h, c.theme.panel, s.kind === 'converter' ? c.theme.accent : c.theme.line, 10);
    c.text(s.kind === 'converter' ? 'POWER CONVERSION' : s.kind === 'bus' ? 'DC BUS' : 'EXTERNAL', x + 16, y + 23, 10, c.theme.muted, 600, 'letter-spacing="0.8"');
    const lh = c.lines(s.label, x + 16, y + 51, w - 32, 18, c.theme.ink, 600, 23);
    c.lines(s.technology ?? '', x + 16, y + 57 + lh, w - 32, 13, c.theme.muted, 400, 18);
  });
  return y + h + 27;
}
function profiles(c: Canvas, model: Model, y: number, selected?: Mode): number {
  const groups = selected ? model.groups.filter(g => g.id === selected.group) : model.groups;
  const cols = Math.min(2, groups.length), width = (c.width - M * 2 - (cols - 1) * 20) / cols;
  const stageList = model.stages.filter(s => s.kind === 'converter');
  const panels = groups.map(g => {
    const modes = selected ? [selected] : model.modes.filter(m => m.group === g.id);
    const blocks = stageList.map(stage => ({ stage, items: model.quantities.filter(q => modes.some(m => m.controls[stage.id]?.some(a => a.quantity === q.id))) }));
    const stageCols = Math.min(2, Math.max(1, blocks.length));
    let height = 64;
    for (let i = 0; i < blocks.length; i += stageCols) height += 46 + Math.max(1, ...blocks.slice(i, i + stageCols).map(b => b.items.length)) * 65;
    return { g, modes, blocks, height, stageCols };
  });
  for (let i = 0; i < panels.length; i += cols) {
    const rowHeight = Math.max(...panels.slice(i, i + cols).map(p => p.height));
    panels.slice(i, i + cols).forEach((p, j) => {
      const x = M + j * (width + 20), color = (i + j) % 2 ? c.theme.second : c.theme.accent;
      c.rect(x, y, width, rowHeight);
      c.text(selected?.label ?? p.g.label, x + 24, y + 32, 19, c.theme.ink, 600);
      c.line(x + 24, y + 48, x + width - 24, y + 48);
      let by = y + 79;
      const sw = (width - 48) / p.stageCols;
      for (let k = 0; k < p.blocks.length; k += p.stageCols) {
        const blockHeight = 46 + Math.max(1, ...p.blocks.slice(k, k + p.stageCols).map(b => b.items.length)) * 65;
        p.blocks.slice(k, k + p.stageCols).forEach((block, col) => {
          const bx = x + 24 + col * sw;
          c.lines(block.stage.label, bx, by, sw - 18, 14, c.theme.muted, 600, 18);
          if (!block.items.length) c.text('Not assigned', bx, by + 41, 14, c.theme.muted);
          block.items.forEach((q, index) => {
            const yy = by + 37 + index * 65;
            const enabled = p.modes.filter(m => m.controls[block.stage.id]?.some(a => a.quantity === q.id));
            const isFocus = q.id === model.focusQuantity;
            c.text(q.symbol, bx, yy, 23, isFocus ? color : c.theme.ink, 600);
            c.lines(q.label, bx + 66, yy - 3, sw - 88, 13, c.theme.ink, 400, 17);
            const scope = enabled.length === p.modes.length ? 'All modes in this panel' : `${enabled.map(m => m.label).join(', ')} only`;
            c.lines(scope, bx + 66, yy + 19, sw - 88, 11, c.theme.muted, 400, 14);
          });
        });
        by += blockHeight;
      }
    });
    y += rowHeight + 20;
  }
  return y;
}
function ownershipTable(c: Canvas, model: Model, y: number): number {
  const first = 250, cell = (c.width - 2 * M - first) / model.modes.length;
  const header = 70, row = 90, height = header + row * model.quantities.length;
  c.rect(M, y, c.width - 2 * M, height);
  c.text('CONTROL QUANTITY', M + 24, y + 40, 12, c.theme.muted, 600);
  model.modes.forEach((m, i) => c.lines(m.label, M + first + i * cell + 14, y + 34, cell - 28, 15, c.theme.ink, 600, 19));
  model.quantities.forEach((q, r) => {
    const yy = y + header + r * row;
    if (q.id === model.focusQuantity) c.rect(M + 1, yy, c.width - M * 2 - 2, row, c.theme.tint, c.theme.tint, 0);
    c.line(M, yy, c.width - M, yy);
    c.text(q.symbol, M + 24, yy + 33, 23, q.id === model.focusQuantity ? c.theme.accent : c.theme.ink, 600);
    c.text(q.label, M + 24, yy + 58, 13, c.theme.muted);
    model.modes.forEach((m, i) => {
      const x = M + first + i * cell + 14;
      const assignments = model.stages.flatMap(s => (m.controls[s.id] ?? []).filter(a => a.quantity === q.id).map(a => ({ owner: s.label, role: a.role })));
      const label = assignments.map(a => a.owner).join(' + ') || '—';
      c.lines(label, x, yy + 34, cell - 26, 14, c.theme.ink, assignments.length ? 600 : 400, 18);
      c.lines(assignments.map(a => a.role).join(' / '), x, yy + 64, cell - 26, 11, c.theme.muted, 400, 14);
    });
  });
  return y + height + 24;
}
function focus(c: Canvas, model: Model, y: number): number {
  const q = model.quantities.find(q => q.id === model.focusQuantity); if (!q) return y;
  const map = new Map<string, string[]>();
  model.modes.forEach(m => {
    const owner = model.stages.filter(s => m.controls[s.id]?.some(a => a.quantity === q.id && a.role === 'regulator')).map(s => s.label).join(' + ') || 'Not declared';
    map.set(owner, [...(map.get(owner) ?? []), m.label]);
  });
  const lines = [...map].map(([owner, modes]) => `${modes.join(' / ')}  :  ${owner}`);
  const h = 58 + lines.reduce((n, l) => n + wrap(l, c.width - 2 * M - 48, 15).length * 22, 0);
  c.rect(M, y, c.width - 2 * M, h, c.theme.tint, c.theme.tint);
  c.text(`${q.symbol.toUpperCase()}  /  DECLARED REGULATION RESPONSIBILITY`, M + 24, y + 27, 12, c.theme.accent, 700, 'letter-spacing="0.7"');
  let yy = y + 54;
  lines.forEach(l => { yy += c.lines(l, M + 24, yy, c.width - 2 * M - 48, 15, c.theme.ink, 500, 22); });
  return y + h + 24;
}
function signals(c: Canvas, model: Model, layout: SignalLayout, y: number) {
  if (!model.signals) throw new Error('This model does not define a signal graph.');
  const xOffset = (c.width - layout.width) / 2;
  c.add(`<g transform="translate(${xOffset} ${y})">`);
  for (const edge of layout.edges) {
    const spec = model.signals.edges.find(e => e.id === edge.id)!;
    for (const points of edge.paths) {
      c.add(`<path d="${points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}" fill="none" stroke="${c.theme.accent}" stroke-width="1.8" ${spec.kind === 'feedback' ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#signal-arrow)"/>`);
    }
    for (const l of edge.labels) {
      c.rect(l.x - 3, l.y - 2, l.width + 6, l.height + 4, c.theme.background, c.theme.background, 2);
      c.text(l.text, l.x, l.y + 13, 12, c.theme.accent, 600);
    }
  }
  for (const n of layout.nodes) {
    const spec = model.signals.nodes.find(s => s.id === n.id)!;
    c.rect(n.x, n.y, n.width, n.height, c.theme.panel, c.theme.line, 10);
    c.text(spec.kind.toUpperCase(), n.x + 16, n.y + 23, 10, c.theme.accent, 600);
    const lh = c.lines(spec.label, n.x + 16, n.y + 49, n.width - 32, 17, c.theme.ink, 600, 23);
    c.lines(spec.detail ?? '', n.x + 16, n.y + 52 + lh, n.width - 32, 12, c.theme.muted, 400, 17);
  }
  c.add('</g>');
  return y + layout.height + 30;
}
/** Presentation is separate from domain parsing and graph layout, and performs no I/O. */
export function compose(model: Model, options: RenderOptions = {}, layout?: SignalLayout): Diagram {
  const view = options.view ?? 'overview';
  const theme = themes[options.theme ?? 'studio'];
  if (!theme) throw new Error(`Unknown theme: ${options.theme}`);
  if (!views.includes(view)) throw new Error(`Unknown view: ${view}`);
  const width = Math.max(1440, model.stages.length * 230 + 2 * M, view === 'matrix' ? 2 * M + 250 + model.modes.length * 190 : 0, layout ? layout.width + 2 * M : 0);
  const c = new Canvas(width, theme);
  c.text('CONTROL RENDERING ENGINE', M, 37, 11, theme.accent, 700, 'letter-spacing="2"');
  c.text(`MODEL v1  /  ${view.toUpperCase()}`, width - M, 37, 11, theme.muted, 600, 'text-anchor="end"');
  let y = 82;
  y += c.lines(model.title, M, y, width - 2 * M, 36, theme.ink, 600, 44);
  y += c.lines(model.description, M, y - 2, width - 2 * M, 16, theme.muted, 400, 23) + 28;
  if (view === 'overview') {
    y = modeBand(c, model, y) + 18;
    labelSection(c, '01', 'POWER CONVERSION', y, 'Arrows show hardware capability, not simultaneous power flow');
    y = topology(c, model, y + 48) + 24;
    labelSection(c, '02', 'CONTROL RESPONSIBILITY', y, 'A function list, not an independent-setpoint declaration');
    y = profiles(c, model, y + 22);
    y = focus(c, model, y);
  } else if (view === 'topology') {
    labelSection(c, '01', 'POWER CONVERSION', y, 'Hardware capability');
    y = topology(c, model, y + 48);
  } else if (view === 'matrix') {
    labelSection(c, '01', 'MODE × CONTROL QUANTITY', y, '— means not assigned in this model');
    y = ownershipTable(c, model, y + 24);
    y = focus(c, model, y);
  } else if (view === 'mode') {
    const mode = model.modes.find(m => m.id === (options.mode ?? model.modes[0].id));
    if (!mode) throw new Error(`Unknown mode: ${options.mode}`);
    c.pill(mode.label, M, y - 4); y += 63;
    labelSection(c, '01', 'MODE POWER FLOW', y, 'Direction is explicitly declared in the model');
    y = topology(c, model, y + 48) + 20;
    labelSection(c, '02', 'ASSIGNED CONTROLS', y);
    y = profiles(c, model, y + 24, mode);
    if (mode.note) y += c.lines(mode.note, M, y + 4, width - 2 * M, 14, theme.muted, 400, 21) + 20;
  } else {
    if (!model.signals || !layout) throw new Error('This model has no signal graph. Open the signal-loop example.');
    labelSection(c, '01', model.signals.title.toUpperCase(), y);
    y += c.lines(model.signals.description, M, y + 27, width - M * 2, 14, theme.muted, 400, 21) + 50;
    y = signals(c, model, layout, y);
  }
  c.line(M, y, width - M, y); y += 26;
  for (const note of model.notes) y += c.lines(note, M, y, width - 2 * M, 12, theme.muted, 400, 18) + 7;
  y += 14;
  c.text('SOURCE → MODEL → VIEW', M, y, 10, theme.muted, 600, 'letter-spacing="1.4"');
  c.text('Generated deterministically · Edit the YAML, not this SVG', width - M, y, 10, theme.muted, 400, 'text-anchor="end"');
  const height = Math.ceil(y + 30);
  return { svg: c.finish(height, model.title, model.description, view), width, height };
}
