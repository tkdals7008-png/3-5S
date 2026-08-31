(function(){
  const style=document.createElement('style');
  style.textContent=`
    #reportContent table thead th{text-align:center!important;vertical-align:middle;word-break:keep-all}
    #requestBody td:nth-child(4){text-align:left!important;min-width:260px}
    #requestBody td:nth-child(7){text-align:left!important;min-width:180px}
    #requestBody td:nth-child(1){min-width:112px;line-height:1.35}
    #requestBody td:nth-child(2){min-width:92px;white-space:nowrap}
    #requestBody td:nth-child(3){min-width:64px;white-space:nowrap}
    #requestBody td:nth-child(5){min-width:72px;white-space:nowrap}
    #requestBody td:nth-child(6){min-width:70px;white-space:nowrap}
    #requestBody td:nth-child(8),#requestBody td:nth-child(9){min-width:96px}
    #requestBody td:nth-child(10){min-width:78px;white-space:nowrap}
    #requestBody td:nth-child(11){min-width:132px;white-space:nowrap}
    #requestBody .req-id{font-size:12px;font-weight:800;word-break:keep-all}
    #requestBody .compare-label{display:block;font-size:11px;color:#667085;margin-bottom:3px;font-weight:800}
    #requestBody .photos{justify-content:center}
    #requestBody .photos img{width:88px;height:66px;object-fit:cover;border-radius:8px}
    .req-complete-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.48);z-index:10050;padding:18px}
    .req-complete-card{width:min(720px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.25)}
    .req-complete-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
    .req-complete-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}
    .req-photo-box{border:1px solid #d8dee8;border-radius:12px;padding:12px;min-height:180px;background:#f8fafc}
    .req-photo-box img{display:block;max-width:100%;max-height:280px;margin:8px auto 0;border-radius:8px}
    .req-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
    @media(max-width:700px){.req-complete-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const statusKey='mymachine_v3_request_status';
  const mapVersion='MM_REQ_ADMIN_V1';
  let activeRequestId='';

  function localStatuses(){try{return JSON.parse(localStorage.getItem(statusKey)||'{}')||{};}catch(e){return {};}}
  function saveLocalStatus(id,st){const s=localStatuses();s[id]=st;localStorage.setItem(statusKey,JSON.stringify(s));}
  function requestById(id){return (window.requests||requests||[]).find(q=>q.id===id);}
  function photoUrl(p){return p&&(p.preview||p.url||(p.base64?'data:image/jpeg;base64,'+p.base64:''))||'';}
  function beforeUrl(q){return photoUrl(q&&q.action&&q.action.photos&&q.action.photos.reqBefore);}
  function afterUrl(q){return (q&&q.adminMeta&&q.adminMeta.photoUrl)||photoUrl(q&&q.action&&q.action.photos&&q.action.photos.reqAfter);}
  function imgHtml(url,label){if(!url)return '<span class="hint">-</span>';return `<span class="compare-label">${label}</span><div class="photos">${photoTag(url)}</div>`;}

  function parseAdminStore(row){
    const raw=String(row&&row.actionText||'').trim();
    if(!raw)return {version:mapVersion,legacyText:'',requests:{}};
    try{
      const o=JSON.parse(raw);
      if(o&&o.version===mapVersion&&o.requests&&typeof o.requests==='object')return {version:mapVersion,legacyText:String(o.legacyText||''),requests:o.requests};
    }catch(e){}
    return {version:mapVersion,legacyText:raw,requests:{}};
  }
  function adminMeta(row,id){const s=parseAdminStore(row);return s.requests[id]||{};}
  function serializeAdminStore(row,id,patch){
    const s=parseAdminStore(row);s.requests[id]=Object.assign({},s.requests[id]||{},patch||{}, {updatedAt:new Date().toISOString()});return JSON.stringify(s);
  }
  function statusFor(q){return String((q&&q.adminMeta&&q.adminMeta.status)||localStatuses()[q&&q.id]||'요청');}

  function itemNameFor(q){
    try{const raw=q.row.itemNamesSnapshot;const arr=Array.isArray(raw)?raw:JSON.parse(raw||'[]');const x=Array.isArray(arr)?arr.find(v=>Number(v.no)===Number(q.item)):null;if(x&&x.name)return x.name;}catch(e){}
    return itemNames[q.item-1]||'';
  }
  function requestIdHtml(q){
    const prefix='MM-'+String(q.row.date||'').replaceAll('-','');
    return `<span class="req-id">${prefix}<br>${q.row.machine}-${String(q.item).padStart(2,'0')}</span>`;
  }
  function ensureRequestHeader(){
    const body=document.getElementById('requestBody');const table=body&&body.closest('table');if(!table)return;
    const tr=table.querySelector('thead tr');if(!tr)return;
    tr.innerHTML='<th>요청번호</th><th>일자</th><th>설비</th><th>항목</th><th>요청자</th><th>우선순위</th><th>요청내용</th><th>개선전</th><th>개선후</th><th>상태</th><th class="noPrint">관리</th>';
  }
  function ensureAllHeadersCentered(){document.querySelectorAll('#reportContent table thead th').forEach(th=>th.style.textAlign='center');}

  window.buildRequests=function(){
    requests=[];
    reportRows.filter(r=>r.status==='done'||r.status==='unknown').forEach(r=>{
      (r.actions||[]).filter(a=>a&&a.type==='request').forEach(a=>{
        const id=reqId(r,a),meta=adminMeta(r,id);
        requests.push({id,row:r,item:a.item,text:a.text||r.issue,priority:a.priority||'보통',status:meta.status||localStatuses()[id]||'요청',action:a,adminMeta:meta});
      });
    });
  };
  window.getReqStatus=function(id){const q=requestById(id);return q?statusFor(q):(localStatuses()[id]||'요청');};

  window.renderRequests=function(){
    ensureRequestHeader();ensureAllHeadersCentered();const body=document.getElementById('requestBody');if(!body)return;
    body.innerHTML=requests.map(q=>{
      const st=statusFor(q),stCls=st==='완료'?'b-green':st==='진행중'?'b-blue':'b-orange',done=st==='완료';
      return `<tr><td>${requestIdHtml(q)}</td><td>${q.row.date}</td><td>${q.row.machine}</td><td>${q.item}. ${itemNameFor(q)}</td><td>${q.row.inspector||'-'}</td><td>${q.priority}</td><td>${q.text||'-'}</td><td>${imgHtml(beforeUrl(q),'개선전')}</td><td>${imgHtml(afterUrl(q),'개선후')}</td><td><span class="badge ${stCls}">${st}</span></td><td class="noPrint"><button class="btn" onclick="setRequestProgress('${q.id}')">진행</button><button class="btn green" onclick="openRequestComplete('${q.id}')">${done?'완료사진 변경':'완료'}</button></td></tr>`;
    }).join('')||'<tr><td colspan="11">개선요청 없음</td></tr>';
  };

  async function postAdmin(rowIndex,actionText,actionPhoto){
    const payload={action:'update_admin',rowIndex,actionText:actionText||''};if(actionPhoto)payload.actionPhoto=actionPhoto;
    const res=await fetch(WEB_APP_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});const data=await res.json();
    if(!data||data.status!=='success')throw new Error(data&&data.message?data.message:'서버 저장 실패');return data;
  }
  async function fetchAllRows(){const res=await fetch(WEB_APP_URL+'?t='+Date.now(),{cache:'no-store'});const data=await res.json();if(!Array.isArray(data))throw new Error(data&&data.message?data.message:'조회 데이터 오류');return data;}
  function findServerRow(rows,q){return rows.find(r=>Number(r.rowIndex)===Number(q.row.rowIndex));}

  window.setRequestProgress=async function(id){
    const q=requestById(id);if(!q)return alert('개선요청 정보를 찾을 수 없습니다.');
    try{
      const text=serializeAdminStore(q.row,id,{status:'진행중',photoUrl:afterUrl(q)||''});await postAdmin(q.row.rowIndex,text,null);
      q.row.actionText=text;q.adminMeta=adminMeta(q.row,id);q.status='진행중';saveLocalStatus(id,'진행중');compute();
    }catch(e){alert('진행 상태 저장 실패: '+e.message);}
  };

  function ensureModal(){
    if(document.getElementById('reqCompleteModal'))return;
    const el=document.createElement('div');el.id='reqCompleteModal';el.className='req-complete-modal noPrint';
    el.innerHTML=`<div class="req-complete-card"><div class="req-complete-head"><div><h2 style="margin:0">개선 완료 처리</h2><div id="reqCompleteInfo" class="hint" style="margin-top:4px"></div></div><button class="btn" onclick="closeRequestComplete()">닫기</button></div><p>개선완료 사진을 등록한 후 완료 처리합니다. 사진 저장이 성공해야 상태가 완료로 변경됩니다.</p><div class="req-complete-grid"><div class="req-photo-box"><b>개선 전</b><div id="reqBeforePreview"></div></div><div class="req-photo-box"><b>개선 후</b><input id="reqAfterFile" type="file" accept="image/*" style="width:100%;margin-top:8px"><div id="reqAfterPreview"></div></div></div><div class="req-modal-actions"><button class="btn" onclick="closeRequestComplete()">취소</button><button id="reqCompleteSave" class="btn green" onclick="saveRequestComplete()">사진 저장 + 완료</button></div></div>`;
    document.body.appendChild(el);
    document.getElementById('reqAfterFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0],box=document.getElementById('reqAfterPreview');if(!f){box.innerHTML='';return;}const u=URL.createObjectURL(f);box.innerHTML=`<img src="${u}" alt="개선후 미리보기">`;});
  }
  window.openRequestComplete=function(id){
    const q=requestById(id);if(!q)return alert('개선요청 정보를 찾을 수 없습니다.');ensureModal();activeRequestId=id;
    document.getElementById('reqCompleteInfo').textContent=`${q.row.date} / ${q.row.machine} / ${q.item}. ${itemNameFor(q)}`;
    const b=beforeUrl(q);document.getElementById('reqBeforePreview').innerHTML=b?`<img src="${b}" alt="개선전 사진">`:'<p class="hint">개선전 사진 없음</p>';
    const a=afterUrl(q);document.getElementById('reqAfterPreview').innerHTML=a?`<img src="${a}" alt="현재 개선후 사진"><p class="hint">새 사진을 선택하면 교체됩니다.</p>`:'';
    document.getElementById('reqAfterFile').value='';document.getElementById('reqCompleteModal').style.display='flex';
  };
  window.closeRequestComplete=function(){const m=document.getElementById('reqCompleteModal');if(m)m.style.display='none';activeRequestId='';};

  function readDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('사진 읽기 실패'));r.readAsDataURL(file);});}
  function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('사진 처리 실패'));im.src=src;});}
  async function imagePayload(file){
    const src=await readDataUrl(file),im=await loadImage(src),max=1600;let w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;const scale=Math.min(1,max/Math.max(w,h));w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);const out=c.toDataURL('image/jpeg',0.82);return {base64:out.split(',')[1],mimeType:'image/jpeg'};
  }
  async function refreshRealData(){rawData=await fetchAllRows();compute();}

  window.saveRequestComplete=async function(){
    const q=requestById(activeRequestId);if(!q)return alert('개선요청 정보를 찾을 수 없습니다.');
    const file=document.getElementById('reqAfterFile').files[0],existing=afterUrl(q);if(!file&&!existing)return alert('개선완료 사진을 선택해 주세요.');
    const btn=document.getElementById('reqCompleteSave');btn.disabled=true;const old=btn.textContent;btn.textContent='저장 중...';
    try{
      let photoUrl=existing;
      if(file){
        const photo=await imagePayload(file);
        await postAdmin(q.row.rowIndex,q.row.actionText||'',photo);
        const rows=await fetchAllRows(),saved=findServerRow(rows,q);if(!saved||!saved.actionPhoto)throw new Error('업로드한 사진 URL을 확인할 수 없습니다.');photoUrl=saved.actionPhoto;q.row.actionPhoto=photoUrl;
      }
      const text=serializeAdminStore(q.row,q.id,{status:'완료',photoUrl});await postAdmin(q.row.rowIndex,text,null);
      q.row.actionText=text;q.adminMeta=adminMeta(q.row,q.id);q.status='완료';saveLocalStatus(q.id,'완료');closeRequestComplete();await refreshRealData();alert('개선완료 사진 저장 및 완료 처리가 완료되었습니다.');
    }catch(e){alert('완료 처리 실패: '+e.message);}finally{btn.disabled=false;btn.textContent=old;}
  };

  const run=()=>{ensureRequestHeader();ensureAllHeadersCentered();ensureModal();if(Array.isArray(window.rawData)&&window.rawData.length&&typeof window.compute==='function')window.compute();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();