const AUTO_MAIL_HANDLER = 'scheduledMondayAutoMail_';

function setupAutoMailTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === AUTO_MAIL_HANDLER) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(AUTO_MAIL_HANDLER)
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).nearMinute(0).create();
  return {status:'success', message:'월요일 09시대 자동 확인이 설정되었습니다.'};
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
    var n=normName_(m.owner);
    if(!n || seen[n]) return;
    seen[n]=true;
    var person=byName[n]||null;
    targets.push({name:String(m.owner||'').trim(), machine:String(m.machine||'').trim(), team:(person&&person.team)||String(m.team||'').trim(), email:(person&&person.email)||'', linked:!!person});
  });

  var sheet=getDataSheet_(), vals=sheet.getDataRange().getValues(), registered={};
  for(var i=1;i<vals.length;i++){
    var ds=vals[i][0];
    if(ds instanceof Date) ds=Utilities.formatDate(ds,Session.getScriptTimeZone(),'yyyy-MM-dd');
    else ds=String(ds||'').slice(0,10);
    if(ds===weekKey) registered[normName_(vals[i][1])]=true;
  }
  targets.forEach(function(t){t.registered=!!registered[normName_(t.name)];});
  var missing=targets.filter(function(t){return !t.registered;});
  return {weekKey:weekKey,settings:settings,mails:mails,targets:targets,missing:missing,total:targets.length,done:targets.length-missing.length};
}

function uniqueEmails_(arr){
  var seen={}; return arr.map(String).map(function(x){return x.trim();}).filter(Boolean).filter(function(x){var k=x.toLowerCase();if(seen[k])return false;seen[k]=true;return true;});
}

