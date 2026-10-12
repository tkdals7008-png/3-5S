// Run once in the Apps Script editor. Keep the returned key private.
function setupMyMachinePCReport() {
  var props=PropertiesService.getScriptProperties(),key=props.getProperty('MM_PC_REPORT_KEY');
  if(!key){key=Utilities.getUuid()+Utilities.getUuid();props.setProperty('MM_PC_REPORT_KEY',key);}
  console.log('PC 자동 보고서 연결키: '+key);
  return {status:'success',key:key};
}

function verifyPCReportKey_(d){
  var key=PropertiesService.getScriptProperties().getProperty('MM_PC_REPORT_KEY');
  if(!key||String(d.key||'')!==key)throw Error('PC 자동 보고서 연결키를 확인해 주세요.');
}

function pcReportSnapshot_(st){
  var records=JSON.parse(doGet({parameter:{}}).getContent());
  if(!Array.isArray(records))throw Error('보고서 데이터 조회 실패');
  return {date:st.weekKey,records:records.filter(function(r){return String(r.date).slice(0,10)===st.weekKey;}),settings:{configured:true,machines:st.settings.machines,mails:[]},items:getItemSettings_()};
}

function pcReportRevision_(st,snapshot){
  // Changing a record, machine, item label or recipient invalidates the capture.
  var text=JSON.stringify({snapshot:snapshot,recipients:uniqueEmails_(st.mails.map(function(m){return m.email;}))});
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8));
}

function pcReportStatus_(d){
  verifyPCReportKey_(d);
  var now=new Date(),tz=Session.getScriptTimeZone()||'Asia/Seoul';
  var props=PropertiesService.getScriptProperties(),pending=props.getProperty('MM_PC_PENDING_DATE');
  if(pending&&props.getProperty('MM_REPORT_FINAL_'+pending)==='Y'){props.deleteProperty('MM_PC_PENDING_DATE');pending='';}
  if(Utilities.formatDate(now,tz,'u')!=='1'&&!pending)return {status:'skip',reason:'not_monday'};
  var week=pending||autoMailWeekKey_(now);
  if(props.getProperty('MM_REPORT_FINAL_'+week)==='Y')return {status:'skip',reason:'final_already_sent'};
  var st=getAutoMailStatus_(week);
  if(!st.total||st.missing.length)return {status:'waiting',missing:st.missing.length};
  if(pending!==week)props.setProperty('MM_PC_PENDING_DATE',week);
  var required=uniqueEmails_(st.mails.map(function(m){return m.email;})).length;
  var remaining=MailApp.getRemainingDailyQuota();
  if(!required)throw Error('사용 체크된 전체 메일 수신자가 없습니다.');
  if(remaining<required)return {status:'quota_wait',date:week,remaining:remaining,required:required,retryAfterMs:300000};
  var snapshot=pcReportSnapshot_(st);
  return {status:'ready',snapshot:snapshot,revision:pcReportRevision_(st,snapshot)};
}

function pcReportSend_(d){
  verifyPCReportKey_(d);
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    var status=pcReportStatus_(d);
    if(status.status!=='ready')return status;
    if(d.date!==status.snapshot.date||d.revision!==status.revision)return {status:'retry',reason:'report_changed'};
    var st=getAutoMailStatus_(status.snapshot.date);
    var recipients=uniqueEmails_(st.mails.map(function(m){return m.email;}));
    if(!recipients.length)throw Error('사용 체크된 전체 메일 수신자가 없습니다.');
    var remaining=MailApp.getRemainingDailyQuota();
    if(remaining<recipients.length)return {status:'quota_wait',date:status.snapshot.date,remaining:remaining,required:recipients.length,retryAfterMs:300000};
    var payload={recipients:recipients,subject:'[My Machine] '+status.snapshot.date+' 3정5S 점검 결과',body:'My Machine 3정5S 전체 등록완료 보고서입니다.',reportImageBase64:d.reportImageBase64,reportImageMimeType:'image/jpeg',reportImageName:'MyMachine_'+status.snapshot.date+'.jpg',reportPdfBase64:d.reportPdfBase64,reportPdfName:'MyMachine_'+status.snapshot.date+'.pdf'};
    var result=deliverRichReportEmail_(payload);
    if(result.status!=='success'||!result.inlineImage||!result.pdfAttached||result.sentCount!==recipients.length)throw Error(result.message||'전체 보고서 발송 실패');
    PropertiesService.getScriptProperties().setProperty('MM_REPORT_FINAL_'+status.snapshot.date,'Y');
    return result;
  }finally{lock.releaseLock();}
}
