(function(){
  const MODE_KEY='mymachine_v3_report_mode';
  const ADMIN_STORE_VERSION='MM_REQ_ADMIN_V1';
  const dayRenderDetails=window.renderDetails;
  let reportMode=sessionStorage.getItem(MODE_KEY)==='month'?'month':'day';
  let expectedMondays=[];

  function localDateString(d){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function parseLocalDate(s){
    const p=String(s||'').slice(0,10).split('-').map(Number);
    return new Date(p[0]||1970,(p[1]||1)-1,p[2]||1);
  }
  function mondaysInMonth(month){
    const p=String(month||'').split('-').map(Number),y=p[0],m=p[1];
    if(!y||!m)return [];
    const d=new Date(y,m-1,1),out=[];
    while(d.getMonth()===m-1){if(d.getDay()===1)out.push(localDateString(d));d.setDate(d.getDate()+1);}
    return out;
  }
  function mondayKey(dateStr){
    const d=parseLocalDate(dateStr),diff=(d.getDay()+6)%7;d.setDate(d.getDate()-diff);return localDateString(d);
  }
  function masterMap(){const map={};activeMachines().forEach(m=>map[m.machine]=m);return map;}
  function safeActions(rec){return Array.isArray(rec&&rec.actions)?rec.actions:[];}
  function requestStatusLocal(id){try{return (JSON.parse(localStorage.getItem('mymachine_v3_request_status')||'{}')||{})[id]||'요청';}catch(e){return '요청';}}
  function parseAdminStore(row){
    const raw=String(row&&row.actionText||'').trim();
    if(!raw)return {version:ADMIN_STORE_VERSION,requests:{}};
    try{const o=JSON.parse(raw);if(o&&o.version===ADMIN_STORE_VERSION&&o.requests&&typeof o.requests==='object')return o;}catch(e){}
    return {version:ADMIN_STORE_VERSION,requests:{}};
  }
  function getAdminMeta(row,id){return parseAdminStore(row).requests[id]||{};}
  function teamOfMachine(machine){const m=masterMap()[machine];return m&&m.team?m.team:'미지정';}
  function ownerOfMachine(machine){const m=masterMap()[machine];return m&&m.owner?m.owner:'';}
  function uniqueInspectors(records){return [...new Set((records||[]).flatMap(r=>splitInspectors(r.inspector)).filter(Boolean))];}
  function allRecordActions(records){return (records||[]).flatMap(r=>safeActions(r));}
  function requestDoneCount(list){return (list||[]).filter(q=>String(q.status||getReqStatus(q.id))==='완료').length;}

  function ensureModeUi(){
    const bar=document.querySelector('.toolbar>div');
    if(!bar||document.getElementById('reportModeToggle'))return;
    const wrap=document.createElement('span');wrap.id='reportModeToggle';wrap.className='report-mode-toggle';
    wrap.innerHTML='<button type="button" id="btnDayReport" class="btn report-mode-btn">일 보고</button><button type="button" id="btnMonthReport" class="btn report-mode-btn">월간 보고</button>';
    bar.insertBefore(wrap,bar.firstChild);
    document.getElementById('btnDayReport').onclick=()=>setReportMode('day',true);
    document.getElementById('btnMonthReport').onclick=()=>setReportMode('month',true);
    monthInput.addEventListener('change',()=>{setReportMode('month',false);if(Array.isArray(rawData)&&rawData.length)compute();});
    dateInput.addEventListener('change',()=>{setReportMode('day',false);if(Array.isArray(rawData)&&rawData.length)compute();});
    const st=document.createElement('style');
    st.textContent=`
      .report-mode-toggle{display:inline-flex;gap:4px;margin-right:6px;padding:3px;background:#eef3f8;border-radius:12px;vertical-align:middle}
      .report-mode-btn{padding:8px 12px!important;background:transparent!important}
      .report-mode-btn.report-mode-active{background:#123a66!important;color:#fff!important}
      .monthly-note{font-size:11px;color:#65758a;font-weight:700}
      #machineBody .monthly-progress{font-weight:900;white-space:nowrap}
    `;
    document.head.appendChild(st);
    syncModeUi();
  }
  function syncModeUi(){
    const d=document.getElementById('btnDayReport'),m=document.getElementById('btnMonthReport');
    if(d)d.classList.toggle('report-mode-active',reportMode==='day');
    if(m)m.classList.toggle('report-mode-active',reportMode==='month');
    if(window.monthInput)monthInput.style.display=reportMode==='month'?'':'none';
    if(window.dateInput)dateInput.style.display=reportMode==='day'?'':'none';
    setDetailVisibility();
  }
  function setReportMode(mode,recompute){
    reportMode=mode==='month'?'month':'day';sessionStorage.setItem(MODE_KEY,reportMode);syncModeUi();
    if(recompute&&Array.isArray(rawData)&&rawData.length)compute();
  }
  window.setReportMode=setReportMode;
  window.getReportMode=()=>reportMode;

  function setDetailVisibility(){
    const title=document.querySelector('.detail-title'),box=title&&title.nextElementSibling;
    const show=reportMode==='day';
    if(title)title.style.display=show?'':'none';if(box)box.style.display=show?'':'none';
  }
  function updateSectionHints(){
    const team=document.querySelector('.team-title .hint'),machine=document.querySelector('.machine-title .hint'),detail=document.querySelector('.detail-title .hint');
    if(team)team.textContent=reportMode==='month'?'월 누적 참여/미참여 및 참여율':'당일 참여/미참여 및 참여율';
    if(machine)machine.textContent=reportMode==='month'?'설비별 월간 누적 1대 1줄':'설비 마스터 기준 당일 현황';
    if(detail)detail.textContent='일 보고에서만 상세 이력 표시';
  }

  function buildDayRows(data){
    const byMachine={};data.forEach(r=>(byMachine[r.machine]??=[]).push(r));
    reportRows=[];
    activeMachines().forEach(m=>{
      const arr=(byMachine[m.machine]||[]).sort((a,b)=>String(a.rowIndex||0).localeCompare(String(b.rowIndex||0))),latest=arr[arr.length-1];
      if(!latest){reportRows.push({...m,status:'missing',records:[],xCount:0,actions:[],duplicate:false,duplicateCount:0});return;}
      const acts=allRecordActions(arr),x=arr.reduce((s,r)=>s+(r.xCount||0),0);
      reportRows.push({...m,...latest,status:'done',records:arr,xCount:x,actions:acts,duplicate:arr.length>1,duplicateCount:Math.max(0,arr.length-1)});
    });
    const mm=masterMap(),unknown={};data.filter(r=>!mm[r.machine]).forEach(r=>(unknown[r.machine]??=[]).push(r));
    Object.entries(unknown).forEach(([machine,arr])=>{const latest=arr[arr.length-1];reportRows.push({active:true,machine,maker:'-',ton:'-',team:'미지정',owner:'-',...latest,status:'unknown',records:arr,xCount:arr.reduce((s,r)=>s+(r.xCount||0),0),actions:allRecordActions(arr),unknown:true,duplicate:arr.length>1,duplicateCount:Math.max(0,arr.length-1)});});
  }

  function buildMonthRows(data,month){
    expectedMondays=mondaysInMonth(month);const expectedSet=new Set(expectedMondays),byMachine={};data.forEach(r=>(byMachine[r.machine]??=[]).push(r));reportRows=[];
    activeMachines().forEach(m=>{
      const arr=(byMachine[m.machine]||[]).sort((a,b)=>String(a.date).localeCompare(String(b.date))),buckets={};
      arr.forEach(r=>{const k=mondayKey(r.date);if(expectedSet.has(k))(buckets[k]??=[]).push(r);});
      const completed=expectedMondays.filter(k=>(buckets[k]||[]).length>0).length;
      const duplicateCount=expectedMondays.reduce((s,k)=>s+Math.max(0,(buckets[k]||[]).length-1),0);
      const missing=Math.max(expectedMondays.length-completed,0),latest=arr[arr.length-1]||{};
      reportRows.push({...m,...latest,machine:m.machine,maker:m.maker,ton:m.ton,team:m.team,owner:m.owner,status:arr.length?'done':'missing',records:arr,xCount:arr.reduce((s,r)=>s+(r.xCount||0),0),actions:allRecordActions(arr),weeklyCompleted:completed,weeklyMissing:missing,expectedWeeks:expectedMondays.length,duplicate:duplicateCount>0,duplicateCount});
    });
    const mm=masterMap(),unknown={};data.filter(r=>!mm[r.machine]).forEach(r=>(unknown[r.machine]??=[]).push(r));
    Object.entries(unknown).forEach(([machine,arr])=>{const latest=arr[arr.length-1]||{};reportRows.push({active:true,machine,maker:'-',ton:'-',team:'미지정',owner:'-',...latest,status:'unknown',records:arr,xCount:arr.reduce((s,r)=>s+(r.xCount||0),0),actions:allRecordActions(arr),unknown:true,weeklyCompleted:0,weeklyMissing:0,expectedWeeks:0,duplicate:false,duplicateCount:0});});
  }

  window.buildRequests=function(){
    requests=[];
    reportRows.filter(r=>r.status==='done'||r.status==='unknown').forEach(group=>{
      (group.records||[]).forEach(rec=>{
        safeActions(rec).filter(a=>a&&a.type==='request').forEach(a=>{
          const id=reqId(rec,a),meta=getAdminMeta(rec,id),status=meta.status||requestStatusLocal(id)||'요청';
          requests.push({id,row:rec,item:a.item,text:a.text||rec.issue,priority:a.priority||'보통',status,action:a,adminMeta:meta});
        });
      });
    });
    requests.sort((a,b)=>String(a.row.date).localeCompare(String(b.row.date))||String(a.row.machine).localeCompare(String(b.row.machine))||Number(a.item)-Number(b.item));
  };

  function reportMetrics(){
    const active=reportRows.filter(r=>!r.unknown),unknown=reportRows.filter(r=>r.unknown).length;
    const ng=active.reduce((s,r)=>s+(r.xCount||0),0),imm=active.reduce((s,r)=>s+allRecordActions(r.records).filter(a=>a.type==='immediate').length,0),req=requests.length,reqDone=requestDoneCount(requests),complete=imm+reqDone;
    if(reportMode==='month'){
      const total=activeMachines().length,plan=total*expectedMondays.length,done=active.reduce((s,r)=>s+(r.weeklyCompleted||0),0),missing=Math.max(plan-done,0),dup=active.reduce((s,r)=>s+(r.duplicateCount||0),0);
      return {mode:'month',total,plan,done,missing,dup,unknown,ng,imm,req,reqDone,complete,doneRate:plan?done/plan*100:0,completeRate:ng?complete/ng*100:0,weeks:expectedMondays.length};
    }
    const total=activeMachines().length,done=active.filter(r=>r.status==='done').length,missing=active.filter(r=>r.status==='missing').length,dup=active.reduce((s,r)=>s+(r.duplicateCount||0),0);
    return {mode:'day',total,plan:total,done,missing,dup,unknown,ng,imm,req,reqDone,complete,doneRate:total?done/total*100:0,completeRate:ng?complete/ng*100:0,weeks:1};
  }
  window.metrics=reportMetrics;

  window.renderKpi=function(){
    const m=reportMetrics();let cards;
    if(reportMode==='month')cards=[['총 설비',m.total+'대',`점검 월요일 ${m.weeks}회`,'kpi-blue'],['계획점검',m.plan+'회','설비 × 주차','kpi-blue'],['완료점검',m.done+'회','이행률 '+m.doneRate.toFixed(1)+'%','kpi-green'],['주차누락',m.missing+'회','미실시 주차','kpi-red'],['미흡',m.ng+'건','월 누적','kpi-red'],['개선요청',m.req+'건','월 누적','kpi-orange'],['조치완료율',m.completeRate.toFixed(1)+'%','즉시개선+완료','kpi-purple'],['중복/미등록',m.dup+'/'+m.unknown,'동일주차 중복 / 마스터','kpi-orange']];
    else cards=[['총 설비',m.total+'대','당일 대상 설비','kpi-blue'],['점검 완료',m.done+'대','완료율 '+m.doneRate.toFixed(1)+'%','kpi-green'],['미점검',m.missing+'대','당일 누락','kpi-red'],['미흡',m.ng+'건','O/X 미흡 항목','kpi-red'],['즉시개선',m.imm+'건','작업자 조치완료','kpi-green'],['개선요청',m.req+'건','전문 조치관리','kpi-orange'],['조치완료율',m.completeRate.toFixed(1)+'%','즉시개선+완료','kpi-purple'],['중복/미등록',m.dup+'/'+m.unknown,'당일 중복 / 마스터','kpi-orange']];
    kpiGrid.innerHTML=cards.map(c=>`<div class="card ${c[3]}"><div class="kname">${c[0]}</div><div class="kval">${c[1]}</div><div class="hint">${c[2]}</div></div>`).join('');
    summaryText.innerHTML=reportMode==='month'
      ?`<span class="eval-line">월간 계획 <span class="eval-info">${m.plan}회</span> 중 <span class="eval-good">${m.done}회 완료</span>, <span class="eval-bad">${m.missing}회 주차누락</span>으로 이행률은 <span class="eval-rate">${m.doneRate.toFixed(1)}%</span>입니다.</span><span class="eval-line">동일 설비·동일 주차 중복등록은 <span class="eval-warn">${m.dup}건</span>, 마스터 미등록 설비는 <span class="eval-bad">${m.unknown}대</span>입니다.</span><span class="eval-line">미흡 <span class="eval-bad">${m.ng}건</span>, 개선요청 <span class="eval-warn">${m.req}건</span>, 요청완료 <span class="eval-good">${m.reqDone}건</span>입니다.</span>`
      :`<span class="eval-line">대상 설비 <span class="eval-info">${m.total}대</span> 중 <span class="eval-good">${m.done}대 점검 완료</span>, <span class="eval-bad">${m.missing}대 미점검</span>입니다.</span><span class="eval-line">미흡 <span class="eval-bad">${m.ng}건</span> 중 <span class="eval-good">즉시개선 ${m.imm}건</span>, <span class="eval-warn">개선요청 ${m.req}건</span>입니다.</span><span class="eval-line">개선요청 완료 <span class="eval-good">${m.reqDone}건</span>, 전체 조치완료율 <span class="eval-rate">${m.completeRate.toFixed(1)}%</span>입니다.</span>`;
  };

  window.renderAlerts=function(){
    const m=reportMetrics();
    const list=reportMode==='month'
      ?[['주차누락',m.missing,'red'],['개선요청',m.req,'orange'],['긴급요청',requests.filter(r=>r.priority==='긴급').length,'red'],['중복등록',m.dup,'orange'],['마스터 미등록',m.unknown,'red']]
      :[['미점검',m.missing,'red'],['개선요청',m.req,'orange'],['긴급요청',requests.filter(r=>r.priority==='긴급').length,'red'],['중복점검',m.dup,'orange'],['마스터 미등록',m.unknown,'red']];
    alerts.innerHTML=list.map(a=>`<span class="badge b-${a[2]}" style="margin:4px">${a[0]} ${a[1]}건</span>`).join('');
  };

  function machineHeader(){
    const body=document.getElementById('machineBody'),tr=body&&body.closest('table')&&body.closest('table').querySelector('thead tr');if(!tr)return;
    tr.innerHTML=reportMode==='month'
      ?'<th>호기</th><th>메이커</th><th>톤수</th><th>팀</th><th>설비담당</th><th>점검실적</th><th>이행률</th><th>미흡</th><th>즉시개선</th><th>개선요청</th><th>월간평가</th>'
      :'<th>호기</th><th>메이커</th><th>톤수</th><th>팀</th><th>설비담당</th><th>점검자</th><th>상태</th><th>미흡</th><th>즉시개선</th><th>개선요청</th><th>등급</th>';
  }
  function monthlyEvaluation(r){
    if(r.unknown)return '<span class="badge b-orange">마스터 미등록</span>';
    if(!r.weeklyCompleted)return '<span class="badge b-red">미점검</span>';
    if(r.weeklyMissing>0)return '<span class="badge b-red">점검누락</span>';
    if(r.xCount>0)return '<span class="badge b-orange">관리필요</span>';
    return '<span class="badge b-green">양호</span>';
  }
  window.renderMachine=function(){
    machineHeader();
    if(reportMode==='month'){
      machineBody.innerHTML=reportRows.map(r=>{const recs=r.records||[],acts=allRecordActions(recs),imm=acts.filter(a=>a.type==='immediate').length,req=acts.filter(a=>a.type==='request').length,rate=r.expectedWeeks?((r.weeklyCompleted||0)/r.expectedWeeks*100):0;return `<tr><td><b>${r.machine}</b></td><td>${r.maker||'-'}</td><td>${r.ton||'-'}</td><td>${r.team||'-'}</td><td>${r.owner||'-'}</td><td class="monthly-progress">${r.unknown?recs.length+'건':`${r.weeklyCompleted||0}/${r.expectedWeeks||0}회`}</td><td>${r.unknown?'-':rate.toFixed(1)+'%'}</td><td>${r.xCount||0}</td><td>${imm}</td><td>${req}</td><td>${monthlyEvaluation(r)}</td></tr>`}).join('');
      return;
    }
    machineBody.innerHTML=reportRows.map(r=>{const inspectors=r.status==='missing'?[]:uniqueInspectors(r.records||[r]),acts=allRecordActions(r.records||[]),imm=acts.filter(a=>a.type==='immediate').length,req=acts.filter(a=>a.type==='request').length,g=r.status==='missing'?'N':r.unknown?'X':!r.xCount?'A':req?'C':'B';return `<tr><td><b>${r.machine}</b></td><td>${r.maker||'-'}</td><td>${r.ton||'-'}</td><td>${r.team||'-'}</td><td>${r.owner||'-'}</td><td class="inspector-list">${inspectors.join('<br>')||'-'}</td><td>${r.status==='missing'?'<span class="badge b-red">미점검</span>':r.unknown?'<span class="badge b-orange">마스터 미등록</span>':'<span class="badge b-green">완료</span>'}</td><td>${r.xCount||0}</td><td>${imm}</td><td>${req}</td><td><b>${g}</b></td></tr>`}).join('');
  };

  function teamHeader(){
    const body=document.getElementById('teamBody'),tr=body&&body.closest('table')&&body.closest('table').querySelector('thead tr');if(!tr)return;
    tr.innerHTML=reportMode==='month'
      ?'<th>팀</th><th>대상설비</th><th>담당자수</th><th>완료점검</th><th>누락점검</th><th>참여자</th><th>미참여자</th><th>참여율</th><th>개선요청</th><th>조치율</th>'
      :'<th>팀</th><th>대상설비</th><th>담당자수</th><th>점검완료</th><th>미점검</th><th>참여자</th><th>미참여자</th><th>참여율</th><th>개선요청</th><th>조치율</th>';
  }
  function renderTeamTotalFallback(){
    const body=document.getElementById('teamBody');if(!body)return;let tr=body.querySelector('.team-total-row');
    const rows=[...body.querySelectorAll('tr')].filter(x=>!x.classList.contains('team-total-row')&&x.children.length>=10);if(!rows.length)return;
    let machines=0,owners=0,done=0,missing=0,participants=0,non=0,req=0,reqDone=0;
    rows.forEach(r=>{const c=r.children;machines+=parseInt(c[1].textContent)||0;owners+=parseInt(c[2].textContent)||0;done+=parseInt(c[3].textContent)||0;missing+=parseInt(c[4].textContent)||0;participants+=parseInt(c[5].textContent)||0;non+=parseInt(c[6].textContent)||0;req+=parseInt(c[8].textContent)||0;const rate=parseFloat(c[9].textContent)||0;reqDone+=Math.round((parseInt(c[8].textContent)||0)*rate/100);});
    const pr=owners?Math.min(100,participants/owners*100).toFixed(1)+'%':'-',cr=req?Math.min(100,reqDone/req*100).toFixed(1)+'%':'100%';
    if(!tr){tr=document.createElement('tr');tr.className='team-total-row';tr.style.cssText='font-weight:900;background:#eaf2fb;border-top:3px solid #123a66';body.appendChild(tr);}
    tr.innerHTML=`<td>합계</td><td>${machines}</td><td>${owners}</td><td>${done}</td><td>${missing}</td><td><b>${participants}명</b></td><td><b>${non}명</b></td><td><b>${pr}</b></td><td>${req}</td><td>${cr}</td>`;
  }
  window.renderTeams=function(){
    teamHeader();const teams={};
    activeMachines().forEach(m=>{const t=m.team||'미지정';(teams[t]??={machines:[],owners:new Set(),participants:new Set(),done:0,missing:0,req:0,reqDone:0}).machines.push(m);if(m.owner)teams[t].owners.add(m.owner);});
    reportRows.filter(r=>!r.unknown).forEach(r=>{const t=r.team||'미지정',o=teams[t]||(teams[t]={machines:[],owners:new Set(),participants:new Set(),done:0,missing:0,req:0,reqDone:0});uniqueInspectors(r.records).forEach(n=>o.participants.add(n));if(reportMode==='month'){o.done+=r.weeklyCompleted||0;o.missing+=r.weeklyMissing||0;}else{o.done+=r.status==='done'?1:0;o.missing+=r.status==='missing'?1:0;}});
    requests.forEach(q=>{const t=teamOfMachine(q.row.machine),o=teams[t]||(teams[t]={machines:[],owners:new Set(),participants:new Set(),done:0,missing:0,req:0,reqDone:0});o.req++;if(String(q.status||getReqStatus(q.id))==='완료')o.reqDone++;});
    teamBody.innerHTML=Object.entries(teams).map(([t,o])=>{const participants=[...o.participants].filter(Boolean),owners=[...o.owners].filter(Boolean),non=owners.filter(n=>!o.participants.has(n)),rate=owners.length?Math.min(100,participants.length/owners.length*100).toFixed(1)+'%':'-',cr=o.req?Math.min(100,o.reqDone/o.req*100).toFixed(1)+'%':'100%';return `<tr><td>${t}</td><td>${o.machines.length}</td><td>${owners.length}</td><td>${o.done}</td><td>${o.missing}</td><td class="left"><b>${participants.length}명</b><br>${participants.join(', ')||'-'}</td><td class="left"><b>${non.length}명</b><br>${non.join(', ')||'-'}</td><td><b>${rate}</b></td><td>${o.req}</td><td>${cr}</td></tr>`}).join('');
    setTimeout(renderTeamTotalFallback,20);
  };

  window.renderDetails=function(){
    setDetailVisibility();if(reportMode==='month'){detailBody.innerHTML='';return;}if(typeof dayRenderDetails==='function')return dayRenderDetails.apply(this,arguments);
  };

  window.compute=function(){
    const mode=reportMode,period=mode==='month'?monthInput.value:dateInput.value;
    headPeriod.textContent=(mode==='month'?'월간 보고 ':'일 보고 ')+(period||'-');headDate.textContent=typeof localToday==='function'?localToday():localDateString(new Date());
    const normalized=(rawData||[]).map(normalizeRow).sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.rowIndex||0)-Number(b.rowIndex||0));
    if(mode==='month'){const data=normalized.filter(r=>r.date.startsWith(monthInput.value));buildMonthRows(data,monthInput.value);}else{expectedMondays=[];const data=normalized.filter(r=>r.date===dateInput.value);buildDayRows(data);}
    buildRequests();updateSectionHints();setDetailVisibility();render();setTimeout(renderTeamTotalFallback,40);
  };

  function installTeamRepairObserver(){
    const body=document.getElementById('teamBody');if(!body||body.dataset.reportRepair==='1')return;body.dataset.reportRepair='1';
    new MutationObserver(()=>setTimeout(renderTeamTotalFallback,0)).observe(body,{childList:true});
  }
  function init(){ensureModeUi();syncModeUi();updateSectionHints();installTeamRepairObserver();machineHeader();teamHeader();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();