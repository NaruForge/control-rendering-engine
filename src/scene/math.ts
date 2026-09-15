import type { MathGlyph } from './types.ts';
const cache = new Map<string, MathGlyph>();
let converter: ((input: string) => MathGlyph) | undefined;
let loading: Promise<void> | undefined;
/** A restricted, offline TeX-to-path adapter. No HTML, autoload, href or network extensions. */
export async function typeset(input: string): Promise<MathGlyph> {
    const cached = cache.get(input);
    if (cached)
        return cached;
    if (input.length > 256 || /\\(?:href|url|html|includegraphics|require|def|newcommand|renewcommand|input|write|loop)\b/.test(input))
        throw new Error('Unsupported math command. Use base TeX/AMS expressions only.');
    loading ??= (async () => {
        const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }] = await Promise.all([
            import('mathjax-full/js/mathjax.js'), import('mathjax-full/js/input/tex.js'), import('mathjax-full/js/output/svg.js'),
            import('mathjax-full/js/adaptors/liteAdaptor.js'), import('mathjax-full/js/handlers/html.js'),
        ]);
        await import('mathjax-full/js/input/tex/ams/AmsConfiguration.js');
        const adaptor = liteAdaptor();
        RegisterHTMLHandler(adaptor);
        const document = mathjax.document('', { InputJax: new TeX({ packages: ['base', 'ams'], maxBuffer: 4096 }), OutputJax: new SVG({ fontCache: 'none' }) });
        converter = (input: string) => {
            const node = document.convert(input, { display: true });
            const markup = adaptor.outerHTML(node);
            if (/data-mjx-error|data-mml-node="merror"/.test(markup))
                throw new Error('Invalid TeX expression.');
            const viewBox = markup.match(/viewBox="([^"]+)"/)?.[1];
            const body = markup.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/)?.[1];
            if (!viewBox || !body)
                throw new Error('Math typesetting produced no SVG.');
            const [, , w, h] = viewBox.split(/\s+/).map(Number);
            return { body, viewBox, width: w, height: h };
        };
    })();
    await loading;
    const result = converter!(input);
    if (cache.size >= 128)
        cache.delete(cache.keys().next().value!);
    cache.set(input, result);
    return result;
}
