// Server-only reports. Enable only after reviewing the generated Google PDF.
function previewMyMachineServerReport() {
  var date=autoMailWeekKey_(new Date()), report=buildServerReport_(getAutoMailStatus_(date));
  var pdf=serverReportPdf_(report), file=DriveApp.createFile(pdf);
  PropertiesService.getScriptProperties().setProperty('MM_SERVER_PREVIEW',file.getId());
  console.log('메일은 발송하지 않았습니다. PDF 미리보기: '+file.getUrl());
  return file.getUrl();
}

function enableMyMachineServerReport() {
  var props=PropertiesService.getScriptProperties();
  if(!props.getProperty('MM_SERVER_PREVIEW'))throw Error('previewMyMachineServerReport를 먼저 실행하고 PDF를 확인해 주세요.');
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss.getSheetByName('점검제외일'))ss.insertSheet('점검제외일').appendRow(['점검 제외 일자 (yyyy-MM-dd)','사유']);
  if(!ss.getSheetByName('자동발송상태'))ss.insertSheet('자동발송상태').appendRow(['점검일','상태','내용','확인시각']);
  setupAutoMailTrigger_();
  props.setProperty('MM_SERVER_REPORT_ENABLED','Y');
  console.log('서버 자동발송 활성화: 월요일 09시/10시 미등록 알림, 전원 완료 또는 12시 보고서. PC 불필요.');
}

function serverReportExcluded_(date) {
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('점검제외일');
  if(!s||s.getLastRow()<2)return false;
  return s.getRange(2,1,s.getLastRow()-1,1).getValues().some(function(r){
    var value=r[0] instanceof Date?Utilities.formatDate(r[0],'Asia/Seoul','yyyy-MM-dd'):String(r[0]||'').trim();
    return value===date;
  });
}

function logServerReport_(date,status,message) {
  PropertiesService.getScriptProperties().setProperty('MM_SERVER_STATUS_'+date,JSON.stringify({status:status,message:message,at:new Date().toISOString()}));
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('자동발송상태');
  if(s)s.appendRow([date,status,message,new Date()]);
}

function runServerReportCheck_() {
  var now=new Date(),tz='Asia/Seoul',date=Utilities.formatDate(now,tz,'yyyy-MM-dd');
  if(Utilities.formatDate(now,tz,'u')!=='1')return {status:'skip',reason:'not_monday'};
  if(serverReportExcluded_(date))return {status:'skip',reason:'excluded_day'};
  // Serialize reports independently of the script lock used by mobile saves.
  var lock=LockService.getUserLock();lock.waitLock(30000);
  try{
    var props=PropertiesService.getScriptProperties();
    if(props.getProperty('MM_REPORT_FINAL_'+date)==='Y')return {status:'skip',reason:'final_already_sent'};
    if(props.getProperty('MM_SERVER_HOLD_'+date))return {status:'blocked',reason:'manual_action_required'};
    var st=getAutoMailStatus_(date),hour=Number(Utilities.formatDate(now,tz,'H'));
    if(!st.total)return {status:'error',message:'활성 설비 담당자를 확인해 주세요.'};
    if(st.missing.length===0||hour>=12)return sendServerReport_(st);
    // Each hour is a separate slot; a missed 09 slot is not sent late.
    if(hour!==9&&hour!==10)return {status:'waiting',missing:st.missing.length};
    var slot='MM_SERVER_ALERT_'+date+'_'+hour;
    var count=Number(props.getProperty('MM_ALERT_COUNT_'+date)||0);
    if(count>=2||props.getProperty(slot))return {status:'skip',reason:'alert_slot_sent'};
    var last=Number(props.getProperty('MM_LAST_ALERT_'+date)||0);
    if(last&&Utilities.formatDate(new Date(last),tz,'H')===String(hour))return {status:'skip',reason:'alert_slot_sent'};
    var sent=sendMissingAlert_(st,count+1);
    props.setProperty(slot,'Y');props.setProperty('MM_ALERT_COUNT_'+date,String(count+1));
    props.setProperty('MM_LAST_ALERT_'+date,String(now.getTime()));props.setProperty('MM_0900_'+date,'Y');
    return {status:'success',type:'missing',sentCount:sent};
  }finally{lock.releaseLock();}
}

function blockServerReport_(st,message,remaining,required) {
  var props=PropertiesService.getScriptProperties(),key='MM_SERVER_HOLD_'+st.weekKey;
  props.setProperty(key,message);logServerReport_(st.weekKey,'발송 중지 - 수동 확인 필요',message);
  var admins=uniqueEmails_(st.mails.filter(function(m){return m.role==='관리자';}).map(function(m){return m.email;}));
  var quota=MailApp.getRemainingDailyQuota();
  if(admins.length&&quota>=admins.length){
    try{MailApp.sendEmail({to:admins.join(','),subject:'[My Machine] '+st.weekKey+' 보고서 자동 발송 불가',body:message+'\n잔여 '+remaining+'명 / 필요 '+required+'명\n자동 재시도하지 않습니다. 관리자 화면에서 수신자를 조정해 수동 발송해 주세요.',name:'My Machine'});}catch(e){console.error('관리자 안내 발송 실패',e);}
  }
  return {status:'blocked',message:message,remaining:remaining,required:required};
}

