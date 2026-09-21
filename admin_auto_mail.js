(function(){
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
  function ensureMailDefaults(){(settings.mails||[]).forEach(m=>{if(!('team' in m))m.team='';if(!m.role)m.role='팀원';});}

  const oldRender=window.renderSettings;
  window.renderSettings=function(){
    if(typeof oldRender==='function')oldRender();
    ensureMailDefaults();
    const box=document.getElementById('mailSettings');
    if(!box)return;
    box.innerHTML='<div class="mailRow" style="grid-template-columns:55px 1fr 1.5fr 1fr 100px 70px"><div class="rowHead">사용</div><div class="rowHead">이름</div><div class="rowHead">메일주소</div><div class="rowHead">소속팀</div><div class="rowHead">구분</div><div class="rowHead">삭제</div></div>'+
      settings.mails.map((m,i)=>'<div class="mailRow" style="grid-template-columns:55px 1fr 1.5fr 1fr 100px 70px"><div style="text-align:center"><input class="check" type="checkbox" '+(m.active!==false?'checked':'')+' data-mail="'+i+'" data-k="active"></div><input value="'+esc(m.name)+'" data-mail="'+i+'" data-k="name"><input value="'+esc(m.email)+'" data-mail="'+i+'" data-k="email"><input value="'+esc(m.team||'')+'" data-mail="'+i+'" data-k="team" placeholder="예: A팀"><select data-mail="'+i+'" data-k="role"><option '+(m.role==='팀원'?'selected':'')+'>팀원</option><option '+(m.role==='팀장'?'selected':'')+'>팀장</option><option '+(m.role==='임원'?'selected':'')+'>임원</option></select><button class="btn red" onclick="settings.mails.splice('+i+',1);renderSettings()">삭제</button></div>').join('');
    addAutoMailPanel_();
  };

  function addAutoMailPanel_(){
    const sec=document.getElementById('mailSection'); if(!sec||document.getElementById('autoMailPanel'))return;
    const d=document.createElement('div');d.id='autoMailPanel';d.style.cssText='margin-top:18px;padding:16px;border:1px solid #c9d6e5;border-radius:12px;background:#f7faff';
    d.innerHTML='<div style="font-weight:800;font-size:16px;margin-bottom:8px">자동 메일 운영</div><div style="font-size:13px;line-height:1.7;color:#506174;margin-bottom:10px">월요일 09시: 미등록자가 있으면 미등록자 + 해당 팀장 + 사용 체크된 임원에게만 알림. 미등록자가 없으면 사용 체크된 전체 수신자에게 결과 메일 발송. 이후 전원 등록 완료 시 전체 결과 메일을 1회 자동 발송합니다.</div><button class="btn" id="btnSetupAutoMail" type="button">월요일 09시 자동메일 설정</button> <button class="btn" id="btnTestAutoMail" type="button">현재 기준 자동메일 테스트</button>';
    sec.appendChild(d);
    document.getElementById('btnSetupAutoMail').onclick=()=>autoMailAction_('setup_auto_mail','자동메일 설정');
    document.getElementById('btnTestAutoMail').onclick=()=>{if(confirm('현재 데이터를 기준으로 실제 자동메일 발송 로직을 테스트합니다. 계속할까요?'))autoMailAction_('run_auto_mail_check','자동메일 테스트');};
  }

  const oldAdd=window.addMailRow;
  window.addMailRow=function(){if(typeof collectSettings==='function')collectSettings();settings.mails.push({active:true,name:'',email:'',team:'',role:'팀원'});window.renderSettings();};

  const oldCollect=window.collectSettings;
  window.collectSettings=function(){
    if(typeof oldCollect==='function')oldCollect();
    document.querySelectorAll('[data-mail]').forEach(el=>{
      const i=+el.dataset.mail,k=el.dataset.k;if(!settings.mails[i])return;
      settings.mails[i][k]=el.type==='checkbox'?el.checked:el.value.trim();
    });
  };

  window.saveSettings=async function(){
    try{
      if(typeof collectSettings==='function')collectSettings();
      localStorage.setItem('mymachine_v3_settings',JSON.stringify(settings));
      const res=await fetch(WEB_APP_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'save_admin_settings',machines:settings.machines||[],mails:settings.mails||[]})});
      const o=await res.json();if(!o||o.status!=='success')throw new Error(o&&o.message||'서버 저장 실패');
      alert('저장 완료\n메일의 소속팀/구분 정보도 서버에 반영되었습니다.');closeSettings();compute();
    }catch(e){alert('설정 저장 오류\n'+e.message);}
  };

  async function autoMailAction_(action,label){
    try{
      if(typeof collectSettings==='function')collectSettings();
      localStorage.setItem('mymachine_v3_settings',JSON.stringify(settings));
      let r=await fetch(WEB_APP_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'save_admin_settings',machines:settings.machines||[],mails:settings.mails||[]})});
      let o=await r.json();if(!o||o.status!=='success')throw new Error(o&&o.message||'설정 저장 실패');
      r=await fetch(WEB_APP_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action})});o=await r.json();
      if(o.status==='error')throw new Error(o.message||label+' 실패');
      alert(label+' 완료\n'+(o.message||('상태: '+(o.type||o.reason||o.status)+(o.missing!=null?' / 미등록 '+o.missing+'명':''))));
    }catch(e){alert(label+' 오류\n'+e.message);}
  }

  const oldDownload=window.downloadMailTemplate;
  window.downloadMailTemplate=function(){if(typeof collectSettings==='function')collectSettings();downloadCsv('MyMachine_메일설정.csv',['사용','이름','메일주소','소속팀','구분'],settings.mails.map(m=>[m.active!==false?'Y':'N',m.name,m.email,m.team||'',m.role||'팀원']));};

  window.uploadMailTemplate=function(input){
    const f=input.files&&input.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{try{const txt=decodeUploadBuffer(r.result),rows=parseDelimited(txt);settings.mails=rows.slice(1).map(x=>({active:String(x[0]||'Y').trim().toUpperCase()!=='N',name:String(x[1]||'').trim(),email:String(x[2]||'').trim(),team:String(x[3]||'').trim(),role:String(x[4]||'팀원').trim()||'팀원'})).filter(x=>x.email);localStorage.setItem('mymachine_v3_settings',JSON.stringify(settings));renderSettings();alert('메일 설정 '+settings.mails.length+'명이 업로드되었습니다. 저장 버튼을 눌러 서버에 반영해 주세요.');input.value='';}catch(e){alert('메일 설정 업로드 오류: '+e.message);input.value='';}};
    r.readAsArrayBuffer(f);
  };

  setTimeout(()=>{ensureMailDefaults();if(document.getElementById('mailSettings'))window.renderSettings();},300);
})();