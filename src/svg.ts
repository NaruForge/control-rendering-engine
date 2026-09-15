import type { Theme } from './theme.ts';
export function escapeXml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}
/** Conservative, platform-independent estimate; CJK and wide glyphs get a full em. */
export function textWidth(value: string, size: number): number {
  return Array.from(value).reduce((n, c) => n + (/[^\u0000-\u00ff]/.test(c) ? 1 : /[ilI.,:;'!| ]/.test(c) ? .34 : /[MW@%]/.test(c) ? .92 : .63), 0) * size;
}
export function wrap(value: string, width: number, size: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const token of paragraph.split(/(\s+)/)) {
      if (textWidth(line + token, size) <= width) { line += token; continue; }
      if (line.trim()) { lines.push(line.trim()); line = ''; }
      for (const char of token.trimStart()) {
        if (textWidth(line + char, size) > width && line) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines.length ? lines : [''];
}
export class Canvas {
  parts: string[] = [];
  width: number;
  theme: Theme;
  constructor(width: number, theme: Theme) { this.width = width; this.theme = theme; }
  add(markup: string) { this.parts.push(markup); }
  rect(x: number, y: number, w: number, h: number, fill = this.theme.panel, stroke = this.theme.line, radius = this.theme.radius) {
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`);
  }
  text(value: string, x: number, y: number, size = 16, fill = this.theme.ink, weight = 400, extra = '') {
    this.add(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${escapeXml(value)}</text>`);
  }
  lines(value: string, x: number, y: number, width: number, size = 16, fill = this.theme.ink, weight = 400, leading = size * 1.4) {
    const lines = wrap(value, width, size);
    lines.forEach((line, i) => this.text(line, x, y + i * leading, size, fill, weight));
    return lines.length * leading;
  }
  line(x1: number, y1: number, x2: number, y2: number, color = this.theme.line, width = 1, extra = '') {
    this.add(`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`);
  }
  pill(label: string, x: number, y: number, color = this.theme.accent, fill = this.theme.tint) {
    const width = textWidth(label, 13) + 24;
    this.rect(x, y, width, 29, fill, fill, 7); this.text(label, x + 12, y + 19, 13, color, 600); return width;
  }
  finish(height: number, title: string, description: string, view: string) {
    const t = this.theme;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${height}" viewBox="0 0 ${this.width} ${height}" role="img" aria-labelledby="diagram-title diagram-description" font-family="Segoe UI, Noto Sans, Noto Sans KR, Arial, sans-serif">\n<title id="diagram-title">${escapeXml(title)}</title>\n<desc id="diagram-description">${escapeXml(description)}</desc>\n<metadata>${escapeXml(JSON.stringify({ generator: 'control-rendering-engine', schemaVersion: 1, view }))}</metadata>\n<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="${t.power}" stroke-width="1.5"/></marker><marker id="signal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="${t.accent}" stroke-width="1.5"/></marker></defs>\n<rect width="100%" height="100%" fill="${t.background}"/>\n${this.parts.join('\n')}\n</svg>\n`;
  }
}
