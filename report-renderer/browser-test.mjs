// Synthetic records only. Never call the live mail or settings endpoints.
import http from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,basename} from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..'),date='2026-10-12';
const items=Array.from({length:10},(_,i)=>({no:i+1,name:'시험 점검항목 '+(i+1),active:true}));
const machines=Array.from({length:25},(_,i)=>({machine:String(i+1),owner:'시험 담당자 '+(i+1),team:i<13?'시험 사출팀':'시험 조립팀',maker:'시험 제조사',ton:'100',active:true}));
const records=machines.map((m,i)=>({rowIndex:i+2,date,machine:m.machine,inspector:i===0?'시험 대리점검자':m.owner,items:Array(10).fill('O'),itemActionsJson:'[]'}));
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(!/^\/[\w-]+\.(html|js)$/.test(path)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':'text/html;charset=utf-8');res.end(await readFile(resolve(root,basename(path))));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Seoul'});let sends=0,payload;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='script.google.com'){
   if(req.method()==='POST'){
    const d=req.postDataJSON();assert.equal(d.key,'synthetic-key');
    if(d.action==='pc_report_status')return route.fulfill({json:sends?{status:'skip',reason:'final_already_sent'}:{status:'ready',snapshot:{date,records,items,settings:{configured:true,machines,mails:[]}},revision:'synthetic-revision'}});
    assert.equal(d.action,'pc_report_send');payload=d;sends++;return route.fulfill({json:{status:'success',sentCount:1,pdfAttached:true,inlineImage:true}});
   }
   const a=url.searchParams.get('action');return route.fulfill({json:a==='get_items'?{status:'success',items}:a==='get_admin_settings'?{status:'success',settings:{configured:true,machines,mails:[]}}:records});
  }
  if(req.method()!=='GET')return route.abort();return route.continue();
 });
 page.on('dialog',d=>d.dismiss());
 await page.goto('http://127.0.0.1:'+server.address().port+'/admin.html?autoReport=pc',{waitUntil:'networkidle'});
 await page.locator('#mmPcKey').fill('synthetic-key');await page.locator('#mmPcStart').click();
 await page.waitForFunction(()=>document.querySelector('#mmPcStatus')?.textContent.includes('전체 보고서 발송 완료'),{},{timeout:120000});
 assert.equal(sends,1);assert.equal(payload.date,date);assert.equal(payload.revision,'synthetic-revision');
 const pdf=Buffer.from(payload.reportPdfBase64,'base64');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 assert.equal(Buffer.from(payload.reportImageBase64,'base64').readUInt16BE(0),0xffd8);
 await mkdir('qa-output',{recursive:true});await writeFile('qa-output/synthetic-report.pdf',pdf);await writeFile('qa-output/synthetic-report.jpg',Buffer.from(payload.reportImageBase64,'base64'));
 await page.screenshot({path:'qa-output/pc-report.png',fullPage:true});
 await page.locator('#mmPcStop').click();console.log('Synthetic browser checks passed: PC start, substituted inspector, shared image/PDF capture, send payload, stop.');
}finally{await browser.close();server.close();}
