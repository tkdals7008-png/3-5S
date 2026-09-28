const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rows = [Array(24).fill(''), ['2026-09-28','고상민','24호기'], ['2026-09-28','고상민','24호기'], ['2026-09-28','다른 점검자','25호기']];
let lockCount=0, releases=0;
const sheet={
  getLastRow:()=>rows.length,
  getRange:(row,col,count,width)=>({getValues:()=>rows.slice(row-1,row-1+count).map(r=>Array.from({length:width},(_,i)=>r[col-1+i]||''))}),
  appendRow:r=>rows.push(r),
  deleteRow:r=>rows.splice(r-1,1)
};
const context={
  SpreadsheetApp:{}, Utilities:{formatDate:()=>''}, Session:{getScriptTimeZone:()=> 'Asia/Seoul'},
  LockService:{getScriptLock:()=>({waitLock:()=>{lockCount++},releaseLock:()=>{releases++}})},
  console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),context);
Object.assign(context,{
  getDataSheet_:()=>sheet, jsonResponse:x=>x,
  saveItemActionPhotos_:()=>({urls:['new-photo'],actions:[]}),
  savePhoto_:()=> 'new-photo', getItemSettings_:()=>[],
  createRequestNo:()=> 'REQ-NEW', ensureHeaders_:()=>{}, onInspectionSaved_:()=>null
});
const payload={inspectDate:'2026-09-28',inspectorName:'고상민',machineId:'24호기',item1:'X',itemActionsJson:'[]'};
const post=d=>context.doPost({postData:{contents:JSON.stringify(d)}});
assert.equal(context.doGet({parameter:{action:'check_inspection',date:'2026-09-28',machine:'24호기'}}).existingCount,2);
assert.equal(post(payload).status,'confirm_replace');
assert.equal(rows.length,4);
assert.equal(post({...payload,replaceExisting:true,expectedExistingCount:1}).status,'confirm_replace');
assert.equal(rows.length,4);
assert.equal(post({...payload,replaceExisting:true,expectedExistingCount:2}).replacedCount,2);
assert.equal(rows.length,3);
assert.equal(rows.filter(r=>r[0]==='2026-09-28'&&r[2]==='24호기').length,1);
assert.equal(rows.find(r=>r[2]==='24호기')[14],'new-photo');
assert.equal(rows.find(r=>r[2]==='25호기')[1],'다른 점검자');
assert.equal(lockCount,releases);
console.log('같은 날짜·설비 확인/교체 및 다른 설비 보존 통과');
