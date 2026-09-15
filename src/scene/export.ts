import type { Scene } from './types.ts';
import { themes } from './theme.ts';
import type { ThemeName } from './theme.ts';
import { nodeMarkup, edgeMarkup, markers, fontFamily } from './primitives.ts';
import { xml } from './text.ts';
export function toSvg(scene: Scene, theme: ThemeName = 'studio'): string {
    const t = themes[theme];
    if (!t)
        throw new Error(`Unknown theme '${theme}'.`);
    const renderNodes = (group: boolean) => scene.nodes.filter(n => (n.shape === 'group') === group).map(n => `<g data-node="${xml(n.id)}" transform="translate(${n.x} ${n.y})">${nodeMarkup(n, t)}</g>`).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-labelledby="diagram-title diagram-description" font-family="${fontFamily}">\n<title id="diagram-title">${xml(scene.title)}</title>\n<desc id="diagram-description">${xml(scene.description + ' ' + scene.notes.join(' '))}</desc>\n<metadata>${xml(JSON.stringify({ generator: 'control-studio', sceneVersion: 1, view: scene.viewId, modelRevision: scene.revision }))}</metadata>\n${markers(t)}\n<rect width="100%" height="100%" fill="${t.background}"/>\n${renderNodes(true)}\n${scene.edges.map(e => edgeMarkup(e, t)).join('\n')}\n${renderNodes(false)}\n</svg>\n`;
}
