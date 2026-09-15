import type { TextLine, Tone } from './types.ts';
export const xml = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function width(text: string, size: number): number {
    return Array.from(text).reduce((n, c) => n + (/[^\u0000-\u00ff]/.test(c) ? 1 : /[ilI.,:;'!| ]/.test(c) ? .34 : /[MW@%]/.test(c) ? .94 : .63), 0) * size;
}
export function wrap(text: string, max: number, size: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
        let line = '';
        for (const token of paragraph.split(/(\s+)/)) {
            if (width(line + token, size) <= max) {
                line += token;
                continue;
            }
            if (line.trim()) {
                lines.push(line.trim());
                line = '';
            }
            for (const char of token.trimStart()) {
                if (width(line + char, size) > max && line) {
                    lines.push(line);
                    line = '';
                }
                line += char;
            }
        }
        if (line.trim())
            lines.push(line.trim());
    }
    return lines.length ? lines : [''];
}
export function lines(text: string, x: number, y: number, max: number, size = 15, tone: Tone = 'ink', weight = 400, leading = size * 1.4): TextLine[] {
    return wrap(text, max, size).map((text, i) => ({ text, x, y: y + i * leading, size, tone, weight }));
}
