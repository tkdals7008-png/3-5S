// Synthetic data only; block every external request. No real mail or record writes.
import http from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..');
const server=http.createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(!['/engineer.html','/engineer.js'].includes(path)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':'text/html;charset=utf-8');res.end(await readFile(resolve(root,'.'+path)));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});let saves=0,done=false,mode='success';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.hostname==='127.0.0.1')return route.continue();if(url.hostname!=='script.google.com'||req.method()!=='POST')return route.abort();const d=req.postDataJSON();assert.equal(d.key,'synthetic-only');assert.equal(d.date,'2026-11-16');
  if(d.action==='engineer_list')return route.fulfill({json:{status:'success',requests:[{id:'synthetic-request',revision:'revision',machine:'시험 6호기',inspector:'시험 점검자',item:'3. 누유 점검',text:'누유 부위를 개선해 주세요.',priority:'보통',status:done?'완료':'요청',before:[],completedBy:done?'시험 엔지니어':''}],duplicateCount:0}});
  assert.equal(d.action,'engineer_complete');saves++;assert.equal(d.name,'시험 엔지니어');assert.equal(d.text,'누유 부위 조치 완료');assert.equal(d.photo.mimeType,'image/jpeg');assert.equal(Buffer.from(d.photo.base64,'base64').readUInt16BE(0),0xffd8);await new Promise(r=>setTimeout(r,250));if(mode==='error')return route.fulfill({json:{status:'error',message:'시험 오류'}});done=true;return route.fulfill({json:{status:'success',message:'개선조치 완료 등록이 저장되었습니다.'}});
 });
 const url='http://127.0.0.1:'+server.address().port+'/engineer.html';await page.goto(url);assert.match(await page.locator('#message').textContent(),/메일/);assert.equal(await page.locator('#formSection').isVisible(),false);
 await page.goto(url+'#date=2026-11-16&key=synthetic-only');await page.reload();await page.locator('#formSection').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#name').fill('시험 엔지니어');await page.locator('#text').fill('누유 부위 조치 완료');
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1800"><rect width="2400" height="1800" fill="green"/></svg>');await page.locator('#photo').setInputFiles({name:'synthetic.svg',mimeType:'image/svg+xml',buffer:svg});
 await mkdir('qa-output',{recursive:true});await page.screenshot({path:'qa-output/engineer-mobile.png',fullPage:true});
 mode='error';await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('시험 오류'));assert.equal(await page.locator('#text').inputValue(),'누유 부위 조치 완료');assert.equal(await page.locator('#photo').evaluate(el=>el.files.length),1);
 mode='success';await page.locator('#save').click();assert.equal(await page.locator('#save').isDisabled(),true);await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('저장되었습니다'));assert.equal(saves,2);assert.match(await page.locator('#completeList').textContent(),/시험 엔지니어/);assert.equal(await page.locator('#formSection').isVisible(),false);assert.equal(await page.locator('#requestSection').isVisible(),false);await page.screenshot({path:'qa-output/engineer-complete.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: mobile screen, email link, image compression, pending lock, failure retention, successful completion');
}finally{await browser.close();server.close();}