function sendServerReport_(st) {
  var props=PropertiesService.getScriptProperties(),date=st.weekKey;
  var recipients=uniqueEmails_(st.mails.map(function(m){return m.email;}));
  var remaining=MailApp.getRemainingDailyQuota();
  if(!recipients.length||remaining<recipients.length)return blockServerReport_(st,'메일 수신자 한도 부족 또는 수신자 없음',remaining,recipients.length);
  var report,pdf;
  try{report=buildServerReport_(st);pdf=serverReportPdf_(report);}catch(e){return blockServerReport_(st,'보고서 생성 실패: '+e.message,remaining,recipients.length);}
  if(MailApp.getRemainingDailyQuota()<recipients.length)return blockServerReport_(st,'메일 수신자 한도 부족',MailApp.getRemainingDailyQuota(),recipients.length);
  var bytes=pdf.getBytes().length;
  Object.keys(report.inlineImages).forEach(function(k){bytes+=report.inlineImages[k].getBytes().length;});
  if(bytes>18*1024*1024)return blockServerReport_(st,'본문 사진과 PDF 합계가 18MB를 초과했습니다.',remaining,recipients.length);
  // A send can succeed even if the caller later fails. Persist the hold first
  // so ambiguous/partial sends are never blindly repeated by a timer.
  props.setProperty('MM_SERVER_HOLD_'+date,'발송 처리 중 또는 결과 확인 필요');
  try{
    for(var i=0;i<recipients.length;i+=40)MailApp.sendEmail({to:recipients.slice(i,i+40).join(','),subject:'[My Machine] '+date+' 3정5S 점검 결과',body:'My Machine 점검 결과: 완료 '+st.done+'명 / 미등록 '+st.missing.length+'명. 첨부 PDF와 본문을 확인해 주세요.',htmlBody:report.mailHtml,inlineImages:report.inlineImages,attachments:[pdf],name:'My Machine'});
    props.setProperty('MM_REPORT_FINAL_'+date,'Y');props.deleteProperty('MM_SERVER_HOLD_'+date);
    logServerReport_(date,'발송 완료',recipients.length+'명 / 본문 전체 보고서 + PDF');
    return {status:'success',sentCount:recipients.length,pdfAttached:true};
  }catch(e){return blockServerReport_(st,'발송 결과 확인 필요 (일부 수신자에게 발송됐을 수 있음): '+e.message,MailApp.getRemainingDailyQuota(),recipients.length);}
}

function serverReportPdf_(report) {
  var pdf=HtmlService.createHtmlOutput(report.pdfHtml).getAs('application/pdf').setName('MyMachine_'+report.date+'_3정5S.pdf');
  if(pdf.getBytes().length<100)throw Error('PDF 생성 결과가 비어 있습니다.');
  return pdf;
}

