const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let rows=[[],['2026-10-12','대리 점검자','13호기'],['2026-10-12','대리 점검자','39호기'],['2026-10-05','본인','40호기']];
const c={console,getAdminSettings_:()=>({machines:[{owner:'본인',machine:'13호기'},{owner:'본인',machine:'40호기'},{owner:'출장자',machine:'39호기'}],mails:[]}),getDataSheet_:()=>({getDataRange:()=>({getValues:()=>rows})})};
vm.createContext(c);vm.runInContext(fs.readFileSync('apps-script/AutoMail.gs','utf8'),c);
let st=c.getAutoMailStatus_('2026-10-12');assert.equal(st.total,2);assert.equal(st.done,1);assert.equal(st.missing[0].name,'본인');assert.equal(st.missing[0].machine,'40호기');
rows.push(['2026-10-12','또 다른 점검자','40호기']);st=c.getAutoMailStatus_('2026-10-12');assert.equal(st.done,2);assert.equal(st.missing.length,0);
let html;c.sendAutoMailBatched_=(r,s,h)=>html=h;st.mails=[{email:'admin@example.test'}];c.sendFinalAutoReport_(st);assert.match(html,/실제 점검자/);assert.match(html,/대리 점검자/);assert.match(html,/40호기/);
console.log('대리 등록 인정·복수 담당설비 누락 검출·실제 점검자 표시 통과');
