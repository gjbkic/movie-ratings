/* Isolated, append-once migration checkpoint. Not loaded by index.html.
 * Caller must validate the conversion and lock/recheck the legacy source first.
 */
(()=>{'use strict';
 const DB_NAME='movie30_balanced_migration_v1',STORE='migration';
 function open(){return new Promise((resolve,reject)=>{
  let settled=false;const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})};
  request.onblocked=()=>{settled=true;reject(Error('Database blocked'))};request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result;if(settled){db.close();return}settled=true;db.onversionchange=()=>db.close();resolve(db)};
 })}
 function decode(rows){
  if(!rows.length)return {status:'empty'};
  const backup=rows.find(x=>x.id==='before-conversion'),current=rows.find(x=>x.id==='current');
  if(rows.length!==2||!backup||!current||!valid({sourceJson:backup.json,targetJson:current.json}))return {status:'damaged'};
  return {status:'ready',sourceJson:backup.json,targetJson:current.json};
 }
 function valid(input){try{
  if(typeof input?.sourceJson!=='string'||typeof input?.targetJson!=='string')return false;
  const a=JSON.parse(input.sourceJson),b=JSON.parse(input.targetJson);
  const shape=x=>x&&Array.isArray(x.customFilms)&&x.exactScores&&typeof x.exactScores==='object'&&!Array.isArray(x.exactScores)&&x.rankOrder&&typeof x.rankOrder==='object'&&!Array.isArray(x.rankOrder);
  return shape(a)&&shape(b)&&(!Object.hasOwn(a,'scorePolicy')||a.scorePolicy==='legacy-v23')&&b.scorePolicy==='balanced-v1';
 }catch(_){return false}}
 async function read(){let db;try{
  db=await open();return await new Promise(resolve=>{
   const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();let rows;
   req.onsuccess=()=>{rows=req.result};tx.oncomplete=()=>resolve(decode(rows));tx.onabort=()=>resolve({status:'failed'});tx.onerror=()=>{};
  });
 }catch(_){return {status:'failed'}}finally{db?.close()}}
 async function commit(input){
  if(!valid(input))return {status:'invalid'};
  // Snapshot strings before opening the database; callers cannot change them during awaits.
  const {sourceJson,targetJson}=input;let db;
  try{
   db=await open();const status=await new Promise(resolve=>{
    const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),req=store.getAll();let result='failed';
    req.onsuccess=()=>{try{
     const prior=decode(req.result);
     if(prior.status!=='empty'){
      result=prior.status==='ready'&&prior.sourceJson===sourceJson&&prior.targetJson===targetJson?'already-committed':'conflict';return;
     }
     store.add({id:'before-conversion',json:sourceJson});
     store.put({id:'current',json:targetJson});result='committed';
    }catch(_){try{tx.abort()}catch(_){}}};
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>resolve('failed');tx.onerror=()=>{};
   });
   if(!['committed','already-committed'].includes(status))return {status};
   const verified=await read();
   if(verified.status!=='ready'||verified.sourceJson!==sourceJson||verified.targetJson!==targetJson)return {status:'uncertain'};
   return {status};
  }catch(_){return {status:'failed'}}finally{db?.close()}
 }
 window.Movie30ScoreMigrationStore=Object.freeze({DB_NAME,read,commit});
})();
