const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let time='2026-10-12T00:30:00Z',missing=3,alerts=[],finals=0;
class Clock extends Date {constructor(...a){super(...(a.length?a:[time]))}}
const props={'MM_0900_2026-10-12':'Y'};
const c={Date:Clock,console,Session:{getScriptTimeZone:()=> 'Asia/Seoul'},Utilities:{formatDate:(d,tz,p)=>p==='u'?'1':p==='H'?String((d.getUTCHours()+9)%24):d.toISOString().slice(0,10)},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})},LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})}};
vm.createContext(c);vm.runInContext(fs.readFileSync('apps-script/AutoMail.gs','utf8'),c);
c.getAutoMailStatus_=w=>({weekKey:w,total:23,done:23-missing,missing:Array(missing).fill({})});c.sendMissingAlert_=(st,count)=>{alerts.push({count,missing:st.missing.length});return 5};c.sendFinalAutoReport_=()=>{finals++;return 23};
assert.equal(c.runMondayAutoMailCheck_(false).reason,'hour_not_elapsed');
time='2026-10-12T01:32:00Z';assert.equal(c.runMondayAutoMailCheck_(false).reminderNo,2);
time='2026-10-12T02:31:00Z';assert.equal(c.runMondayAutoMailCheck_(false).reason,'hour_not_elapsed');
time='2026-10-12T02:32:00Z';missing=1;assert.equal(c.runMondayAutoMailCheck_(false).reminderNo,3);assert.deepEqual(alerts,[{count:2,missing:3},{count:3,missing:1}]);
missing=0;assert.equal(c.runMondayAutoMailCheck_(false).type,'final');assert.equal(c.runMondayAutoMailCheck_(false).reason,'final_already_sent');assert.equal(finals,1);assert.equal(alerts.length,2);
for(const k of Object.keys(props))delete props[k];time='2026-10-12T00:00:00Z';missing=2;assert.equal(c.runMondayAutoMailCheck_(false).reminderNo,1);
time='2026-10-11T23:59:00Z';assert.equal(c.runMondayAutoMailCheck_(false).reason,'before_0900');
console.log('기존 1차 이후 차수 전환, 60분 간격, 인원 재집계, 완료 후 중지 통과');
