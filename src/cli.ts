import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseModel, jsonSchema, render, themes, views } from './engine.ts';
import type { View, ThemeName } from './engine.ts';
import { matrixMarkdown, reviewCsv } from './report.ts';

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: 'string', default: 'examples/obcm.yaml' }, out: { type: 'string', default: 'artifacts' },
    theme: { type: 'string', default: 'studio' }, view: { type: 'string' }, mode: { type: 'string' },
    schema: { type: 'string' }, check: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { console.log('npm run render -- [--input model.yaml] [--out artifacts] [--theme studio|midnight|paper]\n  [--view overview|topology|matrix|mode|signals] [--mode v2g] [--schema schema.json] [--check]\nWithout --view, generates the architecture views and all mode-detail views.'); return; }
  if (!Object.hasOwn(themes, values.theme)) throw new Error(`Unknown theme: ${values.theme}`);
  if (values.view && !views.includes(values.view as View)) throw new Error(`Unknown view: ${values.view}`);
  const model = parseModel(await readFile(resolve(values.input), 'utf8'));
  if (values.mode && !model.modes.some(m => m.id === values.mode)) throw new Error(`Unknown mode: ${values.mode}`);
  console.log(`Valid model: ${model.modes.length} modes, ${model.stages.length} stages`);
  if (values.check) return;
  const out = resolve(values.out); await mkdir(out, { recursive: true });
  const requests: { view: View; mode?: string; file: string }[] = values.view
    ? [{ view: values.view as View, mode: values.mode, file: values.view === 'mode' ? `mode-${values.mode ?? model.modes[0].id}` : values.view }]
    : [{ view: 'overview', file: 'overview' }, { view: 'topology', file: 'topology' }, { view: 'matrix', file: 'matrix' }, ...model.modes.map(m => ({ view: 'mode' as const, mode: m.id, file: `mode-${m.id}` })), ...(model.signals ? [{ view: 'signals' as const, file: 'signals' }] : [])];
  for (const request of requests) {
    const diagram = await render(model, { ...request, theme: values.theme as ThemeName });
    await writeFile(join(out, `${request.file}.svg`), diagram.svg); console.log(`Wrote ${request.file}.svg (${diagram.width} × ${diagram.height})`);
  }
  await writeFile(join(out, 'control-matrix.md'), matrixMarkdown(model));
  await writeFile(join(out, 'review-checklist.csv'), reviewCsv(model));
  if (values.schema) { const path = resolve(values.schema); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(jsonSchema(), null, 2) + '\n'); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
