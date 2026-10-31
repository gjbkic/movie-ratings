'use strict';
const {test}=require('node:test'),{chromium,options,isolate,origin,ready,assert}=require('./harness.cjs');

for(const [kind,button] of [['drag','movie30-drag-undo-warning'],['history','movie30-history-undo-warning']])test(kind+' Undo export retains a corrupt candidate alongside a valid one',async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext({acceptDownloads:true});try{
  await isolate(context);const page=await context.newPage();await page.goto(origin);await ready(page);
  await page.evaluate(async kind=>{const db=await openMovie30Db();await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');store.put({id:kind+'-undo-good',status:'pending',json:JSON.stringify({before:{marker:'good'},candidate:{marker:'new'}})});store.put({id:kind+'-undo-bad',status:'pending',json:'{broken'});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})},kind);
  await page.reload();await ready(page);
  const warning=page.locator('#'+button);await warning.waitFor();
  const pending=page.waitForEvent('download');await warning.getByRole('button',{name:'Undo候補をJSON保存'}).click();const download=await pending;
  const stream=await download.createReadStream();let raw='';for await(const chunk of stream)raw+=chunk;
  const candidates=JSON.parse(raw).candidates;assert(candidates.some(x=>x.id===kind+'-undo-good'&&x.before?.marker==='good'));assert(candidates.some(x=>x.id===kind+'-undo-bad'&&x.rawJson==='{broken'));
 }finally{await context.close();await browser.close()}
});
