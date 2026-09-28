const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('index_app.js','utf8');
const start=source.indexOf('async function submitData()'),end=source.indexOf('inspectDate.valueAsDate=',start);
const script=source.slice(start,end);
async function run(accept){
  let posts=0,body,asks=[];
  const ctx={
    photoReads:0,photoData:{},WEB_APP_URL:'https://example.test/exec',
    inspectDate:{value:'2026-09-28'},inspectorName:{value:'고상민'},machineId:{value:'24호기'},issueRemarks:{value:''},
    active:()=>Array.from({length:10},(_,i)=>({no:i+1})),sel:()=> 'O',cfg:[],
    document:{querySelector:()=>({disabled:false,textContent:''})},
    confirm:text=>{asks.push(text);return accept},alert:()=>{},
    fetch:async(url,options)=>{if(options&&options.method==='POST'){posts++;body=JSON.parse(options.body);return {json:async()=>({status:'success'})}}return {json:async()=>({status:'success',existingCount:1})}},
    location:{reload:()=>{}}
  };
  vm.createContext(ctx);vm.runInContext(script+';this.submitData=submitData',ctx);
  await ctx.submitData();return {posts,body,asks};
}
(async()=>{
  const no=await run(false);assert.equal(no.posts,0);assert.match(no.asks[0],/기존 점검 1건/);
  const yes=await run(true);assert.equal(yes.posts,1);assert.equal(yes.body.replaceExisting,true);assert.equal(yes.body.expectedExistingCount,1);
  console.log('확인창 아니오 취소/예 교체 요청 통과');
})().catch(e=>{console.error(e);process.exitCode=1});
