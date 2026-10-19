function setupMyMachineSchedule() {
  return setupAutoMailTrigger_();
}

const AUTO_MAIL_HANDLER = 'scheduledMondayAutoMail_';
const MAX_MISSING_ALERTS = 3;

function setupAutoMailTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === AUTO_MAIL_HANDLER) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(AUTO_MAIL_HANDLER)
    .timeBased().everyMinutes(5).create();
  return {status:'success', message:'월요일 09시 이후 미등록자를 확인하고 1시간 간격으로 최대 3회 알리도록 설정했습니다.'};
}

function scheduledMondayAutoMail_() {
  return runMondayAutoMailCheck_(false);
}

function autoMailWeekKey_(date) {
  var tz=Session.getScriptTimeZone()||'Asia/Seoul';
  var d=new Date(date||new Date()), day=Number(Utilities.formatDate(d,tz,'u'));
  var monday=new Date(d.getTime()-(day-1)*86400000);
  return Utilities.formatDate(monday,tz,'yyyy-MM-dd');
}

function normName_(v){ return String(v||'').replace(/\s+/g,'').trim(); }
function escAuto_(v){ return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function getAutoMailStatus_(weekKey) {
  var settings=getAdminSettings_(), machines=(settings.machines||[]).filter(function(x){return x.active!==false;});
  var mails=(settings.mails||[]).filter(function(x){return x.active!==false && String(x.email||'').trim();});
  var byName={};
  mails.forEach(function(m){ byName[normName_(m.name)]=m; });

  var targets=[], seen={};
  machines.forEach(function(m){
    var n=normName_(m.owner),machine=String(m.machine||'').trim();
    if(!n || !machine) return;
    var person=byName[n]||null;
    if(!seen[n]){
      seen[n]={name:String(m.owner||'').trim(), machines:[], team:(person&&person.team)||String(m.team||'').trim(), email:(person&&person.email)||'', linked:!!person};
      targets.push(seen[n]);
    }
    if(seen[n].machines.indexOf(machine)<0) seen[n].machines.push(machine);
  });

  var sheet=getDataSheet_(), vals=sheet.getDataRange().getValues(), registered={};
  for(var i=1;i<vals.length;i++){
    var ds=vals[i][0];
    if(ds instanceof Date) ds=Utilities.formatDate(ds,Session.getScriptTimeZone(),'yyyy-MM-dd');
    else ds=String(ds||'').slice(0,10);
    if(ds===weekKey) registered[normName_(vals[i][2])]=true;
  }
  targets.forEach(function(t){
    t.missingMachines=t.machines.filter(function(m){return !registered[normName_(m)];});
    t.registered=t.missingMachines.length===0;
    t.machine=(t.registered?t.machines:t.missingMachines).join(', ');
  });
  var missing=targets.filter(function(t){return !t.registered;});
  return {weekKey:weekKey,settings:settings,mails:mails,targets:targets,missing:missing,total:targets.length,done:targets.length-missing.length};
}

function uniqueEmails_(arr){
  var seen={}; return arr.map(String).map(function(x){return x.trim();}).filter(Boolean).filter(function(x){var k=x.toLowerCase();if(seen[k])return false;seen[k]=true;return true;});
}

function sendMissingAlert_(st, reminderNo) {
  reminderNo=Number(reminderNo||1);
  var missingTeams={};
  st.missing.forEach(function(x){ if(x.team) missingTeams[x.team]=true; });
  var recipients=[];
  st.missing.forEach(function(x){ if(x.email) recipients.push(x.email); });
  st.mails.forEach(function(m){
    var role=String(m.role||'팀원').trim();
    if(role==='관리자' || role==='임원' || (role==='팀장' && missingTeams[String(m.team||'').trim()])) recipients.push(m.email);
  });
  recipients=uniqueEmails_(recipients);
  if(!recipients.length) throw Error('09시 현황 메일 수신자가 없습니다. 메일 설정의 이름/소속팀/구분을 확인해 주세요.');

  var rows=st.targets.map(function(x){
    var done=!!x.registered;
    var bg=done?'#f7fbf7':'#fff7f7';
    var color=done?'#2e7d32':'#c62828';
    var label=done?'등록완료':'미등록';
    return '<tr style="background:'+bg+'"><td style="padding:9px;border-bottom:1px solid #e6e6e6">'+escAuto_(x.team||'-')+'</td><td style="padding:9px;border-bottom:1px solid #e6e6e6;font-weight:700">'+escAuto_(x.name)+'</td><td style="padding:9px;border-bottom:1px solid #e6e6e6">'+escAuto_(x.machine||'-')+'</td><td style="padding:9px;border-bottom:1px solid #e6e6e6;color:'+color+';font-weight:800">'+label+'</td></tr>';
  }).join('');

  var html='<div style="font-family:Arial,Malgun Gothic,sans-serif;color:#172033"><div style="max-width:760px;margin:auto"><div style="background:#123a66;color:white;padding:18px;border-radius:12px"><div style="font-size:23px;font-weight:800">My Machine 미등록 알림</div><div style="margin-top:6px">전체 '+st.total+'명 / 완료 '+st.done+'명 / 미등록 '+st.missing.length+'명</div></div><p style="font-size:14px;line-height:1.7">현재 전체 점검 대상자의 등록 현황입니다. 미등록자는 My Machine 3정5S 점검 결과를 등록해 주세요.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:9px;text-align:left">팀</th><th style="padding:9px;text-align:left">점검자</th><th style="padding:9px;text-align:left">설비</th><th style="padding:9px;text-align:left">상태</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  sendAutoMailBatched_(recipients,'[My Machine] '+st.weekKey+' '+reminderNo+'차 미등록 알림 - 완료 '+st.done+'명 / 미등록 '+st.missing.length+'명',html,'현재 전체 '+st.total+'명 중 완료 '+st.done+'명, 미등록 '+st.missing.length+'명입니다.');
  return recipients.length;
}

function sendFinalAutoReport_(st) {
  var recipients=uniqueEmails_(st.mails.map(function(m){return m.email;}));
  if(!recipients.length) throw Error('사용 체크된 전체 메일 수신자가 없습니다.');
  throw Error('PC 자동 보고서에서 전체 보고서 발송을 처리합니다.');
}

function sendAutoMailBatched_(recipients,subject,html,body){
  var rs=uniqueEmails_(recipients), remain=MailApp.getRemainingDailyQuota();
  if(remain<rs.length) throw Error('메일 일일 잔여 한도 부족: 잔여 '+remain+'명 / 필요 '+rs.length+'명');
  for(var i=0;i<rs.length;i+=40) MailApp.sendEmail({to:rs.slice(i,i+40).join(','),subject:subject,body:body,htmlBody:html,name:'My Machine'});
}

function runMondayAutoMailCheck_(manual) {
  var now=new Date(), tz=Session.getScriptTimeZone()||'Asia/Seoul', dow=Utilities.formatDate(now,tz,'u');
  if(dow!=='1') return {status:'skip',reason:'not_monday'};
  var lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var week=autoMailWeekKey_(now), props=PropertiesService.getScriptProperties();
    if(props.getProperty('MM_REPORT_FINAL_'+week)==='Y') return {status:'skip',reason:'final_already_sent'};
    var st=getAutoMailStatus_(week);
    if(!st.total) return {status:'error',message:'활성 설비의 담당자가 없어 자동메일 대상을 계산할 수 없습니다.'};
    if(st.missing.length===0){
      return {status:'pending_report',total:st.total,missing:0,message:'전원 등록완료: PC 전체 보고서 발송 대기'};
    }
    if(Number(Utilities.formatDate(now,tz,'H'))<9) return {status:'skip',reason:'before_0900',missing:st.missing.length};
    var firstSent=props.getProperty('MM_0900_'+week)==='Y';
    var previousCount=Number(props.getProperty('MM_ALERT_COUNT_'+week)||(firstSent?1:0));
    if(previousCount>=MAX_MISSING_ALERTS) return {status:'skip',reason:'alert_limit_reached',reminderNo:previousCount,missing:st.missing.length};
    var last=Number(props.getProperty('MM_LAST_ALERT_'+week)||0);
    // 구버전이 보낸 1차 알림도 중복 발송하지 않고 다음 차수로 이어간다.
    if(!last && firstSent) last=new Date(week+'T09:00:00+09:00').getTime();
    if(last && now.getTime()-last<3600000) return {status:'skip',reason:'hour_not_elapsed',missing:st.missing.length};
    var count=previousCount+1;
    var sent=sendMissingAlert_(st,count);
    props.setProperty('MM_0900_'+week,'Y');
    props.setProperty('MM_LAST_ALERT_'+week,String(now.getTime()));
    props.setProperty('MM_ALERT_COUNT_'+week,String(count));
    return {status:'success',type:'missing',reminderNo:count,sentCount:sent,total:st.total,done:st.done,missing:st.missing.length};
  } finally { lock.releaseLock(); }
}

function onInspectionSaved_(inspectDate) {
  var tz=Session.getScriptTimeZone()||'Asia/Seoul', now=new Date();
  var week=autoMailWeekKey_(now);
  if(String(inspectDate||'').slice(0,10)!==week) return {status:'skip',reason:'not_this_monday'};

  var lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('MM_REPORT_FINAL_'+week)==='Y') return {status:'skip',reason:'final_already_sent'};

  var st=getAutoMailStatus_(week);
  if(st.total && st.missing.length===0){
    return {status:'pending_report',total:st.total,missing:0};
  }
  return {status:'skip',reason:'not_complete',missing:st.missing.length};
  } finally { lock.releaseLock(); }
}
