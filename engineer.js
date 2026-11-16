'use strict';
(()=>{
  const API='https://script.google.com/macros/s/AKfycbwgEHiICS2ga2XCuVYppgEGCJgJ3rAjA2jnq8Qbk1-Ol7zpwe5r2wnSw00M-ovNEB2i/exec';
  const params=new URLSearchParams(location.hash.slice(1)),date=params.get('date'),key=params.get('key');
  const $=id=>document.getElementById(id);let requests=[],busy=false,previewUrl='';
  function message(text){$('message').textContent=text;}
  function setBusy(value){busy=value;$('fields').disabled=value;$('refresh').disabled=value;$('request').disabled=value;$('save').textContent=value?'처리 중… 잠시 기다려 주세요':'완료 등록';}
  async function post(action,data={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{const response=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,date,key,...data}),signal:controller.signal});const r=await response.json();if(r.status!=='success')throw Error(r.message||'처리하지 못했습니다.');return r;}
    finally{clearTimeout(timer);}
  }
  function clearPhoto(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';$('photo').value='';$('preview').hidden=true;$('preview').removeAttribute('src');}
  function selectRequest(){
    const q=requests.find(q=>q.id===$('request').value);$('formSection').hidden=!q;$('details').textContent='';$('photos').replaceChildren();$('text').value='';clearPhoto();if(!q)return;
    $('details').textContent=q.item+'\n요청자: '+q.inspector+' / 우선순위: '+q.priority+'\n\n'+q.text;
    q.before.forEach(url=>{let id;try{const u=new URL(url);if(!['drive.google.com','www.drive.google.com'].includes(u.hostname))return;id=(u.pathname.match(/\/d\/([\w-]+)/)||[])[1]||u.searchParams.get('id');}catch(e){return;}if(!id||!/[\w-]+/.test(id))return;const img=document.createElement('img');img.src='https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w400';img.alt='개선 전 사진';img.referrerPolicy='no-referrer';img.loading='lazy';$('photos').append(img);});
  }
  async function load(){
    if(busy)return;setBusy(true);message('요청 목록을 확인하고 있습니다.');
    try{const r=await post('engineer_list');requests=r.requests.filter(q=>q.status!=='완료');$('request').replaceChildren();requests.forEach(q=>{const o=document.createElement('option');o.value=q.id;o.textContent=q.machine+' · '+q.item;$('request').append(o);});$('requestSection').hidden=!requests.length;selectRequest();const done=r.requests.filter(q=>q.status==='완료');$('completed').hidden=!done.length;$('completeList').textContent=done.map(q=>q.machine+' · '+q.item+' — 완료'+(q.completedBy?' ('+q.completedBy+')':'')).join('\n');message((requests.length?'미완료 '+requests.length+'건입니다. 요청을 선택해 주세요.':'현재 등록할 미완료 요청이 없습니다.')+(r.duplicateCount?'\n중복된 요청 '+r.duplicateCount+'건은 관리자 확인이 필요합니다.':''));}
    catch(e){message('목록 확인 실패: '+e.message+'\n보고서 메일의 버튼으로 접속했는지 확인해 주세요.');}
    finally{setBusy(false);}
  }
  async function compress(file){
    if(!file||!file.type.startsWith('image/'))throw Error('완료 사진을 선택해 주세요.');
    const url=URL.createObjectURL(file),image=new Image();
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('사진을 열 수 없습니다. JPG/PNG 사진을 선택해 주세요.'));image.src=url;});const ratio=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const base64=canvas.toDataURL('image/jpeg',.8).split(',')[1];if(base64.length>2800000)throw Error('사진 용량이 큽니다. 다른 사진을 선택해 주세요.');return {mimeType:'image/jpeg',base64};}
    finally{URL.revokeObjectURL(url);}
  }
  $('request').addEventListener('change',selectRequest);$('refresh').addEventListener('click',load);
  $('photo').addEventListener('change',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);const file=$('photo').files[0];$('preview').hidden=!file;if(file){previewUrl=URL.createObjectURL(file);$('preview').src=previewUrl;}});
  $('form').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;const q=requests.find(q=>q.id===$('request').value);if(!q)return;
    const name=$('name').value.trim(),text=$('text').value.trim(),file=$('photo').files[0];if(!name||!text||!file){message('이름, 조치 내용, 완료 사진을 모두 입력해 주세요.');return;}
    setBusy(true);message('완료 등록 중입니다. 화면을 닫지 말고 기다려 주세요.');let saved=false,result;
    try{const photo=await compress(file);result=await post('engineer_complete',{id:q.id,revision:q.revision,name,text,photo});saved=true;try{localStorage.setItem('mm-engineer-name',name);}catch(e){}message(result.message);}
    catch(e){message('완료 여부를 확인해 주세요: '+e.message+'\n입력 내용은 유지됩니다. 위의 ‘목록 / 저장 여부 다시 확인’을 눌러 완료된 요청에 표시되는지 확인해 주세요.');}
    finally{setBusy(false);}
    if(saved){await load();message(result.message+'\n아래 완료된 요청에서 확인할 수 있습니다.');}
  });
  try{$('name').value=localStorage.getItem('mm-engineer-name')||'';}catch(e){}
  $('dateLabel').textContent=(date||'')+' 점검 · 현장 엔지니어용';
  if(!date||!key){message('보고서 메일의 ‘개선조치 등록’ 버튼으로 접속해 주세요.');$('refresh').hidden=true;}else load();
})();
