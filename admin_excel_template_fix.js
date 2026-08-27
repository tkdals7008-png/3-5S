(function(){
  function safeCell(v){
    return String(v ?? '').replace(/\t/g,' ').replace(/\r?\n/g,' ');
  }

  window.downloadExcelTsv=function(filename,headers,rows){
    const text='\ufeff'+headers.map(safeCell).join('\t')+'\r\n'+rows.map(r=>r.map(safeCell).join('\t')).join('\r\n');
    const blob=new Blob([text],{type:'text/tab-separated-values;charset=utf-8;'});
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
    downloadExcelTsv('MyMachine_설비마스터_Excel용.tsv',
      ['사용','호기','메이커','톤수','담당팀','담당자'],
      (settings.machines||[]).map(m=>[m.active!==false?'Y':'N',m.machine||'',m.maker||'',m.ton||'',m.team||'',m.owner||''])
    );
  };

  window.downloadMailTemplate=function(){
    if(typeof collectSettings==='function') collectSettings();
    downloadExcelTsv('MyMachine_메일설정_Excel용.tsv',
      ['사용','이름','메일주소'],
      (settings.mails||[]).map(m=>[m.active!==false?'Y':'N',m.name||'',m.email||''])
    );
  };

  window.parseDelimited=function(t){
    t=(t||'').replace(/^\ufeff/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const lines=t.split('\n').filter(l=>l.trim()!=='');
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
    el.setAttribute('accept','.tsv,.csv,.txt,text/tab-separated-values,text/csv,text/plain');
  });
})();
