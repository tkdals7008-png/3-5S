(function(){
  const style=document.createElement('style');
  style.textContent='.b-gray{background:#eef1f5;border:1px solid #b7c0ca;color:#586675}.na-note{color:#586675;font-weight:800}';
  document.head.appendChild(style);

  function isProductionOnlyName(name){
    return String(name||'').replace(/\s+/g,'').includes('(생산중일시)');
  }

  function snapshotItem(r,itemNo){
    try{
      const raw=r.itemNamesSnapshot;
      const arr=Array.isArray(raw)?raw:JSON.parse(raw||'[]');
      return Array.isArray(arr)?arr.find(x=>Number(x.no)===Number(itemNo)):null;
    }catch(e){return null;}
  }

  function shouldShowNA(r,itemNo){
    const snap=snapshotItem(r,itemNo);
    if(snap&&snap.active===false)return false;
    const name=(snap&&snap.name)||itemNames[itemNo-1]||'';
    return isProductionOnlyName(name);
  }

  window.normalizeRow=function(r,i){
    let items=Array.from({length:10},(_,k)=>r['item'+(k+1)]||(r.items&&r.items[k])||'O');
    let actions=parseActions(r);
    let xItems=items.map((v,k)=>v==='X'?k+1:null).filter(Boolean);
    let naItems=items.map((v,k)=>v==='N/A'?k+1:null).filter(Boolean);
    let applicableCount=items.filter(v=>v!=='N/A'&&v!=='').length;
    let goodCount=items.filter(v=>v==='O').length;
    let score=applicableCount?Math.round((goodCount/applicableCount)*100)+'점':'-';
    return {...r,date:(r.date||r.inspectDate||todayStr).toString().slice(0,10),machine:r.machine||r.machineId||'',inspector:r.inspector||r.inspectorName||'',items,xItems:xItems.join(','),naItems:naItems.join(','),naCount:naItems.length,applicableCount,xCount:xItems.length,score,issue:r.issue||r.issueRemarks||'',actions,photos:r.photos||[],rowIndex:r.rowIndex||i+2};
  };

  window.renderDetails=function(){
    let lines=[];
    reportRows.filter(r=>r.status==='done'||r.status==='unknown').forEach(r=>{
      let added=false;
      if((r.actions||[]).length){r.actions.forEach(a=>{lines.push({r,a});added=true;});}
      else if(r.xCount){(r.xItems.toString().match(/\d+/g)||[]).forEach(n=>{lines.push({r,a:{item:Number(n),type:'unknown',text:r.issue||'',priority:'',photos:{}}});added=true;});}
      const nas=(r.naItems||'').toString().match(/\d+/g)||[];
      nas.filter(n=>shouldShowNA(r,Number(n))).forEach(n=>{lines.push({r,a:{item:Number(n),type:'na',text:'해당없음',priority:'',photos:{}}});added=true;});
      if(!added)lines.push({r,a:null});
    });
    detailBody.innerHTML=lines.map((o,i)=>{
      let r=o.r,a=o.a;
      let type=!a?'양호':a.type==='immediate'?'즉시개선':a.type==='request'?'개선요청':a.type==='na'?'해당없음':'불량';
      let status=!a?'양호':a.type==='immediate'?'조치완료':a.type==='request'?getReqStatus(reqId(r,a)):a.type==='na'?'해당없음':'확인필요';
      let cls=status==='조치완료'||status==='완료'||status==='양호'?'b-green':status==='진행중'?'b-blue':status==='해당없음'?'b-gray':'b-orange';
      let typeCls=a&&a.type==='request'?'b-orange':a&&a.type==='immediate'?'b-green':a&&a.type==='na'?'b-gray':'b-blue';
      return `<tr><td>${i+1}</td><td>${r.date}</td><td>${r.machine}</td><td>${r.inspector||'-'}</td><td>${a?`${a.item}. ${(snapshotItem(r,a.item)&&snapshotItem(r,a.item).name)||itemNames[a.item-1]||''}`:'-'}</td><td><span class="badge ${typeCls}">${type}</span></td><td class="left action-note">${a&&a.type==='na'?'<span class="na-note">해당없음</span>':a&&a.text?a.text:(r.issue||'-')}</td><td>${a&&a.priority?a.priority:'-'}</td><td>${a&&a.type==='na'?'-':actionPhotos(a,r.photos)}</td><td><span class="badge ${cls}">${status}</span></td></tr>`;
    }).join('');
  };

  if(Array.isArray(window.rawData)&&window.rawData.length&&typeof window.compute==='function')window.compute();
})();