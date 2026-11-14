/* Films offline app shell + on-demand TMDb posters.
   User rankings stay in the existing localStorage/IndexedDB; this worker
   never reads, migrates, or changes rating data. */
'use strict';
const APP_CACHE='movie30-offline-shell-20261115-v19';
const POSTER_CACHE='movie30-offline-posters-v1';
const SHELL_ASSETS=[
  "",
  "index.html",
  "manifest.webmanifest?v=20261112",
  "offline-register.js?v=20261115-cyclepress19",
  "app-icon.svg",
  "app-core.js?v=20261113-onyourmark6",
  "app-save-retry.js?v=20261018save2",
  "app-remote-add.js?v=20261014c",
  "app-enhancements.js?v=20261014c",
  "app-cast-resolver.js?v=20261013c",
  "app-cast.js?v=20261013d",
  "app-people.js?v=20261013e",
  "app-seasons.js?v=20261013f",
  "app-search-stability.js?v=20261014d",
  "app-unrated-panels.js?v=20261014g",
  "app-detail-layout.js?v=20261014h",
  "app-viewing-reconcile-20261019.js?v=1",
  "app-last-attack-merge-20261022.js?v=20261022a",
  "app-crayon-duplicate-repair.js?v=20261031b",
  "patch-v120.js?v=20261115-cyclepress19",
  "app-boot.js?v=20261031b"
];
const BASE=self.registration.scope;
const START_URL=new URL('./',BASE).href;
const INDEX_URL=new URL('index.html',BASE).href;
const POSTER_LIMIT=360;
const isPoster=url=>url.origin==='https://image.tmdb.org'&&/^\/t\/p\/(w185|w342|w500)\//.test(url.pathname);
const isApp=url=>url.origin===self.location.origin&&url.href.startsWith(BASE);
const isStatic=url=>isApp(url)&&/\.(js|css|json|svg|webmanifest)$/.test(url.pathname);

async function cacheShell(){
 const store=await caches.open(APP_CACHE);
 const reqs=SHELL_ASSETS.map(path=>new URL(path,BASE).href);
 // An update is considered complete only if the app entry and critical code exist.
 const essential=new Set(['','index.html','app-core.js','patch-v120.js','app-boot.js']);
 const results=await Promise.all(reqs.map(async(url,index)=>{
   try{
     const req=new Request(url,{cache:'reload'});
     const res=await fetch(req);
     if(!res.ok)throw Error('HTTP '+res.status+' '+url);
     await store.put(req,res.clone());
     return true;
   }catch(err){
     const path=SHELL_ASSETS[index];
     if(essential.has(path)||[...essential].some(x=>x&&path.startsWith(x+'?')))throw err;
     return false;
   }
 }));
 const page=await store.match(INDEX_URL);
 if(!page)throw Error('Offline index missing');
 await store.put(START_URL,page.clone());
 return results.filter(Boolean).length;
}

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
   await cacheShell();
   await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const keys=await caches.keys();
   await Promise.all(keys.filter(key=>key.startsWith('movie30-offline-shell-')&&key!==APP_CACHE)
     .map(key=>caches.delete(key)));
   await self.clients.claim();
 })());
});

