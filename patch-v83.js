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
let listLimit=80;
let tocYear='all',tocMonth='all';

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
    save();drawList();
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

// Import the complete Letterboxd export without changing scores, stars or ranks.
function csv83(raw){
  const rows=parseCsvText(String(raw||'').replace(/^\uFEFF/,''));
  if(!rows.length)return [];
  const keys=rows[0].map(x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' '));
  return rows.slice(1).map(row=>{
    const get=(...names)=>{for(const n of names){const i=keys.indexOf(n.toLowerCase());if(i>=0)return String(row[i]||'').trim();}return '';};
    return {title:get('name','title'),year:get('year'),uri:get('letterboxd uri','url','letterboxduri'),
      watchedDate:get('watched date','watcheddate'),recordDate:get('date'),rewatch:get('rewatch'),
      row};
  }).filter(x=>x.title);
}
async function zipCsv83(file){
  const buf=await file.arrayBuffer(),view=new DataView(buf),bytes=new Uint8Array(buf);
  let end=-1;
  for(let p=buf.byteLength-22;p>=Math.max(0,buf.byteLength-65557);p--){
    if(view.getUint32(p,true)===0x06054b50){end=p;break;}
  }
  if(end<0)throw Error('ZIP形式が正しくありません');
  const count=view.getUint16(end+10,true);let at=view.getUint32(end+16,true);
  const names=new TextDecoder('utf-8'),out={};
  for(let n=0;n<count;n++){
    if(at+46>buf.byteLength||view.getUint32(at,true)!==0x02014b50)throw Error('ZIP一覧が破損しています');
    const method=view.getUint16(at+10,true),packedSize=view.getUint32(at+20,true),size=view.getUint32(at+24,true);
    const nameLen=view.getUint16(at+28,true),extraLen=view.getUint16(at+30,true),commentLen=view.getUint16(at+32,true);
    const local=view.getUint32(at+42,true);
    const name=names.decode(bytes.subarray(at+46,at+46+nameLen)),basename=name.split('/').at(-1).toLowerCase();
    if(['diary.csv','watched.csv'].includes(basename)){
      if(size>12*1024*1024||packedSize>12*1024*1024)throw Error('CSVのサイズが大きすぎます');
      if(local+30>buf.byteLength||view.getUint32(local,true)!==0x04034b50)throw Error('ZIP内部が破損しています');
      const begin=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
      if(begin+packedSize>buf.byteLength)throw Error('ZIPデータが不足しています');
      const packed=bytes.slice(begin,begin+packedSize);
      let result=packed;
      if(method===8){
        if(typeof DecompressionStream!=='function')throw Error('このブラウザはZIP展開に対応していません。diary.csv／watched.csvを読み込んでください');
        try{
          const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          result=new Uint8Array(await new Response(stream).arrayBuffer());
        }catch(_){throw Error('ZIPを解凍できません。ZIP内のdiary.csvとwatched.csvを直接選択してください');}
      }else if(method!==0)throw Error('未対応のZIP圧縮方式です');
      out[basename]=names.decode(result);
    }
    at+=46+nameLen+extraLen+commentLen;
  }
  return out;
}
function importDiaryCsv83(diaryText,watchedText,source){
  const diary=csv83(diaryText),watched=csv83(watchedText);
  if(!diary.length&&!watched.length)throw Error('鑑賞記録を読み取れませんでした');
  const consumed=new Set(),countPerKey=new Map();
  const archive=state.letterboxdMeta=state.letterboxdMeta||{};
  const unresolved=archive.__unmatchedHistory83=archive.__unmatchedHistory83||{diary:{},watched:{}};
  function trackUnmatched(kind,raw){
    const id=[kind,u(raw.uri),norm(raw.title),raw.year,raw.watchedDate,raw.recordDate].join('|');
    unresolved[kind][id]={title:raw.title,year:raw.year,uri:raw.uri,
      watchedDate:raw.watchedDate,recordDate:raw.recordDate,rewatch:raw.rewatch};
  }
  let entries=0,marked=0,unmatched=0,duplicates=0;
  for(const raw of diary){
    const date=validDate(raw.watchedDate);
    const f=findByRss({title:raw.title,year:raw.year,link:raw.uri});
    if(!f){unmatched++;trackUnmatched('diary',raw);continue;}
    const m=meta(f.id),arr=m.watchHistory=m.watchHistory||[];
    const dateKey=f.id+'|'+date;
    const nth=(countPerKey.get(dateKey)||0)+1;countPerKey.set(dateKey,nth);
    const itemKey='csv:diary:'+dateKey+':'+nth;
    if((m.watchHistoryDeleted||[]).includes(itemKey))continue;
    if(arr.some(x=>x.id===itemKey)){duplicates++;continue;}
    // RSS may already contain the same diary event. Avoid duplicating viewings.
    const existing=arr.find(x=>x.id.startsWith('rss:')&&x.date===date&&!consumed.has(x.id));
    if(existing){consumed.add(existing.id);duplicates++;continue;}
    const reg=validDate(raw.recordDate);
    arr.push({id:itemKey,date,recordedAt:reg?reg+'T12:00:00Z':'',
      rewatch:/^(yes|true|1)$/i.test(raw.rewatch),retroactive:false,
      source:'letterboxd-export',manualEdited:false});
    entries++;
  }
  for(const raw of watched){
    const f=findByRss({title:raw.title,year:raw.year,link:raw.uri});
    if(!f){unmatched++;trackUnmatched('watched',raw);continue;}
    const m=meta(f.id),date=validDate(raw.recordDate);
    if(!m.watchedFlag){m.watchedFlag=true;marked++;}
    // "Date" in watched.csv is when marked watched, NOT when actually viewed.
    if(date&&(!m.watchedAddedDate||date<m.watchedAddedDate))m.watchedAddedDate=date;
  }
  save();drawList();
  if(selectedId)drawEditor(selectedId);
  return {diary:diary.length,watched:watched.length,entries,marked,unmatched,duplicates,source};
}
async function readExport83(file){
  const name=String(file.name||'').toLowerCase();
  let diary='',watched='';
  if(name.endsWith('.zip')){
    const entries=await zipCsv83(file);
    diary=entries['diary.csv']||'';watched=entries['watched.csv']||'';
  }else if(name.endsWith('diary.csv'))diary=await file.text();
  else if(name.endsWith('watched.csv'))watched=await file.text();
  else throw Error('LetterboxdのZIP、diary.csv、watched.csvを指定してください');
  if(!diary&&!watched)throw Error('ZIP内にdiary.csvもwatched.csvもありません');
  return importDiaryCsv83(diary,watched,file.name);
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
  sel.onchange=()=>{sortMode=sel.value;listLimit=80;tocYear='all';tocMonth='all';try{localStorage.setItem('movie30_watch_sort_v83',sortMode)}catch(_){}renderRank();};
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
  +'.watch83-editor p{font-size:11px;color:#aeb9c5;line-height:1.5}'+'.watch83-toc{position:sticky;top:54px;z-index:15;background:#0d1520;border:1px solid #354658;border-radius:11px;padding:9px;margin:10px 0 12px;box-shadow:0 5px 12px #0005}'+'.watch83-toc-head{font-size:11px;color:#c5d5e9;margin:0 0 6px;font-weight:700}'+'.watch83-toc-row{display:flex;gap:5px;overflow-x:auto;scrollbar-width:thin;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;padding:1px 1px 4px}'+'.watch83-toc-row+ .watch83-toc-row{margin-top:6px;padding-top:7px;border-top:1px solid #2c3949}'+'.watch83-toc-chip{flex:0 0 auto;border:1px solid #435267;background:#172334;color:#d0dced;border-radius:7px;min-height:34px;padding:6px 9px;font-size:11px;white-space:nowrap}'+'.watch83-toc-chip[aria-pressed="true"]{border-color:#91baff;background:#243e62;color:#fff;font-weight:700}'+'.watch83-toc-chip small{margin-left:5px;color:#a9bad0;font-size:10px}'+'.watch83-divider{grid-column:1/-1;font-size:14px;font-weight:750;border-bottom:1px solid #364556;color:#e0eafd;padding:12px 3px 7px;margin-top:6px;scroll-margin-top:150px}'+'.watch83-toc-empty{font-size:11px;color:#9eacbd;padding:4px}';
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
  let entries=[];
  for(const f of films){
    const rows=events(f);
    if(sortMode==='rewatch'){
      entries.push({f,entry:null,sortDate:latest(f),count:rows.length});continue;
    }
    // Each Letterboxd diary entry appears independently, including rewatches.
    if(rows.length){
      for(const entry of rows){
        const value=sortMode==='logged-new'?(entry.recordedAt||'').slice(0,10):validDate(entry.date);
        entries.push({f,entry,sortDate:value,count:rows.length});
      }
    }else{
      // watched.csv registration date is not an actual viewing date.
      const known=sortMode==='logged-new'
        ?(state.letterboxdMeta?.[f.id]?.watchedAddedDate||''):'';
      entries.push({f,entry:null,sortDate:known,count:0});
    }
  }
  entries.sort((a,b)=>{
    if(sortMode==='rewatch'){
      const n=rewatches(b.f)-rewatches(a.f)||b.count-a.count;
      return n||displayTitle(a.f).localeCompare(displayTitle(b.f),'ja');
    }
    if(!a.sortDate&&!b.sortDate)return displayTitle(a.f).localeCompare(displayTitle(b.f),'ja');
    if(!a.sortDate)return 1;if(!b.sortDate)return -1;
    const n=sortMode==='watched-old'
      ?a.sortDate.localeCompare(b.sortDate):b.sortDate.localeCompare(a.sortDate);
    return n||displayTitle(a.f).localeCompare(displayTitle(b.f),'ja');
  });

  // The Letterboxd-style table of contents works from individual viewing dates,
  // not the film release year or the "marked watched" date.
  const showToc=['watched-new','watched-old','logged-new'].includes(sortMode);
  const counts=new Map();
  const validItems=entries.filter(e=>e.sortDate&&/^\d{4}-\d\d-\d\d/.test(e.sortDate));
  for(const item of validItems){
    const year=item.sortDate.slice(0,4);
    counts.set(year,(counts.get(year)||0)+1);
  }
  const undatedCount=entries.length-validItems.length;
  const years=[...counts.keys()].sort((a,b)=>sortMode==='watched-old'?a.localeCompare(b):b.localeCompare(a));
  if(tocYear!=='all'&&tocYear!=='unknown'&&!counts.has(tocYear)){tocYear='all';tocMonth='all';}
  if(tocYear==='unknown'&&!undatedCount){tocYear='all';tocMonth='all';}
  const yearRows=tocYear==='all'?entries:entries.filter(e=>
    tocYear==='unknown'?!e.sortDate:e.sortDate.startsWith(tocYear+'-'));
  const monthCounts=new Map();
  if(tocYear!=='all'&&tocYear!=='unknown'){
    for(const item of yearRows){
      const month=item.sortDate.slice(5,7);
      if(/^\d\d$/.test(month))monthCounts.set(month,(monthCounts.get(month)||0)+1);
    }
  }
  if(tocMonth!=='all'&&!monthCounts.has(tocMonth))tocMonth='all';
  const visibleRows=tocMonth==='all'?yearRows:yearRows.filter(e=>e.sortDate.slice(5,7)===tocMonth);
  const active=(a,b)=>a===b?'true':'false';
  const button=(key,value,label,count,pressed)=>
    '<button type="button" class="watch83-toc-chip" data-'+key+'="'+esc(value)+'" aria-pressed="'+pressed+'">'
    +esc(label)+(count!=null?'<small>'+count+'</small>':'')+'</button>';
  let toc='';
  if(showToc){
    toc='<nav class="watch83-toc" id="watchTOC83" aria-label="鑑賞年・月の目次">'
      +'<div class="watch83-toc-head">'+(sortMode==='logged-new'?'登録日':'鑑賞日')+'で移動　— 年を選択すると月も選べます</div>'
      +'<div class="watch83-toc-row" aria-label="年を選択">'
      +button('year83','all','すべて',entries.length,active(tocYear,'all'))
      +years.map(year=>button('year83',year,year+'年',counts.get(year),active(tocYear,year))).join('')
      +(undatedCount?button('year83','unknown','日付不明',undatedCount,active(tocYear,'unknown')):'')
      +'</div>';
    if(tocYear!=='all'&&tocYear!=='unknown'){
      const months=[...monthCounts.keys()].sort((a,b)=>sortMode==='watched-old'?a.localeCompare(b):b.localeCompare(a));
      toc+='<div class="watch83-toc-row" aria-label="月を選択">'
        +button('month83','all','全月',yearRows.length,active(tocMonth,'all'))
        +months.map(month=>button('month83',month,Number(month)+'月',monthCounts.get(month),active(tocMonth,month))).join('')
        +'</div>';
    }
    toc+='</nav>';
  }
  const dated=entries.filter(e=>e.sortDate).length;
  let previousMonth=null;
  const cards=visibleRows.slice(0,listLimit).map(({f,entry,count,sortDate})=>{
    const sc=effectiveScore(f),m=state.letterboxdMeta?.[f.id]||{};
    const dateLabel=entry
      ?(entry.date?'鑑賞日 '+entry.date:'鑑賞日不明')
      :(sortMode==='logged-new'&&m.watchedAddedDate?'鑑賞済みに登録 '+m.watchedAddedDate:'鑑賞日未登録');
    const group=sortDate?sortDate.slice(0,7):'unknown';
    const section=showToc&&group!==previousMonth
      ?'<div class="watch83-divider">'+(group==='unknown'?'日付不明':group.slice(0,4)+'年'+Number(group.slice(5))+'月')+'</div>':'';
    previousMonth=group;
    return section+'<button type="button" class="watch83-item" data-film="'+encodeURIComponent(f.id)+'"><strong>'
      +esc(displayTitle(f))+'</strong><small>'+esc(dateLabel)
      +(entry?.rewatch?' · 再鑑賞':'')
      +(entry?.retroactive?' · 過去の鑑賞を後日登録':'')
      +(!entry&&m.historicalWatched?' · 以前から鑑賞済み':'')
      +'</small><small>'+(sc==null?'未採点':sc+'点')
      +(sortMode==='rewatch'?' · 再鑑賞'+rewatches(f)+'件':'')
      +' · 全'+count+'記録</small></button>';
  }).join('');
  listRoot.innerHTML='<p class="watch83-summary">'+entries.length+'件の鑑賞・作品記録／日付あり '+dated+'件。'
    +(sortMode==='rewatch'?'作品単位で再鑑賞数順。':'再鑑賞もそれぞれ別の記録として表示。')
    +' 点数・元の順位には影響しません。</p>'
    +toc
    +(visibleRows.length?'<div class="watch83-grid">'+cards+'</div>':'<p class="watch83-toc-empty">この期間に該当する鑑賞記録はありません。</p>')
    +(visibleRows.length>listLimit?'<button type="button" class="btn" id="watchMore83">さらに'+Math.min(80,visibleRows.length-listLimit)+'件を表示</button>':'');
  listRoot.querySelectorAll('[data-film]').forEach(el=>el.onclick=()=>openSheet(decodeURIComponent(el.dataset.film)));
  const more=listRoot.querySelector('#watchMore83');if(more)more.onclick=()=>{listLimit+=80;drawList();};
  const scrollToToc=()=>{
    // Keep the year/month navigation visible when changing periods on mobile.
    const target=document.getElementById('watchTOC83');
    if(target&&typeof target.scrollIntoView==='function')target.scrollIntoView({behavior:'smooth',block:'start'});
  };
  listRoot.querySelectorAll('[data-year83]').forEach(btn=>btn.onclick=()=>{
    tocYear=btn.dataset.year83;tocMonth='all';listLimit=80;drawList();scrollToToc();
  });
  listRoot.querySelectorAll('[data-month83]').forEach(btn=>btn.onclick=()=>{
    tocMonth=btn.dataset.month83;listLimit=80;drawList();scrollToToc();
  });
  if(typeof window.__movie30PosterDecorate84==='function')window.__movie30PosterDecorate84();
}
const oldRank=renderRank;
renderRank=function(...args){
  const result=sortMode==='rank'?oldRank.apply(this,args):undefined;
  drawList();return result;
};
for(const id of ['searchRank','categoryFilterRank','mediaFilterRank','originFilterRank']){
  const el=document.getElementById(id);if(el)el.addEventListener(id==='searchRank'?'input':'change',()=>{
    if(sortMode!=='rank'){listLimit=80;tocYear='all';tocMonth='all';drawList();}
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
  const m=meta(f.id);
  const rows=[...events(f)].sort((a,b)=>(b.date||b.recordedAt||'').localeCompare(a.date||a.recordedAt||''));
  editor.innerHTML='<h3>鑑賞日・再鑑賞履歴</h3>'
    +'<p>登録されている鑑賞記録 '+rows.length+'件。昔見たものを後日登録した場合はチェックを付けてください。鑑賞日が不明なら空欄で保存できます。</p>'
    +'<label style="display:flex;margin:8px 0"><input type="checkbox" id="watchPast83" '+(m.historicalWatched?'checked':'')+'>以前から見ていた作品（鑑賞日不明）</label>'
    +'<button type="button" id="watchAdd83">＋ 鑑賞記録を追加</button>'
    +rows.map(x=>'<div class="watch83-record" data-id="'+encodeURIComponent(x.id)+'"><div>'
      +'<input aria-label="鑑賞日" type="date" data-date value="'+esc(x.date||'')+'">'
      +'<label><input type="checkbox" data-rewatch '+(x.rewatch?'checked':'')+'>再鑑賞</label>'
      +'<label><input type="checkbox" data-retro '+(x.retroactive?'checked':'')+'>過去に観たものを後から登録</label>'
      +'<button type="button" data-delete>削除</button></div><small>'
      +(x.source==='letterboxd-rss'?'Letterboxdから取得':'手入力')+' ／ 記録日：'
      +(x.recordedAt?esc(x.recordedAt.slice(0,10)):'不明')+'</small></div>').join('');
  editor.querySelector('#watchPast83').onchange=e=>{m.historicalWatched=e.target.checked;save();drawList();};
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
  panel.innerHTML='<h2>Letterboxd全履歴を読み込み</h2><p class="tip">LetterboxdのエクスポートZIPにあるdiary.csv（実際の鑑賞日・再鑑賞）とwatched.csv（鑑賞済み登録日）を区別して読み込みます。点数と順位、レビューは変更しません。過去鑑賞のチェックは後から編集できます。</p>'
    +'<div class="tools"><label class="btn active">Letterboxd ZIPを選択<input type="file" id="watchZip83" accept=".zip,.csv,application/zip,text/csv" hidden></label>'
    +'<button type="button" class="btn" id="watchSync83">保存済みRSSから追加同期</button></div>'
    +'<div class="sync-status" id="watchImportStatus83"></div>';
  page.insertBefore(panel,page.firstChild);
  panel.querySelector('#watchSync83').onclick=importSavedRss;
  panel.querySelector('#watchZip83').onchange=async e=>{
    const status=panel.querySelector('#watchImportStatus83'),file=e.target.files?.[0];
    if(!file)return;
    status.textContent='ZIPの鑑賞履歴を解析中…';
    try{
      const r=await readExport83(file);
      status.textContent='取得：Diary '+r.diary+'件、Watched '+r.watched
        +'件／新しい鑑賞記録 '+r.entries+'件／既存重複 '+r.duplicates
        +'件／照合できなかった記録 '+r.unmatched+'件。';
    }catch(err){status.textContent='読み込みできません：'+(err?.message||err);}
    e.target.value='';
  };
}
drawList();
setTimeout(importSavedRss,700);
window.__movie30WatchDiaryV83={build:BUILD};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();
