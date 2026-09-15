import type { Theme } from './theme.ts';
import type { SceneNode, SceneEdge, MathGlyph } from './types.ts';
import { xml } from './text.ts';
export const fontFamily = 'Segoe UI, Noto Sans, Noto Sans KR, Arial, sans-serif';
export function mathMarkup(glyph: MathGlyph, x: number, y: number, w: number, h: number) {
    const scale = Math.min(w / glyph.width, h / glyph.height), width = glyph.width * scale, height = glyph.height * scale;
    return `<svg x="${x + (w - width) / 2}" y="${y + (h - height) / 2}" width="${width}" height="${height}" viewBox="${glyph.viewBox}" xmlns="http://www.w3.org/2000/svg">${glyph.body}</svg>`;
}
/** Shared verbatim by interactive nodes and standalone export. All external text is escaped. */
export function nodeMarkup(n: SceneNode, t: Theme): string {
    const color = t[n.tone], w = n.width, h = n.height;
    const text = n.texts.map(l => `<text x="${l.x}" y="${l.y}" font-size="${l.size}" fill="${t[l.tone ?? 'ink']}" font-weight="${l.weight ?? 400}" text-anchor="${l.anchor ?? 'start'}">${xml(l.text)}</text>`).join('');
    let shape = '';
    if (n.shape === 'card' || n.shape === 'limiter' || n.shape === 'switch') {
        shape = `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${t.radius}" fill="${t.panel}" stroke="${n.tone === 'ink' ? t.line : color}" stroke-width="1.5"/>`;
        if (n.kind)
            shape += `<path d="M16 36H${w - 16}" stroke="${t.line}"/>`;
        if (n.shape === 'limiter')
            shape += `<path d="M${w - 46} 26h8l12 -12h8" stroke="${color}" stroke-width="1.5" fill="none"/>`;
        if (n.shape === 'switch')
            shape += `<path d="M${w - 48} 24h9m4 0l12 -9m0 9h8" stroke="${color}" stroke-width="1.5" fill="none"/>`;
    }
    else if (n.shape === 'group') {
        shape = `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${t.radius}" fill="${t.tint}" fill-opacity="0.55" stroke="${t.line}" stroke-width="1.5" stroke-dasharray="5 5"/>`;
    }
    else if (n.shape === 'sum') {
        const cx = w / 2, cy = h / 2, r = 25;
        shape = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.panel}" stroke="${color}" stroke-width="1.8"/>`;
        n.ports.forEach(p => {
            const tx = p.side === 'WEST' ? cx - r : p.side === 'EAST' ? cx + r : cx;
            const ty = p.side === 'NORTH' ? cy - r : p.side === 'SOUTH' ? cy + r : cy;
            shape += `<path d="M${p.x} ${p.y}L${tx} ${ty}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
            if (p.sign)
                shape += `<text x="${cx + (p.side === 'WEST' ? -14 : p.side === 'EAST' ? 14 : 0)}" y="${cy + (p.side === 'NORTH' ? -9 : p.side === 'SOUTH' ? 20 : 5)}" text-anchor="middle" font-size="15" fill="${color}">${p.sign === '-' ? '−' : '+'}</text>`;
        });
    }
    else if (n.shape === 'gain') {
        shape = `<path d="M12 22L${w - 12} ${h / 2}L12 ${h - 22}Z" fill="${t.panel}" stroke="${color}" stroke-width="1.7"/>`;
        n.ports.forEach(p => { shape += `<path d="M${p.x} ${p.y}L${p.side === 'WEST' ? 12 : w - 12} ${h / 2}" stroke="${color}"/>`; });
    }
    else if (n.shape === 'junction') {
        for (const p of n.ports)
            shape += `<path d="M${p.x} ${p.y}L${w / 2} ${h / 2}" stroke="${color}"/>`;
        shape += `<circle cx="${w / 2}" cy="${h / 2}" r="4" fill="${color}"/>`;
    }
    const ports = ['sum', 'gain', 'junction'].includes(n.shape) ? '' : n.ports.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${t.panel}" stroke="${color}" stroke-width="1.3"/>`).join('');
    const math = n.math && n.mathBox ? mathMarkup(n.math, n.mathBox.x, n.mathBox.y, n.mathBox.width, n.mathBox.height) : '';
    return `<g font-family="${fontFamily}" color="${t.ink}">${shape}${text}${math}${ports}</g>`;
}
export function edgeMarkup(e: SceneEdge, t: Theme, markerPrefix = 'cre'): string {
    const color = e.kind === 'feedback' ? t.violet : e.kind === 'power' ? t.muted : t.accent;
    return e.paths.map(points => `<path data-edge="${xml(e.id)}" d="${points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${e.kind === 'power' ? 2.5 : 1.8}" ${e.kind === 'feedback' ? 'stroke-dasharray="6 4"' : e.kind === 'off' ? 'stroke-dasharray="3 5" opacity="0.4"' : ''}${e.startArrow ? ` marker-start="url(#${markerPrefix}-${e.kind})"` : ''}${e.endArrow ? ` marker-end="url(#${markerPrefix}-${e.kind})"` : ''}/>`).join('') +
        e.labels.map(l => `<rect x="${l.x - 4}" y="${l.y - 2}" width="${l.width + 8}" height="${l.height + 4}" rx="3" fill="${t.background}"/><text x="${l.x}" y="${l.y + 13}" font-family="${fontFamily}" font-size="12" font-weight="600" fill="${color}">${xml(l.text)}</text>`).join('');
}
export function markers(t: Theme, prefix = 'cre') {
    return `<defs>${(['signal', 'feedback', 'power', 'off'] as const).map(kind => `<marker id="${prefix}-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="${kind === 'feedback' ? t.violet : kind === 'power' ? t.muted : t.accent}" stroke-width="1.5"/></marker>`).join('')}</defs>`;
}
