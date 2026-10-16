'use strict';
const {test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {launch,origin,ready,assert,fixture}=require('./harness.cjs');
const root=path.resolve(__dirname,'../..');
test('pure queries match pre-extraction behavior for 740 films and edge values without mutations',()=>{
 const seed=fixture().state,films=seed.customFilms;
 const names=['filmById','titleInfo','displayTitle','secondaryTitle','filmCategory'];
 const legacy={state:seed,allFilms:()=>films};vm.createContext(legacy);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'film-queries-baseline.txt'),'utf8'),legacy);
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'app-film-queries.js'),'utf8'),ctx);const q=ctx.window.Movie30FilmQueries;
 const cases=[...films,{id:'edge',title:' ',originalTitle:' 原題 ',englishTitle:' 英題 ',category:'  ',tmdbId:0},{id:'empty'},{id:'lb',lbTitle:' Alias ',title:null}];
 for(const override of [{},{edge:{title:'',originalTitle:null,englishTitle:' 手動 ',tmdbId:0}},{edge:{title:0,originalTitle:false,englishTitle:null,tmdbId:null}}]){
  seed.titleOverrides=override;seed.categoryOverrides={edge:0};const before=JSON.stringify([seed,cases]);
  for(const f of cases){for(const name of names.slice(1)){const actual=q[name](f,name==='filmCategory'?seed.categoryOverrides:seed.titleOverrides);assert.equal(JSON.stringify(actual),JSON.stringify(legacy[name](f)),name+' '+f.id)}}
  assert.equal(JSON.stringify([seed,cases]),before);
 }
 const duplicate={...films[0],title:'duplicate'};assert.equal(q.filmById([...films,duplicate],films[0].id),films[0]);assert.equal(q.filmById(films,'missing'),undefined);
});
test('delegates observe replacement state and edited titles across save/reload',async()=>{
 const browser=await launch();try{const page=await browser.newPage();await page.goto(origin);await ready(page);
 const before=await page.evaluate(()=>JSON.stringify([state.exactScores,state.rankOrder,state.letterboxdMeta]));
 const out=await page.evaluate(async()=>{state=JSON.parse(JSON.stringify(state));state.titleOverrides['fixture-0012']={title:'架空の手動タイトル',englishTitle:' Fictional manual '};state.categoryOverrides['fixture-0012']='架空分類';await save();const f=filmById('fixture-0012');return [displayTitle(f),secondaryTitle(f),filmCategory(f),filmById('does-not-exist')===undefined]});
 assert.deepEqual(out,['架空の手動タイトル','Original Fixture 12','架空分類',true]);await page.reload();await ready(page);
 assert.equal(await page.evaluate(()=>displayTitle(filmById('fixture-0012'))),'架空の手動タイトル');assert.equal(await page.evaluate(()=>JSON.stringify([state.exactScores,state.rankOrder,state.letterboxdMeta])),before);
 }finally{await browser.close()}
});
