/// <reference lib="webworker" />
import { compile } from '../compiler/compile.ts';
import { buildScene } from '../scene/build.ts';
import { applyOperations } from '../domain/operations.ts';
import type { Format } from '../domain/schema.ts';
self.addEventListener('message', async (event: MessageEvent) => {
    const request = event.data as {
        id: number;
        kind: 'compile' | 'operation';
        source: string;
        format?: Format;
        view?: string;
        mode?: string;
        operations?: unknown[];
        revision?: string;
        outputFormat?: Format;
    };
    try {
        if (request.kind === 'operation') {
            const result = applyOperations(request.source, request.operations ?? [], request.revision, request.outputFormat);
            self.postMessage({ id: request.id, kind: 'operation', result });
            return;
        }
        const compilation = compile(request.source, request.format);
        let scene;
        if (compilation.ok) {
            try {
                scene = await buildScene(compilation.model!, request.view && compilation.model!.views.some(v => v.id === request.view) ? request.view : compilation.model!.views[0].id, request.mode);
            }
            catch (e) {
                self.postMessage({ id: request.id, kind: 'compile', compilation, error: e instanceof Error ? e.message : String(e) });
                return;
            }
        }
        self.postMessage({ id: request.id, kind: 'compile', compilation, scene });
    }
    catch (error) {
        self.postMessage({ id: request.id, kind: request.kind, error: error instanceof Error ? error.message : String(error) });
    }
});
