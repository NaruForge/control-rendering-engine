import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { compile, requireModel } from '../compiler/compile.ts';
import { serialize } from '../compiler/serialize.ts';
import { diffModels } from '../domain/diff.ts';
import { buildScene } from '../scene/build.ts';
import { toSvg } from '../scene/export.ts';
import { themes } from '../scene/theme.ts';
import type { ThemeName } from '../scene/theme.ts';
import type { Format } from '../domain/schema.ts';
import { matrixMarkdown, reviewCsv } from '../compiler/report.ts';
async function readSource(path: string) {
    if ((await stat(path)).size > 131072)
        throw new Error('Source exceeds 128 KiB.');
    return readFile(path, 'utf8');
}
async function main() {
    const command = process.argv[2] ?? 'help';
    const { values } = parseArgs({ args: process.argv.slice(3), options: {
            input: { type: 'string', default: 'examples/obcm.control' }, out: { type: 'string', default: 'artifacts' },
            view: { type: 'string' }, mode: { type: 'string' }, theme: { type: 'string', default: 'studio' },
            format: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' },
            json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
        } });
    if (command === 'help' || values.help) {
        console.log('Control Studio CLI\n\nvalidate [--input model.control] [--json]\nrender [--input model.control] [--out artifacts] [--view VIEW_ID] [--mode MODE_ID] [--theme studio|midnight|paper]\nmigrate --input legacy.yaml --out model.control [--format control|yaml|json]\ndiff --before baseline.control --after revised.control [--json]\n\nAll source formats share the same compiler. render writes SVG, scene JSON and review reports; it fails on structural layout errors.');
        return;
    }
    if (!['render', 'validate', 'migrate', 'diff'].includes(command))
        throw new Error(`Unknown command '${command}'.`);
    if (values.format && !['control', 'yaml', 'json'].includes(values.format))
        throw new Error(`Unknown format '${values.format}'.`);
    if (command === 'diff') {
        if (!values.before || !values.after)
            throw new Error('diff requires --before and --after files.');
        const a = requireModel(await readSource(resolve(values.before))), b = requireModel(await readSource(resolve(values.after)));
        const changes = diffModels(a.model, b.model);
        console.log(values.json ? JSON.stringify({ before: a.revision, after: b.revision, changes }, null, 2) : changes.length ? changes.map(c => `${c.kind.toUpperCase()} ${c.collection}.${c.id}${c.fields.length ? ': ' + c.fields.join(', ') : ''}`).join('\n') : 'No semantic changes.');
        return;
    }
    const source = await readSource(resolve(values.input));
    if (command === 'validate') {
        const c = compile(source);
        console.log(values.json ? JSON.stringify({ ok: c.ok, revision: c.revision, migrated: c.migrated, format: c.format, diagnostics: c.diagnostics }, null, 2) : `${c.ok ? 'VALID' : 'INVALID'} ${values.input}${c.migrated ? ' (v1 imported as v2)' : ''}\n${c.diagnostics.map(d => `${d.severity} ${d.code}${d.span ? ` ${d.span.line}:${d.span.column}` : ''}: ${d.message}`).join('\n')}`);
        if (!c.ok)
            process.exitCode = 1;
        return;
    }
    const c = requireModel(source);
    if (command === 'migrate') {
        if (values.out === 'artifacts')
            throw new Error('migrate requires an explicit output filename via --out.');
        const format = values.format as Format | undefined ?? (values.out.endsWith('.json') ? 'json' : /\.ya?ml$/.test(values.out) ? 'yaml' : 'control');
        const result = serialize(c.source, format);
        requireModel(result, format);
        await mkdir(dirname(resolve(values.out)), { recursive: true });
        await writeFile(resolve(values.out), result);
        console.log(`Wrote ${values.out}. Formatting normalized; comments are not preserved.`);
        return;
    }
    if (!Object.hasOwn(themes, values.theme))
        throw new Error(`Unknown theme '${values.theme}'.`);
    const views = values.view ? [values.view] : c.model.views.map(v => v.id);
    // Build all requested outputs before writing, avoiding partial artifacts on a validation failure.
    const results = await Promise.all(views.map(id => buildScene(c.model, id, values.mode)));
    const issues = results.flatMap(s => s.audit.filter(a => a.severity === 'error').map(a => `${s.viewId}: ${a.message}`));
    if (issues.length)
        throw new Error('LAYOUT_AUDIT:\n' + issues.join('\n'));
    await mkdir(resolve(values.out), { recursive: true });
    for (const scene of results) {
        const base = join(resolve(values.out), scene.viewId);
        await writeFile(base + '.svg', toSvg(scene, values.theme as ThemeName));
        await writeFile(base + '.scene.json', JSON.stringify(scene, null, 2) + '\n');
        console.log(`Wrote ${scene.viewId}: ${scene.width} × ${scene.height}, ${scene.audit.length} layout diagnostics`);
    }
    await writeFile(join(resolve(values.out), 'control-matrix.md'), matrixMarkdown(c.model));
    await writeFile(join(resolve(values.out), 'review-checklist.csv'), reviewCsv(c.model));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
