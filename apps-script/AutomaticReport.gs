// Configure these script properties only after deploying the authenticated renderer.
function renderAutomaticReport_(st) {
  var props=PropertiesService.getScriptProperties();
  var url=props.getProperty('MM_REPORT_RENDER_URL'),token=props.getProperty('MM_REPORT_RENDER_TOKEN');
  if(!url||!/^https:\/\//.test(url)||!token)throw Error('자동 보고서 생성 서버 연결이 필요합니다.');
  // Reuse the existing record serializer so photos/admin actions match manual reports.
  var records=JSON.parse(doGet({parameter:{}}).getContent());
  if(!Array.isArray(records))throw Error('보고서 데이터 조회 실패');
  var snapshot={date:st.weekKey,records:records.filter(function(r){return String(r.date).slice(0,10)===st.weekKey;}),settings:{configured:true,machines:st.settings.machines,mails:[]},items:getItemSettings_()};
  var response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify(snapshot),muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw Error('보고서 생성 서버 오류: HTTP '+response.getResponseCode());
  var payload=JSON.parse(response.getContentText());
  if(!payload.reportImageBase64||!payload.reportPdfBase64)throw Error('본문 이미지 또는 PDF 누락');
  return payload;
}
