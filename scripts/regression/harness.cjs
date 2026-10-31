'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),origin='https://movie-regression.test';
const sourceRoot=path.resolve(process.env.MOVIE_APP_ROOT||root);
const allowed=new Set(fs.readdirSync(sourceRoot).filter(n=>/^app-[\w-]+\.js$/.test(n)).concat(['index.html','recovery-check.html','score-preview.html']));
const downloadsPath=path.join(root,'test-results','downloads');fs.mkdirSync(downloadsPath,{recursive:true});
const options={headless:true,downloadsPath,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})};
async function isolate(context,{seed=fixture().state}={}){
  const requests=[];
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());requests.push({host:u.host,path:u.pathname,method:route.request().method()});
    if(![origin,'http://localhost:8777','http://localhost:8778','http://localhost:8783','http://localhost:8784','http://localhost:8785','http://localhost:8789','http://localhost:8799'].includes(u.origin))return route.abort('blockedbyclient');
    // No request is forwarded to a server, including localhost. Only explicit static assets.
    const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
    if(name==='seed')return route.fulfill({contentType:'text/html',body:'isolated fixture origin'});
    if(name==='live-state.json')return route.fulfill({json:{...fixture(),state:seed}});
    if(name==='tmdb-metadata.json')return route.fulfill({json:{schema:1,films:{},updatedAt:'2026-01-01'}});
    if(name==='cast-fetch-report.json')return route.fulfill({json:{}});
    if(name==='letterboxd-gjbkic.xml')return route.fulfill({contentType:'application/xml',body:'<rss><channel></channel></rss>'});
    if(/^recovery-ranks-/.test(name))return route.fulfill({json:{sourceCommit:'synthetic-only',rankOrder:seed.rankOrder,scores:seed.exactScores,clearScores:[],correctScores:[],knownDamagedOrders:{}}});
    if(!allowed.has(name))return route.fulfill({status:404,body:'not a test asset'});
    let body=fs.readFileSync(path.join(sourceRoot,name),'utf8');
    // Substitute only the embedded dataset in the response; application code/files stay unchanged.
    if(name==='app-core.js'){
      assert.match(body,/const BASE_FILMS=\[[^\n]*\];\r?\nconst DEFAULT_MAP=/,'Seed extraction contract changed');
      body=body.replace(/const BASE_FILMS=\[[^\n]*\];(?=\r?\nconst DEFAULT_MAP=)/,'const BASE_FILMS=[];');
    }
    return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':'text/html',body});
  });
  await context.addInitScript(seed=>{
    if(!localStorage.getItem('regression-initialized')){
      localStorage.setItem('movie30_data_v1',JSON.stringify(seed));
      localStorage.setItem('regression-initialized','1');
    }
    localStorage.setItem('movie30_letterboxd_settings_v1',JSON.stringify({username:'fixture-user',auto:false}));
    localStorage.setItem('movie30_github_stable_auto_v1','0');
    localStorage.setItem('movie30_github_sync_settings_v1',JSON.stringify({auto:false}));
  },seed);
  return requests;
}
async function launch(){
  const browser=await chromium.launch(options),newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);
  const seen=new WeakSet();
  const prepare=async c=>{if(!seen.has(c)){seen.add(c);await isolate(c)}return c};
  browser.newContext=async opts=>prepare(await newContext(opts));
  browser.newPage=async opts=>{const page=await newPage(opts);await prepare(page.context());return page};
  return browser;
}
async function ready(page){await page.waitForSelector('html.movie30-ready',{timeout:30000});await page.evaluate(()=>window.__movie30PendingSave);}
async function snapshot(page){return page.evaluate(()=>JSON.parse(JSON.stringify(state)));}
async function saved(page){return page.evaluate(async()=>{const ok=await window.__movie30PendingSave;return {ok,failed:!!window.__movie30SaveFailed,status:document.getElementById('saveState').textContent}});}
async function reload(page){await page.reload();await ready(page);}
module.exports={launch,isolate,chromium,options,fixture,origin,ready,snapshot,saved,reload,assert};
