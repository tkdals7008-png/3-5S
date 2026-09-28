const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let instant='2026-09-29T00:00:00Z',sent=0,complete=false;
class Clock extends Date {constructor(...a){super(...(a.length?a:[instant]))}static now(){return new Date(instant).getTime()}}
const props={},cache={};
const context={Date:Clock,console,
  Session:{getScriptTimeZone:()=> 'Asia/Seoul'},
  Utilities:{formatDate:(d,tz,fmt)=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false}).formatToParts(d).map(x=>[x.type,x.value]));const date=`${parts.year}-${parts.month}-${parts.day}`;return fmt==='yyyy-MM-dd'?date:fmt==='H'?String(Number(parts.hour)%24):fmt==='u'?String(new Date(date+'T12:00:00Z').getUTCDay()||7):''}},
  CacheService:{getScriptCache:()=>({get:k=>cache[k],put:(k,v)=>cache[k]=v})},
  UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=> 'BEGIN:VEVENT\nDTSTART;VALUE=DATE:20260928\nDESCRIPTION:Public holiday\nEND:VEVENT\n'+Array.from({length:20},(_,i)=>`BEGIN:VEVENT\nDTSTART;VALUE=DATE:2026${String((i%12)+1).padStart(2,'0')}${String((i%27)+1).padStart(2,'0')}\nDESCRIPTION:Public holiday\nEND:VEVENT`).join('')})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  getAdminSettings_:()=>({machines:[],mails:[]}),getDataSheet_:()=>({getDataRange:()=>({getValues:()=>[]})})
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/Holidays.gs','utf8')+'\n'+fs.readFileSync('apps-script/AutoMail.gs','utf8'),context);
context.getAutoMailStatus_=()=>({total:2,done:complete?2:1,missing:complete?[]:[{name:'미등록자'}]});
context.sendMissingAlert_=()=>{sent++;return 3};
assert.equal(context.autoMailWorkDate_(new Clock()),'2026-09-29');
instant='2026-09-28T23:55:00Z';assert.equal(context.runMondayAutoMailCheck_(false).reason,'before_0900');
instant='2026-09-29T00:00:00Z';assert.equal(context.runMondayAutoMailCheck_(false).reminderNo,1);assert.equal(sent,1);
instant='2026-09-29T00:30:00Z';assert.equal(context.runMondayAutoMailCheck_(false).reason,'hour_not_elapsed');
instant='2026-09-29T01:00:00Z';assert.equal(context.runMondayAutoMailCheck_(false).reminderNo,2);assert.equal(sent,2);
complete=true;instant='2026-09-29T01:05:00Z';assert.equal(context.onInspectionSaved_('2026-09-29').status,'pending_report');assert.equal(context.runMondayAutoMailCheck_(false).status,'pending_report');assert.equal(sent,2);
console.log('공휴일 익일·9시·매시간·완료 후 중지 검증 통과');
