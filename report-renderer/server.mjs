import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..');
const token=process.env.MM_RENDER_TOKEN;
if(!token || token.length<32)throw Error('MM_RENDER_TOKEN must contain at least 32 characters');
let busy=false;
const allowedHosts=new Set(['cdn.sheetjs.com','cdn.jsdelivr.net','cdnjs.cloudflare.com','unpkg.com','drive.google.com','lh3.googleusercontent.com']);
function authorized(value){const a=Buffer.from(value||''),b=Buffer.from('Bearer '+token);return a.length===b.length&&timingSafeEqual(a,b);}
async function render(snapshot,origin){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.settings?.machines)||!Array.isArray(snapshot.items))throw Error('Invalid snapshot');
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Seoul'});
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(req.method()!=='GET')return route.abort(); // Never send mail or update settings.
      if(url.hostname==='script.google.com'){
        const action=url.searchParams.get('action');
        const data=action==='get_items'?{status:'success',items:snapshot.items}:action==='get_admin_settings'?{status:'success',settings:snapshot.settings}:snapshot.records;
        return route.fulfill({json:data});
      }
      if(url.origin===origin || allowedHosts.has(url.hostname))return route.continue();
      return route.abort();
    });
    page.on('dialog',dialog=>dialog.dismiss());
    await page.goto(origin+'/admin.html',{waitUntil:'networkidle',timeout:60000});
    await page.waitForFunction(()=>typeof window.createMyMachineReportPayload==='function'&&typeof window.setReportMode==='function');
    await page.evaluate(async date=>{
      document.getElementById('dateInput').value=date;
      window.setReportMode('day',false);
      await window.loadRealData();
    },snapshot.date);
    await page.waitForFunction(()=>document.getElementById('reportContent')?.offsetHeight>0);
    return await page.evaluate(date=>window.createMyMachineReportPayload(date,true),snapshot.date);
  }finally{await browser.close();}
}
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&/^\/[a-zA-Z0-9_-]+\.(html|js)$/.test(path)){
    try{const body=await readFile(resolve(root,basename(path)));res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':'text/html;charset=utf-8');return res.end(body);}catch{res.writeHead(404);return res.end();}
  }
  if(path!=='/render'||req.method!=='POST'){res.writeHead(404);return res.end();}
  if(!authorized(req.headers.authorization)){res.writeHead(401);return res.end();}
  if(busy){res.writeHead(503);return res.end();}
  busy=true;
  const timer=setTimeout(()=>req.destroy(),180000);
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>15*1024*1024)throw Error('Snapshot too large');chunks.push(chunk);}
    const snapshot=JSON.parse(Buffer.concat(chunks));
    const result=await render(snapshot,'http://127.0.0.1:'+server.address().port);
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
  }catch{res.writeHead(500);res.end('Report rendering failed');} // Never log records, photos, or tokens.
  finally{clearTimeout(timer);busy=false;}
});
server.listen(Number(process.env.PORT||8080),'0.0.0.0');
