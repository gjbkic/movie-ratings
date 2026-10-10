(() => {
'use strict';
// v83: viewing diary is separate from numeric scores, film ranks and reviews.
const BUILD='20261011a';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const u=v=>String(v||'').split(/[?#]/)[0].replace(/\/+$/,'').toLowerCase();
const validDate=v=>/^\d{4}-\d\d-\d\d$/.test(String(v||''))&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))?v:'';
const meta=id=>(state.letterboxdMeta=state.letterboxdMeta||{},state.letterboxdMeta[id]=state.letterboxdMeta[id]||{});
const events=f=>Array.isArray(state.letterboxdMeta?.[f.id]?.watchHistory)?state.letterboxdMeta[f.id].watchHistory:[];
const latest=f=>events(f).map(x=>validDate(x.date)).filter(Boolean).sort().at(-1)||'';
const logged=f=>events(f).map(x=>x.recordedAt||'').filter(Boolean).sort().at(-1)||'';
const rewatches=f=>events(f).filter(x=>x.rewatch).length;
let sortMode='rank';try{sortMode=localStorage.getItem('movie30_watch_sort_v83')||'rank'}catch(_){}
if(!['rank','watched-new','watched-old','rewatch','logged-new'].includes(sortMode))sortMode='rank';

let parsed=[];
const priorParse=parseLbRss;
parseLbRss=function(xml){
  const list=priorParse(xml);
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))return list;
  const nodes=[...doc.querySelectorAll('item')].filter(i=>childTextByLocal(i,'filmTitle')&&childTextByLocal(i,'filmYear'));
  parsed=list.map((x,i)=>{
    const el=nodes[i];if(!el)return x;
    return {...x,reviewGuid:x.reviewGuid||childTextByLocal(el,'guid'),
      recordedAt:childTextByLocal(el,'pubDate'),
      rewatch:childTextByLocal(el,'rewatch'),
      memberLike:childTextByLocal(el,'memberLike')};
  });
  return parsed;
};
function findByRss(x){
  const films=allFilms(),url=u(x.link||x.uri);
  if(url){const a=films.filter(f=>u(f.uri)===url);if(a.length===1)return a[0];}
  const k=norm(x.title),y=Number(x.year)||0;
  if(!k)return null;
  const a=films.filter(f=>{
    if(y&&Number(f.year)&&Math.abs(Number(f.year)-y)>2)return false;
    const t=titleInfo(f);
    return [t.title,t.englishTitle,t.originalTitle,f.title,f.englishTitle,f.originalTitle,f.lbTitle].some(v=>norm(v)===k);
  });
  return a.length===1?a[0]:null;
}
function mergeRss(list){
  const touched=new Set();let added=0,updated=0,unmatched=0;
  for(const x of list){
    const f=findByRss(x);if(!f){unmatched++;continue;}
    const key=String(x.reviewGuid||'').trim()||(u(x.link)+'|'+x.watchedDate+'|'+x.title);
    if(!key)continue;
    const id='rss:'+key,m=meta(f.id);
    if((m.watchHistoryDeleted||[]).includes(id))continue;
    const rows=m.watchHistory=m.watchHistory||[];
    const old=rows.find(r=>r.id===id);
    const time=Date.parse(x.recordedAt||''),recordedAt=Number.isFinite(time)?new Date(time).toISOString():'';
    const date=validDate(x.watchedDate);
    const retroactive=!!(date&&recordedAt&&time-Date.parse(date+'T00:00:00Z')>14*86400000);
    const data={id,date,recordedAt,rewatch:String(x.rewatch||'').toLowerCase()==='yes',
      retroactive,source:'letterboxd-rss',manualEdited:false};
    if(!old){rows.push(data);added++;touched.add(f.id);}
    else if(!old.manualEdited){
      let change=false;
      for(const k of ['date','recordedAt','rewatch','retroactive'])if(old[k]!==data[k]){old[k]=data[k];change=true;}
      if(change){updated++;touched.add(f.id);}
    }
  }
  if(touched.size){
    save(false);drawList();
    if(selectedId&&touched.has(selectedId))drawEditor(selectedId);
  }
  return {added,updated,unmatched};
}
async function importSavedRss(){
  const status=document.getElementById('watchImportStatus83');
  try{
    const response=await fetch('letterboxd-gjbkic.xml?v='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const list=parseLbRss(await response.text()),r=mergeRss(list);
    if(status)status.textContent='RSS '+list.length+'件を確認：新規鑑賞記録 '+r.added+'件、更新 '+r.updated+'件、未一致 '+r.unmatched+'件';
  }catch(e){if(status)status.textContent='取得失敗：'+(e?.message||e);}
}
const oldSync=syncLetterboxd;
syncLetterboxd=async function(...args){
  parsed=[];
  const r=await oldSync.apply(this,args);
  if(r!==false&&parsed.length){
    const n=mergeRss(parsed);
    const label=document.getElementById('lbStatus');if(label)label.textContent+=' · 鑑賞記録追加 '+n.added+'件';
  }
  return r;
};
const syncButton=document.getElementById('syncLetterboxd');
if(syncButton)syncButton.onclick=()=>syncLetterboxd(false);

// The date view does not rewrite the point-ranked lists or their draggable cards.
const rankPage=document.getElementById('page-rank');
const rankRoot=document.getElementById('rankRoot');
const tools=rankPage?.querySelector('.tools');
if(tools&&!document.getElementById('watchSort83')){
  const sel=document.createElement('select');sel.id='watchSort83';sel.className='field';
  sel.setAttribute('aria-label','表示順');
  sel.innerHTML='<option value="rank">点数・順位順（従来）</option><option value="watched-new">鑑賞日：新しい順</option>'
    +'<option value="watched-old">鑑賞日：古い順</option><option value="rewatch">再鑑賞の記録が多い順</option>'
    +'<option value="logged-new">登録日：新しい順</option>';
  sel.value=sortMode;tools.appendChild(sel);
  sel.onchange=()=>{sortMode=sel.value;try{localStorage.setItem('movie30_watch_sort_v83',sortMode)}catch(_){}renderRank();};
}
const listRoot=document.createElement('div');listRoot.id='watchList83';
rankRoot?.insertAdjacentElement('afterend',listRoot);
const style=document.createElement('style');
style.textContent='.watch83-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:7px;margin:10px 0 30px}'
  +'.watch83-item{width:100%;text-align:left;background:#111923;border:1px solid #374151;border-radius:10px;padding:11px;color:#eef4fb}'
  +'.watch83-item strong{display:block;font-size:12px;line-height:1.5}.watch83-item small{display:block;font-size:11px;color:#9aa7b8;line-height:1.5;margin-top:4px}'
  +'.watch83-summary{font-size:11px;color:#9aa7b8;margin:12px 0}'
  +'.watch83-editor{background:#0c121a;border:1px solid #374151;border-radius:11px;padding:12px;margin:13px 0}'
  +'.watch83-editor h3{font-size:14px;margin:0 0 9px}.watch83-record{border-top:1px solid #374151;padding:9px 0}'
  +'.watch83-record>div{display:flex;flex-wrap:wrap;gap:9px;align-items:center}'
  +'.watch83-editor input[type=date]{background:#101b29;color:#eaf1fb;border:1px solid #475569;border-radius:7px;padding:6px;font-size:16px}'
  +'.watch83-editor label{display:inline-flex;gap:5px;align-items:center;font-size:12px;line-height:1.4}'
  +'.watch83-editor input[type=checkbox]{width:17px;height:17px;accent-color:#91baff}'
  +'.watch83-editor small{display:block;font-size:10px;color:#96a4b5;margin-top:5px}'
  +'.watch83-editor button{background:#192433;color:#e4efff;border:1px solid #46576e;border-radius:7px;padding:7px 9px;font-size:12px}'
  +'.watch83-editor p{font-size:11px;color:#aeb9c5;line-height:1.5}';
document.head.appendChild(style);
function cmp(a,b,fn,asc=false){
  const x=fn(a),y=fn(b);
  if(!x&&!y)return 0;if(!x)return 1;if(!y)return -1;
  return asc?x.localeCompare(y):y.localeCompare(x);
}
function drawList(){
  if(!rankRoot)return;
  rankRoot.style.display=sortMode==='rank'?'':'none';
  listRoot.style.display=sortMode==='rank'?'none':'';
  if(sortMode==='rank')return;
  const q=document.getElementById('searchRank')?.value||'';
  const cat=document.getElementById('categoryFilterRank')?.value||'';
  const media=document.getElementById('mediaFilterRank')?.value||'';
  const origin=document.getElementById('originFilterRank')?.value||'';
  const films=allFilms().filter(f=>
    (!q||match(f,q))&&(!cat||filmCategory(f)===cat)&&
    (!media||(state.mediaTypeOverrides?.[f.id]||'movie')===media)&&
    (!origin||state.originOverrides?.[f.id]===origin));
  films.sort((a,b)=>{
    let n=0;
    if(sortMode==='watched-new')n=cmp(a,b,latest);
    if(sortMode==='watched-old')n=cmp(a,b,latest,true);
    if(sortMode==='logged-new')n=cmp(a,b,logged);
    if(sortMode==='rewatch')n=rewatches(b)-rewatches(a)||events(b).length-events(a).length;
    return n||displayTitle(a).localeCompare(displayTitle(b),'ja');
  });
  const dated=films.filter(f=>latest(f)).length;
  listRoot.innerHTML='<p class="watch83-summary">'+films.length+'作品／鑑賞日の記録あり '+dated+'作品。未記録は末尾。点数と同点内順位は変更しません。</p>'
    +'<div class="watch83-grid">'+films.map(f=>{
      const d=latest(f),h=events(f),sc=effectiveScore(f);
      return '<button type="button" class="watch83-item" data-film="'+encodeURIComponent(f.id)+'"><strong>'+esc(displayTitle(f))+'</strong>'
        +'<small>最新鑑賞日：'+(d||'未記録')+' ／ 記録 '+h.length+'回</small>'
        +'<small>再鑑賞記録：'+rewatches(f)+'件'+(h.some(x=>x.retroactive)?' ／ 過去鑑賞を後日登録':'')+'</small>'
        +'<small>'+(sc==null?'未採点':sc+'点')+'</small></button>';
    }).join('')+'</div>';
  listRoot.querySelectorAll('[data-film]').forEach(el=>el.onclick=()=>openSheet(decodeURIComponent(el.dataset.film)));
}
const oldRank=renderRank;
renderRank=function(...args){
  const result=sortMode==='rank'?oldRank.apply(this,args):undefined;
  drawList();return result;
};
for(const id of ['searchRank','categoryFilterRank','mediaFilterRank','originFilterRank']){
  const el=document.getElementById(id);if(el)el.addEventListener(id==='searchRank'?'input':'change',()=>{
    if(sortMode!=='rank')drawList();
  });
}
let editor=null;
const sheet=document.querySelector('#sheetBg .sheet'),close=document.getElementById('closeSheet');
if(sheet&&close){
  editor=document.createElement('section');editor.className='watch83-editor';editor.id='watchEditor83';
  sheet.insertBefore(editor,close);
}
function commit(f){
  save();drawList();
}
function drawEditor(id){
  if(!editor)return;
  const f=filmById(id);if(!f){editor.innerHTML='';return;}
  const rows=[...events(f)].sort((a,b)=>(b.date||b.recordedAt||'').localeCompare(a.date||a.recordedAt||''));
  editor.innerHTML='<h3>鑑賞日・再鑑賞履歴</h3>'
    +'<p>登録されている鑑賞記録 '+rows.length+'件。昔見たものを後日登録した場合はチェックを付けてください。鑑賞日が不明なら空欄で保存できます。</p>'
    +'<button type="button" id="watchAdd83">＋ 鑑賞記録を追加</button>'
    +rows.map(x=>'<div class="watch83-record" data-id="'+encodeURIComponent(x.id)+'"><div>'
      +'<input aria-label="鑑賞日" type="date" data-date value="'+esc(x.date||'')+'">'
      +'<label><input type="checkbox" data-rewatch '+(x.rewatch?'checked':'')+'>再鑑賞</label>'
      +'<label><input type="checkbox" data-retro '+(x.retroactive?'checked':'')+'>過去に観たものを後から登録</label>'
      +'<button type="button" data-delete>削除</button></div><small>'
      +(x.source==='letterboxd-rss'?'Letterboxdから取得':'手入力')+' ／ 記録日：'
      +(x.recordedAt?esc(x.recordedAt.slice(0,10)):'不明')+'</small></div>').join('');
  editor.querySelector('#watchAdd83').onclick=()=>{
    const m=meta(f.id);m.watchHistory=m.watchHistory||[];
    m.watchHistory.push({id:'manual:'+Date.now()+'-'+Math.random().toString(36).slice(2,6),
      date:'',recordedAt:new Date().toISOString(),rewatch:false,retroactive:false,source:'manual',manualEdited:true});
    commit(f);drawEditor(f.id);
  };
  editor.querySelectorAll('[data-id]').forEach(el=>{
    const item=decodeURIComponent(el.dataset.id);
    const edit=(name,value)=>{
      const x=events(f).find(x=>x.id===item);if(!x)return;
      x[name]=value;x.manualEdited=true;commit(f);
    };
    el.querySelector('[data-date]').onchange=e=>edit('date',validDate(e.target.value));
    el.querySelector('[data-rewatch]').onchange=e=>edit('rewatch',e.target.checked);
    el.querySelector('[data-retro]').onchange=e=>edit('retroactive',e.target.checked);
    el.querySelector('[data-delete]').onclick=()=>{
      const m=meta(f.id);m.watchHistory=events(f).filter(x=>x.id!==item);
      if(item.startsWith('rss:')){
        m.watchHistoryDeleted=m.watchHistoryDeleted||[];
        if(!m.watchHistoryDeleted.includes(item))m.watchHistoryDeleted.push(item);
      }
      commit(f);drawEditor(f.id);
    };
  });
}
const oldOpen=openSheet;
openSheet=function(...args){
  const result=oldOpen.apply(this,args);drawEditor(args[0]);return result;
};
const page=document.getElementById('page-data');
if(page&&!document.getElementById('watchImport83')){
  const panel=document.createElement('div');panel.className='panel';panel.id='watchImport83';
  panel.innerHTML='<h2>鑑賞履歴</h2><p class="tip">RSSの鑑賞日と登録日を区別して保存。再鑑賞も1回ずつ管理し、昔見た作品は詳細画面でチェックできます。</p>'
    +'<div class="tools"><button type="button" class="btn" id="watchSync83">保存済みRSSから鑑賞履歴を取得</button></div>'
    +'<div class="sync-status" id="watchImportStatus83"></div>';
  page.insertBefore(panel,page.firstChild);
  panel.querySelector('#watchSync83').onclick=importSavedRss;
}
drawList();
setTimeout(importSavedRss,700);
window.__movie30WatchDiaryV83={build:BUILD};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();
