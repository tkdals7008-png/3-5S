(function(){
  function csvCell(v){
    const s=String(v ?? '').replace(/\r?\n/g,' ');
    return '"'+s.replace(/"/g,'""')+'"';
  }

  // Excel에서 더블클릭 시 바로 열리고 열 구분이 유지되도록 sep=, 지시자를 포함한 UTF-8 CSV 생성
  window.downloadExcelCsv=function(filename,headers,rows){
    const lines=['sep=,',headers.map(csvCell).join(',')]
      .concat(rows.map(r=>r.map(csvCell).join(',')));
    const text='\ufeff'+lines.join('\r\n');
    const blob=new Blob([text],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  };

  window.downloadMachineTemplate=function(){
    if(typeof collectSettings==='function') collectSettings();
    downloadExcelCsv('MyMachine_설비마스터_Excel용.csv',
      ['사용','호기','메이커','톤수','담당팀','담당자'],
      (settings.machines||[]).map(m=>[m.active!==false?'Y':'N',m.machine||'',m.maker||'',m.ton||'',m.team||'',m.owner||''])
    );
  };

  window.downloadMailTemplate=function(){
    if(typeof collectSettings==='function') collectSettings();
    downloadExcelCsv('MyMachine_메일설정_Excel용.csv',
      ['사용','이름','메일주소'],
      (settings.mails||[]).map(m=>[m.active!==false?'Y':'N',m.name||'',m.email||''])
    );
  };

  window.parseDelimited=function(t){
    t=(t||'').replace(/^\ufeff/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    let lines=t.split('\n').filter(l=>l.trim()!=='');
    if(lines[0] && /^sep=./i.test(lines[0].trim())) lines=lines.slice(1);
    if(!lines.length) return [];
    const first=lines[0];
    const counts={tab:(first.match(/\t/g)||[]).length,comma:(first.match(/,/g)||[]).length,semi:(first.match(/;/g)||[]).length};
    let delimiter='\t';
    if(counts.comma>counts.tab && counts.comma>=counts.semi) delimiter=',';
    else if(counts.semi>counts.tab && counts.semi>counts.comma) delimiter=';';
    if(delimiter==='\t') return lines.map(l=>l.split('\t'));
    return lines.map(line=>{
      const out=[]; let cur='',q=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(ch==='"'){
          if(q && line[i+1]==='"'){cur+='"';i++;}
          else q=!q;
        }else if(ch===delimiter && !q){out.push(cur);cur='';}
        else cur+=ch;
      }
      out.push(cur); return out;
    });
  };

  document.querySelectorAll('#machineSection input[type=file],#mailSection input[type=file]').forEach(el=>{
    el.setAttribute('accept','.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain');
  });
})();
