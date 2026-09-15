import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// npm run test:browser builds first. Exercise the production bundle, not only the dev server.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { stdio: 'pipe' });
let browser, logs = '';
server.stdout.on('data', data => { logs += data; }); server.stderr.on('data', data => { logs += data; });
const evidence = { checks: [], screenshots: [], metrics: {} };
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch('http://127.0.0.1:4178')).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 200)); }
  assert(ready, `Preview server failed: ${logs}`);
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.goto('http://127.0.0.1:4178');
  const valid = () => page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Preview up to date'));
  const settled = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const screenshot = async name => { await settled(); await page.screenshot({ path: `test-results/${name}.png`, fullPage: true }); evidence.screenshots.push(name); };
  const scale = () => page.evaluate(() => { const s = document.querySelector('#canvas svg'); return s.getBoundingClientRect().width / s.viewBox.baseVal.width; });
  const fits = () => page.evaluate(() => { const p = document.getElementById('canvas-scroll'), s = document.querySelector('#canvas svg'), r = s.getBoundingClientRect(); return r.width <= p.clientWidth && r.height <= p.clientHeight; });
  async function textBounds() {
    const overflow = await page.evaluate(() => {
      const svg = document.querySelector('#canvas svg'), r = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('text')].filter(t => { const b = t.getBoundingClientRect(); return b.left < r.left - 2 || b.top < r.top - 2 || b.right > r.right + 2 || b.bottom > r.bottom + 2; }).map(t => t.textContent);
    });
    assert.deepEqual(overflow, [], 'Text outside SVG');
  }
  async function exportedSvg(name) {
    const pending = page.waitForEvent('download'); await page.click('#export-svg'); const file = await pending;
    await file.saveAs(`test-results/${name}.svg`); return readFile(`test-results/${name}.svg`, 'utf8');
  }
  await valid();
  const original = await page.locator('#source').inputValue();
  await mkdir('test-results', { recursive: true });
  await screenshot('workbench');
  for (const theme of ['studio', 'midnight', 'paper']) {
    await page.selectOption('#theme', theme);
    for (const view of ['overview', 'topology', 'matrix', 'mode']) { await page.click(`[data-view="${view}"]`); await valid(); await textBounds(); }
  }
  await page.locator('#source').fill(original.replace('title: OBCM Control Architecture', 'title: Edited Local Model')); await valid();
  assert.match(await page.locator('#canvas').textContent(), /Edited Local Model/);
  await page.locator('#source').fill('schemaVersion: 999'); await page.waitForFunction(() => !document.getElementById('error').hidden);
  assert(await page.locator('#export-svg').isDisabled()); assert.equal(await page.locator('#canvas svg').count(), 0);
  await page.locator('#source').fill(original); await valid();
  const pngPending = page.waitForEvent('download'); await page.click('#export-png'); const png = await pngPending;
  assert.match(png.suggestedFilename(), /\.png$/);
  evidence.checks.push('live-edit', 'invalid-model-blocks-export', 'PNG-download', 'all-curated-views-and-themes');

  await page.selectOption('#example', 'signals'); await page.click('[data-view="signals"]'); await valid();
  await page.click('#toggle-source');
  for (const theme of ['studio', 'midnight', 'paper']) {
    await page.selectOption('#theme', theme); await valid(); await textBounds();
    assert.equal(await page.locator('#canvas svg path[marker-end="url(#signal-arrow)"]').count(), 7);
    assert.equal(await page.locator('#canvas svg path[stroke-dasharray="6 4"]').count(), 2);
    const svg = await exportedSvg(`feedback-${theme}`);
    const dimensions = await page.locator('#canvas svg').evaluate(s => ({ width: s.viewBox.baseVal.width, height: s.viewBox.baseVal.height }));
    const native = await browser.newPage({ viewport: { width: Math.ceil(dimensions.width), height: Math.ceil(dimensions.height) }, deviceScaleFactor: 1 });
    await native.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`); await native.evaluate(() => document.fonts.ready);
    await native.screenshot({ path: `test-results/feedback-${theme}-native.png`, fullPage: true });
    await native.locator('svg > g').screenshot({ path: `test-results/feedback-${theme}-graph.png` });
    await native.close();
  }
  evidence.checks.push('signal-view-text-bounds-all-themes', 'seven-directed-edges', 'two-feedback-styles');
  await page.selectOption('#theme', 'studio'); await valid();
  await page.click('#fit'); await settled(); assert(await fits());
  await screenshot('feedback-desktop-fit');
  const before = await exportedSvg('feedback-before-zoom');
  await page.click('#actual-size'); await settled(); assert(Math.abs(await scale() - 1) < 0.001);
  await page.selectOption('#theme', 'midnight'); await valid(); assert(Math.abs(await scale() - 1) < 0.001);
  await page.selectOption('#theme', 'studio'); await valid();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.click('#toggle-sidebar'); await settled();
  assert(Math.abs(await scale() - 1) < 0.001, '1:1 must remain native size after resizing');
  await page.click('#fit'); await settled(); assert(await fits()); evidence.metrics.tabletFitScale = await scale();
  await screenshot('feedback-tablet-fit');
  await page.click('#actual-size'); await settled(); evidence.metrics.tabletNativeScale = await scale();
  assert(Math.abs(await scale() - 1) < 0.001);
  const box = await page.locator('#canvas-scroll').boundingBox(); assert(box);
  await page.locator('#canvas-scroll').evaluate(p => { p.scrollLeft = 600; p.scrollTop = 0; });
  await page.mouse.move(box.x + box.width * 0.7, box.y + 200); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7 - 160, box.y + 200, { steps: 8 }); await page.mouse.up();
  assert(await page.locator('#canvas-scroll').evaluate(p => p.scrollLeft) >= 750, 'Mouse drag must pan horizontally');
  await page.locator('#canvas-scroll').evaluate(p => { p.scrollLeft = 1050; p.scrollTop = 0; });
  await screenshot('feedback-tablet-native');
  await page.mouse.move(box.x + box.width / 2, box.y + 200); await page.keyboard.down('Control');
  await page.mouse.wheel(0, -40); await page.keyboard.up('Control'); await settled();
  assert(await scale() > 1, 'Ctrl+wheel must zoom the diagram');
  await page.locator('#zoom').evaluate(input => { input.value = '400'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await settled(); assert(Math.abs(await scale() - 4) < 0.001);
  const after = await exportedSvg('feedback-after-zoom'); assert.equal(after, before, 'Viewport actions must not alter the exported diagram');
  await page.click('#fit'); await settled(); assert(await fits());
  assert.deepEqual(errors, []);
  evidence.checks.push('Fit-both-dimensions', 'native-1-to-1-persists-on-resize-and-rerender', 'sidebar-collapse', 'mouse-pan', 'Ctrl-wheel', '400-percent-absolute-scale', 'export-invariant-to-viewport', 'no-browser-errors');
  evidence.browser = browser.version();
  await writeFile('test-results/feedback-verification.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log('Production browser smoke passed:', evidence.checks.join(', '));
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await browser?.close(); server.kill(); }
