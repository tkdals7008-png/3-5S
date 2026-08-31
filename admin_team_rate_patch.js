(function(){
  function ensureHeader(){
    const body=document.getElementById('teamBody');
    const table=body&&body.closest('table');
    const tr=table&&table.querySelector('thead tr');
    if(!tr)return;
    tr.innerHTML='<th>팀</th><th>대상설비</th><th>담당자수</th><th>점검완료</th><th>미점검</th><th>참여자</th><th>미참여자</th><th>참여율</th><th>개선요청</th><th>조치율</th>';
  }
  window.renderTeams=function(){
    ensureHeader();
    let teams={};
    activeMachines().forEach(m=>{let t=m.team||'미지정';(teams[t]??={machines:[],owners:new Set(),participants:new Set(),req:0}).machines.push(m);if(m.owner)teams[t].owners.add(m.owner)});
    reportRows.forEach(r=>{let t=r.team||'미지정';if(!teams[t])teams[t]={machines:[],owners:new Set(),participants:new Set(),req:0};if(r.status==='done'||r.status==='unknown')(r.records||[r]).forEach(rec=>splitInspectors(rec.inspector).forEach(n=>teams[t].participants.add(n)));teams[t].req+=(r.actions||[]).filter(a=>a.type==='request').length;});
    teamBody.innerHTML=Object.entries(teams).map(([t,o])=>{let participants=[...o.participants].filter(Boolean),owners=[...o.owners].filter(Boolean),non=owners.filter(n=>!o.participants.has(n)),doneMachines=reportRows.filter(r=>(r.team||'미지정')===t&&r.status==='done').length,rate=owners.length?Math.min(100,participants.length/owners.length*100).toFixed(1)+'%':'-';return `<tr><td>${t}</td><td>${o.machines.length}</td><td>${owners.length}</td><td>${doneMachines}</td><td>${Math.max(o.machines.length-doneMachines,0)}</td><td class="left"><b>${participants.length}명</b><br>${participants.join(', ')||'-'}</td><td class="left"><b>${non.length}명</b><br>${non.join(', ')||'-'}</td><td><b>${rate}</b></td><td>${o.req}</td><td>${o.req?'-':'100%'}</td></tr>`}).join('');
  };
  const oldCompute=window.compute;
  if(typeof oldCompute==='function')window.compute=function(){const r=oldCompute.apply(this,arguments);ensureHeader();return r;};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureHeader);else ensureHeader();
})();