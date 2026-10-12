const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let recipients;
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/AutoMail.gs','utf8'),ctx);
ctx.sendAutoMailBatched_=(r)=>{recipients=Array.from(r)};
const missing={name:'작업자',team:'A팀',email:'worker@example.test',registered:false};
const admin={name:'고상민',team:'B팀',email:'admin@example.test',registered:true};
const st={total:2,done:1,missing:[missing],targets:[missing,admin],mails:[
  {...missing,role:'팀원'}, {...admin,role:'관리자'},
  {name:'A팀장',team:'A팀',email:'leader@example.test',role:'팀장'},
  {name:'B팀장',team:'B팀',email:'other-leader@example.test',role:'팀장'},
  {name:'임원',email:'executive@example.test',role:'임원'},
  {name:'완료 작업자',email:'done@example.test',role:'팀원'},
  {name:'관리자 중복',email:'admin@example.test',role:'관리자'}
]};
assert.equal(ctx.sendMissingAlert_(st),4);
assert.deepEqual(recipients,['worker@example.test','admin@example.test','leader@example.test','executive@example.test']);
console.log('등록 완료 관리자 포함, 해당 팀장 선택, 중복 주소 제외 통과');
