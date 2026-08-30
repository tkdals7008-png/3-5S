(function(){
  function isProductionOnly(name){return String(name||'').replace(/\s+/g,'').includes('(생산중일시)');}
  function localToday(){const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
  const style=document.createElement('style');
  style.textContent='.choice.three{grid-template-columns:repeat(3,1fr)}.na.sel{background:#eef1f5!important;border-color:#9aa8b8!important}.item.na-state{background:#f5f7fa;border-color:#aab6c4}.badge.na-badge{background:#eef1f5;color:#59697a}';
  document.head.appendChild(style);

  window.render=function(){
    items.innerHTML=active().map(x=>{
      let n=x.no,hasNA=(n===7)||isProductionOnly(x.name);
      const na=hasNA?`<label class="na" id="na${n}"><input type="radio" name="item${n}" value="N/A" onchange="setItem(${n},'N/A')">➖ 해당없음</label>`:'';
      return `<div class="item" id="card${n}"><div class="top"><div>${n}. ${x.name}</div><span class="badge" id="state${n}">미선택</span></div><div class="choice ${hasNA?'three':''}"><label class="good" id="ok${n}"><input type="radio" name="item${n}" value="O" onchange="setItem(${n},'O')">✅ 양호</label><label class="bad" id="ng${n}"><input type="radio" name="item${n}" value="X" onchange="setItem(${n},'X')">⚠ 불량</label>${na}</div><div class="actbox" id="actbox${n}"><b>불량 처리 구분</b><div class="acts"><label class="imm" id="imm${n}"><input type="radio" name="act${n}" value="immediate" onchange="setAct(${n},'immediate')">즉시개선<br><span class="hint">작업자 조치완료</span></label><label class="req" id="req${n}"><input type="radio" name="act${n}" value="request" onchange="setAct(${n},'request')">개선요청<br><span class="hint">전문인력 조치</span></label></div><div id="immbox${n}" style="display:none"><label>즉시개선 내용</label><textarea id="immtxt${n}" rows="2"></textarea><div class="photos"><div><label>개선 전 사진</label>${pbtn(n,'immBefore')}</div><div><label>개선 후 사진</label>${pbtn(n,'immAfter')}</div></div></div><div id="reqbox${n}" style="display:none"><label>개선 요청 내용</label><textarea id="reqtxt${n}" rows="2"></textarea><label>우선순위</label><select id="priority${n}"><option>보통</option><option>긴급</option><option>낮음</option></select><label>불량 사진</label>${pbtn(n,'reqBefore')}</div></div></div>`;
    }).join('');
  };

  window.setItem=function(n,v){
    const card=document.getElementById('card'+n),ok=document.getElementById('ok'+n),ng=document.getElementById('ng'+n),na=document.getElementById('na'+n),state=document.getElementById('state'+n),act=document.getElementById('actbox'+n);
    if(!card||!ok||!ng||!state||!act)return;
    card.classList.remove('ok','ng','na-state');
    ok.classList.toggle('sel',v==='O');
    ng.classList.toggle('sel',v==='X');
    if(na)na.classList.toggle('sel',v==='N/A');
    if(v==='O')card.classList.add('ok'); else if(v==='X')card.classList.add('ng'); else if(v==='N/A')card.classList.add('na-state');
    state.classList.toggle('na-badge',v==='N/A');
    state.textContent=v==='O'?'양호':v==='X'?'불량':'해당없음';
    act.style.display=v==='X'?'block':'none';
  };

  const dateEl=document.getElementById('inspectDate');
  if(dateEl) dateEl.value=localToday();
  render();
})();