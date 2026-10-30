'use strict';
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const suites=['data-contract','storage-reconnect','multitab','sync-retry','sync-divergence-review','episode-duplicates','html-snapshot','catalog-shared','film-queries','rank-queries','score-policy','score-entry-gate','score-migration-stage','score-preview','score-preview-page','score-migration-store','detail-ranks','rank-view','search-base','search-extensions','search-cast','search-taxonomy','search-catalog-credits','render-lifecycle','lb-transport','star-editor','unrated-panels','pending-posters','poster-refresh','poster-scope','detail-unified','detail-render-contract','filtered-ui','advanced-search','pending-search-layout','drag-touch','long-drag','search-drag','search-registration','search-keyboard','mobile-search-poster','compare-scroll-lock','letterboxd','letterboxd-review','lb-sync-deadline','sheet-data-ui','crayon-duplicate'];
suites.splice(3,0,'history-safety');
const requested=process.argv[2]||'all';
if(requested!=='all'&&!suites.includes(requested))throw Error('Unknown regression suite: '+requested);
const selected=requested==='all'?suites:[requested],results=[];
const browserTmp=path.resolve(__dirname,'../../test-results/browser-tmp');
if(process.platform==='win32')fs.mkdirSync(browserTmp,{recursive:true});
const testEnv=process.platform==='win32'?{...process.env,TEMP:browserTmp,TMP:browserTmp}:process.env;
for(const name of selected){
 const started=Date.now();
 const result=spawnSync(process.execPath,[...(['data-contract','storage-reconnect','multitab','history-safety','sync-retry','sync-divergence-review','episode-duplicates','html-snapshot','catalog-shared','film-queries','rank-queries','score-policy','detail-ranks','search-base','search-extensions','search-cast','search-taxonomy','search-catalog-credits','render-lifecycle','lb-transport'].includes(name)?['--test']:[]),path.join(__dirname,name+'.cjs')],{cwd:path.resolve(__dirname,'../..'),env:testEnv,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 results.push({suite:name,status:result.status===0&&!result.error?(name==='known-issues'?'known-defects-reproduced':'passed'):'failed',durationMs:Date.now()-started,...(result.error?{error:result.error.message}:{})});
}
const dir=path.resolve(process.env.MOVIE_TEST_RESULTS||'test-results');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,requested+'.json'),JSON.stringify({node:process.version,results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.status==='failed')?1:0;
