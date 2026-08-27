(function(){
  function ensureXlsx(){
    if(typeof XLSX==='undefined') throw new Error('Excel 모듈을 불러오지 못했습니다. 인터넷 연결 후 새로고침 해주세요.');
  }

  function aoaToXlsx(filename, sheetName, rows, widths){
    ensureXlsx();
    const ws=XLSX.utils.aoa_to_sheet(rows);
    if(Array.isArray(widths)) ws['!cols']=widths.map(w=>({wch:w}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,sheetName);
    XLSX.writeFile(wb,filename,{bookType:'xlsx',compression:true});
  }

  window.downloadMachineTemplate=function(){
    if(typeof collectSettings==='function') collectSettings();
    const rows=[['사용','호기','메이커','톤수','담당팀','담당자']];
    (settings.machines||[]).forEach(m=>rows.push([
      m.active!==false?'Y':'N',m.machine||'',m.maker||'',m.ton||'',m.team||'',m.owner||''
    ]));
    aoaToXlsx('MyMachine_설비마스터.xlsx','설비마스터',rows,[8,18,16,12,18,16]);
  };

  window.downloadMailTemplate=function(){
    if(typeof collectSettings==='function') collectSettings();
    const rows=[['사용','이름','메일주소']];
    (settings.mails||[]).forEach(m=>rows.push([
      m.active!==false?'Y':'N',m.name||'',m.email||''
    ]));
    aoaToXlsx('MyMachine_메일수신자.xlsx','메일수신자',rows,[8,18,36]);
  };

  function decodeTextBuffer(buf){
    try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){}
    try{return new TextDecoder('euc-kr').decode(buf)}catch(e){}
    return new TextDecoder().decode(buf);
  }

  function parseDelimitedText(t){
    t=(t||'').replace(/^\ufeff/,'').replace(/^sep=.[\r\n]+/i,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const lines=t.split('\n').filter(l=>l.trim()!=='');
    if(!lines.length)return [];
    const first=lines[0];
    const c={tab:(first.match(/\t/g)||[]).length,comma:(first.match(/,/g)||[]).length,semi:(first.match(/;/g)||[]).length};
    let d='\t';
    if(c.comma>c.tab&&c.comma>=c.semi)d=',';
    else if(c.semi>c.tab&&c.semi>c.comma)d=';';
    if(d==='\t')return lines.map(x=>x.split('\t'));
    return lines.map(line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(ch===d&&!q){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;});
  }

  function readRows(file, callback){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    const r=new FileReader();
    r.onload=()=>{
      try{
        if(ext==='xlsx'||ext==='xls'){
          ensureXlsx();
          const wb=XLSX.read(r.result,{type:'array',cellDates:false});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
          callback(rows);
        }else{
          callback(parseDelimitedText(decodeTextBuffer(r.result)));
        }
      }catch(err){alert('파일 읽기 오류: '+err.message);}
    };
    r.readAsArrayBuffer(file);
  }

  window.uploadMachineTemplate=function(input){
    const f=input.files&&input.files[0];if(!f)return;
    readRows(f,rows=>{
      try{
        const body=rows.slice(1).filter(r=>r.some(v=>String(v||'').trim()!==''));
        const machines=body.map(x=>({
          active:String(x[0]||'Y').trim().toUpperCase()!=='N',
          machine:String(x[1]||'').trim(), maker:String(x[2]||'').trim(),
          ton:String(x[3]||'').trim(), team:String(x[4]||'').trim(), owner:String(x[5]||'').trim()
        })).filter(x=>x.machine);
        if(!machines.length)throw new Error('등록 가능한 설비가 없습니다. B열 호기를 확인하세요.');
        settings.machines=machines;
        localStorage.setItem('mymachine_v3_settings',JSON.stringify(settings));
        if(typeof renderSettings==='function')renderSettings();
        if(typeof compute==='function')compute();
        alert('설비 마스터 '+machines.length+'대가 업로드되었습니다. 설정 저장을 눌러 서버에 저장해 주세요.');
      }catch(err){alert('설비 마스터 업로드 오류: '+err.message);}finally{input.value='';}
    });
  };

  window.uploadMailTemplate=function(input){
    const f=input.files&&input.files[0];if(!f)return;
    readRows(f,rows=>{
      try{
        const body=rows.slice(1).filter(r=>r.some(v=>String(v||'').trim()!==''));
        const mails=body.map(x=>({
          active:String(x[0]||'Y').trim().toUpperCase()!=='N',
          name:String(x[1]||'').trim(), email:String(x[2]||'').trim()
        })).filter(x=>x.email);
        if(!mails.length)throw new Error('등록 가능한 메일주소가 없습니다. C열 메일주소를 확인하세요.');
        settings.mails=mails;
        localStorage.setItem('mymachine_v3_settings',JSON.stringify(settings));
        if(typeof renderSettings==='function')renderSettings();
        alert('메일 수신자 '+mails.length+'명이 업로드되었습니다. 설정 저장을 눌러 서버에 저장해 주세요.');
      }catch(err){alert('메일 수신자 업로드 오류: '+err.message);}finally{input.value='';}
    });
  };

  document.querySelectorAll('#machineSection input[type=file],#mailSection input[type=file]').forEach(el=>{
    el.setAttribute('accept','.xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain');
  });
})();
