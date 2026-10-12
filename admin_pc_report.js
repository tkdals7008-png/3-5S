(function(){
  if(new URLSearchParams(location.search).get('autoReport')!=='pc')return;
  let enabled=false,busy=false,timer=null,key='';
  const panel=document.createElement('section');panel.className='noPrint';
  panel.style.cssText='position:sticky;top:0;z-index:9999;background:#123a66;color:white;padding:14px;font-family:sans-serif';
  panel.innerHTML='<b>PC 자동 보고서</b> · 이 창을 열어두고 PC 절전 모드를 해제해 주세요. <input id="mmPcKey" type="password" autocomplete="off" placeholder="Apps Script 연결키" style="width:240px"> <button id="mmPcStart">자동 발송 시작</button> <button id="mmPcStop">중지</button><div id="mmPcStatus" style="margin-top:8px">중지됨 · 별도 클라우드 서버를 사용하지 않습니다.</div>';
  document.body.prepend(panel);
  const status=panel.querySelector('#mmPcStatus'),start=panel.querySelector('#mmPcStart'),stop=panel.querySelector('#mmPcStop'),input=panel.querySelector('#mmPcKey');
  function note(text){status.textContent=new Date().toLocaleTimeString('ko-KR')+' · '+text;}
  async function post(data){
    const res=await fetch(WEB_APP_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...data,key})});
    const result=await res.json();if(result.status==='error')throw Error(result.message||'서버 오류');return result;
  }
  async function check(){
    if(!enabled||busy)return;busy=true;let nextDelay=10000;
    try{
      const result=await post({action:'pc_report_status'});
      if(!enabled)return;
      if(result.status==='quota_wait'){
        nextDelay=300000;note('메일 한도 회복 대기 · 잔여 '+result.remaining+'명 / 필요 '+result.required+'명 · 5분마다 한도 확인 · 보고서 날짜 '+result.date);return;
      }
      if(result.status!=='ready'){
        note(result.reason==='final_already_sent'?'전체 보고서 발송 완료 · 중복 발송하지 않습니다.':result.status==='waiting'?'등록 대기 · 미등록 '+result.missing+'명':'점검일 대기');return;
      }
      note('전원 등록완료 · 보고서 이미지와 PDF 생성 중...');
      const snapshot=result.snapshot;
      settings.machines=snapshot.settings.machines;
      settings.items=snapshot.items;
      snapshot.items.forEach(x=>{itemNames[Number(x.no)-1]=x.name;});
      rawData=snapshot.records;
      document.getElementById('dateInput').value=snapshot.date;
      window.setReportMode('day',false);showReport();compute();
      const payload=await window.createMyMachineReportPayload(snapshot.date,true);
      if(!enabled)return;
      note('전체 보고서 발송 중...');
      const sent=await post({...payload,action:'pc_report_send',date:snapshot.date,revision:result.revision});
      if(sent.status==='quota_wait'){nextDelay=300000;note('메일 한도 회복 대기 · 잔여 '+sent.remaining+'명 / 필요 '+sent.required+'명 · 5분마다 한도 확인');}
      else if(sent.status==='retry')note('등록 내용 변경 · 다음 확인에서 보고서를 다시 생성합니다.');
      else if(sent.status==='success'&&sent.pdfAttached&&sent.inlineImage)note('전체 보고서 발송 완료 · '+sent.sentCount+'명 · 본문 이미지 + PDF 첨부');
      else if(sent.reason==='final_already_sent')note('다른 창에서 이미 발송 완료 · 중복 발송하지 않습니다.');
      else note('상태 재확인 대기');
    }catch(error){if(/한도|quota|too many times/i.test(error.message))nextDelay=300000;note('확인/발송 실패 · '+error.message+' · '+(nextDelay===300000?'5분 후 재확인':'자동 재시도합니다.'));}
    finally{busy=false;if(enabled)timer=setTimeout(check,nextDelay);}
  }
  start.onclick=()=>{if(enabled)return;key=input.value.trim();if(!key){note('먼저 Apps Script 연결키를 입력해 주세요.');return;}enabled=true;input.disabled=true;start.disabled=true;note('자동 발송 시작 · 10초 간격 확인');check();};
  stop.onclick=()=>{enabled=false;clearTimeout(timer);input.disabled=false;start.disabled=false;note('중지됨 · 진행 중인 서버 발송은 취소되지 않습니다.');};
})();
