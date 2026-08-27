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

  function numCell(td){
    const n=parseInt(String(td&&td.textContent||'').replace(/[^0-9-]/g,''),10);
    return Number.isFinite(n)?n:0;
  }

  function addTeamTotalRow(){
    const body=document.getElementById('teamBody');
    if(!body) return;
    const existing=body.querySelector('.team-total-row');
    if(existing) existing.remove();
    const rows=[...body.querySelectorAll('tr')].filter(tr=>tr.children.length>=9&&!tr.classList.contains('team-total-row'));
    if(!rows.length) return;
    let machines=0,owners=0,done=0,missing=0,participants=0,nonParticipants=0,requests=0;
    rows.forEach(tr=>{
      const c=tr.children;
      machines+=numCell(c[1]);
      owners+=numCell(c[2]);
      done+=numCell(c[3]);
      missing+=numCell(c[4]);
      participants+=numCell(c[5]);
      nonParticipants+=numCell(c[6]);
      requests+=numCell(c[7]);
    });
    const rate=requests===0?'100%':'-';
    const tr=document.createElement('tr');
    tr.className='team-total-row';
    tr.style.cssText='font-weight:900;background:#eaf2fb;border-top:3px solid #123a66';
    tr.innerHTML=`<td>합계</td><td>${machines}</td><td>${owners}</td><td>${done}</td><td>${missing}</td><td><b>${participants}명</b></td><td><b>${nonParticipants}명</b></td><td>${requests}</td><td>${rate}</td>`;
    body.appendChild(tr);
  }

  function installTeamObserver(){
    const body=document.getElementById('teamBody');
    if(!body||body.dataset.totalObserver==='1') return;
    body.dataset.totalObserver='1';
    let busy=false;
    const obs=new MutationObserver(()=>{
      if(busy) return;
      busy=true;
      setTimeout(()=>{addTeamTotalRow();busy=false;},0);
    });
    obs.observe(body,{childList:true});
    addTeamTotalRow();
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

  function run(){
    reorderReportSections();
    installTeamObserver();
    setTimeout(addTeamTotalRow,50);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();

  const oldCompute=window.compute;
  if(typeof oldCompute==='function'){
    window.compute=function(){
      const result=oldCompute.apply(this,arguments);
      reorderReportSections();
      installTeamObserver();
      setTimeout(addTeamTotalRow,0);
      return result;
    };
  }

  const reportObserver=new MutationObserver(()=>reorderReportSections());
  function startReportObserver(){
    const report=document.getElementById('reportContent');
    if(report) reportObserver.observe(report,{childList:true,subtree:false});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startReportObserver); else startReportObserver();
})();