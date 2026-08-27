(function(){
  const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function readJsonResponse(res,label){
    const txt=await res.text();
    let obj;
    try{obj=JSON.parse(txt);}catch(e){
      throw new Error(label+' 응답 형식 오류 (HTTP '+res.status+'): '+txt.slice(0,180));
    }
    if(!res.ok) throw new Error(label+' HTTP 오류: '+res.status);
    return obj;
  }

  async function persistCurrentSettings(){
    if(typeof collectSettings==='function') collectSettings();
    localStorage.setItem('mymachine_v3_settings',JSON.stringify(settings));
    const res=await fetch(WEB_APP_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'save_admin_settings',machines:settings.machines||[],mails:settings.mails||[]})
    });
    const o=await readJsonResponse(res,'메일 설정 저장');
    if(!o||o.status!=='success') throw new Error(o&&o.message||'메일 설정 서버 저장 실패');
  }

  async function getVerifiedRecipients(){
    const res=await fetch(WEB_APP_URL+'?action=get_admin_settings&_='+Date.now(),{cache:'no-store'});
    const o=await readJsonResponse(res,'메일 수신자 조회');
    if(!o||o.status!=='success'||!o.settings) throw new Error(o&&o.message||'메일 수신자 서버 조회 실패');
    const mails=Array.isArray(o.settings.mails)?o.settings.mails:[];
    const active=mails.filter(m=>m&&m.active!==false&&String(m.email||'').trim());
    if(!active.length) throw new Error('사용 체크된 메일 수신자가 없습니다.');
    const invalid=active.filter(m=>!EMAIL_RE.test(String(m.email).trim()));
    if(invalid.length) throw new Error('메일주소 형식 오류: '+invalid.map(m=>(m.name||'이름없음')+' <'+m.email+'>').join(', '));
    return active.map(m=>String(m.email).trim());
  }

  window.sendMail=async function(){
    if(typeof isAdminAuthed==='function'&&!isAdminAuthed()) return openAdminLogin();
    const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('보고서 메일 발송'));
    const old=btn?btn.textContent:'';
    if(btn){btn.disabled=true;btn.textContent='메일 확인 중...';}
    try{
      await persistCurrentSettings();
      const recipients=await getVerifiedRecipients();
      const period=(document.getElementById('monthPicker')&&document.getElementById('monthPicker').value)||new Date().toISOString().slice(0,7);
      const reportEl=document.getElementById('reportContent');
      const reportText=reportEl&&reportEl.classList.contains('visible')?reportEl.innerText:'현재 조회된 보고서가 없습니다. 관리자 시스템에서 실데이터 조회 후 다시 발송해 주세요.';
      const payload={
        action:'send_report_email',
        recipients,
        subject:'[My Machine] '+period+' 3정5S 점검 결과',
        body:'My Machine 자주보전 & 개선관리 시스템\n\n'+reportText
      };
      if(!confirm(period+' My Machine 보고서를\n'+recipients.length+'명에게 발송하시겠습니까?\n\n'+recipients.join('\n'))) return;
      if(btn)btn.textContent='메일 발송 중...';
      const res=await fetch(WEB_APP_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify(payload)
      });
      const result=await readJsonResponse(res,'메일 발송');
      if(result.status!=='success') throw new Error(result.message||'Apps Script 메일 발송 실패');
      if(Number(result.sentCount||0)!==recipients.length) throw new Error('발송 건수 불일치: 요청 '+recipients.length+'명 / 서버 '+(result.sentCount||0)+'명');
      alert('메일 발송 완료\n수신자: '+recipients.length+'명\n\nGmail 보낸편지함에서도 발송 기록을 확인해 주세요.');
    }catch(err){
      console.error('My Machine mail error',err);
      alert('메일 발송 오류\n'+err.message);
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old||'보고서 메일 발송';}
    }
  };
})();
