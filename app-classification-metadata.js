/* Six independent classification axes. Overrides are per film and survive
   ordinary backup/sync, without modifying ratings, ranks, runtime or year. */
(()=>{
'use strict';
const META='classificationOverrides131',GENRES={16:'アニメ',28:'アクション',12:'アドベンチャー',35:'コメディ',80:'クライム',99:'ドキュメンタリー',18:'ドラマ',10751:'ファミリー',14:'ファンタジー',36:'歴史',27:'ホラー',10402:'音楽',9648:'ミステリー',10749:'恋愛',878:'SF',10770:'テレビ映画',53:'サスペンス',10752:'戦争',37:'西部劇',10759:'アクション',10765:'SF',10768:'戦争',10767:'トーク',10764:'リアリティ'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
const uniq=xs=>[...new Set(xs.filter(Boolean))];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const split=s=>uniq(String(s||'').split(/[,、;；\n]+/).map(x=>x.trim()));
const meta=f=>state.letterboxdMeta?.[f.id]||{};
const automatic=f=>window.__movie30Studios?.entry(f)||{};
const overridden=f=>meta(f)[META]||{};
const countryDisplay=new Intl.DisplayNames(['ja'],{type:'region'}),languageDisplay=new Intl.DisplayNames(['ja'],{type:'language'});
function countryName(code){try{return countryDisplay.of(code)||code}catch(_){return code}}
function languageName(code){try{return languageDisplay.of(code)||code}catch(_){return code}}
const COUNTRY_CODES=['JP','US','GB','FR','DE','IT','ES','KR','CN','HK','TW','IN','CA','AU','NZ','RU','SE','DK','NO','FI','IR','TH','MX','BR'];
const LANGUAGE_CODES=['ja','en','fr','de','it','es','ko','zh','cn','hi','ru','sv','da','no','fi','fa','th','pt','ar','nl'];
function countryCode(value){const x=value.trim();if(/^[A-Za-z]{2}$/.test(x))return x.toUpperCase();return COUNTRY_CODES.find(c=>countryName(c)===x)||({'アメリカ':'US','イギリス':'GB','韓国':'KR','台湾':'TW','香港':'HK'}[x])||x}
function languageCode(value){const x=value.trim();if(/^[a-z]{2,3}(-[A-Za-z]+)?$/.test(x))return x;return LANGUAGE_CODES.find(c=>languageName(c)===x)||({'中国語':'zh','広東語':'cn','英語':'en','日本語':'ja'}[x])||x}
function get(f){
 if(!f)return null;
 const a=automatic(f),o=overridden(f);
 const companies=own(o,'companies')?o.companies:(a.companies||[]);
 const countries=own(o,'countries')?o.countries:(a.productionCountries||[]).map(c=>c.code).filter(Boolean);
 // Only a previously explicit Japan label is a usable country fallback.
 if(!countries.length&&!own(o,'countries')&&['日本','邦画'].includes(state.originOverrides?.[f.id]))countries.push('JP');
 const originalLanguage=own(o,'originalLanguage')?o.originalLanguage:(a.originalLanguage||'');
 const spokenLanguages=own(o,'spokenLanguages')?o.spokenLanguages:(a.spokenLanguages||[]).map(l=>l.code).filter(Boolean);
 const genres=own(state.genreOverrides,f.id)?state.genreOverrides[f.id]:
  (a.genres||[]).map(g=>GENRES[g.id]||g.name).filter(Boolean);
 const media=state.mediaTypeOverrides?.[f.id]||f.mediaType||(a.kind==='tv'?'drama':'movie');
 const format=state.formatOverrides?.[f.id]||f.format||a.formatHint||'live';
 return {companies,countries,originalLanguage,spokenLanguages,genres,
  media,mediaLabel:({movie:'映画',drama:'ドラマ',documentary:'ドキュメンタリー',other:'その他'})[media]||media,
  format,formatLabel:({live:'実写',animation:'アニメ',hybrid:'実写＋アニメ'})[format]||format,
  countryNames:countries.map(countryName),languageNames:uniq([originalLanguage,...spokenLanguages]).map(languageName)};
}
function searchable(f){
 const c=get(f);if(!c)return '';
 return [c.mediaLabel,c.formatLabel,...c.genres,...c.countryNames,...c.countries,...c.languageNames,c.originalLanguage,...c.spokenLanguages,
  ...c.companies.flatMap(x=>[x.name,window.__movie30Studios?.aliases(x)||''])].filter(Boolean).join(' ');
}
function setOverride(f,key,value){
 state.letterboxdMeta=state.letterboxdMeta||{};
 const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};
 const o=m[META]={...(m[META]||{})};
 if(value===undefined)delete o[key];else o[key]=value;
 save();refresh(f.id);window.__movie30DetailUnified?.refresh();
 window.dispatchEvent(new Event('movie30-studio-update'));
 if(view.page!=='rerank'&&typeof render==='function')render();
}
const row=(key,label,html)=>'<div class="struct-row movie131-row" data-classification="'+key+'"><div class="struct-label">'+label+'</div>'+html+'</div>';
function refresh(id=selectedId){
 if(!id||id!==selectedId)return;
 const f=filmById(id),editor=document.getElementById('editGenrePicker');if(!f||!editor)return;
 if(editor.contains(document.activeElement)&&document.activeElement.matches('.movie131-row input'))return;
 document.getElementById('movie30ProductionPanel')?.remove();
 editor.querySelectorAll('.movie131-row').forEach(e=>e.remove());
 const c=get(f),o=overridden(f),a=automatic(f);
 const input=(name,value,placeholder,list='')=>'<input class="field" id="'+name+'" value="'+esc(value)+'" placeholder="'+esc(placeholder)+'"'+(list?' list="'+list+'"':'')+'>';
 const add=document.createElement('div');
 add.innerHTML=row('companies','会社',input('movie131Companies',c.companies.map(x=>x.name).join('、'),'制作会社（複数は「、」区切り）'))+
  row('countries','制作',input('movie131Countries',c.countryNames.join('、'),'製作国（複数可）','movie131CountryOptions'))+
  row('languages','言語','<label class="movie131-sub">原語'+input('movie131OriginalLanguage',c.originalLanguage?languageName(c.originalLanguage):'','原語','movie131LanguageOptions')+'</label><label class="movie131-sub">使用言語'+input('movie131SpokenLanguages',c.spokenLanguages.map(languageName).join('、'),'使用言語（複数可）')+'</label>')+
  '<div class="movie131-row movie131-actions"><button type="button" class="btn" id="movie131Fetch">TMDBから分類を取得／更新</button>'+
  '<button type="button" class="btn" id="movie131Reset"'+(Object.keys(o).length?'':' hidden')+'>会社・制作・言語を自動情報に戻す</button>'+
  '<small id="movie131Status">'+(a.schema===2?'TMDB取得済み':'未取得の項目は空欄です')+'。形式・独自ジャンルの指定は優先して保持します。</small></div>';
 const rows=[...editor.querySelectorAll(':scope>.struct-row')];
 const original=rows.find(r=>r.querySelector('.struct-label')?.textContent.trim()==='制作区分');
 if(original){original.hidden=true;original.style.display='none'}
 const type=rows.find(r=>r.querySelector('.struct-label')?.textContent.trim()==='種別');
 const anchor=type?.nextSibling||editor.firstChild;
 const newRows=[...add.children];for(const e of newRows.slice(0,3))editor.insertBefore(e,anchor);
 editor.appendChild(newRows[3]);
 const bind=(id,key,convert)=>document.getElementById(id).onchange=e=>setOverride(f,key,e.target.value.trim()?convert(e.target.value):undefined);
 bind('movie131Companies','companies',s=>split(s).map(name=>({name,id:0})));
 bind('movie131Countries','countries',s=>split(s).map(countryCode));
 bind('movie131OriginalLanguage','originalLanguage',languageCode);
 bind('movie131SpokenLanguages','spokenLanguages',s=>split(s).map(languageCode));
 document.getElementById('movie131Reset').onclick=()=>{const m=meta(f);delete m[META];save();refresh(id);window.__movie30DetailUnified?.refresh();window.dispatchEvent(new Event('movie30-studio-update'))};
 document.getElementById('movie131Fetch').onclick=async e=>{
  const b=e.currentTarget;b.disabled=true;b.textContent='取得中…';
  const result=await window.__movie30Studios?.fetchOne(f,true);
  if(selectedId!==id)return;
  refresh(id);window.__movie30DetailUnified?.refresh();
  const status=document.getElementById('movie131Status');
  if(result?.status==='no-key')status.textContent='TMDBキーをデータ画面で設定してください。';
  else if(['error','unmatched'].includes(result?.status))status.textContent='作品を確認できないため取得しませんでした。後から再試行できます。';
 };
 window.__movie30DetailUnified?.refresh();
}
function catalogOptions(){
 const countries=new Set(),languages=new Set();
 for(const f of allFilms()){const c=get(f);c.countries.forEach(v=>countries.add(v));uniq([c.originalLanguage,...c.spokenLanguages]).forEach(v=>languages.add(v))}
 return {countries:[...countries].sort((a,b)=>countryName(a).localeCompare(countryName(b),'ja')),languages:[...languages].sort((a,b)=>languageName(a).localeCompare(languageName(b),'ja'))};
}
function installFilters(){
 const options=catalogOptions();
 for(const suffix of ['Rank','Classify']){
  const old=document.getElementById('originFilter'+suffix);if(!old)continue;
  old.value='';old.hidden=true;
  const create=(key,label,items,name)=>{
   let select=document.getElementById('movie131'+key+suffix);
   if(!select){select=document.createElement('select');select.id='movie131'+key+suffix;select.className='field';select.setAttribute('aria-label',label);old.after(select);select.onchange=()=>suffix==='Rank'?renderRank():renderClassify()}
   const value=select.value;
   select.innerHTML='<option value="">'+label+'：すべて</option>'+items.map(x=>'<option value="'+esc(x)+'">'+esc(name(x))+'</option>').join('');
   select.value=items.includes(value)?value:'';
  };
  create('Language','言語',options.languages,languageName);create('Country','制作',options.countries,countryName);
 }
}
function filterMatches(f){
 const suffix=view.page==='rank'?'Rank':view.page==='classify'?'Classify':null;if(!suffix)return true;
 const country=document.getElementById('movie131Country'+suffix)?.value||'',language=document.getElementById('movie131Language'+suffix)?.value||'',c=get(f);
 return (!country||c.countries.includes(country))&&(!language||c.originalLanguage===language||c.spokenLanguages.includes(language));
}
async function hydrate(){
 try{
  const response=await fetch('./tmdb-metadata.json?classification=20261120v131');if(!response.ok)return;
  const rows=(await response.json()).films||{};let changed=false;
  for(const f of allFilms()){
   const r=rows[f.id]?.classification131;if(r?.schema!==2)continue;
   const titles=[f.title,f.lbTitle,f.originalTitle,f.englishTitle,...Object.values(titleInfo(f)).filter(x=>typeof x==='string')].map(norm).filter(Boolean);
   if(!r.filmTitles?.some(t=>titles.includes(norm(t)))||(r.filmYear&&f.year&&String(r.filmYear)!==String(f.year)))continue;
   const old=automatic(f);
   if(old.schema===2&&String(old.checkedAt||'')>=String(r.checkedAt||''))continue;
   const m=state.letterboxdMeta[f.id]=state.letterboxdMeta[f.id]||{};m.studio130=r;changed=true;
  }
  if(changed){save(false);installFilters();refresh();window.dispatchEvent(new Event('movie30-studio-update'))}
 }catch(_){}
}
window.__movie30Classification={version:131,get,searchable,refresh,countryName,languageName,options:catalogOptions};
const style=document.createElement('style');style.textContent='#originFilterRank,#originFilterClassify{display:none!important}.movie131-row .field{width:100%;min-height:38px;font-size:16px}.movie131-sub{display:block;font-size:11px;color:#aeb7c4;margin:8px 0}.movie131-sub .field{display:block;margin-top:5px}.movie131-actions{display:flex;flex-wrap:wrap;gap:7px;padding:10px 0}.movie131-actions small{display:block;width:100%;color:#9bafc0;font-size:10px;line-height:1.5}';document.head.appendChild(style);
for(const [id,codes,name] of [['movie131CountryOptions',COUNTRY_CODES,countryName],['movie131LanguageOptions',LANGUAGE_CODES,languageName]]){
 const list=document.createElement('datalist');list.id=id;list.innerHTML=codes.map(c=>'<option value="'+esc(name(c))+'"></option>').join('');document.body.appendChild(list);
}
Promise.resolve(window.__movie30StorageReady).then(()=>{
 if(window.__movie30RecoveryBlocked)return;
 const baseOpen=openSheet;openSheet=function(id,...args){const out=baseOpen.call(this,id,...args);refresh(id);window.__movie30Studios?.queueAuto(filmById(id));return out};
 const baseMatch=match;match=function(f,q){if(!filterMatches(f))return false;const tokens=String(q||'').trim().split(/\s+/).map(norm).filter(Boolean),text=norm(searchable(f));return !tokens.length||tokens.every(token=>baseMatch(f,token)||text.includes(token))};
 const editor=document.getElementById('editGenrePicker');editor?.addEventListener('click',()=>{const id=selectedId;setTimeout(()=>{if(id===selectedId)refresh(id)},150)},true);
 installFilters();void hydrate();
}).catch(()=>{});
let timer=null;window.addEventListener('movie30-studio-update',()=>{clearTimeout(timer);timer=setTimeout(()=>{installFilters();refresh();window.__movie30DetailUnified?.refresh();if(view.page==='rank')renderRank();else if(view.page==='classify')renderClassify()},700)});
})();
