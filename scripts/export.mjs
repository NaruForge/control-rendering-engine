import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { chromium } from 'playwright';
const [input = 'artifacts/overview.svg', output = 'artifacts/overview.png'] = process.argv.slice(2);
let browser;
try {
  const svg = await readFile(resolve(input), 'utf8');
  const width = Number(svg.match(/<svg[^>]*\bwidth="([\d.]+)"/)?.[1]);
  const height = Number(svg.match(/<svg[^>]*\bheight="([\d.]+)"/)?.[1]);
  if (!(width > 0 && height > 0) || width * height > 64000000) throw new Error('Expected a generated SVG with numeric dimensions, at most 64 million pixels.');
  const format = extname(output).toLowerCase();
  if (!['.png', '.pdf'].includes(format)) throw new Error('Output extension must be .png or .pdf');
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(height) }, deviceScaleFactor: 1, javaScriptEnabled: false });
  await page.route('**/*', route => route.abort());
  await page.setContent(`<style>@page{size:${width}px ${height}px;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  await mkdir(dirname(resolve(output)), { recursive: true });
  if (format === '.png') await page.screenshot({ path: resolve(output), fullPage: true });
  else await page.pdf({ path: resolve(output), preferCSSPageSize: true, printBackground: true });
  console.log(`Exported ${output}`);
} catch (error) { console.error(`${error.message}\nFor a missing browser, run: npm run browser:install`); process.exitCode = 1; }
finally { await browser?.close(); }
