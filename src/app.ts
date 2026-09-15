import './app.css';
import obcm from '../examples/obcm.yaml?raw';
import signalExample from '../examples/signal-loop.yaml?raw';
import { parseModel, render } from './engine.ts';
import type { Diagram, Model, ThemeName, View } from './engine.ts';
import { createViewport } from './viewport.ts';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const source = el<HTMLTextAreaElement>('source'), modeSelect = el<HTMLSelectElement>('mode');
const viewport = createViewport();
const viewNames: Record<View, string> = { overview: 'Architecture', topology: 'Power topology', matrix: 'Control matrix', mode: 'Mode detail', signals: 'Signal graph' };
let view: View = 'overview', sequence = 0, diagram: Diagram | undefined, model: Model | undefined, dirty = false;
let timer: ReturnType<typeof setTimeout> | undefined;
source.value = obcm;
const setDirty = (value: boolean) => { dirty = value; el('dirty').textContent = value ? 'UNSAVED' : 'EXAMPLE / SAVED'; };
function download(value: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportEnabled(enabled: boolean) {
  for (const id of ['export-svg', 'export-png']) el<HTMLButtonElement>(id).disabled = !enabled;
}
async function update() {
  const request = ++sequence;
  exportEnabled(false); diagram = undefined;
  el('status').textContent = 'Validating and rendering…';
  el('error').hidden = true;
  try {
    const nextModel = parseModel(source.value);
    const prior = modeSelect.value;
    modeSelect.replaceChildren(...nextModel.modes.map(m => new Option(m.label, m.id)));
    modeSelect.value = nextModel.modes.some(m => m.id === prior) ? prior : nextModel.modes[0].id;
    modeSelect.disabled = view !== 'mode';
    const nextDiagram = await render(nextModel, { view, mode: modeSelect.value, theme: el<HTMLSelectElement>('theme').value as ThemeName });
    if (request !== sequence) return;
    model = nextModel; diagram = nextDiagram;
    // Only our escaped, inert SVG renderer writes markup. Raw YAML/HTML is never inserted here.
    el('canvas').innerHTML = diagram.svg;
    viewport.setSize(diagram.width, diagram.height);
    el('dimensions').textContent = `${diagram.width} × ${diagram.height}`;
    el('stats').textContent = `${model.modes.length} modes / ${model.stages.length} stages / ${model.quantities.length} quantities`;
    el('status').textContent = 'Model valid · Preview up to date'; exportEnabled(true);
  } catch (error) {
    if (request !== sequence) return;
    diagram = undefined; model = undefined; el('canvas').replaceChildren();
    el('stats').textContent = ''; el('dimensions').textContent = '';
    el('error').textContent = error instanceof Error ? error.message : String(error); el('error').hidden = false;
    el('status').textContent = 'Not rendered · Correct the model or choose another view';
  }
}
source.addEventListener('input', () => {
  setDirty(true); sequence++; diagram = undefined; exportEnabled(false);
  el('status').textContent = 'Source changed · Pending validation';
  clearTimeout(timer); timer = setTimeout(update, 300);
});
source.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); void update(); } });
el('views').addEventListener('click', e => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-view]'); if (!button) return;
  view = button.dataset.view as View;
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('active', b === button));
  el('view-title').textContent = viewNames[view]; void update();
});
for (const id of ['mode', 'theme']) el(id).addEventListener('change', () => { void update(); });
el<HTMLSelectElement>('example').addEventListener('change', () => {
  if (dirty && !window.confirm('Replace the unsaved YAML in the editor?')) { el<HTMLSelectElement>('example').value = source.value === signalExample ? 'signals' : 'obcm'; return; }
  source.value = el<HTMLSelectElement>('example').value === 'signals' ? signalExample : obcm; setDirty(false); void update();
});
el('import').addEventListener('click', () => el<HTMLInputElement>('file').click());
el<HTMLInputElement>('file').addEventListener('change', async () => {
  const file = el<HTMLInputElement>('file').files?.[0]; if (!file) return;
  if (file.size > 131072) { window.alert('Maximum model size is 128 KiB.'); return; }
  if (dirty && !window.confirm('Replace the unsaved YAML in the editor?')) return;
  source.value = await file.text(); setDirty(false); await update(); el<HTMLInputElement>('file').value = '';
});
el('save-model').addEventListener('click', () => { download(source.value, 'architecture.yaml', 'text/yaml;charset=utf-8'); setDirty(false); });
el('export-svg').addEventListener('click', () => { if (diagram) download(diagram.svg, `${view}${view === 'mode' ? '-' + modeSelect.value : ''}.svg`, 'image/svg+xml;charset=utf-8'); });
el('export-png').addEventListener('click', async () => {
  if (!diagram) return;
  const current = diagram, url = URL.createObjectURL(new Blob([current.svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const scale = Math.min(2, Math.sqrt(32000000 / (current.width * current.height)), 16000 / Math.max(current.width, current.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.floor(current.width * scale); canvas.height = Math.floor(current.height * scale);
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed.')), 'image/png'));
    download(blob, `${view}.png`, 'image/png');
  } catch (error) { el('status').textContent = `Export failed: ${String(error)}`; }
  finally { URL.revokeObjectURL(url); }
});
el('toggle-source').addEventListener('click', () => {
  const hidden = document.querySelector('.panels')!.classList.toggle('source-hidden');
  el('toggle-source').setAttribute('aria-pressed', String(!hidden));
});
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
void update();
