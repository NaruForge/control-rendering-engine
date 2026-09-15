import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { requireModel } from '../src/compiler/compile.ts';
import { modelSchema } from '../src/domain/schema.ts';
import { operationSchema } from '../src/domain/operations.ts';
import { buildScene } from '../src/scene/build.ts';
import { toSvg } from '../src/scene/export.ts';
import { matrixMarkdown, reviewCsv } from '../src/compiler/report.ts';
const root = 'docs/generated';
await mkdir(root, { recursive: true });
await mkdir('schema', { recursive: true });
await writeFile('schema/model.schema.json', JSON.stringify(z.toJSONSchema(modelSchema, { target: 'draft-7' }), null, 2) + '\n');
await writeFile('schema/operations.schema.json', JSON.stringify(z.toJSONSchema(z.array(operationSchema).min(1).max(32), { target: 'draft-7' }), null, 2) + '\n');
for (const file of ['obcm', 'cascade', 'branched', 'symbols']) {
    const c = requireModel(await readFile(`examples/${file}.control`, 'utf8'));
    const out = join(root, file);
    await mkdir(out, { recursive: true });
    for (const view of c.model.views) {
        const scene = await buildScene(c.model, view.id);
        if (scene.audit.some(a => a.severity === 'error'))
            throw new Error(`${file}/${view.id}: ${JSON.stringify(scene.audit)}`);
        await writeFile(join(out, view.id + '.svg'), toSvg(scene));
    }
    await writeFile(join(out, 'control-matrix.md'), matrixMarkdown(c.model));
    await writeFile(join(out, 'review-checklist.csv'), reviewCsv(c.model));
}
console.log('Generated schemas and all public example views.');
