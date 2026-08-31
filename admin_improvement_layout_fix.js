(function(){
  const style=document.createElement('style');
  style.textContent=`
    #requestBody{font-size:13px}
    #requestBody td{min-width:0!important;box-sizing:border-box;vertical-align:middle}
    #requestBody td:nth-child(1){width:9%;line-height:1.3;padding-left:6px;padding-right:6px}
    #requestBody td:nth-child(2){width:7.5%;white-space:nowrap}
    #requestBody td:nth-child(3){width:5%;white-space:nowrap}
    #requestBody td:nth-child(4){width:20%;text-align:left!important;word-break:keep-all;overflow-wrap:anywhere}
    #requestBody td:nth-child(5){width:6%;white-space:nowrap}
    #requestBody td:nth-child(6){width:5.5%;white-space:nowrap}
    #requestBody td:nth-child(7){width:14%;text-align:left!important;word-break:keep-all;overflow-wrap:anywhere}
    #requestBody td:nth-child(8),#requestBody td:nth-child(9){width:8%}
    #requestBody td:nth-child(10){width:6%;white-space:nowrap}
    #requestBody td:nth-child(11){width:11%;white-space:nowrap;padding-left:5px;padding-right:5px}
    #requestBody .req-id{font-size:11px;line-height:1.25}
    #requestBody .photos img{width:72px!important;height:54px!important}
    #requestBody td:nth-child(11) .btn{padding:8px 10px!important;font-size:12px!important;min-width:0!important;margin:1px!important}
    #requestBody+*{}
    #requestBody{width:100%}
    #requestBody tr{width:100%}
    #requestBody.closest-table{}
    #requestBody td:nth-child(8) .compare-label,#requestBody td:nth-child(9) .compare-label{font-size:10px;margin-bottom:2px}
  `;
  document.head.appendChild(style);

  function fitTable(){
    const body=document.getElementById('requestBody');
    const table=body&&body.closest('table');
    if(!table)return;
    table.style.width='100%';
    table.style.maxWidth='100%';
    table.style.tableLayout='fixed';
    table.style.minWidth='0';
    const widths=['9%','7.5%','5%','20%','6%','5.5%','14%','8%','8%','6%','11%'];
    const hs=table.querySelectorAll('thead th');
    hs.forEach((th,i)=>{if(widths[i])th.style.width=widths[i];th.style.minWidth='0';th.style.whiteSpace='nowrap';});
    body.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='완료사진 변경')b.textContent='사진변경';});
  }

  const obs=new MutationObserver(fitTable);
  const start=()=>{
    fitTable();
    const body=document.getElementById('requestBody');
    if(body)obs.observe(body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('resize',fitTable);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();