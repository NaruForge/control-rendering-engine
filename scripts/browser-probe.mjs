import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const port=4183;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1760,height:1080}});const events=[];
  page.on('console',m=>events.push({type:m.type(),text:m.text()}));page.on('pageerror',e=>events.push({type:'pageerror',text:String(e)}));
  page.on('worker',w=>{events.push({type:'worker',url:w.url()});w.evaluate(()=>{self.addEventListener('error',e=>console.error('WORKER ERROR',e.message));self.addEventListener('unhandledrejection',e=>console.error('WORKER REJECTION',String(e.reason)));}).catch(e=>events.push({type:'worker-evaluate',text:String(e)}));});
  await page.goto(`http://127.0.0.1:${port}`);await page.waitForTimeout(5000);await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/startup.png',fullPage:true});
  const result={events,text:await page.locator('body').innerText(),workers:page.workers().map(w=>w.url())};
  console.log('PRODUCTION STARTUP',JSON.stringify(result,null,2));await writeFile('test-results/startup.json',JSON.stringify(result,null,2));
}finally{await browser?.close();server.kill();}
