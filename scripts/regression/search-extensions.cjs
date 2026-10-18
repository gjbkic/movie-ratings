'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./fixture.cjs');
const baseline=require('./search-extensions-baseline.json');
const fold=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-search-queries.js'),'utf8'),ctx);
const helpers=ctx.window.Movie30SearchQueries;
for(const name of Object.keys(baseline))test(name+' search preserves legacy IDs before/after dynamic metadata updates',()=>{
 const films=fixture().state.customFilms,state={letterboxdMeta:{}},catalog={};
 const aliases=new Map([[fold('Synthetic Director A'),['架空監督甲','Ａ監督']],[fold('Synthetic Creator B'),['架空制作者乙']]]);
 const deps={state,catalog,aliases,fold,norm:fold,meta:id=>state.letterboxdMeta[id]||{},matchPrior:()=>false,priorMatch:()=>false,baseMatch:()=>false};
 const old=vm.runInNewContext('('+baseline[name]+')',deps);
 const next=(f,q)=>helpers[name](q,name==='catalogLabels'?catalog[f.id]||{}:state.letterboxdMeta[f.id]||{},aliases,fold);
 for(const stage of ['empty','fetched','manual','replaced']){
  if(stage==='fetched'){state.letterboxdMeta[films[12].id]={crew84:{directors:['Synthetic Director A','Ｄｉｒ Ｃ'],creators:['Synthetic Creator B']}};catalog[films[13].id]={title:'架空 ＴＩＴＬＥ 甲',directorAliases:['架空・別名乙']}}
  if(stage==='manual'){state.letterboxdMeta[films[14].id]={directors84Manual:['Synthetic Director A']};aliases.set(fold('Synthetic Director A'),['変更後の架空監督'])}
  if(stage==='replaced'){state.letterboxdMeta[films[12].id]={crew84:{directors:['新しい架空監督']}};catalog[films[13].id]={title:'変更済み架空題名'}}
  const before=JSON.stringify({films,state,catalog,aliases:[...aliases]});
  for(const q of ['',null,undefined,0,false,1,' ','・','---','架空','架空監督甲','Ａ監督','synthetic director','ＳＹＮＴＨＥＴＩＣ','DIR C','架空別名','ＴＩＴＬＥ','title','変更','不存在'])assert.deepEqual(films.filter(f=>next(f,q)).map(f=>f.id),films.filter(f=>old(f,q)).map(f=>f.id),name+' '+stage+' '+String(q));
  assert.equal(JSON.stringify({films,state,catalog,aliases:[...aliases]}),before,'Search mutated inputs');
 }
});
