(async function(){
  const WEB_APP_URL='https://script.google.com/macros/s/AKfycbwgEHiICS2ga2XCuVYppgEGCJgJ3rAjA2jnq8Qbk1-Ol7zpwe5r2wnSw00M-ovNEB2i/exec';
  try{
    const r=await fetch(WEB_APP_URL+'?action=get_admin_settings&_='+Date.now(),{cache:'no-store'});
    const o=await r.json();
    if(o&&o.status==='success'&&o.settings){
      localStorage.setItem('mymachine_v3_settings',JSON.stringify(o.settings));
    }
  }catch(e){
    console.warn('설비마스터 서버 조회 실패',e);
  }
  const s=document.createElement('script');
  s.src='index_app.js?b=20260827-1325';
  s.async=false;
  document.body.appendChild(s);
})();