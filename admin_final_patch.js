(function(){
  function reorderReportSections(){
    const report=document.getElementById('reportContent');
    if(!report) return;

    const teamTitle=report.querySelector('.team-title');
    const machineTitle=report.querySelector('.machine-title');
    if(!teamTitle||!machineTitle) return;

    const teamBox=teamTitle.nextElementSibling;
    const machineBox=machineTitle.nextElementSibling;
    if(!teamBox||!machineBox) return;

    const teamH2=teamTitle.querySelector('h2');
    const machineH2=machineTitle.querySelector('h2');
    if(teamH2) teamH2.textContent='2. 팀별 현황';
    if(machineH2) machineH2.textContent='3. 설비별 현황';

    if(machineTitle.compareDocumentPosition(teamTitle)&Node.DOCUMENT_POSITION_FOLLOWING){
      report.insertBefore(teamTitle,machineTitle);
      report.insertBefore(teamBox,machineTitle);
    }
  }

  function installTeamTotal(){
    if(typeof window.renderTeams!=='function'||typeof window.activeMachines!=='function'||typeof window.splitInspectors!=='function') return;

    window.renderTeams=function(){
      let teams={};
      activeMachines().forEach(m=>{
        let t=m.team||'미지정';
        (teams[t]??={machines:[],owners:new Set(),participants:new Set(),req:0}).machines.push(m);
        if(m.owner) teams[t].owners.add(m.owner);
      });

      reportRows.forEach(r=>{
        let t=r.team||'미지정';
        if(!teams[t]) teams[t]={machines:[],owners:new Set(),participants:new Set(),req:0};
        if(r.status==='done'||r.status==='unknown'){
          (r.records||[r]).forEach(rec=>splitInspectors(rec.inspector).forEach(n=>teams[t].participants.add(n)));
        }
        teams[t].req+=(r.actions||[]).filter(a=>a.type==='request').length;
      });

      let totalMachines=0,totalOwners=0,totalDone=0,totalMissing=0,totalReq=0;
      const allParticipants=new Set(),allNonParticipants=new Set();

      let rows=Object.entries(teams).map(([t,o])=>{
        let participants=[...o.participants].filter(Boolean);
        let owners=[...o.owners].filter(Boolean);
        let non=owners.filter(n=>!o.participants.has(n));
        let doneMachines=reportRows.filter(r=>(r.team||'미지정')===t&&r.status==='done').length;
        let missing=Math.max(o.machines.length-doneMachines,0);

        totalMachines+=o.machines.length;
        totalOwners+=owners.length;
        totalDone+=doneMachines;
        totalMissing+=missing;
        totalReq+=o.req;
        participants.forEach(n=>allParticipants.add(n));
        non.forEach(n=>allNonParticipants.add(n));

        return `<tr><td>${t}</td><td>${o.machines.length}</td><td>${owners.length}</td><td>${doneMachines}</td><td>${missing}</td><td class="left"><b>${participants.length}명</b><br>${participants.join(', ')||'-'}</td><td class="left"><b>${non.length}명</b><br>${non.join(', ')||'-'}</td><td>${o.req}</td><td>${o.req?'-':'100%'}</td></tr>`;
      }).join('');

      const totalRate=totalReq?'-':'100%';
      rows+=`<tr class="team-total-row" style="font-weight:900;background:#eaf2fb;border-top:3px solid #123a66"><td>합계</td><td>${totalMachines}</td><td>${totalOwners}</td><td>${totalDone}</td><td>${totalMissing}</td><td class="left"><b>${allParticipants.size}명</b><br>${[...allParticipants].join(', ')||'-'}</td><td class="left"><b>${allNonParticipants.size}명</b><br>${[...allNonParticipants].join(', ')||'-'}</td><td>${totalReq}</td><td>${totalRate}</td></tr>`;
      teamBody.innerHTML=rows;
    };
  }

  function loadScript(src,test){
    return new Promise((resolve,reject)=>{
      if(test()) return resolve();
      const s=document.createElement('script');
      s.src=src;
      s.async=true;
      s.onload=()=>test()?resolve():reject(new Error('라이브러리 초기화 실패'));
      s.onerror=()=>reject(new Error('라이브러리 다운로드 실패'));
      document.head.appendChild(s);
    });
  }

  window.ensureReportLibraries=async function(){
    const jobs=[];
    if(!window.html2canvas) jobs.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>!!window.html2canvas));
    if(!window.jspdf||!window.jspdf.jsPDF){
      jobs.push(loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!(window.jspdf&&window.jspdf.jsPDF))
        .catch(()=>loadScript('https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!(window.jspdf&&window.jspdf.jsPDF))));
    }
    await Promise.all(jobs);
  };

  const run=()=>{installTeamTotal();reorderReportSections();};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();

  const oldCompute=window.compute;
  if(typeof oldCompute==='function'){
    window.compute=function(){
      installTeamTotal();
      const result=oldCompute.apply(this,arguments);
      reorderReportSections();
      return result;
    };
  }

  const observer=new MutationObserver(()=>reorderReportSections());
  const startObserver=()=>{
    const report=document.getElementById('reportContent');
    if(report) observer.observe(report,{childList:true,subtree:false});
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startObserver); else startObserver();
})();