function sendMissingAlert_(st) {
  var missingTeams={};
  st.missing.forEach(function(x){ if(x.team) missingTeams[x.team]=true; });
  var recipients=[];
  st.missing.forEach(function(x){ if(x.email) recipients.push(x.email); });
  st.mails.forEach(function(m){
    var role=String(m.role||'팀원').trim();
    if(role==='임원' || (role==='팀장' && missingTeams[String(m.team||'').trim()])) recipients.push(m.email);
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

  var html='<div style="font-family:Arial,Malgun Gothic,sans-serif;color:#172033"><div style="max-width:760px;margin:auto"><div style="background:#123a66;color:white;padding:18px;border-radius:12px"><div style="font-size:23px;font-weight:800">09시 My Machine 점검 현황</div><div style="margin-top:6px">전체 '+st.total+'명 / 완료 '+st.done+'명 / 미등록 '+st.missing.length+'명</div></div><p style="font-size:14px;line-height:1.7">09시 현재 전체 점검 대상자의 등록 현황입니다. 미등록자는 My Machine 3정5S 점검 결과를 등록해 주세요.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:9px;text-align:left">팀</th><th style="padding:9px;text-align:left">점검자</th><th style="padding:9px;text-align:left">설비</th><th style="padding:9px;text-align:left">상태</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  sendAutoMailBatched_(recipients,'[My Machine] 09시 점검현황 - 완료 '+st.done+'명 / 미등록 '+st.missing.length+'명',html,'09시 현재 전체 '+st.total+'명 중 완료 '+st.done+'명, 미등록 '+st.missing.length+'명입니다.');
  return recipients.length;
}

function sendFinalAutoReport_(st) {
  var recipients=uniqueEmails_(st.mails.map(function(m){return m.email;}));
  if(!recipients.length) throw Error('사용 체크된 전체 메일 수신자가 없습니다.');
  var sheet=getDataSheet_(), vals=sheet.getDataRange().getValues(), byName={};
  for(var i=1;i<vals.length;i++){
    var ds=vals[i][0]; if(ds instanceof Date) ds=Utilities.formatDate(ds,Session.getScriptTimeZone(),'yyyy-MM-dd'); else ds=String(ds||'').slice(0,10);
    if(ds!==st.weekKey) continue;
    var ok=0,ng=0,na=0;
    for(var j=3;j<=12;j++){if(vals[i][j]==='O')ok++;else if(vals[i][j]==='X')ng++;else if(vals[i][j]==='N/A')na++;}
    byName[normName_(vals[i][1])]={name:vals[i][1],machine:vals[i][2],ok:ok,ng:ng,na:na,issue:vals[i][13]||'',imm:Number(vals[i][15]||0),req:Number(vals[i][16]||0)};
  }
  var rows=st.targets.map(function(t){var r=byName[normName_(t.name)]||{};return '<tr><td style="padding:8px;border-bottom:1px solid #ddd">'+escAuto_(t.team||'-')+'</td><td style="padding:8px;border-bottom:1px solid #ddd">'+escAuto_(t.name)+'</td><td style="padding:8px;border-bottom:1px solid #ddd">'+escAuto_(r.machine||t.machine||'-')+'</td><td style="padding:8px;border-bottom:1px solid #ddd">'+Number(r.ok||0)+'</td><td style="padding:8px;border-bottom:1px solid #ddd">'+Number(r.ng||0)+'</td><td style="padding:8px;border-bottom:1px solid #ddd">'+escAuto_(r.issue||'-')+'</td></tr>';}).join('');
  var html='<div style="font-family:Arial,Malgun Gothic,sans-serif;color:#172033"><div style="max-width:900px;margin:auto"><div style="background:#123a66;color:#fff;padding:18px;border-radius:12px"><div style="font-size:23px;font-weight:800">My Machine 3정5S 전체 등록완료</div><div style="margin-top:6px">'+escAuto_(st.weekKey)+' / 전체 '+st.total+'명 등록완료</div></div><p style="line-height:1.7">이번 주 점검 대상자가 모두 등록을 완료하여 최종 결과를 자동 발송합니다.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:8px;text-align:left">팀</th><th style="padding:8px;text-align:left">점검자</th><th style="padding:8px;text-align:left">설비</th><th style="padding:8px">양호</th><th style="padding:8px">미흡</th><th style="padding:8px;text-align:left">비고</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  sendAutoMailBatched_(recipients,'[My Machine] '+st.weekKey+' 3정5S 전체 등록완료',html,'My Machine 3정5S 전체 등록완료 결과입니다.');
  return recipients.length;
}

function sendAutoMailBatched_(recipients,subject,html,body){
  var rs=uniqueEmails_(recipients), remain=MailApp.getRemainingDailyQuota();
  if(remain<rs.length) throw Error('메일 일일 잔여 한도 부족: 잔여 '+remain+'명 / 필요 '+rs.length+'명');
  for(var i=0;i<rs.length;i+=40) MailApp.sendEmail({to:rs.slice(i,i+40).join(','),subject:subject,body:body,htmlBody:html,name:'My Machine'});
}

function runMondayAutoMailCheck_(manual) {
  var now=new Date(), tz=Session.getScriptTimeZone()||'Asia/Seoul', dow=Utilities.formatDate(now,tz,'u');
  if(!manual && dow!=='1') return {status:'skip',reason:'not_monday'};
  var week=autoMailWeekKey_(now), props=PropertiesService.getScriptProperties();
  var st=getAutoMailStatus_(week);
  if(!st.total) return {status:'error',message:'활성 설비의 담당자가 없어 자동메일 대상을 계산할 수 없습니다.'};

  if(st.missing.length===0){
    if(props.getProperty('MM_FINAL_'+week)==='Y') return {status:'skip',reason:'final_already_sent',total:st.total};
    var n=sendFinalAutoReport_(st); props.setProperty('MM_FINAL_'+week,'Y'); props.setProperty('MM_0900_'+week,'Y');
    return {status:'success',type:'final',sentCount:n,total:st.total,missing:0};
  }
  if(props.getProperty('MM_0900_'+week)==='Y') return {status:'skip',reason:'0900_already_sent',total:st.total,missing:st.missing.length};
  var sent=sendMissingAlert_(st); props.setProperty('MM_0900_'+week,'Y');
  return {status:'success',type:'missing',sentCount:sent,total:st.total,done:st.done,missing:st.missing.length};
}

function onInspectionSaved_(inspectDate) {
  var tz=Session.getScriptTimeZone()||'Asia/Seoul', now=new Date();
  var week=autoMailWeekKey_(now);
  if(String(inspectDate||'').slice(0,10)!==week) return {status:'skip',reason:'not_this_monday'};

  // 09시 이전에는 등록 완료 여부와 관계없이 최종 메일을 보내지 않는다.
  // 09시 시점에 이미 100%이면 정기 트리거가 최종 메일 1회만 발송한다.
  var hour=Number(Utilities.formatDate(now,tz,'H'));
  if(hour<9) return {status:'skip',reason:'before_0900'};

  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('MM_FINAL_'+week)==='Y') return {status:'skip',reason:'final_already_sent'};

  var st=getAutoMailStatus_(week);
  if(st.total && st.missing.length===0){
    var n=sendFinalAutoReport_(st);
    props.setProperty('MM_FINAL_'+week,'Y');
    return {status:'success',type:'final',sentCount:n,total:st.total};
  }
  return {status:'skip',reason:'not_complete',missing:st.missing.length};
}
