import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { stdio: 'pipe' });
let browser, logs = '';
server.stdout.on('data', data => { logs += data; }); server.stderr.on('data', data => { logs += data; });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch('http://127.0.0.1:4178')).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 200)); }
  assert(ready, `Dev server failed: ${logs}`);
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.goto('http://127.0.0.1:4178');
  const valid = () => page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Preview up to date'));
  await valid();
  const original = await page.locator('#source').inputValue();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/workbench.png', fullPage: true });
  for (const theme of ['studio', 'midnight', 'paper']) {
    await page.selectOption('#theme', theme);
    for (const view of ['overview', 'topology', 'matrix', 'mode']) {
      await page.click(`[data-view="${view}"]`); await valid();
      const overflow = await page.evaluate(() => {
        const svg = document.querySelector('#canvas svg'); const r = svg.getBoundingClientRect();
        return [...svg.querySelectorAll('text')].filter(t => { const b = t.getBoundingClientRect(); return b.left < r.left - 2 || b.top < r.top - 2 || b.right > r.right + 2 || b.bottom > r.bottom + 2; }).map(t => t.textContent);
      });
      assert.deepEqual(overflow, [], `Text outside SVG: ${theme}/${view}`);
    }
  }
  await page.locator('#source').fill(original.replace('title: OBCM Control Architecture', 'title: Edited Local Model')); await valid();
  assert.match(await page.locator('#canvas').textContent(), /Edited Local Model/);
  await page.locator('#source').fill('schemaVersion: 999');
  await page.waitForFunction(() => !document.getElementById('error').hidden);
  assert(await page.locator('#export-svg').isDisabled()); assert.equal(await page.locator('#canvas svg').count(), 0);
  await page.locator('#source').fill(original); await valid();
  const downloadPromise = page.waitForEvent('download'); await page.click('#export-svg'); const download = await downloadPromise; assert.match(download.suggestedFilename(), /\.svg$/);
  const pngPromise = page.waitForEvent('download'); await page.click('#export-png'); const png = await pngPromise; assert.match(png.suggestedFilename(), /\.png$/);
  await page.selectOption('#example', 'signals'); await page.click('[data-view="signals"]'); await valid();
  assert.match(await page.locator('#canvas').textContent(), /Voltage controller/);
  await page.screenshot({ path: 'test-results/signal-workbench.png', fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: 'test-results/tablet.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: views, themes, live edit, invalid input, SVG/PNG download, ELK, tablet screenshot.');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await browser?.close(); server.kill(); }
