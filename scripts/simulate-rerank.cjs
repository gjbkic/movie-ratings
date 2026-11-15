// Conditional synthetic benchmark, not a forecast of the user's preferences.
// Run: node scripts/simulate-rerank.cjs 400 3000 1
// Fixed total order, no misclicks/ties/cycles, eight independent genre groups.
const fs=require('fs'),path=require('path');
const n=Number(process.argv[2]||400),rounds=Number(process.argv[3]||1200),seed=Number(process.argv[4]||1);
const films=Array.from({length:n},(_,i)=>({id:'sim-'+i,title:'Sim '+i,star:4,score:85,category:['SF','ドラマ','コメディ','ホラー','アクション','恋愛','戦争','ファンタジー'][i%8]}));
const state={genreOverrides:Object.fromEntries(films.map(f=>[f.id,[f.category]]))};
const sandbox={state,window:{},document:{createElement:()=>({textContent:''}),head:{appendChild(){}}},allFilms:()=>films,filmById:id=>films.find(f=>f.id===id),filmStar:f=>f.star,effectiveScore:f=>f.score,filmCategory:f=>f.category,displayTitle:f=>f.title,save(){}};

let source=fs.readFileSync(path.join(__dirname,'../patch-v120.js'),'utf8').replace('rrInstall();','globalThis.sim={session:rrNewSession,model:rrModel,choose:rrChooseTriad,bounds:rrOrderBounds,positions:rrTriadPositions,jumps:rrBuildJumpChecks,hash:rrHash};');
const api=new Function(...Object.keys(sandbox),source+";return globalThis.sim;")(...Object.values(sandbox)),truth=new Map(films.slice().sort((a,b)=>api.hash(a.id+'truth'+seed)-api.hash(b.id+'truth'+seed)).map((f,i)=>[f.id,i]));
const r=api.session();let model=api.model(r);const started=Date.now();
for(let t=0;t<rounds;t++){
 const chosen=api.choose(r,r.mode),ordered=chosen.slice().sort((a,b)=>truth.get(a)-truth.get(b));
 const e={id:'sim-'+t,ids:ordered,displayIds:chosen,groups:ordered.map(id=>[id])};r.events.push(e);
 const before=model;model=api.model(r);e.triadPositions=api.positions(before,model,chosen);e.jumpChecks=api.jumps(before,model,e);
 if((t+1)%100===0||t===rounds-1){
  const seen=model.order.slice(0,model.seenCount),ranks=seen.map(id=>truth.get(id));let inversions=0;for(let a=0;a<ranks.length;a++)for(let b=a+1;b<ranks.length;b++)if(ranks[a]>ranks[b])inversions++;
  const fixed=api.bounds(model),error=seen.map((id,i)=>Math.abs(i-truth.get(id))).sort((a,b)=>a-b);
  console.log(JSON.stringify({n,seed,rounds:t+1,seen:seen.length,inversionsPct:+(100*inversions/(seen.length*(seen.length-1)/2)).toFixed(2),medianError:error[Math.floor(error.length*.5)],p90Error:error[Math.floor(error.length*.9)],exact:fixed.exact,width10:fixed.within10,sec:+((Date.now()-started)/1000).toFixed(1)}));
 }
}
