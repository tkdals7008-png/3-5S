(function(){
  function reorderReportSections(){
    const report=document.getElementById('reportContent');
    if(!report) return;
    const findBox=cls=>{const title=report.querySelector('.sectionTitle.'+cls);return title&&title.closest('.box');};
    const evaluation=report.querySelector('.evaluation-panel');
    const team=findBox('team-title');
    const machine=findBox('machine-title');
    const request=findBox('request-title');
    const detail=findBox('detail-title');
    const ordered=[evaluation,team,machine,request,detail].filter(Boolean);
    if(ordered.length<5) return;
    ordered.forEach(el=>report.appendChild(el));
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

  const run=()=>{reorderReportSections();};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  const oldCompute=window.compute;
  if(typeof oldCompute==='function') window.compute=function(){const r=oldCompute.apply(this,arguments);reorderReportSections();return r;};
})();