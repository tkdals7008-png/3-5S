import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps-script/AutoMail.gs',import.meta.url),'utf8');
function harness({complete=true,fail=false,hour=8}={}){
  const properties={MM_FINAL_2026:'Y'};let sent=0,released=0;
  const context={Date,Session:{getScriptTimeZone:()=> 'Asia/Seoul'},Utilities:{formatDate:(_,__,format)=>format==='u'?'1':format==='H'?String(hour):'2026-10-12'},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k],setProperty:(k,v)=>properties[k]=v})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++}})}};
  vm.createContext(context);vm.runInContext(source,context);
  context.getAutoMailStatus_=()=>({weekKey:'2026-10-12',total:1,missing:complete?[]:[{}]});
  context.sendFinalAutoReport_=()=>{if(fail)throw Error('renderer unavailable');sent++;return 1;};
  return {context,properties,get sent(){return sent},get released(){return released}};
}
test('complete before nine sends full report once, independent of old list marker',()=>{
  const h=harness();h.properties['MM_FINAL_2026-10-12']='Y';
  assert.equal(h.context.runMondayAutoMailCheck_(false).type,'final');
  assert.equal(h.context.runMondayAutoMailCheck_(false).reason,'final_already_sent');assert.equal(h.sent,1);
});
test('failed renderer does not mark completion and releases lock for retry',()=>{
  const h=harness({fail:true});assert.throws(()=>h.context.runMondayAutoMailCheck_(false));
  assert.equal(h.properties['MM_REPORT_FINAL_2026-10-12'],undefined);assert.equal(h.released,1);
});
test('missing reminders still wait until nine',()=>{
  const h=harness({complete:false});assert.equal(h.context.runMondayAutoMailCheck_(false).reason,'before_0900');assert.equal(h.sent,0);
});
test('last registration before nine sends immediately',()=>{
  const h=harness();assert.equal(h.context.onInspectionSaved_('2026-10-12').type,'final');assert.equal(h.sent,1);
});
