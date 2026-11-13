(()=>{
'use strict';
const BUILD='20261113-crossgroup-v109';
let rrTriad=null,rrOrder=[],rrTie12=false,rrTie23=false,rrPicks=[],rrLogOpen=false,rrLogTab='history',rrTieOpen=false,rrTiePartner=false;

// Uses the same image service as the film detail panel, including its cache.
const rrPosterAPI=()=>window.__movie30PosterBridge84||null;
const rrPosterMeta=f=>rrPosterAPI()?.meta?.(f)||null;
const rrPosterUrl=(path,size)=>rrPosterAPI()?.url?.(path,size)||'';
const rrPosterQueue=f=>rrPosterAPI()?.queue?.(f);
let rrWarmToken=0;const rrPreloadedImages=new Map(),rrPrefetching=new Set();
function rrPosterSize(){return typeof window!=='undefined'&&window.innerWidth>760?'w342':'w185'}
function rrPreloadSource(path){
 const url=rrPosterUrl(path,rrPosterSize());
 if(!url||typeof Image!=='function'||rrPreloadedImages.has(url))return;
 const img=new Image();img.decoding='async';img.src=url;
 rrPreloadedImages.set(url,img);
 while(rrPreloadedImages.size>45)rrPreloadedImages.delete(rrPreloadedImages.keys().next().value);
}
function rrPreloadFilm(f){
 if(!f||rrPrefetching.has(f.id))return;
 const path=rrPosterMeta(f)?.path;
 if(path){rrPreloadSource(path);return}
 const api=rrPosterAPI();
 if(!api?.load||!api?.hasCredential?.())return;
 rrPrefetching.add(f.id);
 Promise.resolve().then(()=>api.load(f)).then(found=>{if(found)rrPreloadSource(found)}).catch(()=>{}).finally(()=>rrPrefetching.delete(f.id));
}
function rrWarmNext(r){
 const token=++rrWarmToken;
 if(rrLogOpen||!rrTriad||rrTriad.length!==3)return;
 setTimeout(()=>{
  if(token!==rrWarmToken||rrLogOpen||view.page!=='rerank')return;
  const pretend={...r,baselineIds:r.baselineIds.slice(),events:r.events.concat([{
   ids:rrTriad.slice(),groups:rrTriad.map(id=>[id])
  }])};
  const next=rrChooseTriad(pretend,r.mode);
  for(const id of next)if(!rrTriad.includes(id))rrPreloadFilm(filmById(id));
 },35);
}

function rrHash(id){
  let h=2166136261;const t=String(id)+"|fresh-2026";
  for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function rrGlobal(){
  // Eligibility only: no old ranks or scores are used to initialize the new order.
  // Include every rated title (movies, TV series, episodes, etc.).
  // Star threshold is unchanged; previous comparison history is preserved.
  // Only finalized scores qualify, exactly as the main ranking's
  // "未確定" section does. Star rating by itself is not enough.
  // Keep all media types including series and episodes.
  return allFilms().filter(f=>{
    if(Number(filmStar(f))<3)return false;
    const score=effectiveScore(f);
    return score!=null&&Number.isFinite(Number(score));
  }).sort((a,b)=>rrHash(a.id)-rrHash(b.id)||String(a.id).localeCompare(String(b.id)));
}
function rrNewSession(){
  const ids=rrGlobal().map(f=>f.id);
  return {version:2,startedAt:Date.now(),baselineIds:ids,events:[],skips:[],
    rangeStart:1,rangeEnd:ids.length,mode:"local"};
}
function rrState(create=true){
  if(!state.rerankV2&&create)state.rerankV2=rrNewSession();
  const r=state.rerankV2;
  if(!r)return null;
  r.events=Array.isArray(r.events)?r.events:[];
  r.skips=Array.isArray(r.skips)?r.skips:[];
  r.baselineIds=Array.isArray(r.baselineIds)?r.baselineIds:[];
  r.mode=["local","wide","conflict"].includes(r.mode)?r.mode:"local";
  return r;
}
function rrEnsureFresh(r){
  const current=rrGlobal().map(f=>f.id),valid=new Set(current);
  const baseline=[...new Set(r.baselineIds.filter(id=>valid.has(id)))];
  for(const id of current)if(!baseline.includes(id))baseline.push(id);
  r.baselineIds=baseline;
  r.rangeStart=1;r.rangeEnd=baseline.length;
}
function rrSelectedIds(r){rrEnsureFresh(r);return r.baselineIds.slice()}
function rrPairKey(a,b){return a<b?a+'\u0000'+b:b+'\u0000'+a}
function rrStats(r,ids){
  const allowed=new Set(ids),pairs=new Map(),counts=new Map(ids.map(id=>[id,0]));
  let ambiguous=0;
  for(const e of r.events){
    if(e.ambiguous){if((e.ids||[]).some(id=>allowed.has(id)))ambiguous++;continue;}
    const groups=Array.isArray(e.groups)?e.groups:[];
    const pos=new Map();groups.forEach((g,gi)=>(g||[]).forEach(id=>pos.set(id,gi)));
    const members=[...pos.keys()].filter(id=>allowed.has(id));
    for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
      const a=members[i],b=members[j],pa=pos.get(a),pb=pos.get(b);if(pa==null||pb==null)continue;
      const key=rrPairKey(a,b),first=a<b?a:b,second=a<b?b:a;
      const s=pairs.get(key)||{a:first,b:second,n:0,sum:0,winsA:0,winsB:0,ties:0};
      let outcome=0;if(pa<pb)outcome=1;else if(pa>pb)outcome=-1;
      if(first!==a)outcome=-outcome;
      s.n++;s.sum+=outcome;if(outcome>0)s.winsA++;else if(outcome<0)s.winsB++;else s.ties++;
      pairs.set(key,s);counts.set(a,(counts.get(a)||0)+1);counts.set(b,(counts.get(b)||0)+1);
    }
  }
  const contradictions=[...pairs.values()].filter(p=>p.winsA&&p.winsB);
  // Also detect genuine A>B, B>C, C>A cycles. These are not treated as errors:
  // they are surfaced for re-checking and the consensus model can absorb them.
  const out=new Map(ids.map(id=>[id,new Set()]));
  for(const p of pairs.values()){
    if(!p.sum)continue;
    const winner=p.sum>0?p.a:p.b,loser=p.sum>0?p.b:p.a;
    if(out.has(winner)&&out.has(loser))out.get(winner).add(loser);
  }
  const cycles=[],cycleSeen=new Set();
  for(const a of ids)for(const b of out.get(a)||[])for(const c of out.get(b)||[]){
    if(c===a||b===a||b===c||!out.get(c)?.has(a))continue;
    const sig=[a,b,c].sort().join('|');if(cycleSeen.has(sig))continue;cycleSeen.add(sig);cycles.push([a,b,c]);
  }
  return {pairs,counts,contradictions,cycles,ambiguous};
}
const rrModelCache=new WeakMap();
function rrModel(r){
  const ids=rrSelectedIds(r);
  const signature=ids.join('|');
  const last=r.events[r.events.length-1],cached=rrModelCache.get(r);
  if(cached&&cached.events===r.events&&cached.length===r.events.length&&
      cached.last===last&&cached.signature===signature)return cached.model;
  const stats=rrStats(r,ids),prior=new Map(),score=new Map();
  // All ratings start at 0. The legacy ranking never contributes to the model.
  const lambda=.65,delta=1.0;
  ids.forEach(id=>{prior.set(id,0);score.set(id,0)});
  const neighbors=new Map(ids.map(id=>[id,[]]));
  for(const p of stats.pairs.values()){
    if(!neighbors.has(p.a)||!neighbors.has(p.b))continue;
    const mean=p.n?p.sum/p.n:0,w=Math.min(4,p.n);
    neighbors.get(p.a).push({id:p.b,y:mean,w});
    neighbors.get(p.b).push({id:p.a,y:-mean,w});
  }
  for(let iter=0;iter<120;iter++){
    const next=new Map();
    for(const id of ids){
      let num=0,den=lambda;
      for(const e of neighbors.get(id)||[]){num+=e.w*(score.get(e.id)+delta*e.y);den+=e.w}
      next.set(id,num/den);
    }
    for(const [k,v] of next)score.set(k,v);
  }
  const basePos=new Map(ids.map((id,i)=>[id,i]));
  const order=ids.slice().sort((a,b)=>score.get(b)-score.get(a)||basePos.get(a)-basePos.get(b));
  const model={ids,order,score,stats,basePos};
  rrModelCache.set(r,{events:r.events,length:r.events.length,last,signature,model});
  return model;
}

function rrNetwork(m){
 const ids=m.ids, parent=new Map(ids.map(id=>[id,id])),degrees=new Map(ids.map(id=>[id,new Set()]));
 const root=id=>{let x=id;while(parent.get(x)!==x)x=parent.get(x);return x};
 const join=(a,b)=>{const pa=root(a),pb=root(b);if(pa!==pb)parent.set(pb,pa)};
 for(const p of m.stats.pairs.values()){
  if(!parent.has(p.a)||!parent.has(p.b)||p.n<=0)continue;
  join(p.a,p.b);degrees.get(p.a).add(p.b);degrees.get(p.b).add(p.a);
 }
 const groups=new Map();
 for(const id of ids){
  const p=root(id);if(!groups.has(p))groups.set(p,[]);groups.get(p).push(id);
 }
 return {components:[...groups.values()].sort((a,b)=>b.length-a.length),
  degree:new Map(ids.map(id=>[id,degrees.get(id).size]))};
}
function rrQuantile(sorted,q){
 if(!sorted.length)return 0;
 return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];
}
function rrProgress(r,m){
 const n=m.ids.length,net=rrNetwork(m),counts=m.stats.counts;
 const compared=m.ids.filter(id=>(counts.get(id)||0)>0).length;
 const depth=m.ids.filter(id=>(counts.get(id)||0)>=8&&(net.degree.get(id)||0)>=5).length;
 const underCount=m.ids.reduce((sum,id)=>sum+Math.max(0,8-(counts.get(id)||0)),0);
 const underDegree=m.ids.reduce((sum,id)=>sum+Math.max(0,5-(net.degree.get(id)||0)),0);
 const needed=Math.max(Math.ceil((n-compared)/2),Math.ceil(underCount/6),
  Math.ceil(underDegree/6),Math.ceil((net.components.length-1)/2));
 const judged=r.events.filter(e=>Array.isArray(e.groups)&&e.groups.length>0).length;
 let drift=null;
 if(n>=3&&judged>=90&&compared/n>=.92&&net.components.length===1){
  const recent=40,oldEvents=r.events.slice(0,Math.max(0,r.events.length-recent));
  if(oldEvents.some(e=>Array.isArray(e.groups)&&e.groups.length)){
   const earlier=rrModel({...r,events:oldEvents,baselineIds:r.baselineIds.slice()});
   const positions=new Map(earlier.order.map((id,i)=>[id,i]));
   const change=m.order.map((id,i)=>Math.abs(i-positions.get(id))).sort((a,b)=>a-b);
   drift={window:Math.min(recent,r.events.length),median:rrQuantile(change,.5),
    p90:rrQuantile(change,.9)};
  }
 }
 const fullyCompared=compared===n;
 const connected=net.components.length===1;
 let stage='一巡中',detail='まず全作品に比較結果をつなぎます。';
 if(fullyCompared&&!connected){stage='比較網を接続中';detail='離れた作品群を横断比較します。'}
 if(fullyCompared&&connected){stage='順位の精度を向上中';detail='比較回数が少ない作品や接戦を補強します。'}
 if(fullyCompared&&connected&&depth>=.8*n&&!drift){
  stage='変動を測定中';detail='直近の比較による順位変動を測り始めています。';
 }
 if(fullyCompared&&connected&&depth>=.8*n&&drift){
  const moderate=drift.median<=Math.max(3,Math.round(n*.025))&&drift.p90<=Math.max(9,Math.round(n*.07));
  const tight=drift.median<=Math.max(2,Math.round(n*.012))&&drift.p90<=Math.max(5,Math.round(n*.035));
  stage=tight?'全体は安定傾向':moderate?'安定しつつある':'まだ順位が動く';
  detail=tight?'大きな順位変動は減りました。近い作品の前後関係にはまだ誤差があります。':
   moderate?'全体像が固まりつつあります。接戦の再比較が有効です。':
   '最近の判断でも順位が大きく動くため、比較を続ける価値があります。';
 }
 let remaining=null;
 if(n>=3){
  const floor=Math.ceil(needed*1.12);
  if(floor>0){
   const lo=Math.ceil(floor/10)*10,hi=Math.ceil(Math.max(lo,floor*1.55)/10)*10;
   remaining={lo,hi};
  }else if(!drift||stage==='まだ順位が動く'||stage==='変動を測定中'||stage==='安定しつつある'){
   remaining={lo:40,hi:120};
  }
 }
 return {n,compared,depth,components:net.components.length,net,drift,stage,detail,
  judged,remaining,estimated:remaining?('あと約'+remaining.lo+'〜'+remaining.hi+'回'):'大枠は安定傾向'};
}
function rrProgressHtml(p){
 const pct=p.n?Math.round(100*p.compared/p.n):0,
  deep=p.n?Math.round(100*p.depth/p.n):0;
 return '<div class="rr-progress-intro"><strong>'+esc(p.stage)+'</strong><span>'+esc(p.estimated)+'</span></div>'+
  '<div class="rr-progress-meter"><span style="width:'+pct+'%"></span></div>'+
  '<div class="rr-progress-sublabel">比較済み '+p.compared+' / '+p.n+
  '本 · 比較が十分な作品 '+p.depth+'本</div>';
}
function rrProgressDetail(p){
 const n=p.n||1;
 return '<div class="rr-drawer-inner rr-progress-details">'+
  '<h3>現在のランキングの安定度</h3>'+
  '<div class="rr-progress-big">'+esc(p.stage)+'</div>'+
  '<p>'+esc(p.detail)+'</p>'+rrProgressHtml(p)+
  '<div class="rr-progress-figures">'+
   '<div><strong>'+p.compared+' / '+p.n+'</strong><small>一度以上比較した作品</small></div>'+
   '<div><strong>'+p.depth+' / '+p.n+'</strong><small>8判断・異なる5作品以上との比較</small></div>'+
   '<div><strong>'+p.components+'</strong><small>比較がつながっているグループ数（理想は1）</small></div>'+
   '<div><strong>'+p.judged+'</strong><small>有効な3本比較の記録</small></div>'+
  '</div>'+
  (p.drift?
   '<div class="rr-progress-drift"><strong>直近'+p.drift.window+'回の比較による順位変動</strong>'+
    '<span>中央値 '+p.drift.median+'位 / 90パーセンタイル '+p.drift.p90+'位</span></div>':
   '<div class="rr-progress-drift">順位変動の判定は、比較がほぼ全作品につながり、ある程度の記録が集まってから表示します。</div>')+
  '<p class="rr-muted">残り回数は現在の比較不足・比較相手の偏り・順位変動から算出した作業量の目安で、正確な順位や完成までの回数を保証するものではありません。比較が増えると予測も変わります。旧順位・元の点数は推定に一切使っていません。</p>'+
  '</div>';
}

function rrTriadSig(ids){return ids.slice().sort().join('|')}
function rrBridgeTriad(r,m,used){
 const ids=m.order,n=ids.length;
 if(n<9)return null;
 const stats=m.stats,positions=new Map(ids.map((id,i)=>[id,i]));
 const count=id=>stats.counts.get(id)||0;
 const pair=(a,b)=>stats.pairs.get(rrPairKey(a,b))?.n||0;
 // Each event supplies contextual evidence: first among one trio, last among
 // another. Neither outcome fixes absolute rank across different trios.
 const top=new Map(),bottom=new Map();
 const allowed=new Set(ids);
 for(const e of r.events){
  const groups=Array.isArray(e.groups)?e.groups:[];
  if(groups.length<2)continue;
  for(const id of groups[0]||[])if(allowed.has(id))top.set(id,(top.get(id)||0)+1);
  for(const id of groups[groups.length-1]||[])if(allowed.has(id))bottom.set(id,(bottom.get(id)||0)+1);
 }
 const band=Math.max(2,Math.floor(n*.34));
 const high=ids.slice(0,band),low=ids.slice(-band);
 // If someone repeatedly won weak comparisons yet remains low in the model,
 // explicitly pair them with a repeated last-place finisher from high groups.
 const lowCandidates=low.slice().sort((a,b)=>
   (top.get(b)||0)-(top.get(a)||0)||count(a)-count(b)||
   rrHash(a+'|bridge'+r.events.length)-rrHash(b+'|bridge'+r.events.length)).slice(0,24);
 const highCandidates=high.slice().sort((a,b)=>
   (bottom.get(b)||0)-(bottom.get(a)||0)||count(a)-count(b)||
   rrHash(a+'|bridge'+r.events.length)-rrHash(b+'|bridge'+r.events.length)).slice(0,24);
 const unseen=ids.filter(id=>count(id)===0);
 const center=ids.slice(band,n-band);
 const thirdPool=(unseen.length?unseen:center).slice().sort((a,b)=>
   count(a)-count(b)||
   rrHash(a+'|third'+r.events.length)-rrHash(b+'|third'+r.events.length)).slice(0,18);
 if(!thirdPool.length)thirdPool.push(...ids.slice(Math.floor(n*.4),Math.ceil(n*.6)).slice(0,18));
 let best=null,bestValue=-Infinity;
 for(const a of lowCandidates)for(const b of highCandidates){
  if(a===b)continue;
  const compared=pair(a,b);
  const longGap=(positions.get(a)-positions.get(b))/n;
  const context=(top.get(a)||0)>=2&&(bottom.get(b)||0)>=2;
  const priority=(context?110:0)+Math.min(3,top.get(a)||0)*8+
   Math.min(3,bottom.get(b)||0)*8+
   Math.max(0,10-count(a))+Math.max(0,10-count(b))+
   longGap*12-compared*38;
  for(const c of thirdPool){
   if(c===a||c===b)continue;
   const triple=[a,b,c];
   if(used.has(rrTriadSig(triple)))continue;
   const value=priority+Math.max(0,8-count(c))*.6-
     (pair(a,c)+pair(b,c))*1.5+
     (rrHash(triple.join('|')+'|bridge'+r.events.length)%113)/1000;
   if(value>bestValue){best=triple;bestValue=value}
  }
 }
 return best;
}
function rrChooseTriad(r,mode=r.mode){
 const m=rrModel(r),ids=m.order,n=ids.length;if(n<3)return ids;
 const stats=m.stats,net=rrNetwork(m);
 const used=new Set(r.events.slice(-60).map(e=>rrTriadSig(e.displayIds||e.ids||[]))
   .concat((r.skips||[]).slice(-60)));
 const count=id=>stats.counts.get(id)||0,degree=id=>net.degree.get(id)||0;
 const pair=(a,b)=>stats.pairs.get(rrPairKey(a,b))?.n||0;
 const seen=ids.filter(id=>count(id)>0),unseen=ids.filter(id=>count(id)===0);
 const counter=r.events.length+r.skips.length;
 // Guaranteed calibration slots, not merely occasional cross-band candidates
 // that may be discarded by a local-quality score. One in five picks once
 // enough of the graph has been covered. During coverage the third film is
 // preferably unseen, so exploration continues.
 if(mode==='local'&&seen.length>=Math.min(n,Math.max(9,Math.ceil(n*.35)))&&counter%5===4){
  const bridge=rrBridgeTriad(r,m,used);
  if(bridge)return bridge;
 }
 const take=(pool,num,seed)=>{
  const available=pool.slice().sort((a,b)=>count(a)-count(b)||degree(a)-degree(b)||
   rrHash(a+'|'+seed)-rrHash(b+'|'+seed));
  return available.slice(0,num);
 };
 const novel=trio=>trio?.length===3&&new Set(trio).size===3&&!used.has(rrTriadSig(trio));
 if(mode==='conflict'){
  const cycle=stats.cycles.find(c=>novel(c));
  if(cycle)return cycle.slice();
  for(const p of stats.contradictions){
   const third=ids.find(id=>id!==p.a&&id!==p.b&&!pair(id,p.a));
   if(third&&novel([p.a,p.b,third]))return [p.a,p.b,third];
  }
 }
 if(mode==='local'&&unseen.length){
  // Two new films + one already connected anchor whenever possible, so an
  // early film does not end up in a disconnected mini-ranking.
  const isFresh=unseen.slice().sort((a,b)=>rrHash(a+'|'+counter)-rrHash(b+'|'+counter));
  const anchors=seen.slice().sort((a,b)=>count(a)-count(b)||
    rrHash(a+'|anchor'+counter)-rrHash(b+'|anchor'+counter));
  for(let t=0;t<Math.min(28,Math.max(1,isFresh.length));t++){
   const picks=isFresh.slice(t,t+2);
   const chosen=picks.concat(anchors[(counter+t)%Math.max(1,anchors.length)]||[]);
   for(const id of isFresh)if(chosen.length<3&&!chosen.includes(id))chosen.push(id);
   for(const id of ids)if(chosen.length<3&&!chosen.includes(id))chosen.push(id);
   if(novel(chosen))return chosen;
  }
 }
 // Compare across disconnected comparison clusters before fine-tuning ranks.
 if(mode==='local'&&net.components.length>1){
  const groups=net.components.slice().sort((a,b)=>a.length-b.length);
  for(let t=0;t<20;t++){
   const chosen=[];
   for(const g of groups){
    const first=take(g,1,counter+t)[0];
    if(first&&!chosen.includes(first))chosen.push(first);
    if(chosen.length===3)break;
   }
   for(const id of ids)if(chosen.length<3&&!chosen.includes(id))chosen.push(id);
   if(novel(chosen))return chosen;
  }
 }
 if(mode==='wide'){
  const bands=[ids.slice(0,Math.ceil(n/3)),ids.slice(Math.ceil(n/3),Math.ceil(2*n/3)),ids.slice(Math.ceil(2*n/3))];
  for(let t=0;t<36;t++){
   const chosen=bands.map((band,i)=>take(band,Math.min(12,band.length),counter+t+i*7)[t%Math.min(12,band.length)]).filter(Boolean);
   if(novel(chosen))return chosen;
  }
 }
 const pos=new Map(ids.map((id,i)=>[id,i])),score=m.score;
 // Priority: under-tested movies, few unique opponents, uncertain neighboring
 // scores; every fifth selection is deliberately cross-band for calibration.
 const gap=id=>{
  const p=pos.get(id),neighbors=[ids[p-1],ids[p+1]].filter(Boolean);
  return neighbors.length?Math.min(...neighbors.map(x=>Math.abs(score.get(x)-score.get(id)))):1;
 };
 const focus=ids.slice().sort((a,b)=>{
  const priority=id=>Math.max(0,10-count(id))*3+Math.max(0,6-degree(id))*4+
   1/(.09+gap(id))*.7;
  return priority(b)-priority(a)||rrHash(a+'|focus'+counter)-rrHash(b+'|focus'+counter);
 });
 let best=null,bestValue=-Infinity;
 const searchCount=Math.min(48,Math.max(12,n));
 for(let attempt=0;attempt<searchCount;attempt++){
  const f=focus[(attempt+counter%Math.min(17,n))%Math.min(n,Math.max(30,Math.floor(n*.28)))];
  if(!f)continue;
  const rank=pos.get(f),radius=Math.max(9,Math.ceil(n*.1));
  const cross=(counter+attempt)%5===0;
  const local=ids.slice(Math.max(0,rank-radius),Math.min(n,rank+radius+1)).filter(id=>id!==f);
  const candidatePool=cross?ids.filter(id=>id!==f):local;
  const utility=(id,against)=>{
   const d=Math.abs(pos.get(id)-rank),p=pair(id,against);
   const coverage=Math.max(0,10-count(id))*2+Math.max(0,6-degree(id))*3;
   const diversity=5/(1+p);
   const closeness=9/(1+Math.abs(score.get(id)-score.get(against))*4);
   const scope=cross?(d>=n*.17?5:0):9/(1+d/(Math.max(2,n*.035)));
   return coverage+diversity+closeness+scope+((rrHash(id+'|'+counter+':'+attempt)%100)/250);
  };
  let second=null,secondVal=-Infinity;
  for(const id of candidatePool){
   const v=utility(id,f);if(v>secondVal){secondVal=v;second=id}
  }
  if(!second)continue;
  let third=null,thirdVal=-Infinity;
  for(const id of (cross?ids:local)){
   if(id===f||id===second)continue;
   const v=utility(id,f)+utility(id,second)*.55-3*pair(id,second);
   if(v>thirdVal){thirdVal=v;third=id}
  }
  if(!third)continue;
  const triple=[f,second,third];
  if(!novel(triple))continue;
  const quality=secondVal+thirdVal+Math.max(0,10-count(f))*3+
   Math.max(0,6-degree(f))*4-
   (pair(f,second)+pair(f,third)+pair(second,third))*3;
  if(quality>bestValue){best=triple;bestValue=quality}
 }
 if(best)return best;
 for(let i=0;i<n;i++){
  const t=(i+counter)%n,candidate=[ids[t],ids[(t+Math.ceil(n/3))%n],ids[(t+Math.ceil(n*2/3))%n]];
  if(novel(candidate))return candidate;
 }
 return [ids[0],ids[Math.floor(n/2)],ids[n-1]];
}
function rrFilmCard(id,idx,m){
 const f=filmById(id);if(!f)return '';
 const path=rrPosterMeta(f)?.path;
 const size=rrPosterSize();
 const src=rrPosterUrl(path,size);
 const photo='<img class="movie30-poster84" data-poster-id="'+esc(id)+
    '" data-poster-size="'+size+'" alt="" decoding="async" loading="eager" fetchpriority="high"'+(src?' src="'+esc(src)+'"':'')+'>';
 return '<button type="button" class="rr-fast-card" data-rr-pick="'+encodeURIComponent(id)+'" aria-label="'+
   esc(displayTitle(f))+'を選ぶ" aria-pressed="false">'+
   '<span class="rr-fast-poster"><span class="rr-placeholder">POSTER</span>'+photo+
   '<span class="rr-fast-badge">選ぶ</span></span>'+
   '<span class="rr-fast-title">'+esc(displayTitle(f))+'</span>'+
   '<span class="rr-fast-year">'+(f.year||'')+'</span></button>';
}
function rrGroups(){
  if(rrOrder.length!==3)return [];
  if(rrTie12&&rrTie23)return [[rrOrder[0],rrOrder[1],rrOrder[2]]];
  if(rrTie12)return [[rrOrder[0],rrOrder[1]],[rrOrder[2]]];
  if(rrTie23)return [[rrOrder[0]],[rrOrder[1],rrOrder[2]]];
  return rrOrder.map(id=>[id]);
}
function rrSetTriad(ids){
 rrTriad=ids.slice(0,3);rrOrder=rrTriad.slice();rrPicks=[];
 rrTieOpen=false;rrTiePartner=false;rrTie12=false;rrTie23=false;
}
function rrPaintSelection(){
 const root=document.getElementById('rerankRoot');if(!root)return;
 root.querySelectorAll('[data-rr-pick]').forEach(card=>{
  const id=decodeURIComponent(card.dataset.rrPick),position=rrPicks.indexOf(id);
  card.classList.toggle('rr-picked-first',position===0);
  card.classList.toggle('rr-picked-second',position===1);
  card.setAttribute('aria-pressed',position>=0?'true':'false');
  const badge=card.querySelector('.rr-fast-badge');
  if(badge)badge.textContent=position>=0?(position+1)+'位':'選ぶ';
 });
 const prompt=root.querySelector('#rrPickInstruction'),sub=root.querySelector('#rrPickSub');
 if(prompt)prompt.textContent=rrTiePartner?'1位と同格にする作品をタップ':
   rrPicks.length?'次は2位の映画をタップ':'一番好きな作品をタップ';
 if(sub)sub.textContent=rrTiePartner?'選んだ2本を同格の1位にします':
   rrPicks.length?'残り2本同格なら下のボタン／2位をタップすると自動確定':'1位 → 2位の2タップで次へ';
 const hasFirst=rrPicks.length===1;
 for(const selector of ['#rrTieRest','#rrTieFirst']){
  const el=root.querySelector(selector);if(el)el.hidden=!hasFirst;
 }
 const tieFirst=root.querySelector('#rrTieFirst');
 if(tieFirst)tieFirst.classList.toggle('active',!!rrTiePartner);
 const undo=root.querySelector('#rrUndo');
 if(undo)undo.disabled=!(hasFirst||rrTiePartner||(rrState(false)?.events||[]).length);
}
function rrPick(id){
 if(rrLogOpen||!rrTriad||!rrTriad.includes(id))return;
 if(rrTiePartner){
  if(id===rrPicks[0]){rrTiePartner=false;rrPaintSelection();return}
  const first=rrPicks[0],last=rrTriad.find(x=>x!==first&&x!==id);
  const groups=[[first,id],[last]];
  rrTiePartner=false;rrOrder=groups.flat();rrCommit('rank',groups,first);return;
 }
 const i=rrPicks.indexOf(id);
 if(i>=0){rrPicks=rrPicks.slice(0,i);rrTiePartner=false;rrPaintSelection();return}
 rrPicks.push(id);
 if(rrPicks.length===2){
  rrOrder=[rrPicks[0],rrPicks[1],rrTriad.find(x=>!rrPicks.includes(x))];
  rrCommit('rank',null,rrPicks[0]);return;
 }
 rrPaintSelection();
}
function rrNext(){rrSkip()}
function rrCommit(kind='rank',groupsOverride=null,restoreFirst=null){
 const r=rrState();if(!rrTriad||rrTriad.length!==3)return;
 const ordered=(kind==='rank'&&rrOrder.length===3)?rrOrder.slice():rrTriad.slice();
 const e={id:'rr2-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),at:Date.now(),
  ids:ordered,displayIds:rrTriad.slice(),mode:r.mode,kind};
 if(kind==='rank')e.groups=groupsOverride||rrGroups();
 else e.ambiguous=true;
 if(restoreFirst)e.firstPick=restoreFirst;
 r.events.push(e);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();
}
function rrTieRest(){
 if(rrPicks.length!==1)return;
 const first=rrPicks[0],others=rrTriad.filter(id=>id!==first);
 rrOrder=[first,...others];rrCommit('rank',[[first],others],first);
}
function rrTieWithFirst(){
 if(rrPicks.length!==1)return;
 rrTiePartner=true;rrPaintSelection();
}
function rrTieAll(){
 if(!rrTriad||rrTriad.length!==3)return;
 rrOrder=rrTriad.slice();rrCommit('rank',[rrTriad.slice()]);
}
function rrSkip(){const r=rrState();if(rrOrder.length===3)r.skips.push(rrTriadSig(rrOrder));if(r.skips.length>80)r.skips=r.skips.slice(-80);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrUndoEvent(){
 if(rrTiePartner){rrTiePartner=false;rrPaintSelection();return}
 if(rrPicks.length){rrPicks=[];rrPaintSelection();return}
 const r=rrState();
 if(!r.events.length)return;
 const last=r.events.pop();save();
 rrSetTriad((last.displayIds||last.ids||[]).length===3?
    (last.displayIds||last.ids):rrChooseTriad(r,r.mode));
 if(last.firstPick&&rrTriad.includes(last.firstPick))rrPicks=[last.firstPick];
 rrRender();
}
function rrDeleteEvent(id){const r=rrState();r.events=r.events.filter(e=>e.id!==id);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrNew(){
  if(!confirm("新ランキングの比較履歴だけを消してやり直しますか？\n旧ランキング・星・点数・レビューは変更しません。"))return;
  state.rerankV2=rrNewSession();save();
  rrSetTriad(rrChooseTriad(state.rerankV2,"local"));rrRender();
}
function rrHistoryHtml(r){
 const ev=r.events.slice().reverse();
 if(!ev.length)return '<div class="rr-muted">まだ比較履歴はありません。</div>';
 return ev.map((e,j)=>{
   const names=(e.ids||[]).map(id=>displayTitle(filmById(id)||{title:id}));
   const v=e.kind==='cycle'?'三すくみ':e.kind==='hold'?'判断保留':
     (e.groups||[]).map(g=>g.map(id=>displayTitle(filmById(id)||{title:id})).join(' ≈ ')).join(' ＞ ');
   const txt=e.ambiguous?v+'： '+names.join(' / '):v;
   return '<div class="rr-hrow"><b>#'+(r.events.length-j)+'</b><span>'+esc(txt)+
     '</span><button data-rr-del="'+e.id+'">削除</button></div>';
 }).join('');
}
function rrPreviewHtml(r,m){
  const judged=r.events.some(e=>Array.isArray(e.groups)&&e.groups.length);
  if(!judged)return '<div class="rr-muted">まだ順位は未判定です。最初の3作品比較から新しい順位を作ります。旧順位は初期値に使っていません。</div>';
  const html=m.order.map((id,i)=>{
    const f=filmById(id),c=m.stats.counts.get(id)||0;
    return '<div class="rr-rank-row"><b>'+(i+1)+'</b><span>'+esc(displayTitle(f))+
      '</span><small>'+(c?c+" 比較":"未比較")+'</small></div>';
  }).join("");
  return '<div class="rr-muted">比較が少ない段階では順位は大きく変わります。未比較の作品は暫定位置です。</div>'+
    '<div class="rr-rank-scroll">'+html+'</div>';
}
function rrConflictsHtml(m){
 const cycles=m.stats.cycles.slice(0,200),contradictions=m.stats.contradictions.slice(0,100);
 const detail='<div class="rr-muted">過去の比較を横断して、A ＞ B・B ＞ C・C ＞ A となる循環を検出します。この画面の3本だけに起こる現象ではありません。</div>';
 const c=cycles.length?cycles.map((ids,i)=>
  '<div class="rr-hrow"><span>'+esc(ids.map(x=>displayTitle(filmById(x)||{title:x})).join(' ＞ ')+
  ' ＞ '+displayTitle(filmById(ids[0])||{title:ids[0]}))+
  '</span><button data-rr-cycle="'+i+'">再比較</button></div>').join(''):
  '<div class="rr-muted">現時点で循環は検出されていません。</div>';
 const p=contradictions.length?contradictions.map((p,i)=>
  '<div class="rr-hrow"><span>'+esc(displayTitle(filmById(p.a)||{title:p.a})+' ↔ '+
  displayTitle(filmById(p.b)||{title:p.b}))+
  '（逆方向 '+p.winsA+' / '+p.winsB+' 回）</span><button data-rr-pair="'+i+'">再比較</button></div>').join(''):
  '<div class="rr-muted">同じ2本で反対の判断になった組はありません。</div>';
 return detail+'<h3>比較を横断した三すくみ '+m.stats.cycles.length+'組</h3>'+c+
  '<h3>直接比較の逆転 '+m.stats.contradictions.length+'組</h3>'+p;
}
function rrExit(){
 rrLogOpen=false;rrTieOpen=false;rrTiePartner=false;
 view.page='rank';save(false);renderHeader();
}
function rrOpenConflict(ids){
 if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3)return;
 rrSetTriad(ids);rrLogOpen=false;rrRender();
}
function rrRender(){
 const root=document.getElementById('rerankRoot');if(!root)return;
 const r=rrState(),m=rrModel(r);
 if(!rrTriad||rrTriad.some(id=>!m.ids.includes(id)))rrSetTriad(rrChooseTriad(r,r.mode));
 const nSeen=[...m.stats.counts.values()].filter(n=>n>0).length,showLogs=rrLogOpen;
 const progress=rrProgress(r,m);
 // Preserve loaded images when a film appears in consecutive comparisons.
 const reusable=new Map();
 if(!showLogs){
  root.querySelectorAll('[data-rr-pick]').forEach(btn=>{
   const img=btn.querySelector('img.movie30-poster84');
   if(img&&img.getAttribute('src')&&img.complete&&img.naturalWidth)
    reusable.set(decodeURIComponent(btn.dataset.rrPick),img);
  });
 }
 root.innerHTML='<div class="rr-fast-shell">'+
  '<div class="rr-fast-top">'+
   '<button id="rrExit" class="rr-top-button">‹ 戻る</button>'+
   '<div class="rr-fast-brand"><b>新ランキング</b><small>★3以上・点数確定済みの作品</small></div>'+
   '<button id="rrOpenLog" class="rr-top-button" aria-expanded="'+(showLogs?'true':'false')+'">'+
      (showLogs?'比較へ戻る':'ログ・順位')+'</button>'+
  '</div>'+
 (showLogs?
   '<div class="rr-drawer">'+
    '<div class="rr-drawer-tabs">'+
     '<button data-rr-logtab="history" class="'+(rrLogTab==='history'?'active':'')+'">比較ログ '+r.events.length+'</button>'+
     '<button data-rr-logtab="ranks" class="'+(rrLogTab==='ranks'?'active':'')+'">暫定順位</button>'+
     '<button data-rr-logtab="conflicts" class="'+(rrLogTab==='conflicts'?'active':'')+'">三すくみ '+m.stats.cycles.length+'</button>'+ 
     '<button data-rr-logtab="progress" class="'+(rrLogTab==='progress'?'active':'')+'">進捗</button>'+
     '<button data-rr-logtab="settings" class="'+(rrLogTab==='settings'?'active':'')+'">設定</button>'+
    '</div>'+
    (rrLogTab==='history'?
     '<div class="rr-drawer-inner"><div class="rr-muted">過去の判断は個別削除できます。</div>'+rrHistoryHtml(r)+'</div>':
     rrLogTab==='ranks'?
     '<div class="rr-drawer-inner"><h3>新ランキング（全'+m.ids.length+'作品）</h3>'+rrPreviewHtml(r,m)+'</div>':
     rrLogTab==='conflicts'?
     '<div class="rr-drawer-inner">'+rrConflictsHtml(m)+'</div>':
     rrLogTab==='progress'?rrProgressDetail(progress):
     '<div class="rr-drawer-inner rr-settings"><h3>次に表示する組み合わせ</h3>'+
      '<div class="rr-mode">'+
       '<button data-rr-mode="local" class="'+(r.mode==='local'?'active':'')+'">未比較・近い3本</button>'+
       '<button data-rr-mode="wide" class="'+(r.mode==='wide'?'active':'')+'">広く点検</button>'+
       '<button data-rr-mode="conflict" class="'+(r.mode==='conflict'?'active':'')+'">矛盾を確認</button></div>'+
      '<p>旧ランキング・点数・星・レビューは一切変更せず、新ランキングの判断だけ別に保存します。</p>'+
      '<button id="rrNew" class="rr-danger">新ランキングだけ最初からやり直す</button></div>')+
   '</div>':
   '<div class="rr-fast-stage">'+
    '<div class="rr-fast-progress"><span>比較 <strong>'+r.events.length+'</strong> 回</span>'+
     '<span>比較済み <strong>'+nSeen+'</strong> / '+m.ids.length+' 本</span></div>'+ 
    '<button class="rr-progress-summary" id="rrOpenProgress" aria-label="ランキングの進捗と目安の詳細を開く">'+rrProgressHtml(progress)+'</button>'+
    '<div class="rr-fast-instruction" id="rrPickInstruction">一番好きな映画をタップ</div>'+
    '<div class="rr-fast-sub" id="rrPickSub">1位 → 2位の2タップで次へ</div>'+
    '<div class="rr-fast-grid">'+rrTriad.map((id,i)=>rrFilmCard(id,i,m)).join('')+'</div>'+
    '<div class="rr-fast-caption">長押しで作品の詳細。タップで順位を選択。</div>'+
   '</div>'+
   '<div class="rr-fast-bottom">'+
    '<button id="rrTieRest"'+(rrPicks.length===1?'':' hidden')+'>残り2本同格</button>'+
    '<button id="rrTieFirst"'+(rrPicks.length===1?'':' hidden')+'>1位と同格</button>'+
    '<button id="rrTieAll">3本同格</button>'+
    '<button id="rrHold">保留</button>'+
    '<button id="rrSkip">スキップ</button>'+
    '<button id="rrUndo" '+(rrPicks.length||rrTiePartner||r.events.length?'':'disabled')+'>戻す</button>'+
   '</div>')+
  '</div>';
 if(!showLogs){
  root.querySelectorAll('[data-rr-pick]').forEach(btn=>{
   const id=decodeURIComponent(btn.dataset.rrPick),img=reusable.get(id);
   const target=btn.querySelector('img.movie30-poster84');
   if(img&&target)target.replaceWith(img);
  });
 }
 const bind=(selector,fn)=>{const el=root.querySelector(selector);if(el)el.onclick=fn;};
 bind('#rrExit',rrExit);
 bind('#rrOpenLog',()=>{rrLogOpen=!rrLogOpen;rrTiePartner=false;rrRender()});
 bind('#rrOpenProgress',()=>{rrLogTab='progress';rrLogOpen=true;rrRender()});
 if(showLogs){
  root.querySelectorAll('[data-rr-logtab]').forEach(btn=>btn.onclick=()=>{rrLogTab=btn.dataset.rrLogtab;rrRender()});
  root.querySelectorAll('[data-rr-del]').forEach(btn=>btn.onclick=()=>rrDeleteEvent(btn.dataset.rrDel));
  root.querySelectorAll('[data-rr-mode]').forEach(btn=>btn.onclick=()=>{
   r.mode=btn.dataset.rrMode;save(false);rrSetTriad(rrChooseTriad(r,r.mode));rrRender();
  });
  root.querySelectorAll('[data-rr-cycle]').forEach(btn=>btn.onclick=()=>rrOpenConflict(m.stats.cycles[Number(btn.dataset.rrCycle)]));
  root.querySelectorAll('[data-rr-pair]').forEach(btn=>btn.onclick=()=>{
   const p=m.stats.contradictions[Number(btn.dataset.rrPair)];if(!p)return;
   const third=m.order.find(x=>x!==p.a&&x!==p.b);if(third)rrOpenConflict([p.a,p.b,third]);
  });
  bind('#rrNew',rrNew);
 }else{
  root.querySelectorAll('[data-rr-pick]').forEach(btn=>{
   const id=decodeURIComponent(btn.dataset.rrPick);
   btn.onclick=e=>{
    if(btn.dataset.rrLongPressed==='1'){
     const recent=Date.now()-Number(btn.dataset.rrDetailOpenedAt||0)<850;
     btn.dataset.rrLongPressed='';btn.dataset.rrDetailOpenedAt='';
     if(recent){e.preventDefault();return}
    }
    rrPick(id);
   };
   // Long press opens the app's existing film details, without selecting a rank.
   let pressTimer=null,startX=0,startY=0,opened=false;
   const cancel=()=>{if(pressTimer!==null){clearTimeout(pressTimer);pressTimer=null}};
   const openDetail=()=>{
    cancel();opened=true;btn.dataset.rrLongPressed='1';
    btn.dataset.rrDetailOpenedAt=String(Date.now());
    if(typeof openSheet==='function')openSheet(id);
   };
   btn.addEventListener('pointerdown',e=>{
    if(e.button!==0||rrLogOpen)return;
    opened=false;startX=e.clientX;startY=e.clientY;
    cancel();pressTimer=setTimeout(openDetail,520);
   });
   btn.addEventListener('pointermove',e=>{
    if(Math.abs(e.clientX-startX)>14||Math.abs(e.clientY-startY)>14)cancel();
   });
   btn.addEventListener('pointerup',cancel);
   btn.addEventListener('pointercancel',cancel);
   btn.addEventListener('pointerleave',cancel);
   btn.addEventListener('contextmenu',e=>{e.preventDefault();if(!opened)openDetail()});
  });
  bind('#rrTieRest',rrTieRest);
  bind('#rrTieFirst',()=>{if(rrTiePartner){rrTiePartner=false;rrPaintSelection()}else rrTieWithFirst()});
  bind('#rrTieAll',rrTieAll);
  bind('#rrHold',()=>rrCommit('hold'));
  bind('#rrSkip',rrSkip);
  bind('#rrUndo',rrUndoEvent);
  rrPaintSelection();
  for(const id of rrTriad){
   const f=filmById(id);if(!f)continue;
   rrPosterQueue(f);
   // Display cached posters even when the remote credential has been removed.
   const img=root.querySelector('[data-rr-pick="'+encodeURIComponent(id)+'"] img.movie30-poster84');
   const url=rrPosterUrl(rrPosterMeta(f)?.path,rrPosterSize());
   if(img&&url&&img.getAttribute('src')!==url)img.src=url;
  }
  rrWarmNext(r);
 }
}
function rrInstall(){
 if(document.getElementById('page-rerank'))return;
 const tabs=document.querySelector('.tabs'),rankTab=tabs?.querySelector('[data-page="rank"]');
 if(!tabs||!rankTab)return;
 const tab=document.createElement('button');tab.className='tab';tab.dataset.page='rerank';tab.textContent='新ランキング';
 rankTab.insertAdjacentElement('afterend',tab);
 const page=document.createElement('section');page.id='page-rerank';page.className='page';
 page.innerHTML='<main id="rerankRoot"></main>';
 const rankPage=document.getElementById('page-rank');rankPage.insertAdjacentElement('afterend',page);
 tab.onclick=()=>{view.page='rerank';save(false);renderHeader()};
 const baseHeader=renderHeader;
 renderHeader=function(...args){
  const value=baseHeader.apply(this,args);
  const open=view.page==='rerank';
  document.body.classList.toggle('rr-immersive-on',open);
  if(open)rrRender();
  return value;
 };
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||view.page!=='rerank')return;
  if(rrTiePartner){rrTiePartner=false;rrRender()}
  else if(rrLogOpen){rrLogOpen=false;rrRender()}
  else rrExit();
 });
 window.__movie30RerankV109={build:BUILD,render:rrRender,model:()=>rrModel(rrState()),
    newSession:rrNew,choose:rrPick,undo:rrUndoEvent};
}


