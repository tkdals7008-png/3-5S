const {readFileSync,writeFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function harness({hour=12,day='1',missing=1,quota=100,excluded=false,fail=false}={}){
 const props={},sent=[],logs=[];let renders=0;
 const c={console,Date,Session:{getScriptTimeZone:()=> 'Asia/Seoul'},Utilities:{formatDate:(_,__,f)=>f==='u'?day:f==='H'?String(hour):'2026-11-16',base64Encode:()=> 'YWJj'},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v,deleteProperty:k=>delete props[k]})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:d=>{if(fail)throw Error('mail failed');sent.push(d);}},DriveApp:{},HtmlService:{}};
 c.LockService.getUserLock=c.LockService.getScriptLock;
 vm.createContext(c);for(const f of ['AutoMail','AutomaticReport','ServerReport'])vm.runInContext(readFileSync('apps-script/'+f+'.gs','utf8'),c);
 const st={weekKey:'2026-11-16',total:2,done:2-missing,missing:Array.from({length:missing},()=>({name:'B',team:'T'})),targets:[],mails:[{email:'admin@example.com',role:'관리자'},{email:'b@example.com'}],settings:{machines:[]}};
 c.getAutoMailStatus_=()=>st;c.serverReportExcluded_=()=>excluded;c.logServerReport_=(...x)=>logs.push(x);
 c.buildServerReport_=()=>{renders++;return {date:st.weekKey,mailHtml:'full report',inlineImages:{}};};c.serverReportPdf_=()=>({getBytes:()=>Array(200)});
 c.sendMissingAlert_=(_,n)=>{sent.push({reminder:n});return 2;};
 return {c,props,sent,logs,st,get renders(){return renders}};
}
for(const hour of [9,10]){const h=harness({hour});assert.equal(h.c.runServerReportCheck_().type,'missing');assert.equal(h.c.runServerReportCheck_().reason,'alert_slot_sent');assert.equal(h.sent.length,1);}
{const h=harness({hour:11});assert.equal(h.c.runServerReportCheck_().status,'waiting');assert.equal(h.sent.length,0);}
{const h=harness({hour:8,missing:0});assert.equal(h.c.runServerReportCheck_().status,'success');assert.equal(h.sent[0].htmlBody,'full report');assert.equal(h.sent[0].attachments.length,1);assert.equal(h.c.runServerReportCheck_().reason,'final_already_sent');}
{const h=harness({hour:12,missing:2});assert.equal(h.c.runServerReportCheck_().status,'success');assert.match(h.sent[0].body,/미등록 2명/);}
{const h=harness({quota:1});assert.equal(h.c.runServerReportCheck_().status,'blocked');assert.equal(h.renders,0);assert.equal(h.sent.length,1);assert.match(h.sent[0].subject,/발송 불가/);assert.equal(h.c.runServerReportCheck_().reason,'manual_action_required');assert.equal(h.sent.length,1);}
{const h=harness({quota:0});h.c.runServerReportCheck_();assert.equal(h.sent.length,0);assert.equal(h.logs.length,1);}
{const h=harness({fail:true});h.c.runServerReportCheck_();assert.ok(h.props['MM_SERVER_HOLD_2026-11-16']);assert.equal(h.props['MM_REPORT_FINAL_2026-11-16'],undefined);}
for(const cfg of [{excluded:true},{day:'2'}]){const h=harness(cfg);assert.equal(h.c.runServerReportCheck_().status,'skip');assert.equal(h.renders,0);assert.equal(h.sent.length,0);}
{const h=harness();h.props.MM_SERVER_REPORT_ENABLED='Y';h.c.verifyPCReportKey_=()=>{};assert.equal(h.c.pcReportStatus_({}).reason,'server_report_enabled');}
// Synthetic HTML fixture. It never reads live inspection records/photos.
const h=harness();vm.runInContext(readFileSync('apps-script/ServerReport.gs','utf8'),h.c);
h.c.pcReportSnapshot_=()=>({records:[{date:'2026-11-16',machine:'6호기',inspector:'시험점검자',score:'7 / 1',xCount:1,issue:'누유 확인',itemActionsJson:JSON.stringify([{item:3,type:'request',text:'누유 점검 요청',priority:'보통',photos:{}}])}],items:[{no:3,name:'바닥 청소'}]});
h.st.settings.machines=[{machine:'6호기',owner:'시험담당자',team:'제조팀'},{machine:'7호기',owner:'미등록담당자',team:'제조팀'}];h.st.targets=[{name:'미등록담당자',team:'제조팀',registered:false}];
const report=h.c.buildServerReport_(h.st);assert.match(report.pdfHtml,/누유 점검 요청/);assert.match(report.pdfHtml,/미등록담당자/);assert.match(report.pdfHtml,/미점검/);assert.match(report.pdfHtml,/bgcolor="#123a66"/);assert.match(report.pdfHtml,/등록률/);assert.match(report.pdfHtml,/집계 시각/);assert.doesNotMatch(report.pdfHtml,/12시 기준/);writeFileSync('/tmp/mm-server-synthetic.html',report.pdfHtml);
console.log('PASS: 09/10 slots, no 11 reminder, early completion, noon with missing/zero registrations, quota stop/admin notice, zero quota log, ambiguous send stop, exclusions, PC handoff, report content');
