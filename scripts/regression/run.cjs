'use strict';
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const suites=['data-contract','storage-reconnect','multitab','sync-retry','sync-divergence-review','episode-duplicates','html-snapshot','catalog-shared','film-queries','rank-queries','detail-ranks','search-base','search-extensions','search-cast','search-taxonomy','search-catalog-credits','render-lifecycle','lb-transport','star-editor','unrated-panels','pending-posters','poster-refresh','detail-unified','filtered-ui','drag-touch','long-drag','search-drag','search-registration','letterboxd','letterboxd-review','lb-sync-deadline','sheet-data-ui'];
const requested=process.argv[2]||'all';
if(requested!=='all'&&!suites.includes(requested))throw Error('Unknown regression suite: '+requested);
const selected=requested==='all'?suites:[requested],results=[];
for(const name of selected){
 const started=Date.now();
 const result=spawnSync(process.execPath,[...(['data-contract','storage-reconnect','multitab','sync-retry','sync-divergence-review','episode-duplicates','html-snapshot','catalog-shared','film-queries','rank-queries','detail-ranks','search-base','search-extensions','search-cast','search-taxonomy','search-catalog-credits','render-lifecycle','lb-transport'].includes(name)?['--test']:[]),path.join(__dirname,name+'.cjs')],{cwd:path.resolve(__dirname,'../..'),env:process.env,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 results.push({suite:name,status:result.status===0&&!result.error?(name==='known-issues'?'known-defects-reproduced':'passed'):'failed',durationMs:Date.now()-started,...(result.error?{error:result.error.message}:{})});
}
const dir=path.resolve(process.env.MOVIE_TEST_RESULTS||'test-results');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,requested+'.json'),JSON.stringify({node:process.version,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.status==='failed')?1:0;
