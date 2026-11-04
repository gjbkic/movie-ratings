'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./fixture.cjs');
test('structured search preserves result IDs, normalization and dynamic metadata',()=>{
 const films=fixture().state.customFilms;let label='映画',manual='';
 const deps={titleInfo:f=>({title:manual||f.title,originalTitle:f.originalTitle,englishTitle:f.englishTitle}),mediaLabel19:()=>label,origin19:()=> '日本',formatLabel19:()=> '実写',rawGenres:()=>['ドラマ','SF'],runtime19:()=>120};
 const old={...deps};vm.createContext(old);vm.runInContext(fs.readFileSync(path.join(__dirname,'search-base-baseline.txt'),'utf8'),old);
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../app-search-queries.js'),'utf8'),ctx);const fn=ctx.window.Movie30SearchQueries.structuredMatch;
 const before=JSON.stringify(films);
 for(const changed of [false,true]){if(changed){label='ドラマ';manual='手動 TITLE ＡＢＣ'}for(const query of ['',null,0,'架空作品 12','fixture','日本','映画','ドラマ','実写','SF','120','TITLE','abc','ＡＢＣ',' ','.','不存在']){assert.deepEqual(films.filter(f=>fn(f,query,deps)).map(f=>f.id),films.filter(f=>old.match(f,query)).map(f=>f.id),String(query))}}
 assert.equal(JSON.stringify(films),before);
});
