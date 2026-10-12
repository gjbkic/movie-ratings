(() => {
'use strict';
// v92: autocomplete for the existing rank/classify searches.
// Suggestions from the local film library are always available.
// Real-time TMDb proposals are an optional addition only when the device has a credential.
const BUILD='20261012c';
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const validPoster=s=>typeof s==='string'&&/^\/[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp)$/i.test(s)&&!s.includes('..');
const escText=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const jpNames=window.__movie30JPDirector91?.aliases||new Map();
let catalog=Object.create(null);
const baseMatch=match;
match=function(f,q){
 if(baseMatch(f,q))return true;
 if(!q)return true;
 const needle=norm(q);
 if(!needle)return false;
 const rec=catalog[f.id]||{};
 return [...(rec.directorAliases||[]),rec.title||'']
   .some(label=>norm(label).includes(needle));
};
fetch('./tmdb-metadata.json?autocomplete=20261012c',{cache:'no-store'})
 .then(res=>res.ok?res.json():null)
 .then(data=>{
   if(!data?.films)return;
   catalog=data.films;
   if(document.getElementById('searchRank')?.value.trim())renderRank();
   if(document.getElementById('searchClassify')?.value.trim())renderClassify();
   for(const box of inputs)if(box.input.value.trim()&&document.activeElement===box.input)refresh(box);
 }).catch(err=>console.warn('TMDb catalog suggestions unavailable',err));

const style=document.createElement('style');
style.id='movie30-search-autocomplete92';
style.textContent=[
 '.movie92-search-wrap{position:relative;flex:1 1 170px;min-width:170px;max-width:100%;}',
 '.movie92-search-wrap>.search{width:100%;min-width:0;display:block;}',
 '.movie92-suggestions{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:1000;overflow-y:auto;overscroll-behavior:contain;max-height:min(410px,60vh);background:#121b26;border:1px solid #53667e;border-radius:12px;box-shadow:0 12px 32px #000b;padding:6px;text-align:left;}',
 '.movie92-suggestions[hidden]{display:none!important;}',
 '.movie92-section{font-size:10px;font-weight:750;color:#afc2d9;letter-spacing:.03em;margin:8px 7px 5px;}',
 '.movie92-entry{display:flex;align-items:center;gap:9px;width:100%;min-height:49px;background:transparent;border:0;border-radius:8px;padding:6px 7px;text-align:left;color:#eaf1fb;}',
 '.movie92-entry:hover,.movie92-entry.is-current,.movie92-entry:focus-visible{background:#29405a;outline:none;}',
 '.movie92-entry img{width:28px;height:42px;flex:0 0 28px;object-fit:contain;background:#0d141d;border-radius:4px;}',
 '.movie92-person{display:flex;align-items:center;justify-content:center;width:28px;height:42px;flex:0 0 28px;background:#233346;border-radius:5px;font-size:17px;}',
 '.movie92-entry-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}',
 '.movie92-entry-title{font-weight:700;font-size:12px;line-height:1.3;overflow-wrap:anywhere;}',
 '.movie92-entry-sub{font-size:10px;line-height:1.35;color:#b2c0d2;overflow-wrap:anywhere;}',
 '.movie92-footer{font-size:10px;color:#9eafc5;margin:7px;padding-top:6px;border-top:1px solid #3a4758;line-height:1.45;}',
 '.movie92-entry-tag{font-size:9px;color:#92e0b1;white-space:nowrap;}',
 '@media (max-width:560px){.movie92-suggestions{max-height:min(390px,59vh)}.movie92-entry{min-height:47px}.movie92-entry-title{font-size:11px}}'
].join('\n');
document.head.appendChild(style);

const inputs=[];
const remoteCache=new Map();
function poster(f){
 const m=state.letterboxdMeta?.[f.id]?.poster84||{};
 const r=catalog[f.id]||{};
 const p=validPoster(m.path)?m.path:r.posterPath;
 return validPoster(p)?'https://image.tmdb.org/t/p/w92'+p:'';
}
function localData(q){
 const target=norm(q),movieItems=[],people=new Map();
 if(!target)return {movies:[],people:[]};
 for(const f of allFilms()){
  const ti=titleInfo(f),r=catalog[f.id]||{},meta=state.letterboxdMeta?.[f.id]||{},crew=meta.crew84||{};
  const titles=[ti.title,ti.englishTitle,ti.originalTitle,f.lbTitle,r.title].filter(Boolean);
  const matching=titles.map(x=>norm(x)).filter(x=>x.includes(target));
  if(matching.length){
   const prefix=matching.some(x=>x.startsWith(target)),exact=matching.some(x=>x===target);
   movieItems.push({kind:'movie',f,id:f.id,label:displayTitle(f),
    detail:[f.year||'',ti.englishTitle&&ti.englishTitle!==displayTitle(f)?ti.englishTitle:''].filter(Boolean).join(' · '),
    score:(exact?900:prefix?700:400)+(effectiveScore(f)!=null?10:0),image:poster(f)});
  }
  const persons=[...(crew.directors||r.directors||[]),...(crew.creators||r.creators||[])];
  for(const name of persons){
   const key=norm(name);if(!key)continue;
   let item=people.get(key);
   if(!item){
    item={kind:'director',name,aliases:new Set(jpNames.get(key)||[]),ids:new Set(),count:0};
    people.set(key,item);
   }
   item.ids.add(f.id);
   if(persons.length===1)for(const alias of r.directorAliases||[])item.aliases.add(alias);
  }
 }
 const peopleMatches=[];
 for(const item of people.values()){
  item.count=item.ids.size;
  const names=[item.name,...item.aliases];
  const matches=names.map(norm).filter(s=>s.includes(target));
  if(!matches.length)continue;
  const japanese=names.slice(1).find(name=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(name));
  item.label=japanese||item.name;
  item.detail=japanese?item.name+' · '+item.count+'作品':item.count+'作品';
  item.score=(matches.some(x=>x===target)?900:matches.some(x=>x.startsWith(target))?700:400)+Math.min(item.count,40);
  peopleMatches.push(item);
 }
 movieItems.sort((a,b)=>b.score-a.score||(a.label||'').localeCompare(b.label||'','ja'));
 peopleMatches.sort((a,b)=>b.score-a.score||b.count-a.count);
 return {movies:movieItems.slice(0,7),people:peopleMatches.slice(0,6)};
}
function remoteData(data,q){
 const result=[];
 const used=new Set();
 for(const x of data?.results||[]){
  const kind=x.media_type;
  if(kind!=='movie'&&kind!=='tv'&&kind!=='person')continue;
  if(x.adult===true)continue;
  if(!x.id||used.has(kind+':'+x.id))continue;
  used.add(kind+':'+x.id);
  const title=String(x.title||x.name||'').trim();
  if(!title)continue;
  const image=kind==='person'?x.profile_path:x.poster_path;
  result.push({
   kind:'remote',media:kind,tmdbId:x.id,label:title,
   detail:kind==='person'?'人物・別名からの候補':kind==='tv'?'ドラマ・番組':(x.release_date||'').slice(0,4)+' · TMDb',
   image:validPoster(image)?'https://image.tmdb.org/t/p/w92'+image:'',
   original:x.original_title||x.original_name||'',
  });
  if(result.length>=7)break;
 }
 return result;
}
function remoteAlreadyLocal(item){
 if(item.media==='person'){
  return allFilms().some(f=>{
   const crew=state.letterboxdMeta?.[f.id]?.crew84||catalog[f.id]||{};
   return [...(crew.directors||[]),...(crew.creators||[])].some(n=>norm(n)===norm(item.label));
  });
 }
 return allFilms().some(f=>{
   const ti=titleInfo(f),m=state.letterboxdMeta?.[f.id]||{},r=catalog[f.id]||{};
   if(Number(item.tmdbId)===Number(m.poster84?.tmdbId||ti.tmdbId||r.tmdbId)&&Number(item.tmdbId)>0)return true;
   const matches=[ti.title,ti.englishTitle,ti.originalTitle,f.lbTitle].some(n=>norm(n)===norm(item.label)||norm(n)===norm(item.original));
   return matches&&(!item.detail.slice(0,4).match(/^\d{4}$/)||Number(f.year)===Number(item.detail.slice(0,4)));
 });
}
function hide(box){box.menu.hidden=true;box.entries=[];box.selected=-1;}
function label(item){
 if(item.kind==='movie')return item.label;
 if(item.kind==='director')return item.label;
 return item.label;
}
function addEntry(box,item){
 const b=document.createElement('button');b.type='button';b.className='movie92-entry';
 const image=item.image;
 if(image){const img=document.createElement('img');img.src=image;img.alt='';img.loading='lazy';b.appendChild(img);}
 else {const placeholder=document.createElement('span');placeholder.className='movie92-person';placeholder.textContent=item.kind==='director'||item.media==='person'?'👤':'🎬';b.appendChild(placeholder);}
 const span=document.createElement('span');span.className='movie92-entry-text';
 const title=document.createElement('span');title.className='movie92-entry-title';title.textContent=label(item);
 const sub=document.createElement('span');sub.className='movie92-entry-sub';sub.textContent=item.detail||'';
 span.append(title,sub);b.appendChild(span);
 if(item.kind==='remote'){const tag=document.createElement('span');tag.className='movie92-entry-tag';tag.textContent='TMDb';b.append(tag);}
 b.addEventListener('pointerdown',event=>event.preventDefault());
 b.addEventListener('click',()=>choose(box,item));
 box.menu.appendChild(b);box.entries.push(b);
}
function section(box,title,list){
 if(!list.length)return;
 const heading=document.createElement('div');heading.className='movie92-section';heading.textContent=title;box.menu.appendChild(heading);
 for(const item of list)addEntry(box,item);
}
function refresh(box){
 if(document.activeElement!==box.input)return;
 const q=box.input.value.trim();
 if(!q){hide(box);return;}
 const local=localData(q);
 box.menu.textContent='';box.entries=[];box.selected=-1;box.menu.hidden=false;
 section(box,'登録済みの作品',local.movies);
 section(box,'監督・製作者',local.people);
 const online=(box.remoteQuery===q?box.remoteItems:[]).filter(x=>!remoteAlreadyLocal(x));
 section(box,'TMDbオンライン（未登録・追加候補）',online);
 const foot=document.createElement('div');foot.className='movie92-footer';
 if(!box.entries.length){foot.textContent='候補はまだありません。通常の検索はそのまま使えます。';}
 else if(!getTmdbCredential())foot.textContent='現在は登録作品の候補を表示中。オンライン候補は端末側にTMDbキーを設定すると使えます。';
 else if(box.remoteQuery!==q&&q.length>=2)foot.textContent='入力を止めるとTMDbの追加候補も表示します。';
 else foot.textContent='候補を選ぶと一覧を絞り込みます。TMDb未登録作品は「＋映画」画面で確認できます。';
 box.menu.appendChild(foot);
}
function setQuery(box,s){
 box.input.value=s;
 box.input.dispatchEvent(new Event('input',{bubbles:true}));
 hide(box);
 box.input.focus({preventScroll:true});
}
async function choose(box,item){
 hide(box);
 if(item.kind==='movie'){setQuery(box,displayTitle(item.f));return;}
 if(item.kind==='director'){setQuery(box,item.name);return;}
 if(item.media==='person'){
  // TMDb often returns the Latin spelling for a Japanese alias.
  const q=norm(item.label);
  let canonical=allFilms().flatMap(f=>{
   const crew=state.letterboxdMeta?.[f.id]?.crew84||catalog[f.id]||{};
   return [...(crew.directors||[]),...(crew.creators||[])];
  }).find(name=>norm(name)===q);
  if(!canonical&&getTmdbCredential()){
   try{
    const detail=await tmdbFetch('/person/'+item.tmdbId,{language:'ja-JP'});
    const variants=[detail.name,...(detail.also_known_as||[])].map(norm);
    canonical=allFilms().flatMap(f=>{
     const crew=state.letterboxdMeta?.[f.id]?.crew84||catalog[f.id]||{};
     return [...(crew.directors||[]),...(crew.creators||[])];
    }).find(name=>variants.includes(norm(name)));
   }catch(_){}
  }
  setQuery(box,canonical||item.label);
  return;
 }
 if(item.media==='movie'){
  const local=allFilms().find(f=>{
   const ti=titleInfo(f),rec=catalog[f.id]||{},m=state.letterboxdMeta?.[f.id]||{};
   return Number(item.tmdbId)===Number(m.poster84?.tmdbId||ti.tmdbId||rec.tmdbId);
  });
  if(local){setQuery(box,displayTitle(local));return;}
  document.getElementById('quickAdd')?.click();
  if(typeof selectTmdb==='function')selectTmdb(item.tmdbId);
  return;
 }
 if(item.media==='tv'){
  window.open('https://www.themoviedb.org/tv/'+encodeURIComponent(item.tmdbId),'_blank','noopener');
 }
}
function queueOnline(box){
 if(box.timer)clearTimeout(box.timer);
 const q=box.input.value.trim();
 if(q.length<2||!getTmdbCredential()){
  box.remoteQuery='';box.remoteItems=[];return;
 }
 if(remoteCache.has(q)){box.remoteQuery=q;box.remoteItems=remoteCache.get(q);refresh(box);return;}
 const ticket=++box.ticket;
 box.timer=setTimeout(async()=>{
  try{
   const data=await tmdbFetch('/search/multi',{query:q,language:'ja-JP',include_adult:'false',page:1});
   remoteCache.set(q,remoteData(data,q));
   if(ticket!==box.ticket||box.input.value.trim()!==q)return;
   box.remoteItems=remoteCache.get(q);box.remoteQuery=q;refresh(box);
  }catch(e){
   if(ticket===box.ticket){box.remoteQuery='';box.remoteItems=[];}
   console.warn('TMDb live search unavailable',e);
  }
 },380);
}
function setup(input){
 if(!input)return;
 const shell=document.createElement('div');shell.className='movie92-search-wrap';
 input.parentNode.insertBefore(shell,input);shell.appendChild(input);
 const menu=document.createElement('div');menu.className='movie92-suggestions';menu.hidden=true;
 menu.setAttribute('role','listbox');menu.setAttribute('aria-label','検索候補');
 shell.appendChild(menu);
 const box={input,shell,menu,entries:[],selected:-1,timer:null,ticket:0,remoteQuery:'',remoteItems:[]};
 inputs.push(box);
 input.setAttribute('autocomplete','off');
 input.setAttribute('aria-autocomplete','list');
 input.addEventListener('input',()=>{box.ticket++;refresh(box);queueOnline(box);});
 input.addEventListener('focus',()=>refresh(box));
 input.addEventListener('keydown',event=>{
  if(menu.hidden)return;
  if(event.key==='Escape'){event.preventDefault();hide(box);return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   if(!box.entries.length)return;
   event.preventDefault();
   box.selected=(box.selected+(event.key==='ArrowDown'?1:-1)+box.entries.length)%box.entries.length;
   for(const [i,b] of box.entries.entries())b.classList.toggle('is-current',i===box.selected);
   box.entries[box.selected].scrollIntoView({block:'nearest'});
  }else if(event.key==='Enter'&&box.selected>=0){
   event.preventDefault();box.entries[box.selected]?.click();
  }
 });
 document.addEventListener('pointerdown',event=>{if(!shell.contains(event.target))hide(box);});
}
setup(document.getElementById('searchRank'));
setup(document.getElementById('searchClassify'));
window.__movie30AutoComplete92={build:BUILD,refresh:()=>inputs.forEach(refresh)};
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+BUILD;
})();