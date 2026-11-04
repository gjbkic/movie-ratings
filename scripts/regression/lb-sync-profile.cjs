'use strict';
// Diagnostic only. Every request is intercepted; no real token or production data.
const {launch,origin,ready,assert}=require('./harness.cjs');
const fs=require('node:fs');
const rss='<rss xmlns:letterboxd="https://letterboxd.com"><channel><item><title>Fixture Film 12</title><letterboxd:filmTitle>Fixture Film 12</letterboxd:filmTitle><letterboxd:filmYear>2012</letterboxd:filmYear><letterboxd:memberRating>4</letterboxd:memberRating><guid>synthetic-profile-review</guid><description>synthetic profile review</description></item></channel></rss>';
(async()=>{
 const browser=await launch(),reports=[];try{
  for(const mode of ['direct','server']){
   const page=await browser.newPage();let trigger='',started=0;const requests=[];
   await page.route('https://letterboxd.com/**',r=>{requests.push({kind:'direct-rss',ms:Date.now()-started});return r.fulfill({contentType:'application/xml',body:rss})});
   await page.route('https://api.github.com/**',async r=>{
    const req=r.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
    requests.push({kind:req.method()+' '+name,ms:Date.now()-started});
    if(name==='letterboxd-sync-trigger.txt'&&req.method()==='PUT'){
     trigger=Buffer.from(req.postDataJSON().content,'base64').toString().trim();
     return r.fulfill({json:{content:{sha:'synthetic'}}});
    }
    let text='';
    if(name==='letterboxd-sync-trigger.txt')text='synthetic-initial';
    else if(name==='letterboxd-sync-result.json')text=JSON.stringify({trigger,status:'ok',itemCount:1});
    else if(name==='letterboxd-gjbkic.xml')text=rss;
    else return r.fulfill({status:404,json:{message:'isolated mock only'}});
    return r.fulfill({json:{content:Buffer.from(text).toString('base64'),sha:'synthetic'}});
   });
   await page.goto(origin);await ready(page);await page.waitForTimeout(1600);
   await page.evaluate(mode=>{
    document.getElementById('lbUsername').value=mode==='server'?'gjbkic':'fixture-user';
    if(mode==='server')localStorage.setItem('movie30_gpt_sync_token_v1','synthetic-not-a-credential');
    window.__lbProfile={};
    for(const key of ['parseLbRss','save','render','renderRank']){
     const original=window[key];if(typeof original!=='function')continue;
     const stat=window.__lbProfile[key]={calls:0,syncMs:0};
     window[key]=function(...args){const t=performance.now();stat.calls++;try{return original.apply(this,args)}finally{stat.syncMs+=performance.now()-t}};
    }
   },mode);
   requests.length=0;started=Date.now();
   assert.equal(await page.evaluate(()=>syncLetterboxd(false)),true);
   const syncReturnedMs=Date.now()-started;
   await page.evaluate(()=>window.__movie30PendingSave);
   const savedMs=Date.now()-started;
   const stats=await page.evaluate(()=>({functions:window.__lbProfile,status:document.getElementById('lbStatus').textContent,failed:!!window.__movie30SaveFailed}));
   assert.equal(stats.failed,false);assert(mode!=='server'||trigger.startsWith('movie30-'));
   reports.push({mode,syncReturnedMs,savedMs,requests,...stats});await page.close();
  }
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/lb-sync-profile.json',JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
