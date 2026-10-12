import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function harness({complete=true,fail=false,hour=8}={}){
  const properties={MM_PC_REPORT_KEY:'private-test-key'};let sent=0,released=0;
  const c={Date,console,Session:{getScriptTimeZone:()=> 'Asia/Seoul'},Utilities:{formatDate:(_,__,f)=>f==='u'?'1':f==='H'?String(hour):'2026-10-12',base64Encode:b=>Buffer.from(b).toString('base64'),computeDigest:(_,s)=>createHash('sha256').update(s).digest(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k],setProperty:(k,v)=>properties[k]=v})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++}})},MailApp:{getRemainingDailyQuota:()=>100},getItemSettings_:()=>[{no:1,name:'항목'}],doGet:()=>({getContent:()=>JSON.stringify([{date:'2026-10-12',machine:'1',inspector:'대리 점검자'}])})};
  vm.createContext(c);
  for(const name of ['AutoMail','AutomaticReport'])vm.runInContext(readFileSync(new URL('../apps-script/'+name+'.gs',import.meta.url),'utf8'),c);
  c.getAutoMailStatus_=()=>({weekKey:'2026-10-12',total:1,missing:complete?[]:[{}],settings:{machines:[{machine:'1',owner:'담당자'}]},mails:[{email:'test@example.com'}]});
  c.deliverRichReportEmail_=d=>{if(fail)throw Error('mail failure');assert.equal(d.recipients[0],'test@example.com');sent++;return {status:'success',inlineImage:!!d.reportImageBase64,pdfAttached:!!d.reportPdfBase64,sentCount:1};};
  return {c,properties,get sent(){return sent},get released(){return released}};
}
function payload(h){const s=h.c.pcReportStatus_({key:'private-test-key'});return {key:'private-test-key',date:s.snapshot.date,revision:s.revision,reportImageBase64:'aW1hZ2U=',reportPdfBase64:'cGRm'};}
test('complete before nine stops reminders and waits for PC rich report',()=>{const h=harness();assert.equal(h.c.runMondayAutoMailCheck_(false).status,'pending_report');assert.equal(h.c.onInspectionSaved_('2026-10-12').status,'pending_report');assert.equal(h.sent,0);});
test('missing reminders still wait until nine',()=>{const h=harness({complete:false});assert.equal(h.c.runMondayAutoMailCheck_(false).reason,'before_0900');assert.equal(h.c.pcReportStatus_({key:'private-test-key'}).status,'waiting');});
test('PC sends report once, independent of prior list-only marker',()=>{const h=harness();h.properties['MM_FINAL_2026-10-12']='Y';const p=payload(h);assert.equal(h.c.pcReportSend_(p).status,'success');assert.equal(h.c.pcReportSend_(p).reason,'final_already_sent');assert.equal(h.sent,1);});
test('stale report cannot send',()=>{const h=harness(),p=payload(h);p.revision='outdated';assert.equal(h.c.pcReportSend_(p).status,'retry');assert.equal(h.sent,0);});
test('failed delivery does not mark completion and releases lock',()=>{const h=harness({fail:true});assert.throws(()=>h.c.pcReportSend_(payload(h)));assert.equal(h.properties['MM_REPORT_FINAL_2026-10-12'],undefined);assert.equal(h.released,1);});
test('missing PDF does not mark completion',()=>{const h=harness(),p=payload(h);delete p.reportPdfBase64;assert.throws(()=>h.c.pcReportSend_(p));assert.equal(h.properties['MM_REPORT_FINAL_2026-10-12'],undefined);});
test('invalid connection key cannot read snapshot or send',()=>{const h=harness();assert.throws(()=>h.c.pcReportStatus_({key:'wrong'}));assert.throws(()=>h.c.pcReportSend_({key:'wrong'}));assert.equal(h.sent,0);});
