/* Install and manage offline support without touching movie/rank data. */
(()=>{
'use strict';
const WORKER='./sw.js?v=20261113-confirmedscore5';
const POSTER_CACHE='movie30-offline-posters-v1';
let registration=null,activeJob=null,ui={};
function on(el,event,fn){if(el)el.addEventListener(event,fn)}
function write(text,kind=''){
 if(ui.status){ui.status.textContent=text;ui.status.dataset.status=kind}
}
function statusLine(){
 if(ui.network)ui.network.textContent=navigator.onLine?'オンライン':'オフライン';
}
async function countSaved(){
 if(!window.caches||!ui.count)return;
 try{
  const cache=await caches.open(POSTER_CACHE),keys=await cache.keys();
  ui.count.textContent='この端末に保存済みのポスター：'+keys.length+'枚';
 }catch(_){ui.count.textContent='保存済みポスター枚数を取得できません'}
}
function possiblePosters(){
 const api=window.__movie30PosterBridge84;
 if(!api?.meta||!api?.url||typeof allFilms!=='function')return [];
 const seen=new Set(),out=[];
 for(const f of allFilms()){
  const score=effectiveScore(f);
  if(Number(filmStar(f))<3||score==null||!Number.isFinite(Number(score)))continue;
  const path=api.meta(f)?.path,link=api.url(path,'w185');
  if(!link||seen.has(link))continue;
  seen.add(link);out.push(link);
 }
 return out.slice(0,360);
}
function refreshPosterButton(){
 if(!ui.prepare||activeJob)return;
 const n=possiblePosters().length;
 ui.prepare.textContent='取得済みポスター '+n+'枚をオフライン保存';
 ui.prepare.disabled=!registration?.active||!navigator.onLine||n===0;
}
function showProgress(message){
 if(!activeJob||message.jobId!==activeJob)return;
 const {done=0,total=0,saved=0,failed=0,finished=false,error=''}=message;
 if(ui.posterStatus)ui.posterStatus.textContent='画像保存 '+done+'/'+total+'（成功 '+saved+' / 失敗 '+failed+'）';
 if(finished){
  activeJob=null;
  ui.prepare.disabled=false;
  if(error)write(error,'warn');
  else if(failed)write('ポスターの一部を保存できませんでした。保存済み画像はそのまま使えます。','warn');
  else write('オフライン用のポスター保存が完了しました。','good');
  refreshPosterButton();countSaved();
 }
}
async function prepPosters(){
 if(activeJob)return;
 const worker=registration?.active;
 const urls=possiblePosters();
 if(!worker){write('オフライン機能の準備が完了していません。','warn');return}
 if(!urls.length){write('ポスターをまだ取得していません。オンラインで作品を表示すると保存候補に追加されます。','warn');return}
 if(!navigator.onLine){write('ポスターの事前保存はオンライン時に行ってください。','warn');return}
 activeJob='prep-'+Date.now();
 ui.prepare.disabled=true;
 write('ポスターの保存中です。画面を開いたままにしてください。');
 if(ui.posterStatus)ui.posterStatus.textContent='画像保存 0/'+urls.length;
 worker.postMessage({type:'MOVIE30_PREPARE_POSTERS',urls,jobId:activeJob});
}
function mount(){
 if(document.getElementById('movie30-offline-panel'))return;
 const page=document.getElementById('page-data');
 if(!page)return;
 const section=document.createElement('section');
 section.id='movie30-offline-panel';section.className='panel';
 section.innerHTML='<h2>オフライン利用</h2>'+
   '<p class="tip">一度オンラインで読み込むと、以降は通信がなくてもアプリを開いて順位比較できます。作品データと比較履歴はこれまでどおり端末内に保存します。</p>'+
   '<div id="movie30-offline-status" class="offline-status" role="status" aria-live="polite">オフライン機能を準備しています…</div>'+
   '<div class="offline-meta"><span id="movie30-offline-network"></span><span id="movie30-offline-count"></span></div>'+
   '<div class="tools"><button class="btn" id="movie30-offline-prepare" disabled>取得済みポスターを保存</button>'+
   '<button class="btn" id="movie30-offline-retry">オフライン設定を確認</button></div>'+
   '<div id="movie30-offline-poster-status" class="tip" aria-live="polite"></div>'+
   '<p class="tip">ポスターはネット接続時に表示・保存されたものをオフラインでも使用できます。未取得の画像、TMDb検索、Letterboxd同期などには通信が必要です。iPhoneではSafariの共有メニューから「ホーム画面に追加」すると起動しやすくなります。重要な記録はJSONバックアップも取ってください。</p>';
 page.appendChild(section);
 ui={status:section.querySelector('#movie30-offline-status'),network:section.querySelector('#movie30-offline-network'),
 count:section.querySelector('#movie30-offline-count'),prepare:section.querySelector('#movie30-offline-prepare'),
 retry:section.querySelector('#movie30-offline-retry'),posterStatus:section.querySelector('#movie30-offline-poster-status')};
 const style=document.createElement('style');
 style.textContent='#movie30-offline-panel .offline-status{font-size:13px;font-weight:750;padding:7px 0;color:#aecbf3}' +
  '#movie30-offline-panel .offline-status[data-status="good"]{color:#88d9a5}'+
  '#movie30-offline-panel .offline-status[data-status="warn"]{color:#ffce91}'+
  '#movie30-offline-panel .offline-meta{display:flex;gap:12px;flex-wrap:wrap;color:#adb9cc;font-size:11px;margin:9px 0}';
 document.head.appendChild(style);
 on(ui.prepare,'click',prepPosters);
 on(ui.retry,'click',()=>install(true));
 on(window,'online',()=>{statusLine();refreshPosterButton()});
 on(window,'offline',()=>{statusLine();refreshPosterButton();if(registration?.active)write('オフラインで利用中。既に保存された映画データと画像を使っています。','good')});
 statusLine();countSaved();
}
async function install(force=false){
 if(!('serviceWorker' in navigator)||!('caches' in window)){
  write('このブラウザはオフライン保存に対応していません。Safariなどの対応ブラウザで開いてください。','warn');return;
 }
 if(!force&&registration?.active)return;
 write('オフライン用のアプリ本体を保存しています…');
 try{
  const reg=await navigator.serviceWorker.register(WORKER,{scope:'./',updateViaCache:'none'});
  registration=reg;
  if(force&&navigator.onLine)try{await reg.update()}catch(_){}
  const ready=await navigator.serviceWorker.ready;
  registration=ready;
  const client=ready.active||ready.waiting||ready.installing;
  if(!client){write('準備中です。しばらくして設定を確認してください。','warn');return}
  write(navigator.onLine?'オフライン用アプリを保存しました。圏外でも起動できます。':
    '保存済みのアプリをオフラインで利用できます。','good');
  countSaved();refreshPosterButton();
 }catch(err){
  write('オフライン保存に失敗しました。ネット接続後に「設定を確認」を押してください。','warn');
  if(ui.posterStatus)ui.posterStatus.textContent=String(err?.message||'');
 }
}
function initialize(){
 mount();
 if(!ui.status)return;
 if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message',event=>{
   const message=event.data||{};
   if(message.type==='MOVIE30_OFFLINE_PROGRESS')showProgress(message);
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   countSaved();refreshPosterButton();
  });
 }
 install();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);
else initialize();
})();
