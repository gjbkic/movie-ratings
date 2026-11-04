'use strict';
const {launch,ready,origin,assert}=require('./harness.cjs');
(async()=>{
 const browser=await launch();try{
  for(const mode of ['all-stalled','put-stalled','different-trigger']){
   const page=await browser.newPage();await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
   const result=await page.evaluate(async mode=>{
    const originalFetch=window.fetch,read=window.Movie30LbTransport.read;
    window.Movie30LbTransport={read:(url,opt,ms)=>read(url,opt,Math.min(ms||15000,30))};
    const calls=[];let trigger='',polls=0;
    const rss='<rss xmlns:letterboxd="https://letterboxd.com"><channel></channel></rss>';
    const content=text=>new Response(JSON.stringify({content:btoa(text),sha:'synthetic'}),{status:200});
    const stalled=signal=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('synthetic abort','AbortError')),{once:true}));
    document.getElementById('lbUsername').value='gjbkic';
    if(mode!=='all-stalled')localStorage.setItem('movie30_gpt_sync_token_v1','synthetic-not-a-credential');
    window.fetch=async(url,opt={})=>{
     url=String(url);
     if(url.startsWith('https://api.github.com/')){
      const name=new URL(url).pathname.split('/').pop();calls.push((opt.method||'GET')+' '+name);
      if(name==='letterboxd-sync-trigger.txt'){
       if(opt.method==='PUT'){
        trigger=atob(JSON.parse(opt.body).content).trim();
        if(mode==='put-stalled')return stalled(opt.signal);
        return new Response('{}',{status:200});
       }
       return content('synthetic');
      }
      if(name==='letterboxd-sync-result.json'){polls++;return content(JSON.stringify({trigger:polls===1?'another-tab-trigger':trigger,status:'ok'}))}
      if(name==='letterboxd-gjbkic.xml')return content(rss);
      throw Error('Unexpected synthetic GitHub request');
     }
     if(/letterboxd\.com|allorigins|corsproxy|codetabs/.test(url)){
      calls.push('rss-attempt');
      if(mode==='all-stalled')return stalled(opt.signal);
      return new Response(rss,{status:200});
     }
     return originalFetch(url,opt);
    };
    const before={scores:JSON.stringify(state.exactScores),ranks:JSON.stringify(state.rankOrder),meta:JSON.stringify(state.letterboxdMeta)};
    const ok=await syncLetterboxd(false);await window.__movie30PendingSave;
    const after={scores:JSON.stringify(state.exactScores),ranks:JSON.stringify(state.rankOrder),meta:JSON.stringify(state.letterboxdMeta)};
    return {ok,calls,polls,before,after,status:document.getElementById('lbStatus').textContent,disabled:document.getElementById('syncLetterboxd').disabled};
   },mode);
   assert.deepEqual(result.after,result.before,mode+' changed reviews/scores/ranks');assert.equal(result.disabled,false);
   if(mode==='all-stalled'){assert.equal(result.ok,false);assert.equal(result.calls.length,4);assert.match(result.status,/同期できませんでした/)}
   if(mode==='put-stalled'){assert.equal(result.ok,true);assert.equal(result.calls.filter(x=>x==='PUT letterboxd-sync-trigger.txt').length,1);assert.equal(result.calls.filter(x=>x==='rss-attempt').length,1)}
   if(mode==='different-trigger'){assert.equal(result.ok,true);assert.equal(result.polls,2);assert.equal(result.calls.filter(x=>x==='GET letterboxd-gjbkic.xml').length,1);assert.equal(result.calls.includes('rss-attempt'),false)}
   console.log('LB_SYNC_DEADLINE_PASS '+mode);await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
