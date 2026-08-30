(function(){
  function localToday(){
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  }
  function localMonth(){return localToday().slice(0,7);}
  function fixAdminDate(){
    const today=localToday();
    const dateInputs=[...document.querySelectorAll('input[type="date"]')].filter(el=>!el.closest('.modal'));
    if(dateInputs[0] && (!dateInputs[0].value || dateInputs[0].value!==today)) dateInputs[0].value=today;
    const monthInputs=[...document.querySelectorAll('input[type="month"]')].filter(el=>!el.closest('.modal'));
    if(monthInputs[0] && !monthInputs[0].value) monthInputs[0].value=localMonth();
    const hd=document.getElementById('headDate');
    if(hd) hd.textContent=today;
  }
  function moveSampleButton(){
    const btn=[...document.querySelectorAll('button')].find(b=>/교육.*샘플|샘플.*교육/.test((b.textContent||'').replace(/\s+/g,'')));
    const title=[...document.querySelectorAll('h1,h2,h3')].find(h=>(h.textContent||'').trim()==='운영관리');
    if(!btn||!title) return;
    const modal=title.closest('.modalInner')||title.parentElement;
    if(!modal || btn.closest('.ops-sample-slot')) return;
    let slot=modal.querySelector('.ops-sample-slot');
    if(!slot){
      slot=document.createElement('div');
      slot.className='ops-sample-slot';
      slot.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid #d9e2ef';
      const label=document.createElement('div');
      label.textContent='교육/테스트';
      label.style.cssText='font-weight:900;margin-bottom:8px;color:#65758a';
      slot.appendChild(label);
      modal.appendChild(slot);
    }
    slot.appendChild(btn);
  }
  function run(){fixAdminDate();moveSampleButton();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  setTimeout(run,80);setTimeout(run,400);
  const oldCompute=window.compute;
  if(typeof oldCompute==='function')window.compute=function(){const r=oldCompute.apply(this,arguments);setTimeout(fixAdminDate,0);return r;};
})();