function buildServerReport_(st) {
  var snapshot=pcReportSnapshot_(st),records=snapshot.records,images={},photoCache={},seq=0;
  var esc=escAuto_;
  function table(headers,rows){return '<table width="100%" border="1" bordercolor="#d9e2ef" cellspacing="0" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:13px;border-color:#d9e2ef"><thead><tr bgcolor="#eef4fb" style="background-color:#eef4fb">'+headers.map(function(x){return '<th bgcolor="#eef4fb" style="font-weight:bold;color:#123a66;padding:8px;text-align:center">'+esc(x)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';}
  function row(cells){return '<tr style="page-break-inside:avoid">'+cells.map(function(x){var text=String(x),color=text==='미점검'||text==='확인 필요'?'#fde4e4':text==='완료'||text==='양호'||text==='조치완료'?'#dff2e4':text==='개선요청'||text==='요청'?'#fff1d7':'';return '<td'+(color?' bgcolor="'+color+'"':'')+' style="padding:8px;vertical-align:middle;line-height:1.55;'+(color?'background-color:'+color+';font-weight:bold;':'')+'">'+x+'</td>';}).join('')+'</tr>';}
  function actions(r){try{var a=JSON.parse(r.itemActionsJson||'[]');return Array.isArray(a)?a:[];}catch(e){throw Error('개선 상세 데이터 형식 오류: '+r.machine);}}
  function pictures(value,label){
    var list=Array.isArray(value)?value:value?[value]:[];
    return list.map(function(p){
      var url=typeof p==='string'?p:p.url||'',id=(url.match(/\/d\/([\w-]+)/)||url.match(/[?&]id=([\w-]+)/)||[])[1];
      if(!id)throw Error('사진 주소를 확인해 주세요.');
      var photo=photoCache[id];
      if(!photo){var blob=DriveApp.getFileById(id).getBlob();if(!/^image\//.test(blob.getContentType()))throw Error('사진 형식 오류');photo={cid:'mm_photo_'+(++seq),blob:blob};photoCache[id]=photo;images[photo.cid]=blob;}
      return '<span style="display:inline-block;margin:4px"><b style="color:#123a66;font-size:12px">'+esc(label)+'</b><br><img width="120" style="width:120px;height:auto;border:1px solid #d9e2ef;border-radius:7px" src="PHOTO:'+photo.cid+'"></span>';
    }).join(' ');
  }
  var allActions=[];records.forEach(function(r){actions(r).forEach(function(a){allActions.push({r:r,a:a});});});
  var doneMachines={},xCount=0;records.forEach(function(r){doneMachines[normName_(r.machine)]=true;xCount+=Number(r.xCount||0);});
  var html='<html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,"Malgun Gothic",sans-serif;color:#172033;font-size:12px}h1{background:#123a66;color:white;padding:16px}h2{font-size:16px;background:#eef2fa;padding:10px}thead{display:table-header-group}td{word-break:break-word}img{object-fit:contain}</style></head><body><h1>My Machine 3정5S 점검 결과</h1><p>점검일: '+esc(st.weekKey)+' / '+(st.missing.length?'12시 기준 등록 현황 보고':'전원 등록 완료 보고')+'</p>';
  html+='<h2>1. 종합 현황</h2><p>담당자 '+st.total+'명 / 완료 '+st.done+'명 / 미등록 '+st.missing.length+'명 / 등록 '+records.length+'건 / 미흡 '+xCount+'건 / 즉시개선 '+allActions.filter(function(x){return x.a.type==='immediate';}).length+'건 / 개선요청 '+allActions.filter(function(x){return x.a.type==='request';}).length+'건</p>';
  if(!records.length)html+='<p><b>등록된 점검 결과가 없습니다.</b></p>';
  html+='<h2>2. 설비별 점검 결과</h2>'+table(['설비','팀','담당자','실제 점검자','상태','양호 / 미흡','비고'],st.settings.machines.filter(function(m){return m.active!==false;}).map(function(m){var rs=records.filter(function(r){return normName_(r.machine)===normName_(m.machine);});return row([esc(m.machine),esc(m.team||'-'),esc(m.owner||'-'),esc(rs.map(function(r){return r.inspector;}).join(', ')||'-'),rs.length?'완료':'미점검',esc(rs.map(function(r){return r.score;}).join(', ')||'-'),esc(rs.map(function(r){return r.issue||'';}).filter(Boolean).join(' / ')||'-')]);}));
  var teams={};st.targets.forEach(function(t){var k=t.team||'미지정';if(!teams[k])teams[k]={total:0,done:0,missing:[]};teams[k].total++;if(t.registered)teams[k].done++;else teams[k].missing.push(t.name);});
  html+='<h2>3. 팀별 등록 현황</h2>'+table(['팀','담당자','완료','미등록','미등록자'],Object.keys(teams).map(function(k){var t=teams[k];return row([esc(k),t.total,t.done,t.missing.length,esc(t.missing.join(', ')||'-')]);}));
  function actionRows(type){return allActions.filter(function(x){return !type||x.a.type===type;}).map(function(x){var r=x.r,a=x.a,photos=a.photos||{},names;try{names=JSON.parse(r.itemNamesSnapshot||'[]');}catch(e){names=[];}var item=names.filter(function(n){return Number(n.no)===Number(a.item);})[0]||snapshot.items.filter(function(n){return Number(n.no)===Number(a.item);})[0]||{};var key='MM-'+String(r.date).replace(/-/g,'')+'-'+r.machine+'-'+('0'+a.item).slice(-2),meta={};try{meta=(JSON.parse(r.actionText||'{}').requests||{})[key]||{};}catch(e){}return row([esc(r.machine),esc(r.inspector),esc(a.item+'. '+(item.name||'')),esc(a.type==='immediate'?'즉시개선':'개선요청'),esc(a.text||a.memo||''),esc(a.priority||'-'),pictures(photos.immBefore||photos.reqBefore,'개선 전')+pictures(photos.immAfter||photos.reqAfter,'개선 후')+(meta.photoUrl?pictures({url:meta.photoUrl},'관리자 조치'):''),esc(meta.status||(a.type==='immediate'?'조치완료':'요청')),esc(meta.text||'')]);});}
  html+='<h2>4. 개선 관리</h2>'+table(['설비','점검자','항목','구분','내용','우선순위','사진','상태','관리자 조치'],actionRows('request'));
  html+='<h2>5. 상세 점검 이력</h2>'+table(['설비','점검자','항목','구분','내용','우선순위','사진','상태','관리자 조치'],actionRows().concat(records.filter(function(r){return !actions(r).length;}).map(function(r){return row([esc(r.machine),esc(r.inspector),esc(r.xItems||'-'),Number(r.xCount)?'미흡':'양호',esc(r.improvementDetail||r.issue||'-'),'-','-',Number(r.xCount)?'확인 필요':'양호',esc(r.actionText||'-')]);})));
  html+='</body></html>';
  // Google HTML-to-PDF may discard head styles. Inline visual structure and
  // classic bgcolor/width attributes keep the email and converted PDF alike.
  var generated=Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd HH:mm');
  var subtitle='점검일 '+esc(st.weekKey)+' · 집계 시각 '+esc(generated)+' · '+(st.missing.length?'미등록 포함 현황':'전원 등록 완료');
  html=html.replace(/<body>/,'<body style="font-family:Arial,Malgun Gothic,sans-serif;font-size:14px;color:#172033;background-color:#f3f6fb"><div style="padding:14px;background-color:#f3f6fb">');
  html=html.replace(/<h1>[\s\S]*?<\/h1><p>[\s\S]*?<\/p>/,'<table width="100%" cellpadding="18" cellspacing="0" bgcolor="#123a66" style="width:100%;background-color:#123a66;border-radius:14px;margin-bottom:14px"><tr><td style="padding:18px;color:#ffffff"><font color="#ffffff" style="color:#ffffff"><b style="font-size:25px;color:#ffffff">My Machine 3정5S 점검 결과</b><br><span style="font-size:12px;color:#ffffff">Autonomous Maintenance &amp; Improvement System</span><br><br>'+subtitle+'</font></td></tr></table>');
  var immediate=allActions.filter(function(x){return x.a.type==='immediate';}).length;
  var requested=allActions.filter(function(x){return x.a.type==='request';}).length;
  var rate=st.total?Math.round(st.done/st.total*1000)/10:0;
  var metrics=[['점검 대상',st.total+'명','#235fbd','#f4f8fe'],['등록 완료',st.done+'명','#16813c','#f2fbf5'],['미등록',st.missing.length+'명','#c93636','#fff5f5'],['등록률',rate+'%','#6546a5','#f8f5ff'],['등록 이력',records.length+'건','#235fbd','#f4f8fe'],['미흡 항목',xCount+'건','#c93636','#fff5f5'],['즉시개선',immediate+'건','#16813c','#f2fbf5'],['개선요청',requested+'건','#c77600','#fff9ef']];
  var cards='<table width="100%" cellspacing="6" cellpadding="10" style="width:100%;margin-bottom:14px">';
  metrics.forEach(function(m,i){if(i%4===0)cards+='<tr>';cards+='<td width="25%" bgcolor="'+m[3]+'" style="background-color:'+m[3]+';border:1px solid #d9e2ef;border-top:4px solid '+m[2]+';padding:12px"><span style="font-size:12px;color:#65758a">'+m[0]+'</span><br><font color="'+m[2]+'"><b style="font-size:24px;color:'+m[2]+'">'+m[1]+'</b></font></td>';if(i%4===3)cards+='</tr>';});cards+='</table>';
  html=html.replace(/(<h2>1\. 종합 현황<\/h2>)<p>[\s\S]*?<\/p>/,'$1'+cards);
  var colors=[['#dceaf8','#3478b8'],['#e5f3e8','#5aa36c'],['#fff1d7','#d49732'],['#fde4e4','#d86b6b'],['#eee8f7','#8b72b5']];
  html=html.replace(/<h2>([1-5])\. ([^<]+)<\/h2>/g,function(_,n,title){var color=colors[Number(n)-1];return '<table width="100%" cellspacing="0" cellpadding="10" style="width:100%;margin-top:18px;margin-bottom:10px;page-break-after:avoid"><tr><td bgcolor="'+color[0]+'" style="background-color:'+color[0]+';border-left:6px solid '+color[1]+';padding:11px;color:#123a66;font-size:18px;font-weight:bold">'+n+'. '+title+'</td></tr></table>';});
  html=html.replace('</body>','</div></body>');
  var pdfHtml=html.replace(/PHOTO:([\w]+)/g,function(_,cid){var b=images[cid];return 'data:'+b.getContentType()+';base64,'+Utilities.base64Encode(b.getBytes());});
  return {date:st.weekKey,mailHtml:html.replace(/PHOTO:/g,'cid:'),pdfHtml:pdfHtml,inlineImages:images};
}
