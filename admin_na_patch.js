(function(){
  const style=document.createElement('style');
  style.textContent=`
    .b-gray{background:#eef1f5;border:1px solid #b7c0ca;color:#586675}
    .na-note{color:#586675;font-weight:800}
    #detailBody td:nth-child(2),
    #detailBody td:nth-child(3),
    #detailBody td:nth-child(4),
    #detailBody td:nth-child(6),
    #detailBody td:nth-child(8),
    #detailBody td:nth-child(10){white-space:nowrap;word-break:keep-all}
    #detailBody td:nth-child(5){text-align:left!important;min-width:320px}
    #detailBody td:nth-child(2){min-width:92px}
    #detailBody td:nth-child(3){min-width:72px}
    #detailBody td:nth-child(4){min-width:72px}
    #detailBody td:nth-child(6){min-width:82px}
    #detailBody td:nth-child(8){min-width:70px}
    #detailBody td:nth-child(10){min-width:82px}
  `;
  document.head.appendChild(style);

  function snapshotItem(r,itemNo){
    try{const raw=r.itemNamesSnapshot;const arr=Array.isArray(raw)?raw:JSON.parse(raw||'[]');return Array.isArray(arr)?arr.find(x=>Number(x.no)===Number(itemNo)):null;}catch(e){return null;}
  }
  function photoUrls(rowPhotos){
    if(Array.isArray(rowPhotos))return rowPhotos.map(x=>typeof x==='string'?x:(x&&x.url)||'').filter(Boolean);
    return String(rowPhotos||'').split(',').map(x=>x.trim()).filter(Boolean);
  }
  function hasMappedPhotos(a){
    return !!(a&&a.photos&&typeof a.photos==='object'&&Object.keys(a.photos).some(k=>{
      const p=a.photos[k];return !!(p&&((typeof p==='string'&&p)||p.url||p.preview||p.base64));
    }));
  }
  function hydrateLegacyPhotos(r){
    const actions=(r.actions||[]).filter(a=>a&&a.type!=='na');
    if(!actions.length||actions.some(hasMappedPhotos))return;
    const urls=photoUrls(r.photos);
    if(!urls.length)return;
    const expected=actions.reduce((n,a)=>n+(a.type==='immediate'?2:a.type==='request'?1:0),0);
    if(expected!==urls.length)return;
    let pos=0;
    actions.forEach(a=>{
      const p={};
      if(a.type==='immediate'){
        p.immBefore={url:urls[pos++]};
        p.immAfter={url:urls[pos++]};
      }else if(a.type==='request'){
        p.reqBefore={url:urls[pos++]};
      }
      a.photos=p;
    });
  }

  window.normalizeRow=function(r,i){
    let items=Array.from({length:10},(_,k)=>r['item'+(k+1)]||(r.items&&r.items[k])||'O');
    let actions=parseActions(r);
    let xItems=items.map((v,k)=>v==='X'?k+1:null).filter(Boolean);
    let naItems=items.map((v,k)=>v==='N/A'?k+1:null).filter(Boolean);
    let applicableCount=items.filter(v=>v!=='N/A'&&v!=='').length;
    let goodCount=items.filter(v=>v==='O').length;
    let score=applicableCount?Math.round((goodCount/applicableCount)*100)+'점':'-';
    const out={...r,date:(r.date||r.inspectDate||todayStr).toString().slice(0,10),machine:r.machine||r.machineId||'',inspector:r.inspector||r.inspectorName||'',items,xItems:xItems.join(','),naItems:naItems.join(','),naCount:naItems.length,applicableCount,xCount:xItems.length,score,issue:r.issue||r.issueRemarks||'',actions,photos:r.photos||[],rowIndex:r.rowIndex||i+2};
    hydrateLegacyPhotos(out);
    return out;
  };

  window.renderDetails=function(){
    let lines=[];
    reportRows.filter(r=>r.status==='done'||r.status==='unknown').forEach(r=>{
      hydrateLegacyPhotos(r);
      let added=false;
      if((r.actions||[]).length){
        r.actions.filter(a=>a&&a.type!=='na').forEach(a=>{lines.push({r,a});added=true;});
      }
      if(!added&&r.xCount){
        (r.xItems.toString().match(/\d+/g)||[]).forEach(n=>{lines.push({r,a:{item:Number(n),type:'unknown',text:r.issue||'',priority:'',photos:{}}});added=true;});
      }
      if(!added)lines.push({r,a:null});
    });
    detailBody.innerHTML=lines.map((o,i)=>{
      let r=o.r,a=o.a;
      let type=!a?'양호':a.type==='immediate'?'즉시개선':a.type==='request'?'개선요청':'불량';
      let status=!a?'양호':a.type==='immediate'?'조치완료':a.type==='request'?getReqStatus(reqId(r,a)):'확인필요';
      let cls=status==='조치완료'||status==='완료'||status==='양호'?'b-green':status==='진행중'?'b-blue':'b-orange';
      let typeCls=a&&a.type==='request'?'b-orange':a&&a.type==='immediate'?'b-green':'b-blue';
      return `<tr><td>${i+1}</td><td>${r.date}</td><td>${r.machine}</td><td>${r.inspector||'-'}</td><td>${a?`${a.item}. ${(snapshotItem(r,a.item)&&snapshotItem(r,a.item).name)||itemNames[a.item-1]||''}`:'-'}</td><td><span class="badge ${typeCls}">${type}</span></td><td class="left action-note">${a&&a.text?a.text:(r.issue||'-')}</td><td>${a&&a.priority?a.priority:'-'}</td><td>${actionPhotos(a,r.photos)}</td><td><span class="badge ${cls}">${status}</span></td></tr>`;
    }).join('');
  };

  if(Array.isArray(window.rawData)&&window.rawData.length&&typeof window.compute==='function')window.compute();
})();