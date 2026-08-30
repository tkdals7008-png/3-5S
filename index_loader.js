(async function(){
  const WEB_APP_URL='https://script.google.com/macros/s/AKfycbwgEHiICS2ga2XCuVYppgEGCJgJ3rAjA2jnq8Qbk1-Ol7zpwe5r2wnSw00M-ovNEB2i/exec';
  try{
    const r=await fetch(WEB_APP_URL+'?action=get_admin_settings&_='+Date.now(),{cache:'no-store'});
    const o=await r.json();
    if(o&&o.status==='success'&&o.settings){localStorage.setItem('mymachine_v3_settings',JSON.stringify(o.settings));}
  }catch(e){console.warn('설비마스터 서버 조회 실패',e);}
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(src+' 로드 실패'));document.body.appendChild(s);});}
  try{
    await load('index_app.js?b=20260831-0834');
    await load('index_na_patch.js?b=20260831-0834');
  }catch(e){console.error(e);alert('점검 화면 최신 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');}
})();