const rrStyle=document.createElement('style');
rrStyle.id='movie30-rerank-fast-v101-style';
rrStyle.textContent=`
body.rr-immersive-on{overflow:hidden}
body.rr-immersive-on #sheetBg{z-index:16000!important}
body.rr-immersive-on .rr-fast-card,body.rr-immersive-on .rr-fast-poster img{
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
}
body.rr-immersive-on .rr-fast-poster img{pointer-events:none}

body.rr-immersive-on #page-rerank{position:fixed!important;inset:0!important;display:block!important;z-index:11000;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#090f19;color:#f1f5fa;padding:calc(env(safe-area-inset-top,0px) + 7px) max(9px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 6px) max(9px,env(safe-area-inset-left,0px))}
#rerankRoot{height:100%;min-height:100%;max-width:860px;margin:0 auto;box-sizing:border-box}
.rr-fast-shell{min-height:100%;display:flex;flex-direction:column;position:relative;gap:8px}
.rr-fast-top{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:8px;align-items:center;padding:5px 1px 10px;border-bottom:1px solid #2a3d55;position:relative;z-index:2}
.rr-fast-brand{text-align:center;line-height:1.2}.rr-fast-brand b{display:block;font-size:17px;white-space:nowrap}.rr-fast-brand small{display:block;font-size:10px;color:#9aaec9;margin-top:4px}
.rr-top-button{border:1px solid #435976;background:#17283e;color:#e8eff8;border-radius:9px;padding:10px 5px;font-size:12px;white-space:nowrap;min-height:40px}
.rr-fast-top .rr-top-button:last-child{background:#244575;font-weight:700}
.rr-fast-stage{flex:1;display:flex;flex-direction:column;justify-content:center;gap:9px;padding:12px 0}
.rr-fast-progress{display:flex;justify-content:space-between;gap:12px;color:#afbdd1;font-size:12px}
.rr-fast-progress strong{color:#edf4ff;font-size:15px}
.rr-fast-instruction{text-align:center;font-weight:850;font-size:clamp(19px,5.1vw,29px);line-height:1.25;margin-top:3px}
.rr-fast-sub{text-align:center;color:#a7bbd5;font-size:12px;margin-top:-4px}
.rr-fast-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:start;gap:7px;margin:7px 0;width:100%}
.rr-fast-card{display:flex;flex-direction:column;text-align:left;min-width:0;width:100%;padding:0 0 11px;overflow:hidden;background:#142034;border:2px solid #3a4e69;color:#f5f8ff;border-radius:12px;cursor:pointer;appearance:none;-webkit-appearance:none;touch-action:manipulation;transition:transform .09s,border-color .09s,background .09s}
.rr-fast-card:active{transform:scale(.974)}
.rr-fast-card.rr-picked-first{border-color:#f7d16a;background:#293049;box-shadow:0 0 0 2px rgba(247,209,106,.25)}
.rr-fast-card.rr-picked-second{border-color:#98c7ff}
.rr-fast-poster{display:block;position:relative;aspect-ratio:2/3;width:100%;overflow:hidden;background:linear-gradient(145deg,#263954,#0d1828)}
.rr-fast-poster img{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.rr-fast-poster img:not([src]){display:none}
.rr-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;letter-spacing:.12em;color:#6f83a0}
.rr-fast-badge{position:absolute;left:5px;top:5px;padding:5px 7px;min-width:33px;border-radius:7px;background:rgba(4,10,21,.82);color:#e9f1ff;font-weight:800;font-size:12px;text-align:center}
.rr-picked-first .rr-fast-badge{color:#1c1b10;background:#f4d267}
.rr-fast-title{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:45px;font-size:clamp(11px,2.9vw,15px);font-weight:750;line-height:1.35;overflow-wrap:anywhere;padding:9px 6px 0}
.rr-fast-year{margin-top:auto;padding:3px 6px 0;font-size:10px;color:#9dafc8}
.rr-fast-caption{text-align:center;font-size:11px;line-height:1.5;color:#7f91ad;margin-top:2px}
.rr-fast-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px;padding:12px 0 3px;border-top:1px solid #243752;position:sticky;bottom:0;background:#090f19;z-index:2}
 .rr-fast-bottom button{flex:1 1 auto;min-height:43px;border:1px solid #3c4c62;border-radius:9px;padding:7px 3px;font-size:11px;font-weight:700;color:#e2eefa;background:#18283b;white-space:nowrap}
.rr-fast-bottom button[hidden]{display:none!important}.rr-fast-bottom button:disabled{opacity:.38}.rr-fast-bottom button.active{background:#315b8e;border-color:#9cc8ff}
.rr-drawer{flex:1;min-height:0;padding-bottom:30px}
.rr-drawer-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:10px 0 15px;position:sticky;top:0;background:#090f19;padding:6px 0;z-index:2}
.rr-drawer-tabs button{background:#14253b;border:1px solid #394e6a;color:#b8c7db;border-radius:9px;padding:11px 5px;font-size:12px}
.rr-drawer-tabs button.active{background:#2a4c81;color:#fff;border-color:#689af4;font-weight:800}
.rr-drawer-inner{padding:0 3px 20px}.rr-drawer-inner h3{font-size:17px;margin:8px 0 12px}
.rr-muted{color:#a6b6cd;line-height:1.55;font-size:12px}
.rr-hrow{display:flex;align-items:center;gap:8px;padding:10px 3px;border-bottom:1px solid #2b3c55;font-size:12px}
.rr-hrow b{color:#7397cb;flex:none;min-width:25px}.rr-hrow span{flex:1;overflow-wrap:anywhere}
.rr-hrow button,.rr-settings button{border-radius:8px;border:1px solid #405c7a;background:#192c45;color:#edf5ff;padding:8px;font-size:11px}
.rr-settings p{font-size:12px;color:#aabbcf;line-height:1.7;margin:15px 0}.rr-settings .rr-mode{display:flex;flex-wrap:wrap;gap:6px}
.rr-settings .rr-mode button.active{background:#28558b;border-color:#78b3ff}
.rr-settings .rr-danger{border-color:#95545b;background:#4e252b;margin-top:20px}
.rr-rank-scroll{overflow:visible;max-height:none;margin-top:12px;border-top:1px solid #394351}
.rr-rank-row{display:grid;grid-template-columns:32px minmax(0,1fr) 65px;gap:9px;padding:10px 3px;border-bottom:1px solid #283a4d;align-items:center;font-size:12px}
.rr-rank-row b{color:#a6beeb}.rr-rank-row small{color:#8b9ab0;text-align:right;font-size:10px}
.rr-tie-backdrop{position:fixed;z-index:11010;inset:0;background:rgba(2,6,13,.76);display:flex;align-items:center;justify-content:center;padding:15px}
.rr-tie-dialog{background:#17263d;border:1px solid #53729d;border-radius:15px;width:min(100%,560px);max-height:84dvh;overflow-y:auto;padding:14px}
.rr-tie-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-bottom:12px;font-size:15px}
.rr-tie-head button,.rr-tie-options button{border:1px solid #3b587c;color:#edf4ff;background:#203958;border-radius:8px;padding:10px}
.rr-tie-options{display:flex;flex-direction:column;gap:7px}
.rr-tie-options button{text-align:left;font-size:12px;line-height:1.4;white-space:normal}

.rr-progress-summary{width:100%;background:#15263b;color:#e9f2ff;border:1px solid #3c587b;border-radius:9px;padding:9px 11px;text-align:left;margin:0;cursor:pointer}
.rr-progress-intro{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px}
.rr-progress-intro strong{color:#e5efff}.rr-progress-intro span{font-size:11px;color:#c5d9fb;font-weight:750}
.rr-progress-meter{height:5px;overflow:hidden;background:#2b3c52;border-radius:8px;margin:8px 0 4px}
.rr-progress-meter>span{height:100%;display:block;background:#759fe4;border-radius:8px}
.rr-progress-sublabel{color:#a9bbd3;font-size:10px}
.rr-progress-big{font-size:19px;font-weight:750;color:#d3e4ff}
.rr-progress-details>p{font-size:12px;line-height:1.6;color:#aabbd2;margin:11px 0}
.rr-progress-figures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:17px 0}
.rr-progress-figures>div{padding:12px;background:#15263b;border:1px solid #2d415b;border-radius:10px}
.rr-progress-figures strong{display:block;font-size:18px}.rr-progress-figures small{display:block;font-size:10px;color:#aebbd0;line-height:1.45;margin-top:5px}
.rr-progress-drift{display:flex;flex-direction:column;gap:7px;margin:11px 0;color:#adc2da;font-size:12px;line-height:1.5}
@media(min-width:700px){.rr-fast-shell{min-height:calc(100dvh - 45px)}.rr-fast-stage{padding:18px 20px}.rr-fast-grid{gap:15px}.rr-fast-card{max-width:280px;justify-self:center}.rr-fast-title{padding:12px 10px 0;min-height:64px}.rr-fast-bottom button{font-size:13px}}
@media(max-width:365px){.rr-drawer-tabs button{font-size:9px}.rr-fast-grid{gap:4px}.rr-fast-title{font-size:10px;padding:7px 4px 0}.rr-fast-bottom button{font-size:10px}.rr-fast-brand b{font-size:15px}}
`;
document.head.appendChild(rrStyle);
rrInstall();
})();
