(() => {
'use strict';
// v93: Read-only combined director / performer / genre filters.
// Works with ranked, classified, and every chronological / poster list.
// No changes to rating, order, notes, or the user's genre classifications.
const VERSION='20261012d';
const fold=x=>String(x||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const knownJP=window.__movie30JPDirector91?.aliases||new Map();
let catalog={};
const chosen={director:'',actor:'',genre:''};
const panels=[];
const genresSynonyms={
 'sf':['sf','サイエンスフィクション','sciencefiction'],
 'サイエンスフィクション':['sf','サイエンスフィクション','sciencefiction'],
 'アニメ':['アニメーション','animation'], 'アニメーション':['アニメ','animation'],
 'クライム':['犯罪','crime'],'犯罪':['クライム','crime'],
 'ホラー':['horror'],'スリラー':['thriller'],
 '恋愛':['romance'],'ロマンス':['恋愛'],
 'ファンタジー':['fantasy']
};
function rowFor(f){return catalog[f.id]||{};}
function directors(f){
 const m=state.letterboxdMeta?.[f.id]||{},cr=m.crew84||{},r=rowFor(f);
 const assigned=m.directors84Manual?.length?m.directors84Manual:(cr.directors?.length?cr.directors:(r.directors||[]));
 return {names:[...assigned,...(cr.creators||[]),...(r.creators||[])],
  aliases:Array.isArray(r.directorAliases)?r.directorAliases:[]};
}
function actors(f){
 const r=rowFor(f);
 return Array.isArray(r.cast)?r.cast:[];
}
function genres(f){
 const manual=state.genreOverrides?.[f.id]||[];
 const remote=rowFor(f).genres||[];
 return [...new Set([...(Array.isArray(manual)?manual:[]),...(Array.isArray(remote)?remote:[])].filter(Boolean))];
}
function genreMatch(f,q){
 const needle=fold(q),equivalent=(genresSynonyms[needle]||[]).map(fold);
 return genres(f).some(n=>{
  const k=fold(n);
  return k.includes(needle)||equivalent.some(a=>k.includes(a));
 });
}
function matches(f){
 if(chosen.director){
  const needle=fold(chosen.director),entry=directors(f);
  const all=[...entry.names,...entry.aliases];
  for(const name of entry.names)all.push(...(knownJP.get(fold(name))||[]));
  if(!all.some(s=>fold(s).includes(needle)))return false;
 }
 if(chosen.actor){
  const needle=fold(chosen.actor);
  if(!actors(f).some(p=>{
   const name=typeof p==='string'?p:p.name;
   return [name,...(typeof p==='string'?[]:(p.aliases||[]))].some(s=>fold(s).includes(needle));
  }))return false;
 }
 if(chosen.genre&&!genreMatch(f,chosen.genre))return false;
 return true;
}
function options(){
 const person={director:new Map(),actor:new Map()};
 const g=new Map();
 const count=(map,text,english)=>{
  const key=fold(english||text);if(!key)return;
  const item=map.get(key)||{text:english||text,display:text||english,count:0};
  item.count++;if(!map.has(key))map.set(key,item);
 };
 for(const f of allFilms()){
  const entry=directors(f),distinctNames=new Set(entry.names.map(s=>String(s).trim()).filter(Boolean));
  for(const name of distinctNames){
   const aliases=knownJP.get(fold(name))||[];
   const japanese=aliases.find(x=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(x))
    ||(distinctNames.size===1?entry.aliases.find(x=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(x)):null);
   count(person.director,japanese||name,name);
  }
  const cast=actors(f);
  const actorSeen=new Set();
  for(const p of cast){
   const name=typeof p==='string'?p:p.name;
   if(!name||actorSeen.has(fold(name)))continue;
   actorSeen.add(fold(name));
   const aliases=typeof p==='string'?[]:p.aliases||[];
   const native=aliases.find(x=>/[\u3040-\u30ff\u3400-\u9fff]/u.test(x));
   count(person.actor,native||name,name);
  }
  for(const genre of new Set(genres(f))){
   const key=fold(genre);if(key)g.set(genre,(g.get(genre)||0)+1);
  }
 }
 return {director:[...person.director.values()],actor:[...person.actor.values()],genre:[...g].sort((a,b)=>a[0].localeCompare(b[0],'ja'))};
}
let candidates=options();
function counter(){
 const total=allFilms().length;
 const matched=allFilms().filter(matches).length;
 const castNum=allFilms().filter(f=>Array.isArray(rowFor(f).cast)).length;
 const active=Object.values(chosen).filter(Boolean).length;
 return {total,matched,castNum,active};
}
function rerender(){
 try{renderRank();renderClassify();}catch(e){console.error('Movie filters could not redraw',e);}
 updateLabels();
}
function updateLabels(){
 const count=counter();
 for(const p of panels){
  p.heading.textContent=count.active?'絞り込み（'+count.active+'条件）':'監督・出演者・ジャンルで絞り込み';
  p.summary.textContent=(count.active?count.matched+' / '+count.total+'作品に絞り込み。':'登録作品 '+count.total+'本。')+' 出演者データ '+count.castNum+'作品。';
  if(count.castNum<Math.min(count.total,20))p.summary.textContent+=' TMDbの出演者データは更新後に増えます。';
  for(const field of ['director','actor','genre']){
   if(document.activeElement!==p.inputs[field]&&p.inputs[field].value!==chosen[field])p.inputs[field].value=chosen[field];
  }
  const newValue=p.select.value;
  const genreLabels=candidates.genre.map(([name,n])=>({name,n}));
  p.select.replaceChildren(new Option('ジャンルを選択',''),...genreLabels.map(({name,n})=>new Option(name+'（'+n+'本）',name)));
  p.select.value=chosen.genre;
  p.clear.disabled=!count.active;
 }
}
const css=document.createElement('style');css.id='movie30-library-filters93';
css.textContent=[
 '.movie93-filter{border:1px solid #384b60;border-radius:11px;margin:6px 0 11px;background:#101923;padding:0 10px;}',
 '.movie93-filter>summary{display:flex;align-items:center;justify-content:space-between;cursor:pointer;min-height:42px;gap:10px;font-size:12px;font-weight:750;color:#d7e5f7;list-style:none;}',
 '.movie93-filter>summary::-webkit-details-marker{display:none;}',
 '.movie93-filter>summary:after{content:"⌄";color:#a8bfd8;font-size:17px;}',
 '.movie93-filter[open]>summary:after{content:"⌃";}',
 '.movie93-filter-content{padding:3px 0 10px;}',
 '.movie93-filter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;}',
 '.movie93-label{display:block;color:#b0c2d5;font-size:11px;font-weight:700;margin-bottom:5px;}',
 '.movie93-box{position:relative;min-width:0;}',
 '.movie93-box input,.movie93-box select{display:block;width:100%;min-height:40px;color:#edf3fb;border:1px solid #50637a;border-radius:8px;background:#172637;padding:7px 9px;font-size:15px;}',
 '.movie93-box input::placeholder{color:#9aacc1;}',
 '.movie93-drop{position:absolute;left:0;right:0;top:100%;z-index:1500;max-height:240px;overflow:auto;background:#182739;border:1px solid #5b748f;border-radius:8px;box-shadow:0 8px 20px #0009;}',
 '.movie93-drop[hidden]{display:none!important;}',
 '.movie93-drop button{display:flex;align-items:center;justify-content:space-between;gap:9px;width:100%;padding:10px 9px;min-height:39px;text-align:left;color:#edf2fb;background:transparent;border:0;border-bottom:1px solid #2e4256;font-size:12px;}',
 '.movie93-drop button:hover,.movie93-drop button:focus-visible{background:#304968;}',
 '.movie93-drop small{color:#a6bad1;font-size:10px;white-space:nowrap;}',
 '.movie93-tail{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:space-between;margin-top:10px;}',
 '.movie93-stats{font-size:10px;color:#a9b9ca;line-height:1.4;}',
 '.movie93-clear{color:#dce9f7;background:#263a4f;border:1px solid #536a83;border-radius:8px;padding:6px 12px;font-size:12px;}',
 '.movie93-clear:disabled{opacity:.45;}',
 '@media(max-width:620px){.movie93-filter-grid{grid-template-columns:1fr 1fr;gap:8px}.movie93-box.movie93-genre{grid-column:1/-1}.movie93-filter{margin:6px 0 10px;}}'
].join('\n');document.head.append(css);
function openSuggestions(panel,field){
 const input=panel.inputs[field],menu=panel.drop[field],needle=fold(input.value.trim());
 if(!needle){menu.hidden=true;return;}
 const hits=candidates[field].filter(item=>
  fold(item.text).includes(needle)||fold(item.display).includes(needle))
  .sort((a,b)=>{
   const aStart=fold(a.display).startsWith(needle)||fold(a.text).startsWith(needle);
   const bStart=fold(b.display).startsWith(needle)||fold(b.text).startsWith(needle);
   return Number(bStart)-Number(aStart)||b.count-a.count;
  }).slice(0,8);
 menu.replaceChildren();
 if(!hits.length){menu.hidden=true;return;}
 for(const item of hits){
  const button=document.createElement('button');button.type='button';
  const name=document.createElement('span');
  name.textContent=item.display===item.text?item.text:item.display+' / '+item.text;
  const count=document.createElement('small');count.textContent=item.count+'作品';
  button.append(name,count);
  button.addEventListener('pointerdown',event=>event.preventDefault());
  button.addEventListener('click',()=>{
   chosen[field]=item.text;
   menu.hidden=true;
   syncValues();rerender();
  });
  menu.appendChild(button);
 }
 menu.hidden=false;
}
function syncValues(){
 for(const panel of panels){
  for(const field of ['director','actor'])panel.inputs[field].value=chosen[field];
  panel.select.value=chosen.genre;
 }
}
function construct(page){
 const root=document.getElementById('page-'+page);
 if(!root)return;
 const tool=root.querySelector('.tools');
 if(!tool)return;
 const details=document.createElement('details');details.className='movie93-filter';details.id='movie93-filter-'+page;
 const heading=document.createElement('summary');heading.textContent='監督・出演者・ジャンルで絞り込み';
 const content=document.createElement('div');content.className='movie93-filter-content';
 const grid=document.createElement('div');grid.className='movie93-filter-grid';
 const panel={details,heading,inputs:{},drop:{},select:null,clear:null,summary:null};
 for(const [field,name,placeholder] of [['director','監督','例：宮崎駿'],['actor','出演者','例：トム・ハンクス']]){
  const box=document.createElement('div');box.className='movie93-box';
  const label=document.createElement('label');label.className='movie93-label';label.textContent=name;
  const input=document.createElement('input');input.type='search';input.placeholder=placeholder;
  input.autocomplete='off';input.setAttribute('aria-label',name+'で絞り込み');
  const drop=document.createElement('div');drop.className='movie93-drop';drop.hidden=true;
  label.appendChild(input);box.append(label,drop);grid.appendChild(box);
  panel.inputs[field]=input;panel.drop[field]=drop;
  input.addEventListener('input',()=>{
   chosen[field]=input.value.trim();
   for(const other of panels)if(other!==panel)other.inputs[field].value=chosen[field];
   openSuggestions(panel,field);rerender();
  });
  input.addEventListener('focus',()=>openSuggestions(panel,field));
  input.addEventListener('keydown',event=>{
   if(event.key==='Escape'){drop.hidden=true;input.blur();}
   if(event.key==='Enter'&&!drop.hidden){
    const first=drop.querySelector('button');
    if(first){event.preventDefault();first.click();}
   }
  });
 }
 const genreBox=document.createElement('div');genreBox.className='movie93-box movie93-genre';
 const genreLabel=document.createElement('label');genreLabel.className='movie93-label';genreLabel.textContent='ジャンル';
 const sel=document.createElement('select');sel.setAttribute('aria-label','ジャンルで絞り込み');
 genreLabel.append(sel);genreBox.append(genreLabel);grid.append(genreBox);
 panel.select=sel;panel.inputs.genre=sel;
 sel.addEventListener('change',()=>{
  chosen.genre=sel.value;for(const other of panels)other.select.value=chosen.genre;
  rerender();
 });
 const footer=document.createElement('div');footer.className='movie93-tail';
 const summary=document.createElement('span');summary.className='movie93-stats';
 const clear=document.createElement('button');clear.type='button';clear.className='movie93-clear';clear.textContent='条件をすべて解除';
 clear.addEventListener('click',()=>{
  chosen.director='';chosen.actor='';chosen.genre='';
  for(const p of panels)for(const field of ['director','actor'])p.drop[field].hidden=true;
  syncValues();rerender();
 });
 panel.clear=clear;panel.summary=summary;
 footer.append(summary,clear);content.append(grid,footer);details.append(heading,content);
 tool.insertAdjacentElement('afterend',details);
 details.addEventListener('toggle',()=>{
  for(const p of panels)if(p!==panel)p.details.open=details.open;
 });
 panels.push(panel);
}
construct('rank');construct('classify');
document.addEventListener('pointerdown',event=>{
 for(const panel of panels){
  for(const field of ['director','actor']){
   if(!panel.inputs[field].parentElement.contains(event.target) &&
      !panel.drop[field].contains(event.target))panel.drop[field].hidden=true;
  }
 }
});
async function load(){
 try{
  const response=await fetch('./tmdb-metadata.json?filters=20261012d',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(data.schema!==1||!data.films)return;
  catalog=data.films;
  candidates=options();
  updateLabels();
  rerender();
 }catch(e){console.warn('Movie cast/genre catalog unavailable; using saved genres and directors',e);}
}
window.__movie30AdvancedFilter93={matches,hasActive:()=>Boolean(chosen.director||chosen.actor||chosen.genre),reset:()=>{
 chosen.director='';chosen.actor='';chosen.genre='';syncValues();rerender();
},getFilters:()=>({...chosen}),version:VERSION};
updateLabels();
load();
const marker=document.getElementById('movie30BuildV29');if(marker)marker.textContent='app build '+VERSION;
})();