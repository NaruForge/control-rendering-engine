import type { ElkNode } from 'elkjs/lib/elk-api';

/** Browser compiler workers must not import ELK's in-process UMD bundle: that
 * bundle takes over self.onmessage when it detects a worker global. Keep ELK's
 * protocol in its own worker and leave the compiler message channel untouched. */
export async function runElk(graph: ElkNode): Promise<ElkNode> {
    if (typeof self !== 'undefined' && typeof Worker !== 'undefined') {
        const [{ default: ElkApi }, { default: ElkWorker }] = await Promise.all([
            import('elkjs/lib/elk-api.js'),
            import('elkjs/lib/elk-worker.min.js?worker'),
        ]);
        const elk = new ElkApi({ workerFactory: () => new ElkWorker() });
        try {
            return await elk.layout(graph);
        }
        finally {
            elk.terminateWorker();
        }
    }
    // Node CLI/MCP/LSP use the supplied in-process implementation, without a browser.
    const { default: Elk } = await import('elkjs/lib/elk.bundled.js');
    return new Elk().layout(graph);
}
