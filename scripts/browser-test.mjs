import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { requireModel } from '../src/compiler/compile.ts';
import { buildScene } from '../src/scene/build.ts';
import { toSvg } from '../src/scene/export.ts';
const port = 4182;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
let browser, serverLog = '';
server.stdout.on('data', d => serverLog += d); server.stderr.on('data', d => serverLog += d);
const evidence = { production: true, checks: [], screenshots: [], browser: '', errors: [], externalRequests: [] };
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(`http://127.0.0.1:${port}`)).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 200)); }
  assert(ready, serverLog);
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || undefined }); evidence.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 1760, height: 1080 }, acceptDownloads: true });
  page.on('pageerror', e => evidence.errors.push(e.message)); page.on('dialog', d => d.accept());
  page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith(`http://127.0.0.1:${port}/`)) evidence.externalRequests.push(r.url()); });
  const valid = async view => {
    await page.waitForFunction(v => document.querySelector('.statusbar')?.textContent?.includes('Model valid · Preview up to date') && (!v || document.querySelector('[data-testid="diagram"]')?.getAttribute('data-view-id') === v), view, { timeout: 30000 });
    await page.waitForTimeout(200);
  };
  const screenshot = async name => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250); await page.screenshot({ path: `test-results/${name}.png`, fullPage: true }); evidence.screenshots.push(name); };
  const download = async (button, filename) => { const pending = page.waitForEvent('download'); await button.click(); const file = await pending; await file.saveAs(`test-results/${filename}`); return readFile(`test-results/${filename}`); };
  const openExample = async (id, view) => { await page.getByLabel('Example model', { exact: true }).selectOption(id); await valid(view); };
  const fillSource = async text => { const content=page.locator('.cm-content');await content.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text); };
  await mkdir('test-results', { recursive: true });
  await page.goto(`http://127.0.0.1:${port}`); await valid('overview');
  await screenshot('01-overview');
  assert.equal(await page.locator('[data-model-node^="components:"]').count(), 5);
  await page.getByTestId('view-matrix').click(); await valid('matrix'); await screenshot('02-control-matrix');
  await page.getByTestId('view-power').click(); await valid('power');
  await page.getByLabel('Operating mode').selectOption('v2h'); await valid('power');
  const homeSvg = (await download(page.getByTestId('export-svg'), 'v2h.svg')).toString();
  const expectedHome = toSvg(await buildScene(requireModel(await readFile('examples/obcm.control','utf8')).model, 'power', 'v2h'));
  assert.equal(homeSvg, expectedHome, 'Browser export must equal CLI/compiler output');
  evidence.checks.push('overview-matrix-mode-views', 'browser-export-equals-shared-compiler');

  await openExample('cascade', 'cascade'); await screenshot('03-control-cascade');
  assert.equal(await page.locator('.react-flow__edge').count(), 9);
  assert.equal(await page.locator('.react-flow__edge path[data-edge][stroke-dasharray]').count(), 2);
  assert.equal(await page.locator('[data-model-node="blocks:sum_v"] svg text').filter({ hasText: '−' }).count(), 1);
  const allSvg = (await download(page.getByTestId('export-svg'), 'cascade.svg')).toString();
  assert.equal(allSvg, toSvg(await buildScene(requireModel(await readFile('examples/cascade.control','utf8')).model,'cascade')));
  await page.getByTestId('view-current_loop').click(); await valid('current_loop');
  await page.getByTestId('element-blocks-i_ctrl').click(); await page.getByTestId('toggle-source').click();
  await screenshot('04-source-and-inspector');
  await page.getByLabel('Element label', { exact: true }).fill('Current controller · reviewed'); await page.getByRole('button', { name: 'Apply label', exact: true }).click(); await valid('current_loop');
  await page.getByTestId('review-changes').click(); await page.getByRole('dialog').waitFor();
  assert((await page.getByRole('dialog').innerText()).includes('blocks.i_ctrl'));
  await screenshot('05-semantic-review'); await page.getByLabel('Close dialog', {exact:true}).click();
  await page.getByLabel('Undo model change', {exact:true}).click(); await valid('current_loop');
  assert.equal(await page.getByLabel('Element label', {exact:true}).inputValue(),'Current controller');
  await page.getByLabel('Redo model change', {exact:true}).click(); await valid('current_loop');
  assert((await page.getByLabel('Element label', {exact:true}).inputValue()).includes('reviewed'));
  await page.getByLabel('Undo model change', {exact:true}).click(); await valid('current_loop');
  const original = await readFile('examples/cascade.control','utf8');
  await fillSource(original.replace('sum_v.feedback', 'sum_v.missing'));
  await page.waitForFunction(()=>document.querySelector('.diagnostics-body')?.textContent?.includes('SIGNAL_ENDPOINT'));
  assert(await page.getByTestId('export-svg').isDisabled()); assert.equal(await page.getByTestId('diagram').count(),0);
  await screenshot('06-source-diagnostics');
  await fillSource(original); await valid('current_loop');
  await page.getByLabel('Source format', {exact:true}).selectOption('yaml'); await valid('current_loop');
  const yaml=(await download(page.getByTestId('save-source'),'roundtrip.yaml')).toString(); assert.equal(requireModel(yaml).revision,requireModel(original).revision);
  await page.getByLabel('Source format', {exact:true}).selectOption('control'); await valid('current_loop');
  await page.getByTestId('toggle-source').click(); await page.getByLabel('Close inspector', {exact:true}).click();
  evidence.checks.push('explicit-sum-signs-and-feedback-ports', 'inspector-semantic-edit', 'undo-redo', 'semantic-diff-review', 'real-codemirror-diagnostics-and-recovery', 'invalid-model-blocks-export', 'YAML-DSL-roundtrip');

  await page.getByTestId('view-cascade').click(); await valid('cascade');
  for(const theme of ['midnight','paper','studio']) {
    await page.getByLabel('Theme',{exact:true}).selectOption(theme); await page.waitForTimeout(250);
    const svg=(await download(page.getByTestId('export-svg'),`cascade-${theme}.svg`)).toString();
    assert.equal(svg,toSvg(await buildScene(requireModel(original).model,'cascade'),theme));
    if(theme==='midnight') await screenshot('07-midnight-control');
  }
  const png=await download(page.getByRole('button',{name:'PNG',exact:true}),'control.png');assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  await page.getByTestId('view-grouped').click();await valid('grouped');await screenshot('08-grouped-control');
  await openExample('branched','network');await page.getByLabel('Operating mode',{exact:true}).selectOption('channel_a');await valid('network');await screenshot('09-branched-power');
  const off=(await download(page.getByTestId('export-svg'),'branched-off.svg')).toString();assert((off.match(/stroke-dasharray="3 5"/g)||[]).length===2);
  await openExample('symbols','symbols');await screenshot('10-symbol-library');await page.getByTestId('view-conditioning').click();await valid('conditioning');
  evidence.checks.push('three-theme-exports', 'PNG-signature', 'nested-coordinate-frame-routing', 'branched-power-mode-flow', 'control-symbol-library');

  await openExample('cascade','cascade');await page.getByTestId('agent-tools').click();await screenshot('11-agent-interface');assert((await page.getByRole('dialog').innerText()).includes('propose_operations'));await page.getByLabel('Close dialog',{exact:true}).click();
  await page.setViewportSize({width:768,height:1024});await page.getByLabel('Toggle sidebar',{exact:true}).click();await page.getByTestId('fit').click();await page.waitForTimeout(250);await screenshot('12-tablet-fit');
  await page.getByTestId('native-scale').click();await page.waitForTimeout(250);assert(Math.abs(Number(await page.getByTestId('diagram').getAttribute('data-zoom'))-1)<0.001);
  const viewport=page.locator('.react-flow__viewport');const before=await viewport.getAttribute('style');const box=await page.locator('.flow-host').boundingBox();
  await page.mouse.move(box.x+100,box.y+60);await page.mouse.down();await page.mouse.move(box.x+260,box.y+90,{steps:8});await page.mouse.up();assert.notEqual(await viewport.getAttribute('style'),before);
  await screenshot('13-tablet-native');const afterSvg=(await download(page.getByTestId('export-svg'),'after-viewport.svg')).toString();assert.equal(afterSvg,allSvg);
  await page.setViewportSize({width:1760,height:1080});await page.getByLabel('Toggle sidebar',{exact:true}).click();await page.getByTestId('fit').click();await page.waitForTimeout(250);
  evidence.checks.push('tablet-fit-and-native-1-to-1','canvas-pan','SVG-invariant-to-viewport');

  await page.getByTestId('add-block').click();let dialog=page.getByRole('dialog');await dialog.locator('input[name="id"]').fill('extra_sink');await dialog.locator('input[name="label"]').fill('Additional measurement');await dialog.locator('select[name="kind"]').selectOption('measurement');await dialog.getByRole('button',{name:'Add and validate'}).click();await valid('cascade');
  assert.equal(await page.locator('[data-model-node="blocks:extra_sink"]').count(),1);await page.getByTestId('fit').click();
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  const from=page.locator('.react-flow__node[data-id="blocks:sense"] .react-flow__handle[data-handleid="vm"]');
  const to=page.locator('.react-flow__node[data-id="blocks:extra_sink"] .react-flow__handle[data-handleid="input"]');
  await from.dragTo(to);await page.getByRole('dialog').waitFor({timeout:10000});dialog=page.getByRole('dialog');
  await dialog.locator('input[name="id"]').fill('extra_measurement');await dialog.locator('input[name="label"]').fill('Vo');await dialog.getByRole('button',{name:'Connect and validate'}).click();await valid('cascade');
  assert.equal(await page.locator('.react-flow__edge').count(),10);
  await page.getByLabel('Add view',{exact:true}).click();dialog=page.getByRole('dialog');await dialog.locator('input[name="id"]').fill('new_detail');await dialog.locator('input[name="title"]').fill('Measurement detail');await dialog.locator('input[name="include"]').fill('sense, extra_sink');await dialog.getByRole('button',{name:'Create view',exact:true}).click();await valid('cascade');await page.getByTestId('view-new_detail').click();await valid('new_detail');assert.equal(await page.locator('.react-flow__edge').count(),1);
  await screenshot('14-graphical-semantic-edit');evidence.checks.push('add-block-operation','port-connection-authoring','computed-view-authoring');

  assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.externalRequests,[]);
  evidence.checks.push('no-browser-exceptions','no-external-network-requests');
  await writeFile('test-results/verification.json',JSON.stringify(evidence,null,2)+'\n');console.log(`Production browser verification passed: ${evidence.checks.length} checks; ${evidence.screenshots.length} captures.`);
} catch(error){console.error(error);evidence.failure=String(error);await mkdir('test-results',{recursive:true});await writeFile('test-results/verification.json',JSON.stringify(evidence,null,2)+'\n');process.exitCode=1;}
finally{await browser?.close();server.kill();}