async function offlinePage(request){
 const store=await caches.open(APP_CACHE);
 const pageKey=new URL(request.url);
 const cached=await store.match(pageKey.pathname.endsWith('/index.html')?INDEX_URL:START_URL)
   ||await store.match(INDEX_URL);
 let ctrl=null,timer=null;
 try{
   ctrl=new AbortController();
   timer=setTimeout(()=>ctrl.abort(),3000);
   const network=await fetch(request,{signal:ctrl.signal,cache:'no-store'});
   if(network.ok){
     await store.put(INDEX_URL,network.clone()).catch(()=>{});
     return network;
   }
   if(cached)return cached;
   return network;
 }catch(err){
   if(cached)return cached;
   throw err;
 }finally{if(timer!==null)clearTimeout(timer)}
}
async function appAsset(event){
 const store=await caches.open(APP_CACHE);
 const saved=await store.match(event.request);
 if(saved){
   event.waitUntil(fetch(event.request).then(res=>{
     if(res.ok)return store.put(event.request,res.clone());
   }).catch(()=>{}));
   return saved;
 }
 const res=await fetch(event.request);
 if(res.ok)await store.put(event.request,res.clone()).catch(()=>{});
 return res;
}
async function savePoster(request,response){
 if(!(response.ok||response.type==='opaque'))return;
 try{
   const cache=await caches.open(POSTER_CACHE);
   await cache.put(request,response.clone());
   const keys=await cache.keys();
   if(keys.length>POSTER_LIMIT){
     await Promise.all(keys.slice(0,keys.length-POSTER_LIMIT).map(key=>cache.delete(key)));
   }
 }catch(_){/* Safari may reject storage when device quota is low. */}
}
async function posterAsset(request){
 const cache=await caches.open(POSTER_CACHE);
 const saved=await cache.match(request,{ignoreVary:true});
 if(saved)return saved;
 const response=await fetch(request);
 await savePoster(request,response);
 return response;
}
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(isPoster(u)){
   event.respondWith(posterAsset(req));
   return;
 }
 if(!isApp(u))return;
 if(req.mode==='navigate'){
   event.respondWith(offlinePage(req));
   return;
 }
 if(isStatic(u)){
   event.respondWith(appAsset(event));
 }
});

async function preparePosters(event,urls,jobId){
 const client=event.source;
 const report=(done,total,saved,failed,finished=false,error='')=>{
   try{client?.postMessage({type:'MOVIE30_OFFLINE_PROGRESS',jobId,done,total,saved,failed,finished,error})}catch(_){}
 };
 const unique=[...new Set((Array.isArray(urls)?urls:[]).filter(x=>typeof x==='string'))]
   .filter(value=>{try{return isPoster(new URL(value))}catch(_){return false}})
   .slice(0,POSTER_LIMIT);
 const total=unique.length,cache=await caches.open(POSTER_CACHE);
 let done=0,saved=0,failed=0,quota=false;
 for(let i=0;i<unique.length;i+=3){
   const batch=unique.slice(i,i+3);
   await Promise.all(batch.map(async(url)=>{
     try{
       const req=new Request(url,{mode:'no-cors',credentials:'omit'});
       const have=await cache.match(url,{ignoreVary:true});
       if(have){saved++;return}
       const res=await fetch(req);
       if(!(res.ok||res.type==='opaque'))throw Error('Image fetch failed');
       await cache.put(req,res.clone());saved++;
     }catch(err){
       failed++;
       if(err?.name==='QuotaExceededError')quota=true;
     }finally{done++}
   }));
   report(done,total,saved,failed,false);
   if(quota)break;
 }
 try{
   const keys=await cache.keys();
   if(keys.length>POSTER_LIMIT)await Promise.all(keys.slice(0,keys.length-POSTER_LIMIT)
     .map(key=>cache.delete(key)));
 }catch(_){}
 report(done,total,saved,failed,true,quota?'保存領域の上限に達しました。既存データは変更していません。':'');
}
self.addEventListener('message',event=>{
 const data=event.data||{};
 if(data.type==='MOVIE30_PREPARE_POSTERS')
   event.waitUntil(preparePosters(event,data.urls,data.jobId));
 if(data.type==='MOVIE30_OFFLINE_STATUS')
   event.waitUntil((async()=>{
     const cache=await caches.open(APP_CACHE),page=await cache.match(INDEX_URL);
     const posters=await caches.open(POSTER_CACHE),all=await posters.keys();
     try{event.source?.postMessage({type:'MOVIE30_OFFLINE_STATUS',ready:!!page,posters:all.length})}catch(_){}
   })());
});
