// Separate, date-scoped capability for corrective actions. Never expose this key through GET APIs.
function engineerMailButton_(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  var lock=LockService.getScriptLock(); lock.waitLock(10000);
  var key;
  try {
    var props=PropertiesService.getScriptProperties(), name='MM_ENGINEER_KEY_'+date;
    key=props.getProperty(name);
    if(!key){key=Utilities.getUuid()+Utilities.getUuid();props.setProperty(name,key);}
  } finally {lock.releaseLock();}
  var url='https://tkdals7008-png.github.io/3-5S/engineer.html#date='+encodeURIComponent(date)+'&key='+encodeURIComponent(key);
  return '<div style="margin:18px 0;padding:14px;background:#eef5ff;border:1px solid #cbdcf0"><a href="'+url+'" style="display:inline-block;background:#123a66;color:#ffffff;padding:13px 20px;text-decoration:none;border-radius:8px;font-weight:bold">'+date+' 개선조치 등록</a><p style="font-size:13px;color:#41536a;margin:10px 0 0">현장 엔지니어: 요청 선택 → 이름·조치 내용·완료 사진 입력 → 완료 등록<br>이 링크는 해당 점검일의 개선조치 등록용입니다. 담당 엔지니어에게만 공유해 주세요.</p></div>';
}

function engineerReportButtons_(title) {
  var match=String(title||'').match(/\d{4}-\d{2}(?:-\d{2})?/);if(!match)return '';
  var period=match[0];if(period.length===10)return engineerMailButton_(period);
  var dates={};getDataSheet_().getDataRange().getValues().slice(1).forEach(function(r){
    var day=r[0] instanceof Date?Utilities.formatDate(r[0],'Asia/Seoul','yyyy-MM-dd'):String(r[0]||'').trim();
    if(day.slice(0,7)===period&&/^\d{4}-\d{2}-\d{2}$/.test(day))dates[day]=true;
  });
  return Object.keys(dates).sort().reverse().map(engineerMailButton_).join('');
}

function engineerStore_(raw) {
  try {var s=JSON.parse(raw||'{}');if(s.version==='MM_REQ_ADMIN_V1'&&s.requests&&typeof s.requests==='object'&&!Array.isArray(s.requests))return s;}catch(e){}
  return {version:'MM_REQ_ADMIN_V1',legacyText:String(raw||''),requests:{}};
}

function engineerRequests_(date) {
  var values=getDataSheet_().getDataRange().getValues(), out=[];
  values.slice(1).forEach(function(r,i){
    var day=r[0] instanceof Date?Utilities.formatDate(r[0],'Asia/Seoul','yyyy-MM-dd'):String(r[0]||'').trim();
    if(day!==date)return;
    var actions=[], names=[];
    try {actions=JSON.parse(r[23]||'[]');names=JSON.parse(r[22]||'[]');}catch(e){return;}
    if(!Array.isArray(actions))return;
    actions.filter(function(a){return a&&a.type==='request'&&Number.isInteger(Number(a.item))&&Number(a.item)>=1&&Number(a.item)<=10;}).forEach(function(a){
      var id='MM-'+date.replace(/-/g,'')+'-'+r[2]+'-'+('0'+a.item).slice(-2), store=engineerStore_(r[20]), meta=store.requests[id]||{};
      var source=JSON.stringify([r.slice(0,20),r.slice(22),a,meta]);
      var revision=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,source));
      var item=Array.isArray(names)?names.filter(function(n){return Number(n.no)===Number(a.item);})[0]:null;
      var before=a.photos&&a.photos.reqBefore||[];if(!Array.isArray(before))before=[before];
      out.push({id:id,revision:revision,rowIndex:i+2,store:store,meta:meta,machine:String(r[2]||''),inspector:String(r[1]||''),item:String(a.item)+'. '+String(item&&item.name||''),text:String(a.text||a.memo||r[13]||''),priority:String(a.priority||'보통'),status:String(meta.status||'요청'),before:before.map(function(p){return String(p&&p.url||'');}).filter(Boolean)});
    });
  });
  return out;
}

function engineerAction_(d) {
  var date=String(d.date||''), key=String(d.key||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!key||key!==PropertiesService.getScriptProperties().getProperty('MM_ENGINEER_KEY_'+date))throw Error('보고서 메일의 개선조치 등록 버튼으로 접속해 주세요.');
  if(d.action==='engineer_list') {
    var all=engineerRequests_(date), counts={};all.forEach(function(q){counts[q.id]=(counts[q.id]||0)+1;});
    return {status:'success',duplicateCount:all.filter(function(q){return counts[q.id]>1;}).length,requests:all.filter(function(q){return counts[q.id]===1;}).map(function(q){return {id:q.id,revision:q.revision,machine:q.machine,inspector:q.inspector,item:q.item,text:q.text,priority:q.priority,status:q.status,before:q.before,completedBy:String(q.meta.completedBy||''),completedAt:String(q.meta.completedAt||'')};})};
  }
  if(d.action!=='engineer_complete')throw Error('지원하지 않는 요청입니다.');
  var name=String(d.name||'').trim(), text=String(d.text||'').trim();
  if(!name||name.length>50||!text||text.length>2000)throw Error('이름(50자 이내)과 조치 내용(2000자 이내)을 입력해 주세요.');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var matches=engineerRequests_(date).filter(function(q){return q.id===d.id;});
    if(matches.length!==1)throw Error('요청이 변경되었거나 중복되어 있습니다. 목록을 새로 확인하고 관리자에게 문의해 주세요.');
    var q=matches[0];
    if(q.status==='완료')return {status:'success',alreadyComplete:true,message:'이미 완료 등록된 요청입니다.'};
    if(q.revision!==d.revision)throw Error('요청이 변경되었습니다. 목록을 다시 확인해 주세요.');
    var p=d.photo||{}, mime=String(p.mimeType||'');
    if(!/^(image\/jpeg|image\/png)$/.test(mime)||!p.base64||String(p.base64).length>2800000)throw Error('완료 사진은 2MB 이하 JPG/PNG 파일로 등록해 주세요.');
    var bytes=Utilities.base64Decode(String(p.base64));
    var sig=bytes.slice(0,8).map(function(b){return (b+256)%256;});
    if(bytes.length>2097152||!(mime==='image/jpeg'&&sig[0]===255&&sig[1]===216&&sig[2]===255||mime==='image/png'&&sig.join(',')==='137,80,78,71,13,10,26,10'))throw Error('올바른 JPG/PNG 사진이 아닙니다.');
    var url=savePhoto_({base64:p.base64,mimeType:mime},'Engineer_'+date+'_'+Utilities.getUuid());
    var now=new Date().toISOString();
    q.store.requests[q.id]=Object.assign({},q.meta,{status:'완료',photoUrl:url,text:text,completedBy:name,completedAt:now,updatedAt:now});
    getDataSheet_().getRange(q.rowIndex,21).setValue(JSON.stringify(q.store));
    SpreadsheetApp.flush();
    return {status:'success',message:'개선조치 완료 등록이 저장되었습니다.'};
  } finally {lock.releaseLock();}
}
