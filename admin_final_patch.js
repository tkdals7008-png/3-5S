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
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();

  const oldCompute=window.compute;
  if(typeof oldCompute==='function'){
    window.compute=function(){
      const result=oldCompute.apply(this,arguments);
      reorderReportSections();
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