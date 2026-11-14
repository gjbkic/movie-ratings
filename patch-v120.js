(()=>{
'use strict';
const BUILD='20261115-cycle-explain-v120';
let rrTriad=null,rrOrder=[],rrTie12=false,rrTie23=false,rrPicks=[],rrLogOpen=false,rrLogTab='history',rrTieOpen=false,rrTiePartner=false,rrReviewPairs=null,rrHeldReviewFlow=false,rrCycleGroups=[],rrCycleTieNext=false,rrCycleActiveKey=null;

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

function rrCycleKey(r,edge){
 return rrHeldKey(r,edge);
}
function rrCycleQueuePush(r,edge,front=false){
 const key=rrCycleKey(r,edge);
 if(r.cycleReviewQueue.some(item=>item.key===key))return;
 const value={key};
 if(front)r.cycleReviewQueue.unshift(value);
 else r.cycleReviewQueue.push(value);
}
function rrCycleQueueSync(r,m){
 if(!Array.isArray(r.cycleReviewQueue))r.cycleReviewQueue=[];
 // Existing unresolved historical cycles are also offered, but never revive
 // ones the user has already acknowledged.
 let changed=false;
 if(r.cycleReviewVersion!==119){
  r.cycleReviewVersion=119;changed=true;
  for(const edge of rrUnreviewedHolds(r,m))rrCycleQueuePush(r,edge);
 }
 const unresolved=new Map((m.replay?.held||[]).map(edge=>[rrCycleKey(r,edge),edge]));
 const accepted=new Set(r.acknowledgedHolds||[]);
 const entries=r.cycleReviewQueue.filter(item=>
  item.manual?!!r.events.some(e=>e.id===item.eventId):
  unresolved.has(item.key)&&!accepted.has(item.key));
 if(entries.length!==r.cycleReviewQueue.length){
  r.cycleReviewQueue=entries;changed=true;
 }
 if(changed)save(false);
 const item=r.cycleReviewQueue[0];
 if(!item){
  if(rrCycleActiveKey!==null){rrCycleActiveKey=null;rrCycleGroups=[];rrCycleTieNext=false}
  return null;
 }
 const edge=item.manual?{cycleIds:item.ids.slice(),eventIndex:
   r.events.findIndex(e=>e.id===item.eventId)}:unresolved.get(item.key);
 if(!edge||!Array.isArray(edge.cycleIds)||edge.cycleIds.length<3)return null;
 if(rrCycleActiveKey!==item.key){
  rrCycleActiveKey=item.key;rrCycleGroups=[];rrCycleTieNext=false;
 }
 return {item,edge,ids:edge.cycleIds.slice()};
}
function rrCycleNewHolds(r,before,after){
 const previous=new Set((before.replay?.held||[]).map(edge=>rrCycleKey(r,edge)));
 for(const edge of after.replay?.held||[])
  if(!previous.has(rrCycleKey(r,edge)))rrCycleQueuePush(r,edge,true);
}
function rrCycleManualReview(eventId){
 const r=rrState(),e=r.events.find(x=>x.id===eventId);
 if(!e)return;
 const ids=[...new Set(e.displayIds||e.ids||[])];
 if(ids.length<3)return;
 const key='manual:'+eventId;
 r.cycleReviewQueue=r.cycleReviewQueue.filter(item=>item.key!==key);
 r.cycleReviewQueue.unshift({key,manual:true,eventId,ids});
 rrLogOpen=false;rrRender();
}
function rrCyclePick(id){
 const r=rrState(),active=rrCycleQueueSync(r,rrModel(r));
 if(!active||!active.ids.includes(id)||rrCycleGroups.flat().includes(id))return;
 if(rrCycleTieNext&&rrCycleGroups.length)rrCycleGroups[rrCycleGroups.length-1].push(id);
 else rrCycleGroups.push([id]);
 rrCycleTieNext=false;
 if(rrCycleGroups.flat().length===active.ids.length)rrCycleCommit(r,active);
 else rrRender();
}
function rrCycleUndoPick(){
 const last=rrCycleGroups[rrCycleGroups.length-1];
 if(!last)return;
 last.pop();if(!last.length)rrCycleGroups.pop();
 rrCycleTieNext=false;rrRender();
}
function rrCycleDefer(){
 const r=rrState(),m=rrModel(r),active=rrCycleQueueSync(r,m);
 if(!active)return;
 if(!active.item.manual){
  const accepted=new Set(r.acknowledgedHolds||[]);
  accepted.add(active.item.key);r.acknowledgedHolds=[...accepted];
 }
 r.cycleReviewQueue.shift();rrCycleActiveKey=null;rrCycleGroups=[];rrCycleTieNext=false;
 save();rrRender();
}
function rrCycleCommit(r,active){
 const groups=rrCycleGroups.map(g=>g.slice()),ids=groups.flat();
 if(ids.length!==active.ids.length||new Set(ids).size!==ids.length)return;
 const previous=rrModel(r);
 const keys=[];
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)
  keys.push(rrPairKey(ids[i],ids[j]));
 const e={id:'rrcycle-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
  at:Date.now(),kind:'cycle-review',mode:'conflict',
  ids:ids.slice(),displayIds:active.ids.slice(),groups,
  reviewResolves:keys,cycleReviewFromKey:active.item.key,
  genreScope:rrScopeLabel(ids)};
 r.events.push(e);
 const after=rrModel(r);
 e.rankDelta=rrDelta(previous,after);
 e.triadPositions=rrTriadPositions(previous,after,e.displayIds);
 rrCycleNewHolds(r,previous,after);
 r.cycleReviewQueue=r.cycleReviewQueue.filter(item=>item.key!==active.item.key);
 rrCycleGroups=[];rrCycleTieNext=false;rrCycleActiveKey=null;
 save();rrLogOpen=false;rrSetTriad(rrChooseTriad(r,r.mode));rrRender();
}
function rrCycleReviewHtml(r,m,active){
 const title=id=>displayTitle(filmById(id)||{title:id});
 const all=active.ids,chosen=rrCycleGroups.flat(),remaining=all.filter(id=>!chosen.includes(id));
 const review=all.map(title).join(' ＞ ')+' ＞ '+title(all[0]);
 const steps=rrCycleGroups.length?rrCycleGroups.map((group,i)=>
  '<div class="rr-cycle-choice"><b>'+(i+1)+'位</b> '+esc(group.map(title).join(' ≈ '))+
  '</div>').join(''):'<div class="rr-muted">1位の作品から順に選んでください。</div>';
 const choices=remaining.map(id=>{
  const f=filmById(id),path=rrPosterMeta(f)?.path,src=rrPosterUrl(path,'w185');
  return '<button type="button" data-rr-cycle-pick="'+encodeURIComponent(id)+'" class="rr-cycle-card">'+
   (src?'<img src="'+esc(src)+'" alt="" loading="lazy">':'<span class="rr-cycle-no-poster"></span>')+
   '<span>'+esc(title(id))+(f?.year?' <small>'+esc(String(f.year))+'</small>':'')+
   '</span></button>';
 }).join('');
 return '<div class="rr-cycle-screen"><div class="rr-cycle-heading"><strong>循環を発見：'+all.length+
  '作品を並べ直す</strong><p>過去の判断が一周する循環になっています。'+
  '元の判断は消さず、ここで選び直した順序を最新の判断として優先します。</p>'+
  rrCycleExplanationHtml(active.edge)+
  (!active.edge.cycleSteps?.length?'<small>'+esc(review)+'</small>':'')+'</div>'+
  '<div class="rr-cycle-picked">'+steps+'</div>'+
  '<div class="rr-cycle-instruction">'+
  (rrCycleTieNext?'次に選ぶ作品を直前と同格にします':'次の順位の作品をタップ')+
  '（'+chosen.length+' / '+all.length+'本）</div>'+
  '<div class="rr-cycle-cards">'+choices+'</div>'+
  '<div class="rr-cycle-actions">'+
  '<button id="rrCycleTie"'+(rrCycleGroups.length?'':' disabled')+
  ' class="'+(rrCycleTieNext?'active':'')+'">次は直前と同格</button>'+
  '<button id="rrCycleUndo"'+(chosen.length?'':' disabled')+'>1つ戻す</button>'+
  '<button id="rrCycleReset"'+(chosen.length?'':' disabled')+'>最初から</button>'+
  '<button id="rrCycleDefer">今は保留</button></div>'+
  '<p class="rr-muted">全作品を選ぶと順位を確定し、次の比較へ進みます。後から比較ログで再判定できます。</p></div>';
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
  r.cycleReviewQueue=Array.isArray(r.cycleReviewQueue)?r.cycleReviewQueue:[];
  r.mode=["local","wide","conflict"].includes(r.mode)?r.mode:"local";
  // Migrate the existing judgement history without discarding any event.
  if(r.genrePlanVersion!==113){r.genrePlanVersion=113;r.mode="local";}
  if(r.rankingMethodVersion!==115){
   // Old per-event movement measurements were made under the former model.
   // Keep the judgments, but force movement reports to be recalculated.
   r.rankingMethodVersion=115;
   for(const e of r.events){delete e.rankDelta;delete e.triadPositions}
  }
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
  // A deliberate recheck supersedes older judgements for the specifically
  // reviewed pair(s), while retaining every original historical event.
  const events=r.events||[],lastReview=new Map();
  events.forEach((e,i)=>{
   if(!e.ambiguous&&Array.isArray(e.reviewResolves))
    for(const key of e.reviewResolves)lastReview.set(key,i);
  });
  let ambiguous=0;
  for(let ei=0;ei<events.length;ei++){
    const e=events[ei];
    if(e.ambiguous){if((e.ids||[]).some(id=>allowed.has(id)))ambiguous++;continue;}
    const groups=Array.isArray(e.groups)?e.groups:[];
    const pos=new Map();groups.forEach((g,gi)=>(g||[]).forEach(id=>pos.set(id,gi)));
    const members=[...pos.keys()].filter(id=>allowed.has(id));
    for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
      const a=members[i],b=members[j],pa=pos.get(a),pb=pos.get(b);if(pa==null||pb==null)continue;
      const key=rrPairKey(a,b),first=a<b?a:b,second=a<b?b:a;
      if(ei<(lastReview.get(key)??0))continue;
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

function rrReplayConstraints(r,ids,preferred){
 const n=ids.length,words=Math.ceil(n/32);
 const idx=new Map(ids.map((id,i)=>[id,i]));
 const base=new Map(preferred.map((id,i)=>[id,i]));
 const reach=Array.from({length:n},()=>new Uint32Array(words));
 const next=Array.from({length:n},()=>[]);
 const indegree=new Uint16Array(n);
 const processed=new Set(),held=[],acceptedSources=new Map();
 let enforced=0,overridden=0,ties=0;
 const bit=(row,col)=>!!(reach[row][col>>>5]&(1<<(col&31)));
 // Find the actual witness path in the accepted DAG. Its length can be
 // three, four, or more: never truncate a contradiction to three films.
 const witnessPath=(start,end)=>{
  const parent=new Int32Array(n).fill(-1),queue=[start];parent[start]=start;
  for(let k=0;k<queue.length&&parent[end]<0;k++){
   for(const to of next[queue[k]])if(parent[to]<0){
    parent[to]=queue[k];queue.push(to);
   }
  }
  if(parent[end]<0)return [];
  const path=[end];while(path[0]!==start)path.unshift(parent[path[0]]);
  return path;
 };
 const add=(a,b,eventIndex)=>{
  if(bit(b,a)){
   const path=witnessPath(b,a);
   const cycleSteps=[{better:ids[a],worse:ids[b],eventIndex,held:true}];
   for(let j=0;j+1<path.length;j++){
    const from=path[j],to=path[j+1];
    const source=acceptedSources.get(from+'|'+to);
    if(source)cycleSteps.push({better:ids[from],worse:ids[to],
     eventIndex:source.eventIndex,held:false});
   }
   held.push({better:ids[a],worse:ids[b],eventIndex,
    cycleIds:[ids[a],...path.slice(0,-1).map(i=>ids[i])],cycleSteps});
   return;
  }
  next[a].push(b);acceptedSources.set(a+'|'+b,{eventIndex});
  indegree[b]++;enforced++;
  if(bit(a,b))return;
  const mask=reach[b].slice();mask[b>>>5]|=1<<(b&31);
  for(let x=0;x<n;x++){
   if(x!==a&&!bit(x,a))continue;
   const row=reach[x];for(let k=0;k<words;k++)row[k]|=mask[k];
  }
 };
 // The newest direct preference for each pair is processed first. Older
 // judgments stay in the event history even when their precedence is
 // superseded or would create a cycle of any length.
 const events=r.events||[];
 for(let ei=events.length-1;ei>=0;ei--){
  const e=events[ei];if(e.ambiguous||!Array.isArray(e.groups))continue;
  const groups=e.groups;
  for(let g=0;g<groups.length;g++)for(let h=g;h<groups.length;h++)
   for(const aid of groups[g]||[])for(const bid of groups[h]||[]){
    if(aid===bid||(g===h&&aid>bid))continue;
    const a=idx.get(aid),b=idx.get(bid);
    if(a===undefined||b===undefined)continue;
    const key=rrPairKey(aid,bid);
    if(processed.has(key)){overridden++;continue}
    processed.add(key);
    if(g===h){ties++;continue}
    add(a,b,ei);
   }
 }
 // Stable topological sorting, using the Bayesian estimate only as a
 // baseline among works for which no hard direct-order constraint applies.
 const degree=indegree.slice(),top=[],queue=[];
 for(let i=0;i<n;i++)if(degree[i]===0)queue.push(i);
 while(queue.length){
  const a=queue.pop();top.push(a);
  for(const b of next[a])if(--degree[b]===0)queue.push(b);
 }
 if(top.length!==n)return {order:preferred.slice(),held,enforced,
  overridden,ties,error:'unresolved constraints'};
 // Pull a low-ranked prerequisite up to where a strong descendant needs it,
 // instead of automatically pushing the higher-ranked loser to the bottom.
 const urgency=ids.map(id=>base.get(id)??n);
 for(let i=top.length-1;i>=0;i--){
  const a=top[i];
  for(const b of next[a])if(urgency[b]<urgency[a])urgency[a]=urgency[b];
 }
 const available=[],left=indegree.slice(),order=[];
 for(let i=0;i<n;i++)if(left[i]===0)available.push(i);
 while(available.length){
  available.sort((a,b)=>urgency[a]-urgency[b]||
    (base.get(ids[a])??n)-(base.get(ids[b])??n)||a-b);
  const a=available.shift();order.push(ids[a]);
  for(const b of next[a])if(--left[b]===0)available.push(b);
 }
 return {order,held,enforced,overridden,ties,totalPairs:processed.size,
  // Transitive closure of ACCEPTED judgments only, for targeted audits.
  // This is not a permanent rank constraint and is recomputed after every
  // comparison or historical correction.
  reach,reachIndex:idx};
}

function rrModel(r){
 const ids=rrSelectedIds(r),signature=ids.join('|');
 const last=r.events[r.events.length-1],cached=rrModelCache.get(r);
 if(cached&&cached.events===r.events&&cached.length===r.events.length&&
    cached.last===last&&cached.signature===signature)return cached.model;
 const stats=rrStats(r,ids),n=ids.length;
 // Bayesian-regularized Bradley-Terry pairwise likelihood.
 // The old algorithm treated an isolated third-place finish as a large
 // absolute negative score and placed it below every untested work.
 // Here untested means UNKNOWN, not "middle-ranked".
 const lambda=.8,weight=2/3;
 const index=new Map(ids.map((id,i)=>[id,i]));
 const theta=new Float64Array(n),grad=new Float64Array(n),curv=new Float64Array(n);
 const degree=new Uint16Array(n),pairEdges=[];
 for(const p of stats.pairs.values()){
  const a=index.get(p.a),b=index.get(p.b);
  if(a===undefined||b===undefined)continue;
  degree[a]++;degree[b]++;
  pairEdges.push({a,b,n:p.n,wins:p.winsA+.5*p.ties});
 }
 for(let iter=0;iter<85;iter++){
  let maxStep=0;
  for(let i=0;i<n;i++){grad[i]=-lambda*theta[i];curv[i]=lambda}
  for(const edge of pairEdges){
   const diff=Math.max(-15,Math.min(15,theta[edge.a]-theta[edge.b]));
   const p=1/(1+Math.exp(-diff)),g=weight*(edge.wins-edge.n*p);
   const h=weight*edge.n*p*(1-p);
   grad[edge.a]+=g;grad[edge.b]-=g;
   curv[edge.a]+=h;curv[edge.b]+=h;
  }
  for(let i=0;i<n;i++){
   // Damped diagonal Newton steps; every observed comparison has diminishing
   // influence as independent evidence accumulates.
   const step=.35*Math.max(-.65,Math.min(.65,grad[i]/curv[i]));
   theta[i]=Math.max(-5,Math.min(5,theta[i]+step));
   if(Math.abs(step)>maxStep)maxStep=Math.abs(step);
  }
  if(maxStep<.0001)break;
 }
 // Approximate marginal uncertainty from local Fisher information. Inflation
 // for sparse unique opponents avoids false confidence from repeated matches.
 // A single pass over edges keeps the iPhone interaction responsive.
 const fisher=new Float64Array(n).fill(lambda);
 for(const e of pairEdges){
  const d=Math.max(-15,Math.min(15,theta[e.a]-theta[e.b])),p=1/(1+Math.exp(-d));
  const h=weight*e.n*p*(1-p);
  fisher[e.a]+=h;fisher[e.b]+=h;
 }
 const score=new Map(),uncertainty=new Map();
 for(let i=0;i<n;i++){
  const distinct=degree[i],sparse=Math.max(0,4-distinct)/4;
  score.set(ids[i],theta[i]);
  uncertainty.set(ids[i],Math.sqrt(1/fisher[i])*(1+.28*sparse));
 }
 const basePos=new Map(ids.map((id,i)=>[id,i]));
 const observed=ids.filter(id=>(stats.counts.get(id)||0)>0);
 const unseen=ids.filter(id=>(stats.counts.get(id)||0)===0);
 // A tested loser should NEVER be reported as worse than hundreds of films
 // for which no comparison evidence exists. Unseen titles are only appended
 // to the provisional display and retain their deterministic identity order.
 observed.sort((a,b)=>score.get(b)-score.get(a)||basePos.get(a)-basePos.get(b));
 const baselineOrder=observed.concat(unseen),seenCount=observed.length;
 const replay=rrReplayConstraints(r,ids,baselineOrder);
 const order=replay.order;
 const model={ids,order,score,uncertainty,stats,basePos,seenCount,replay};
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
 const confident=m.ids.filter(id=>(counts.get(id)||0)>0&&(m.uncertainty?.get(id)||10)<.58).length;
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
 if(fullyCompared&&connected&&depth>=.8*n&&confident>=.8*n&&!drift){
  stage='変動を測定中';detail='直近の比較による順位変動を測り始めています。';
 }
 if(fullyCompared&&connected&&depth>=.8*n&&confident>=.8*n&&drift){
  const moderate=drift.median<=Math.max(3,Math.round(n*.025))&&drift.p90<=Math.max(9,Math.round(n*.07));
  const tight=drift.median<=Math.max(2,Math.round(n*.012))&&drift.p90<=Math.max(5,Math.round(n*.035));
  stage=tight?'全体は安定傾向':moderate?'安定しつつある':'まだ順位が動く';
  detail=tight?'大きな順位変動は減りました。近い作品の前後関係にはまだ誤差があります。':
   moderate?'全体像が固まりつつあります。接戦の再比較が有効です。':
   '最近の判断でも順位が大きく動くため、比較を続ける価値があります。';
 }
 // The count/degree lower bound is not a forecast of convergence.
 // Never render it as "10 comparisons remaining" when ranks still move.
 const remaining=null;
 const estimated=compared<n?'全作品を比較中':
   stage==='全体は安定傾向'?'安定傾向を検証中':'必要回数は未確定';
 return {n,compared,depth,confident,components:net.components.length,net,drift,stage,detail,
  judged,remaining,estimated};
}
// Count pair-order reversals only among works judged in BOTH snapshots.
function rrDelta(before,after){
 const old=before.order.slice(0,before.seenCount),now=after.order.slice(0,after.seenCount);
 const oldSet=new Set(old),commonNow=now.filter(id=>oldSet.has(id));
 const pos=new Map(commonNow.map((id,i)=>[id,i]));
 const commonOld=old.filter(id=>pos.has(id)),shift=[],numbers=[];
 commonOld.forEach((id,i)=>{const to=pos.get(id);shift.push(Math.abs(to-i));numbers.push(to)});
 const k=commonOld.length,ordered=shift.slice().sort((a,b)=>a-b);
 const bit=new Uint32Array(k+2);
 const prefix=i=>{let sum=0;while(i){sum+=bit[i];i-=i&-i;}return sum};
 let swaps=0;
 numbers.forEach((v,i)=>{swaps+=i-prefix(v+1);for(let j=v+1;j<bit.length;j+=j&-j)bit[j]++});
 return {version:1,shared:k,newCompared:now.length-k,seenAfter:now.length,
  changed:shift.filter(x=>x>0).length,median:ordered.length?rrQuantile(ordered,.5):0,
  p90:ordered.length?rrQuantile(ordered,.9):0,
  max:ordered.length?ordered[ordered.length-1]:0,inversions:swaps};
}
// Positions refer to the provisional order among ALREADY compared works.
// For an unranked work there is no meaningful "before" position.
function rrTriadPositions(before,after,shownIds){
 const beforePos=new Map(before.order.slice(0,before.seenCount).map((id,i)=>[id,i+1]));
 const afterPos=new Map(after.order.slice(0,after.seenCount).map((id,i)=>[id,i+1]));
 return (shownIds||[]).slice(0,3).filter(id=>after.ids.includes(id)).map(id=>({
  id,before:beforePos.get(id)??null,after:afterPos.get(id)??null,
  beforeCount:before.seenCount,afterCount:after.seenCount
 }));
}
function rrTriadPositionsHtml(event,compact=false){
 const info=event?.triadPositions;
 if(!Array.isArray(info)||!info.length)return compact?
   '<div class="rr-triad-unrecorded">3作品の個別順位は未集計</div>':
   '<div class="rr-triad-unrecorded">この回の3作品の変動は未集計です。比較ログの「過去の比較も集計」から計算できます。</div>';
 const rows=info.map(x=>{
  const f=filmById(x.id),title=f?displayTitle(f):x.id;
  const first=x.before==null?'未判定':x.before+'位';
  const last=x.after==null?'未判定':x.after+'位';
  const diff=x.before!=null&&x.after!=null?x.before-x.after:null;
  const suffix=diff===null?'新規':diff>0?'↑'+diff:diff<0?'↓'+(-diff):'±0';
  return '<div class="rr-triad-pos-row"><span>'+esc(title)+'</span>'+
   '<b>'+first+' → '+last+'</b><small class="'+(diff>0?'rr-triad-rise':diff<0?'rr-triad-fall':'')+'">'+suffix+'</small></div>';
 }).join('');
 return '<div class="rr-triad-moves">'+
  (compact?'<strong>この3作品の順位</strong>':'<strong>前回比較した3作品の暫定順位</strong>')+
  '<div class="rr-triad-pos-list">'+rows+'</div>'+
  (compact?'':'<small>比較済み作品内の暫定順位。未比較作品は含みません。</small>')+
  '</div>';
}
function rrDeltaText(d){
 if(!d)return '順位変動の記録なし';
 if(!d.shared)return '比較済みの共通作品なし・新規'+d.newCompared+'本';
 return (d.changed?'既比較'+d.changed+'本変動、最大'+d.max+'位':'既比較の順位変動なし')+
  '／上下逆転'+d.inversions+'組'+(d.newCompared?'／新規'+d.newCompared+'本':'');
}
function rrDeltaSummary(r){
 const last=r.events[r.events.length-1],recent=r.events.filter(e=>e.rankDelta?.version===1&&
   Array.isArray(e.groups)&&e.groups.length&&e.rankDelta.shared>=2).slice(-20);
 const vals=recent.map(e=>e.rankDelta.inversions).sort((a,b)=>a-b);
 return {last:last?.rankDelta||null,n:recent.length,
  changed:recent.filter(e=>e.rankDelta.inversions>0).length,
  median:rrQuantile(vals,.5)};
}
function rrDeltaHtml(r,detail=false){
 const d=rrDeltaSummary(r),v=d.last;
 const primary=v?
   '<strong>前回：'+esc(rrDeltaText(v))+'</strong><span>共通'+v.shared+
   '本・変動中央値'+v.median+'位／90%点'+v.p90+'位</span>':
   '<strong>次の比較から順位の動きを毎回記録</strong>';
 const trend=d.n?'直近'+d.n+'回中、上下逆転あり'+d.changed+
   '回／逆転数の中央値'+d.median+'組':'今後、直近20回の変動傾向も表示します';
 return '<div class="rr-delta-summary">'+primary+'<small>'+esc(trend)+'</small>'+
 (detail?'<small>新規作品の追加で番号がずれただけの変化は除き、以前から比較済みの作品同士の入れ替わりを計測します。共通作品が少ない段階では「変動なし」でも安定を意味しません。</small>':'')+
 '</div>';
}
function rrDeltaTrendHtml(r){
 const rows=r.events.filter(e=>e.rankDelta?.version===1&&
  Array.isArray(e.groups)&&e.groups.length&&e.rankDelta.shared>=10).slice(-30);
 if(rows.length<2)return '<p class="rr-muted">比較済みの共通作品が10本以上ある回から、変動率の推移グラフを表示します。</p>';
 const rates=rows.map(e=>100*e.rankDelta.inversions/
    Math.max(1,e.rankDelta.shared*(e.rankDelta.shared-1)/2));
 const max=Math.max(.3,...rates),mid=Math.floor(rates.length/2);
 const avg=v=>v.reduce((s,x)=>s+x,0)/Math.max(1,v.length);
 const earlier=avg(rates.slice(0,mid)),later=avg(rates.slice(mid));
 const trend=rates.length<10?'集計中':later<earlier*.75?'変動が減少傾向':
  later>earlier*1.25?'変動が増加傾向':'変動はおおむね横ばい';
 const bars=rates.map((v,i)=>'<div style="height:'+
   Math.max(4,Math.round((v/max)*100))+'%" title="#'+
   (r.events.indexOf(rows[i])+1)+' · 逆転率 '+v.toFixed(2)+'%"></div>').join('');
 return '<div class="rr-delta-trend"><strong>各回の順位逆転率（直近'+rates.length+'回）</strong>'+
  '<div class="rr-delta-bars" aria-label="各比較の順位逆転率の棒グラフ">'+bars+'</div>'+
  '<div class="rr-delta-axis"><span>古い回</span><span>新しい回</span></div>'+
  '<small>'+trend+' · 前半平均 '+earlier.toFixed(2)+'% → 後半平均 '+
    later.toFixed(2)+'%</small>'+
  '<small>共通作品の組み合わせのうち、順序が逆転した割合。比較範囲が十分に広がるまでは収束の証拠になりません。</small></div>';
}
let rrHistoryReplayToken=0;
async function rrBackfillHistory(){
 const r=rrState(),events=r.events,total=events.length;
 const btn=document.getElementById('rrBackfill'),status=document.getElementById('rrBackfillStatus');
 if(btn)btn.disabled=true;
 if(!total){if(status)status.textContent='比較履歴なし';return}
 const token=++rrHistoryReplayToken,copy={...r,events:[],baselineIds:r.baselineIds.slice()};
 let prev=rrModel(copy);
 for(let i=0;i<total;i++){
  if(token!==rrHistoryReplayToken||r.events!==events||events.length!==total){
   if(status)status.textContent='比較履歴が変更されたため計測を中断しました。';
   return;
  }
  copy.events=events.slice(0,i+1);
  const after=rrModel(copy);
  events[i].rankDelta=rrDelta(prev,after);
  events[i].triadPositions=rrTriadPositions(prev,after,events[i].displayIds||events[i].ids);
  prev=after;
  if(i%3===2||i===total-1){
   if(status)status.textContent='順位変動を計算中 '+(i+1)+' / '+total+'回';
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 save();if(rrLogOpen&&rrLogTab==='history')rrRender();
}
function rrProgressHtml(p){
 const pct=p.n?Math.round(100*p.compared/p.n):0,
  deep=p.n?Math.round(100*p.depth/p.n):0;
 return '<div class="rr-progress-intro"><strong>'+esc(p.stage)+'</strong><span>'+esc(p.estimated)+'</span></div>'+
  '<div class="rr-progress-meter"><span style="width:'+pct+'%"></span></div>'+
  '<div class="rr-progress-sublabel">比較済み '+p.compared+' / '+p.n+
  '本 · 比較が十分な作品 '+p.depth+'本</div>';
}
function rrProgressDetail(p,r){
 const n=p.n||1;
 return '<div class="rr-drawer-inner rr-progress-details">'+
  '<h3>現在のランキングの安定度</h3>'+rrDeltaHtml(r,true)+rrDeltaTrendHtml(r)+rrGenreProgressHtml(rrModel(r))+
  '<div class="rr-progress-big">'+esc(p.stage)+'</div>'+
  '<p>'+esc(p.detail)+'</p>'+rrProgressHtml(p)+
  '<div class="rr-progress-figures">'+
   '<div><strong>'+p.compared+' / '+p.n+'</strong><small>一度以上比較した作品</small></div>'+
   '<div><strong>'+p.depth+' / '+p.n+'</strong><small>8判断・異なる5作品以上との比較</small></div>'+
   '<div><strong>'+p.confident+' / '+p.n+'</strong><small>推定の不確実性が比較的小さい作品</small></div>'+
   '<div><strong>'+p.components+'</strong><small>比較がつながっているグループ数（理想は1）</small></div>'+
   '<div><strong>'+p.judged+'</strong><small>有効な3本比較の記録</small></div>'+
  '</div>'+
  (p.drift?
   '<div class="rr-progress-drift"><strong>直近'+p.drift.window+'回の比較による順位変動</strong>'+
    '<span>中央値 '+p.drift.median+'位 / 90パーセンタイル '+p.drift.p90+'位</span></div>':
   '<div class="rr-progress-drift">順位変動の判定は、比較がほぼ全作品につながり、ある程度の記録が集まってから表示します。</div>')+
  '<p class="rr-muted">完成までの回数は比較履歴だけから正確に予測できません。比較済み作品数・相手の多様性・直近の順位変動を見て判断します。旧順位・元の点数は新ランキングの推定に一切使っていません。</p>'+
  '</div>';
}

function rrTriadSig(ids){return ids.slice().sort().join('|')}
function rrBridgeTriad(r,m,used){
 const ids=m.order.filter(id=>(m.stats.counts.get(id)||0)>0),n=ids.length;
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
 const unseen=m.order.filter(id=>count(id)===0);
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
// New selector: seven genre-near sessions and three cross-genre
// calibrations per ten completed comparisons. This only changes which
// works appear, never the historical judgements or original scores.
function rrGenreMap(ids){
 const byId=new Map(allFilms().map(f=>[f.id,f])),tokens=new Map(),groups=new Map();
 const fallback={
  'SF':['SF'],'アクション':['アクション'],'ドラマ':['ドラマ'],
  'コメディ':['コメディ'],'サスペンス、ミステリー':['サスペンス','ミステリー'],
  'スリラー、ホラー':['スリラー','ホラー'],
  'マフィア、クライム':['クライム'],'恋愛、ミュージカル':['恋愛','ミュージカル'],
  '戦争、歴史':['戦争','歴史'],'ファンタジー、アドベンチャー':['ファンタジー','アドベンチャー'],
  'ほかアニメ':['アニメ'],'スタジオジブリ系作品':['アニメ'],
  'ピクサー・ディズニー作品':['アニメ'],'コナン映画':['アニメ','ミステリー'],
  'MCU作品':['アクション','SF'],'スパイダーマン作品':['アクション','SF'],
  'スターウォーズシリーズ':['SF','ファンタジー'],
  'ハリーポッター シリーズ':['ファンタジー','アドベンチャー']
 };
 for(const id of ids){
  const f=byId.get(id),fromState=state.genreOverrides?.[id],category=f?filmCategory(f):'';
  const labels=[...new Set((Array.isArray(fromState)&&fromState.length?
    fromState:fallback[category]||[...['SF','アクション','ドラマ','コメディ','サスペンス','ミステリー','ホラー','アニメ','ファンタジー','恋愛','戦争','歴史','クライム'].filter(x=>x===category)])
    .map(x=>String(x||'').trim()).filter(Boolean))].slice(0,6);
  tokens.set(id,new Set(labels));
  for(const label of labels){
   if(!groups.has(label))groups.set(label,[]);
   groups.get(label).push(id);
  }
 }
 return {tokens,groups};
}
function rrGenreChoice(r,m,used,kind='near'){
 const ids=m.order,n=ids.length;if(n<3)return null;
 const {tokens,groups}=rrGenreMap(ids),stats=m.stats,position=new Map(ids.map((id,i)=>[id,i]));
 const counter=r.events.length+r.skips.length,counts=stats.counts;
 const newest=r.events.slice(-45),lastSeen=new Map(),recent=new Map();
 newest.forEach((e,i)=>{
  for(const id of new Set(e.displayIds||e.ids||[])){
   lastSeen.set(id,newest.length-1-i);
   recent.set(id,(recent.get(id)||0)+1);
  }
 });
 const degree=new Map(ids.map(id=>[id,new Set()]));
 for(const p of stats.pairs.values()){
  if(degree.has(p.a)&&degree.has(p.b)){
   degree.get(p.a).add(p.b);degree.get(p.b).add(p.a);
  }
 }
 const count=id=>counts.get(id)||0;
 const pair=(a,b)=>stats.pairs.get(rrPairKey(a,b))?.n||0;
 const profile=id=>tokens.get(id)||new Set();
 const affinity=(a,b)=>{
  const aa=profile(a),bb=profile(b);
  let hit=0;for(const g of aa)if(bb.has(g))hit++;
  return hit;
 };
 const priority=id=>{
  const observations=count(id),peers=degree.get(id)?.size||0;
  const u=m.uncertainty.get(id)||1;
  const age=lastSeen.has(id)?lastSeen.get(id):9999;
  const recentPenalty=(recent.get(id)||0)*17+(age<12?180:age<20?35:0);
  return Math.max(0,18-observations)*2.2+Math.max(0,10-peers)*3.5+
    Math.min(2.5,u)*10-recentPenalty;
 };
 const fresh=ids.filter(id=>!lastSeen.has(id)||lastSeen.get(id)>=12);
 const pool=(fresh.length>=3?fresh:ids).slice();
 if(pool.length<3)return null;
 const eligible=new Set(pool),strength=new Map(pool.map(id=>[id,priority(id)]));
 const rank=id=>strength.get(id)||0;
 const chooseTop=(items,max,extra=0)=>items.slice().sort((a,b)=>
   (rank(b)+extra*(rrHash(b+'|'+counter)%997)/997)-
   (rank(a)+extra*(rrHash(a+'|'+counter)%997)/997)||
   rrHash(a+'|choice'+counter)-rrHash(b+'|choice'+counter)).slice(0,max);
 const normGap=(a,b)=>{
  const v=Math.abs(m.score.get(a)-m.score.get(b));
  const u=Math.sqrt((m.uncertainty.get(a)||1)**2+(m.uncertainty.get(b)||1)**2);
  return v/Math.max(.1,u);
 };
 const matchValue=(a,b)=>10/(1+Math.pow(normGap(a,b),2))-pair(a,b)*14+
   Math.max(0,8-count(b))*1.1+
   (rrHash(a+'|'+b+'|'+counter)%251)/1000;
 const novel=t=>t.length===3&&new Set(t).size===3&&!used.has(rrTriadSig(t));
 let winner=null,best=-Infinity;
 if(kind==='near'){
  // All three share at least one explicit genre. Genre overlap is a soft
  // grouping, NOT a permanent rank partition.
  for(const [genre,members] of groups){
   const within=members.filter(id=>eligible.has(id));
   if(within.length<3)continue;
   const focuses=chooseTop(within,4,1.2);
   for(const a of focuses){
    const peers=within.filter(id=>id!==a).sort((b,c)=>
      (rank(c)*.7+matchValue(a,c))-(rank(b)*.7+matchValue(a,b))).slice(0,7);
    for(let i=0;i<peers.length;i++)for(let j=i+1;j<peers.length;j++){
     const b=peers[i],c=peers[j],triad=[a,b,c];
     if(!novel(triad))continue;
     const quality=rank(a)+rank(b)+rank(c)+
       matchValue(a,b)+matchValue(a,c)+matchValue(b,c)+
       (rrHash(genre+'|'+counter)%1000)/1000;
     if(quality>best){winner=triad;best=quality}
    }
   }
  }
 }else{
  // Select across different genres and different provisional rank bands.
  // Unlike the old bridge rule, recently used works cannot dominate every
  // fifth session; the last 12 appearances are a hard cooldown.
  // Prune to a broad but bounded high-utility pool so a 440-work
  // catalogue stays responsive on a mobile browser.
  const candidatesBase=chooseTop(pool,Math.min(96,pool.length),2);
  const focus=candidatesBase.slice(0,Math.min(18,candidatesBase.length));
  for(const a of focus){
   const candidates=candidatesBase.filter(b=>b!==a).sort((b,c)=>{
    const val=id=>rank(id)+matchValue(a,id)*1.2-
      affinity(a,id)*16+Math.min(.65,Math.abs(position.get(a)-position.get(id))/n)*12;
    return val(c)-val(b);
   }).slice(0,16);
   for(const b of candidates){
    if(affinity(a,b)>0&&profile(a).size&&profile(b).size)continue;
    const next=candidatesBase.filter(c=>c!==a&&c!==b).sort((c,d)=>{
     const val=id=>rank(id)*.75+matchValue(id,a)+matchValue(id,b)-
       (affinity(id,a)+affinity(id,b))*12;
     return val(d)-val(c);
    }).slice(0,7);
    for(const c of next){
     const triad=[a,b,c];if(!novel(triad))continue;
     const diversity=affinity(a,c)+affinity(b,c)+affinity(a,b);
     const range=Math.max(...triad.map(id=>position.get(id)))-
       Math.min(...triad.map(id=>position.get(id)));
     const quality=rank(a)+rank(b)+rank(c)+
       matchValue(a,b)+matchValue(a,c)+matchValue(b,c)+
       Math.min(50,range/n*35)-diversity*15;
     if(quality>best){winner=triad;best=quality}
    }
   }
  }
 }
 return winner;
}
function rrGenreProgressHtml(m){
 const {groups}=rrGenreMap(m.ids),pairs=[...m.stats.pairs.values()];
 const data=[];
 for(const [name,members] of groups){
  if(members.length<7)continue;
  const memberSet=new Set(members),degree=new Map(members.map(id=>[id,new Set()]));
  for(const p of pairs){
   if(!memberSet.has(p.a)||!memberSet.has(p.b))continue;
   degree.get(p.a).add(p.b);degree.get(p.b).add(p.a);
  }
  const compared=members.filter(id=>(m.stats.counts.get(id)||0)>0).length;
  const connected=members.filter(id=>(degree.get(id)?.size||0)>=4).length;
  const average=members.reduce((sum,id)=>sum+(degree.get(id)?.size||0),0)/members.length;
  data.push({name,total:members.length,compared,connected,average});
 }
 data.sort((a,b)=>b.total-a.total);
 if(!data.length)return '';
 return '<div class="rr-genre-progress"><h3>ジャンル別の比較状況</h3>'+
  '<p class="rr-muted">同じジャンルの相手を何本比較したかの集計です。順位が確定した本数ではありません。複数ジャンルに属する作品は重複して数えます。</p>'+
  data.slice(0,15).map(row=>
    '<div class="rr-genre-row"><strong>'+esc(row.name)+'</strong>'+
    '<span>登場済み '+row.compared+'/'+row.total+'本 · 同系統の相手 平均'+
     row.average.toFixed(1)+'本 · 相手4本以上 '+row.connected+'本</span></div>'
  ).join('')+'</div>';
}
function rrScopeLabel(ids){
 const map=rrGenreMap(ids),items=ids.map(id=>map.tokens.get(id)||new Set());
 const common=[...items[0]||[]].filter(g=>items.slice(1).every(set=>set.has(g)));
 return common.length?'同系統を比較 · '+common.slice(0,2).join('・'):'ジャンルを横断して比較';
}
// An occasional audit of INDIRECT (transitively inferred) precedence.
// Unlike ordinary nearby-pair picks, the audited pair has never been
// directly compared, but its current A>B order depends on a chain of other
// comparisons. This lets low-ranked titles challenge a possibly mistaken
// chain instead of being trapped below it.
//
// Returns null if there is no safe, fresh, informative trio to recheck.
function rrIndirectAuditTriad(r,m,used){
 const ids=m.order,n=ids.length,counts=m.stats.counts;
 const graph=m.replay,reach=graph?.reach,indices=graph?.reachIndex;
 if(!reach||!indices||n<10)return null;
 const position=new Map(ids.map((id,i)=>[id,i]));
 const recent=new Set();
 for(const e of r.events.slice(-18))for(const id of (e.displayIds||e.ids||[]))recent.add(id);
 const eligible=ids.filter(id=>(counts.get(id)||0)>0&&!recent.has(id));
 if(eligible.length<3)return null;
 const count=id=>counts.get(id)||0;
 const compared=(a,b)=>!!(m.stats.pairs.get(rrPairKey(a,b))?.n);
 const implied=(a,b)=>{
  const i=indices.get(a),j=indices.get(b);
  return i!==undefined&&j!==undefined&&
   !!(reach[i][j>>>5]&(1<<(j&31)));
 };
 const minGap=Math.max(8,Math.round(n*.13));
 const seed=r.events.length+(r.skips||[]).length;
 // A tentative low-placed film is interesting when it has few independent
 // observations or the statistical estimate questions the enforced order.
 const options=[];
 for(const lower of eligible){
  const lo=position.get(lower);
  if(lo<Math.floor(n*.42))continue;
  for(const upper of eligible){
   const up=position.get(upper),distance=lo-up;
   if(distance<minGap||compared(upper,lower)||!implied(upper,lower))continue;
   const scoreDisagreement=Math.max(0,
    (m.score.get(lower)||0)-(m.score.get(upper)||0));
   const value=distance/n*28+Math.min(2.5,scoreDisagreement)*17+
    Math.max(0,12-count(lower))*1.2+
    Math.max(0,12-count(upper))*.5+
    Math.min(2,(m.uncertainty.get(lower)||1))*3+
    (rrHash(upper+'|'+lower+'|audit'+seed)%997)/997*3;
   options.push({upper,lower,value});
  }
 }
 options.sort((a,b)=>b.value-a.value);
 // Prefer a fresh third title near the lower-placed work; it provides a
 // genuine calibration rather than repeating a previously solved triple.
 for(const {upper,lower} of options.slice(0,24)){
  const lp=position.get(lower),up=position.get(upper);
  const thirds=eligible.filter(id=>id!==upper&&id!==lower)
   .sort((a,b)=>{
    const value=id=>{
     const p=position.get(id);
     const nearLower=Math.abs(p-lp);
     const nearUpper=Math.abs(p-up);
     return Math.max(0,12-count(id))*2+
      Math.min(32,40/(1+nearLower/Math.max(5,n*.035)))+
      Math.min(14,16/(1+nearUpper/Math.max(5,n*.1)))-
      (compared(id,lower)?13:0)-(compared(id,upper)?9:0)+
      (rrHash(id+'|auditthird'+seed)%997)/997;
    };
    return value(b)-value(a);
   }).slice(0,30);
  for(const third of thirds){
   const triple=[upper,lower,third];
   if(!used.has(rrTriadSig(triple)))return triple;
  }
 }
 return null;
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
 // One cross-band slot in ten is dedicated to checking an otherwise
 // untested pair whose ordering came from a transitive chain. When no such
 // pair is available, leave the existing selector unchanged.
 if(mode==='local'&&counter%10===8){
  const audit=rrIndirectAuditTriad(r,m,used);
  if(audit)return audit;
 }
 if(mode==='local'||mode==='wide'){
  // 7/10 similar-genre comparisons, 3/10 cross-genre calibration.
  // Explicit wide mode always checks across genres.
  const kind=mode==='wide'||counter%10>=7?'cross':'near';
  const genrePick=rrGenreChoice(r,m,used,kind);
  if(genrePick)return genrePick;
  // If a rare genre has too few unused works, switch strategy rather
  // than repeatedly choosing the same prominent movie.
  const fallback=rrGenreChoice(r,m,used,kind==='near'?'cross':'near');
  if(fallback)return fallback;
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
 const pos=new Map(ids.map((id,i)=>[id,i])),score=m.score,uncertainty=m.uncertainty;
 const std=(a,b)=>Math.sqrt((uncertainty.get(a)||1)**2+(uncertainty.get(b)||1)**2);
 const ambiguity=(a,b)=>Math.abs(score.get(a)-score.get(b))/Math.max(.2,std(a,b));
 // Priority: under-tested movies, few unique opponents, uncertain neighboring
 // scores; every fifth selection is deliberately cross-band for calibration.
 const gap=id=>{
  const p=pos.get(id),neighbors=[ids[p-1],ids[p+1]].filter(Boolean);
  return neighbors.length?Math.min(...neighbors.map(x=>ambiguity(x,id))):1;
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
   const z=ambiguity(id,against);
   // High uncertainty matters even when current mean rank is far apart.
   const info=11/(1+z*z)+3*Math.min(2,std(id,against));
   const scope=cross?(d>=n*.17?5:0):9/(1+d/(Math.max(2,n*.035)));
   return coverage+diversity+info+scope+((rrHash(id+'|'+counter+':'+attempt)%100)/250);
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
 rrReviewPairs=null;
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
   rrPicks.length?'次は2位の作品をタップ':'一番好きな作品をタップ';
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
/**
 * Warn only for NEW conflicts caused by the pending answer:
 * (a) an older edge becomes suspended in the latest-first DAG, including
 * cycles of length >3; or (b) the latest recorded direct head-to-head is
 * being reversed. Existing unresolved cycles alone never trigger warnings.
 *
 * The preview is computed without mutating the saved event list.
 */
function rrPendingConflict(r,modelBefore,pending){
 if(!pending||pending.ambiguous||!Array.isArray(pending.groups))return null;
 const current=modelBefore.replay||rrReplayConstraints(r,modelBefore.ids,modelBefore.order);
 const preview=rrReplayConstraints(
  {...r,events:r.events.concat([pending])},modelBefore.ids,modelBefore.order);
 const heldKey=e=>e.eventIndex+'|'+rrPairKey(e.better,e.worse);
 const existing=new Set(current.held.map(heldKey));
 const suspended=preview.held.filter(e=>!existing.has(heldKey(e)));
 const groups=pending.groups,pos=new Map();
 groups.forEach((group,i)=>(group||[]).forEach(id=>pos.set(id,i)));
 const ordered=[...pos.keys()],edges=[];
 for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
  const a=ordered[i],b=ordered[j],pa=pos.get(a),pb=pos.get(b);
  if(pa===pb)continue;
  edges.push(pa<pb?[a,b]:[b,a]);
 }
 const reversed=[];
 for(const [winner,loser] of edges){
  // Only the most recent previous direct result counts for a reversal
  // warning, not a stale earlier result that has since been corrected.
  for(let i=r.events.length-1;i>=0;i--){
   const old=r.events[i];if(old.ambiguous||!Array.isArray(old.groups))continue;
   let ow=-1,ol=-1;
   old.groups.forEach((group,gi)=>{
    if(group.includes(winner))ow=gi;
    if(group.includes(loser))ol=gi;
   });
   if(ow<0||ol<0)continue;
   if(ow>ol)reversed.push({better:loser,worse:winner,eventIndex:i});
   break;
  }
 }
 if(!suspended.length&&!reversed.length)return null;
 return {suspended,reversed};
}
function rrConfirmPendingConflict(r,modelBefore,pending){
 const found=rrPendingConflict(r,modelBefore,pending);
 if(!found)return true;
 const name=id=>displayTitle(filmById(id)||{title:id});
 const summary=pending.groups.map(g=>g.map(name).join(' ≈ ')).join(' ＞ ');
 const unique=new Map();
 for(const entry of found.suspended.concat(found.reversed)){
  const key=rrPairKey(entry.better,entry.worse)+'|'+entry.eventIndex;
  if(!unique.has(key))unique.set(key,entry);
 }
 const rows=[...unique.values()];
 const heading=found.suspended.length?'以前の判断との循環が発生します。':
  '以前の直接比較と逆の判断になっています。';
 const examples=rows.slice(0,4).map(e=>
  '・'+name(e.better)+' ＞ '+name(e.worse)+'（比較#'+(e.eventIndex+1)+'）'
 ).join('\n');
 const extra=rows.length>4?'\nほか'+(rows.length-4)+'件':'';
 const message=heading+'\n\n今回：'+summary+
  '\n\n衝突する以前の判断：\n'+examples+extra+
  '\n\n［OK］今回の回答で確定（新しい判断を優先）'+
  '\n［キャンセル］選び直す（今回は保存しない）'+
  '\n\n以前の判断は消去せず、順位への強制反映だけ保留します。'+
  '後から同じ作品を再比較したり、ログから誤判断を削除したりできます。';
 return confirm(message);
}

function rrCommit(kind='rank',groupsOverride=null,restoreFirst=null){
 const r=rrState();if(!rrTriad||rrTriad.length!==3)return;
 const modelBefore=rrModel(r);
 const ordered=(kind==='rank'&&rrOrder.length===3)?rrOrder.slice():rrTriad.slice();
 const e={id:'rr2-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),at:Date.now(),
  ids:ordered,displayIds:rrTriad.slice(),mode:r.mode,kind};
 if(kind==='rank')e.groups=groupsOverride||rrGroups();
 else e.ambiguous=true;
 if(restoreFirst)e.firstPick=restoreFirst;
 if(kind==='rank'&&rrReviewPairs?.length)e.reviewResolves=rrReviewPairs.slice();
 e.genreScope=rrScopeLabel(e.displayIds);
 const newConflict=kind==='rank'?rrPendingConflict(r,modelBefore,e):null;
 // A newly formed cycle is handled by the very next multi-work comparison,
 // not by a one-off yes/no pop-up. Plain direct reversals retain confirmation.
 if(kind==='rank'&&newConflict?.reversed?.length&&!newConflict.suspended.length&&
    !rrConfirmPendingConflict(r,modelBefore,e)){
  // Clear the attempted two-tap choice; leave the same three titles shown,
  // retain any explicit review context and never change comparison history.
  rrPicks=[];rrTiePartner=false;rrOrder=rrTriad.slice();
  rrPaintSelection();return;
 }
 r.events.push(e);
 const modelAfter=rrModel(r);
 if(kind==='rank')rrCycleNewHolds(r,modelBefore,modelAfter);
 e.rankDelta=rrDelta(modelBefore,modelAfter);
 e.triadPositions=rrTriadPositions(modelBefore,modelAfter,e.displayIds);
 save();rrSetTriad(rrChooseTriad(r,r.mode));
 if(rrHeldReviewFlow){rrHeldReviewFlow=false;rrLogOpen=true;rrLogTab='conflicts';}
 rrRender();
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
function rrSkip(){rrReviewPairs=null;rrHeldReviewFlow=false;const r=rrState();if(rrOrder.length===3)r.skips.push(rrTriadSig(rrOrder));if(r.skips.length>80)r.skips=r.skips.slice(-80);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrUndoEvent(){
 if(rrTiePartner){rrTiePartner=false;rrPaintSelection();return}
 if(rrPicks.length){rrPicks=[];rrPaintSelection();return}
 const r=rrState();
 if(!r.events.length)return;
 const last=r.events.pop();
 if(last.kind==='cycle-review'){
  // Undoing a whole-cycle correction restores its original review task.
  const key=last.cycleReviewFromKey;
  if(key?.startsWith('manual:')){
   const eventId=key.slice(7),original=r.events.find(e=>e.id===eventId);
   if(original)r.cycleReviewQueue.unshift({key,manual:true,
    eventId,ids:[...new Set(original.displayIds||original.ids||[])]});
  }else{
   const remaining=rrModel(r).replay?.held.find(edge=>rrCycleKey(r,edge)===key);
   if(remaining)rrCycleQueuePush(r,remaining,true);
  }
  rrCycleActiveKey=null;rrCycleGroups=[];rrCycleTieNext=false;
  save();rrLogOpen=false;rrRender();return;
 }
 save();
 rrSetTriad((last.displayIds||last.ids||[]).length===3?
    (last.displayIds||last.ids):rrChooseTriad(r,r.mode));
 if(last.firstPick&&rrTriad.includes(last.firstPick))rrPicks=[last.firstPick];
 if(Array.isArray(last.reviewResolves))rrReviewPairs=last.reviewResolves.slice();
 rrRender();
}
function rrDeleteEvent(id){
 const r=rrState(),idx=r.events.findIndex(e=>e.id===id);if(idx<0)return;
 rrHistoryReplayToken++;r.events=r.events.filter(e=>e.id!==id);
 r.events.slice(idx).forEach(e=>{delete e.rankDelta;delete e.triadPositions});
 save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();
}
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
     (e.genreScope?'<small class="rr-genre-log">'+esc(e.genreScope)+'</small>':'')+
     (e.reviewResolves?.length?'<small class="rr-genre-log">再検証で'+e.reviewResolves.length+'組の過去判断を更新（履歴は保存）</small>':'')+
     '<small class="rr-delta-line">'+esc(rrDeltaText(e.rankDelta))+'</small>'+rrTriadPositionsHtml(e,true)+ 
     '</span><button data-rr-review="'+e.id+'">再比較</button>'+
     '<button data-rr-del="'+e.id+'">削除</button></div>';
 }).join('');
}
// Approximate 80% rank ranges by deterministic normal-posterior sampling.
// They describe the judged subset, not an invented order for untouched works.
function rrRankBands(m){
 const observed=m.order.slice(0,m.seenCount),n=observed.length;
 const result=new Map();if(!n)return result;
 const samples=new Map(observed.map(id=>[id,[]]));
 for(let draw=0;draw<48;draw++){
  const order=observed.map(id=>{
   const u=(rrHash(id+'|uncertainty-a|'+draw)+.5)/4294967296;
   const v=(rrHash(id+'|uncertainty-b|'+draw)+.5)/4294967296;
   const z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
   return {id,score:m.score.get(id)+(m.uncertainty.get(id)||1)*z};
  }).sort((a,b)=>b.score-a.score);
  order.forEach(({id},i)=>samples.get(id).push(i+1));
 }
 for(const id of observed){
  const ranks=samples.get(id).sort((a,b)=>a-b);
  result.set(id,{lo:ranks[4],hi:ranks[43]});
 }
 return result;
}
function rrPreviewHtml(r,m){
 const judged=m.seenCount>0;
 // Posterior score bands are not intervals for constrained ranks.
 if(!judged)return '<div class="rr-muted">まだ順位は未判定です。初回の比較から新ランキングを作ります。旧順位は初期値に使っていません。</div>';
 const html=m.order.map((id,i)=>{
   const f=filmById(id),c=m.stats.counts.get(id)||0,never=c===0;
   // Mandatory comparisons determine rank; ties use stable baseline order.
   return (i===m.seenCount?
      '<div class="rr-rank-divider">未比較の作品 '+(m.ids.length-m.seenCount)+'本（順位未判定・下位という意味ではありません）</div>':'')+
     '<div class="rr-rank-row'+(never?' rr-rank-unseen':'')+'"><b>'+
       (never?'—':(i+1))+'</b><span>'+esc(displayTitle(f))+
       '</span><small>'+(never?'未比較・順位未判定':
         c+' ペア判断 · 最新の直接比較を優先')+
       '</small></div>';
 }).join('');
 return '<div class="rr-muted">直接比較の最新判断を優先して過去の全記録から順位を作っています。循環する古い判断は保留し、三すくみ画面で再検証できます。未比較作品は順位未判定で、下位と決めつけません。</div>'+
   '<div class="rr-rank-scroll">'+html+'</div>';
}

function rrHeldKey(r,edge){
 const event=r.events?.[edge.eventIndex];
 return (event?.id||'event-'+edge.eventIndex)+'|'+rrPairKey(edge.better,edge.worse);
}
function rrUnreviewedHolds(r,m){
 const accepted=new Set(Array.isArray(r.acknowledgedHolds)?r.acknowledgedHolds:[]);
 return (m.replay?.held||[]).filter(edge=>!accepted.has(rrHeldKey(r,edge)));
}
function rrAcceptHeld(key){
 const r=rrState(),m=rrModel(r);
 const edge=(m.replay?.held||[]).find(e=>rrHeldKey(r,e)===key);
 if(!edge)return;
 const accepted=new Set(Array.isArray(r.acknowledgedHolds)?r.acknowledgedHolds:[]);
 accepted.add(key);r.acknowledgedHolds=[...accepted];save();
 rrLogTab='conflicts';rrLogOpen=true;rrRender();
}
function rrRecheckHeld(key){
 const r=rrState(),m=rrModel(r);
 const edge=(m.replay?.held||[]).find(e=>rrHeldKey(r,e)===key);
 if(!edge)return;
 r.cycleReviewQueue=r.cycleReviewQueue.filter(q=>q.key!==key);
 rrCycleQueuePush(r,edge,true);
 rrLogOpen=false;rrCycleActiveKey=null;rrCycleGroups=[];rrRender();
}


function rrCycleExplanationHtml(edge){
 if(!edge||!Array.isArray(edge.cycleIds)||edge.cycleIds.length<2)return '';
 const ids=edge.cycleIds,steps=edge.cycleSteps||[];
 const name=id=>displayTitle(filmById(id)||{title:id});
 const chain=ids.map(id=>name(id)).concat(name(ids[0])).join(' ＞ ');
 const detailed=steps.map((step,i)=>{
  const left=name(step.better),right=name(step.worse);
  const isHeld=!!step.held;
  return '<div class="rr-cycle-evidence'+(isHeld?' rr-cycle-evidence-held':'')+'">'+
    '<span class="rr-cycle-evidence-index">'+(i+1)+'</span>'+
    '<span class="rr-cycle-evidence-text">'+esc(left+' ＞ '+right)+
    '<small>比較#'+(step.eventIndex+1)+
    (isHeld?' · 今は保留中の判断':' · 順位に採用中の判断')+
    '</small></span></div>';
 }).join('');
 return '<div class="rr-cycle-explain">'+
  '<strong>この'+ids.length+'作品で循環しています</strong>'+
  '<div class="rr-cycle-chain">'+esc(chain)+'</div>'+
  '<div class="rr-cycle-explain-note">最初の作品に戻ってしまうため、すべての「＞」を同時には満たせません。</div>'+
  (steps.length?'<details class="rr-cycle-details"'+(steps.length<=5?' open':'')+'>'+
  '<summary>各矢印の根拠（'+steps.length+'件の比較）</summary>'+
  '<div class="rr-cycle-evidences">'+detailed+'</div></details>':'')+
  '</div>';
}

function rrConflictsHtml(r,m){
 const cycles=m.stats.cycles.slice(0,200),contradictions=m.stats.contradictions.slice(0,100);
 const detail='<div class="rr-muted">新ランキングは最新の直接比較を優先します。判断が循環する場合、古い制約は一時保留し、記録自体は残します。再検証すると新しい判断が優先されます。</div>';
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
 const held=m.replay?.held||[],pending=rrUnreviewedHolds(r,m);
 const rows=pending.length?pending.map((edge,i)=>{
  const event=r.events[edge.eventIndex],key=rrHeldKey(r,edge);
  const a=displayTitle(filmById(edge.better)||{title:edge.better});
  const b=displayTitle(filmById(edge.worse)||{title:edge.worse});
  const pos=new Map(m.order.map((id,j)=>[id,j+1]));
  const trio=(event?.displayIds||event?.ids||[]).map(id=>
   displayTitle(filmById(id)||{title:id})).join(' / ');
  return '<div class="rr-hrow rr-held-row"><div class="rr-held-main"><b>判断 '+(i+1)+'</b> '+esc(a+' ＞ '+b)+
   '<small>比較#'+(edge.eventIndex+1)+' · 元の3作品：'+esc(trio)+'</small>'+
   rrCycleExplanationHtml(edge)+
   '<small>現在の暫定順位：'+esc(a)+' '+(pos.get(edge.better)||'—')+'位 / '+
   esc(b)+' '+(pos.get(edge.worse)||'—')+'位</small></div>'+
   '<div class="rr-held-buttons"><button data-rr-recheck="'+encodeURIComponent(key)+'">再比較</button>'+
   '<button data-rr-accept="'+encodeURIComponent(key)+'">保留を了承</button></div></div>';
 }).join(''):'<div class="rr-muted">未確認の保留判断はありません。</div>';
 return '<div class="rr-review-intro"><strong>未確認の保留判断：'+pending.length+'組</strong>'+
  '<p>過去の判断の一部が循環し、順位に同時反映できません。「再比較」で元の3作品を選び直すか、'+
  '「保留を了承」で現在の順位を維持してください。過去ログはいずれの場合も保存されます。'+
  '了承した判断は未確認件数から除きます。</p>'+
  '<small>全保留 '+held.length+'組 / 了承済み '+(held.length-pending.length)+'組</small></div>'+
  rows+'<h3>比較を横断した三すくみ '+m.stats.cycles.length+'組</h3>'+c+
  '<h3>記録上の直接判断の食い違い '+m.stats.contradictions.length+'組</h3>'+p;
}
function rrExit(){
 rrLogOpen=false;rrTieOpen=false;rrTiePartner=false;rrHeldReviewFlow=false;
 view.page='rank';save(false);renderHeader();
}
function rrOpenConflict(ids,pairsToResolve=null){
 if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3)return;
 rrSetTriad(ids);
 const scope=new Set(ids),pairs=(pairsToResolve||[]).filter(p=>
   Array.isArray(p)&&p.length===2&&p.every(id=>scope.has(id))&&p[0]!==p[1]);
 rrReviewPairs=[...new Set(pairs.map(p=>rrPairKey(p[0],p[1])))];
 rrLogOpen=false;rrRender();
}
function rrRender(){
 const root=document.getElementById('rerankRoot');if(!root)return;
 const r=rrState(),m=rrModel(r);
 const activeCycle=rrCycleQueueSync(r,m);
 if(!rrTriad||rrTriad.some(id=>!m.ids.includes(id)))rrSetTriad(rrChooseTriad(r,r.mode));
 const pending=rrUnreviewedHolds(r,m);
 if(pending.length&&!activeCycle&&r.heldReviewNoticeVersion!==118){
  r.heldReviewNoticeVersion=118;rrLogOpen=true;rrLogTab='conflicts';save(false);
 }
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
     '<button data-rr-logtab="conflicts" class="'+(rrLogTab==='conflicts'?'active':'')+'">要確認 '+pending.length+'</button>'+ 
     '<button data-rr-logtab="progress" class="'+(rrLogTab==='progress'?'active':'')+'">進捗</button>'+
     '<button data-rr-logtab="settings" class="'+(rrLogTab==='settings'?'active':'')+'">設定</button>'+
    '</div>'+
    (rrLogTab==='history'?
     '<div class="rr-drawer-inner"><div class="rr-muted">各回の順位変動を確認できます。過去の判断も個別に削除できます。</div>'+rrDeltaHtml(r,true)+
 rrDeltaTrendHtml(r)+
 '<button id="rrBackfill" class="rr-backfill">過去の比較も集計</button><div id="rrBackfillStatus" class="rr-muted"></div>'+rrHistoryHtml(r)+'</div>':
     rrLogTab==='ranks'?
     '<div class="rr-drawer-inner"><h3>新ランキング（全'+m.ids.length+'作品）</h3>'+
      '<div class="rr-muted">直接比較優先で過去の判定も再計算済み · 循環で保留 '+(m.replay?.held?.length||0)+'組</div>'+
      rrPreviewHtml(r,m)+'</div>':
     rrLogTab==='conflicts'?
     '<div class="rr-drawer-inner">'+rrConflictsHtml(r,m)+'</div>':
     rrLogTab==='progress'?rrProgressDetail(progress,r):
     '<div class="rr-drawer-inner rr-settings"><h3>次に表示する組み合わせ</h3>'+
      '<div class="rr-mode">'+
       '<button data-rr-mode="local" class="'+(r.mode==='local'?'active':'')+'">近いジャンル中心（7：3）</button>'+
       '<button data-rr-mode="wide" class="'+(r.mode==='wide'?'active':'')+'">ジャンルを横断</button>'+
       '<button data-rr-mode="conflict" class="'+(r.mode==='conflict'?'active':'')+'">矛盾を確認</button></div>'+
      '<p>最新の直接判断を優先して順位を作ります。成立しない古い判断は保留し、履歴は残します。旧ランキング・点数・星・レビューは変更しません。</p>'+
      '<button id="rrNew" class="rr-danger">新ランキングだけ最初からやり直す</button></div>')+
   '</div>':
   activeCycle?rrCycleReviewHtml(r,m,activeCycle):
   '<div class="rr-fast-stage">'+
    (pending.length?'<button id="rrOpenPending" class="rr-pending-banner">要確認の過去判断 '+pending.length+'組 · 1組ずつ確認</button>':'')+
    '<div class="rr-fast-progress"><span>比較 <strong>'+r.events.length+'</strong> 回</span>'+
     '<span>比較済み <strong>'+nSeen+'</strong> / '+m.ids.length+' 本</span></div>'+ 
    '<button class="rr-progress-summary" id="rrOpenProgress" aria-label="ランキングの進捗と目安の詳細を開く">'+rrProgressHtml(progress)+'</button>'+rrDeltaHtml(r)+(r.events.length?rrTriadPositionsHtml(r.events[r.events.length-1]):'')+
    '<div class="rr-genre-scope">'+esc(rrReviewPairs?.length?'再検証中：'+rrReviewPairs.length+'組の過去判断を更新':rrScopeLabel(rrTriad))+'</div>'+
    '<div class="rr-fast-instruction" id="rrPickInstruction">一番好きな作品をタップ</div>'+
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
 bind('#rrOpenPending',()=>{rrLogTab='conflicts';rrLogOpen=true;rrRender()});
 if(showLogs){
  root.querySelectorAll('[data-rr-logtab]').forEach(btn=>btn.onclick=()=>{rrLogTab=btn.dataset.rrLogtab;rrRender()});
  root.querySelectorAll('[data-rr-accept]').forEach(btn=>btn.onclick=()=>rrAcceptHeld(decodeURIComponent(btn.dataset.rrAccept)));
  root.querySelectorAll('[data-rr-recheck]').forEach(btn=>btn.onclick=()=>rrRecheckHeld(decodeURIComponent(btn.dataset.rrRecheck)));
  root.querySelectorAll('[data-rr-del]').forEach(btn=>btn.onclick=()=>rrDeleteEvent(btn.dataset.rrDel));
  root.querySelectorAll('[data-rr-review]').forEach(btn=>btn.onclick=()=>{
   const old=r.events.find(e=>e.id===btn.dataset.rrReview);if(!old)return;
   const ids=[...new Set(old.displayIds||old.ids||[])];
   if(ids.length!==3){rrCycleManualReview(old.id);return;}
   rrOpenConflict(ids,[[ids[0],ids[1]],[ids[1],ids[2]],[ids[0],ids[2]]]);
  });
  root.querySelectorAll('[data-rr-mode]').forEach(btn=>btn.onclick=()=>{
   r.mode=btn.dataset.rrMode;save(false);rrSetTriad(rrChooseTriad(r,r.mode));rrRender();
  });
  root.querySelectorAll('[data-rr-cycle]').forEach(btn=>btn.onclick=()=>{
    const ids=m.stats.cycles[Number(btn.dataset.rrCycle)];
    if(ids)rrOpenConflict(ids,[[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]]);
   });
  root.querySelectorAll('[data-rr-held]').forEach(btn=>btn.onclick=()=>{
   const edge=m.replay?.held?.[Number(btn.dataset.rrHeld)];if(!edge)return;
   const third=m.order.find(id=>id!==edge.better&&id!==edge.worse);
   if(third)rrOpenConflict([edge.better,edge.worse,third],[[edge.better,edge.worse]]);
  });
  root.querySelectorAll('[data-rr-pair]').forEach(btn=>btn.onclick=()=>{
   const p=m.stats.contradictions[Number(btn.dataset.rrPair)];if(!p)return;
   const third=m.order.find(x=>x!==p.a&&x!==p.b);if(third)rrOpenConflict([p.a,p.b,third],[[p.a,p.b]]);
  });
  bind('#rrBackfill',rrBackfillHistory);
   bind('#rrNew',rrNew);
 }else if(activeCycle){
  root.querySelectorAll('[data-rr-cycle-pick]').forEach(btn=>{
   btn.onclick=()=>rrCyclePick(decodeURIComponent(btn.dataset.rrCyclePick));
  });
  bind('#rrCycleTie',()=>{
   if(rrCycleGroups.length){rrCycleTieNext=!rrCycleTieNext;rrRender();}
  });
  bind('#rrCycleUndo',rrCycleUndoPick);
  bind('#rrCycleReset',()=>{rrCycleGroups=[];rrCycleTieNext=false;rrRender()});
  bind('#rrCycleDefer',rrCycleDefer);
  for(const id of activeCycle.ids)rrPosterQueue(filmById(id));
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
 window.__movie30RerankV120={build:BUILD,render:rrRender,model:()=>rrModel(rrState()),
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

.rr-delta-trend{border:1px solid #344b67;border-radius:9px;padding:11px;margin:12px 0;display:flex;flex-direction:column;gap:6px}
.rr-delta-trend strong{font-size:12px;color:#e5eeff}
.rr-delta-bars{height:76px;display:flex;align-items:end;gap:3px;border-bottom:1px solid #496180}
.rr-delta-bars>div{flex:1;min-width:2px;background:#83ace6;border-radius:2px 2px 0 0}
.rr-delta-axis{display:flex;justify-content:space-between;color:#90a9c7;font-size:10px}
.rr-delta-trend small{color:#abc1db;font-size:11px;line-height:1.5}

.rr-triad-moves{border:1px solid #405879;border-radius:9px;padding:9px 10px;background:#121e2e;display:flex;flex-direction:column;gap:7px}
.rr-triad-moves>strong{font-size:11px;color:#dceaff}.rr-triad-moves>small{color:#829bb9;font-size:9px}
.rr-triad-pos-list{display:flex;flex-direction:column;gap:5px}
.rr-triad-pos-row{display:grid;grid-template-columns:minmax(0,1fr) auto 38px;gap:8px;align-items:center;font-size:11px;line-height:1.35}
.rr-triad-pos-row>span{color:#d2e1f6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rr-triad-pos-row>b{font-size:11px;font-weight:750;white-space:nowrap;color:#eff5ff}
.rr-triad-pos-row>small{text-align:right;color:#b4c5dc;font-size:10px;white-space:nowrap}
.rr-triad-pos-row>small.rr-triad-rise{color:#8fd4a6}.rr-triad-pos-row>small.rr-triad-fall{color:#f1b7a8}
.rr-triad-unrecorded{color:#98afca;font-size:11px;padding:4px 1px}
.rr-hrow .rr-triad-moves{margin-top:9px;padding:8px;background:#102238}
.rr-hrow .rr-triad-pos-row{grid-template-columns:minmax(0,1fr) auto 34px}
@media(max-width:390px){.rr-triad-pos-row{gap:5px;grid-template-columns:minmax(0,1fr) auto 30px}.rr-triad-pos-row>b{font-size:10px}}

.rr-genre-log{display:block;color:#90b9d4;font-size:10px;margin-top:4px}
.rr-genre-scope{text-align:center;color:#93badc;font-size:11px;line-height:1.4;font-weight:700}
.rr-genre-progress{margin:12px 0 15px}
.rr-genre-row{display:flex;justify-content:space-between;gap:7px;border-bottom:1px solid #2e4058;padding:9px 2px;align-items:center}
.rr-genre-row strong{font-size:12px;flex:0 0 28%;color:#dce7f8}
.rr-genre-row span{font-size:10px;color:#97acc8;text-align:right;line-height:1.45}
.rr-delta-summary{border:1px solid #3c587b;background:#112235;border-radius:9px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;font-size:11px;line-height:1.4}
.rr-delta-summary strong{font-size:12px;color:#dce9fc}.rr-delta-summary span{color:#b4cae6}.rr-delta-summary small{color:#91a7bf;font-size:10px}
.rr-delta-line{display:block;margin-top:5px;color:#95b9ed;font-size:10px;line-height:1.5}
.rr-backfill{width:100%;border:1px solid #49628a;color:#d8e9ff;background:#182b47;border-radius:9px;padding:11px;font-size:12px;margin:11px 0}
.rr-rank-divider{padding:12px 7px;font-size:12px;font-weight:750;color:#a8beda;border-top:1px solid #3a526d;background:#142337}.rr-rank-unseen{opacity:.65}@media(min-width:700px){.rr-fast-shell{min-height:calc(100dvh - 45px)}.rr-fast-stage{padding:18px 20px}.rr-fast-grid{gap:15px}.rr-fast-card{max-width:280px;justify-self:center}.rr-fast-title{padding:12px 10px 0;min-height:64px}.rr-fast-bottom button{font-size:13px}}
@media(max-width:365px){.rr-drawer-tabs button{font-size:9px}.rr-fast-grid{gap:4px}.rr-fast-title{font-size:10px;padding:7px 4px 0}.rr-fast-bottom button{font-size:10px}.rr-fast-brand b{font-size:15px}}
`;
rrStyle.textContent += "\n.rr-pending-banner{display:block;width:100%;padding:11px 10px;border-radius:9px;\n border:1px solid #bd9550;color:#fff2d7;background:#3d3022;\n font-size:12px;font-weight:800;text-align:center}\n.rr-review-intro{padding:12px;margin:6px 0 12px;background:#18273b;\n border:1px solid #526a8a;border-radius:10px}\n.rr-review-intro strong{font-size:16px}\n.rr-review-intro p{font-size:12px;line-height:1.65;margin:8px 0;color:#d6e4f5}\n.rr-review-intro small{font-size:11px;color:#b4c7db}\n.rr-held-row{display:flex;flex-direction:column;align-items:stretch;gap:9px}\n.rr-held-row span{min-width:0;overflow-wrap:anywhere}\n.rr-held-row small{display:block;margin-top:4px;color:#b7c6d9;font-size:11px}\n.rr-held-buttons{display:flex;gap:7px;justify-content:flex-end}\n.rr-held-buttons button{padding:9px 13px;border-radius:8px;min-height:36px;\n border:1px solid #56739a;background:#1d395c;color:#eff7ff;font-size:12px}\n.rr-held-buttons button:last-child{background:#304132;border-color:#718675}\n";
rrStyle.textContent += "\n.rr-cycle-screen{display:flex;flex-direction:column;gap:12px;padding:10px 4px 18px;max-width:740px;margin:0 auto}\n.rr-cycle-heading{background:#1c2d43;border:1px solid #57718f;border-radius:12px;padding:14px}\n.rr-cycle-heading strong{color:#ffdb9e;font-size:19px}\n.rr-cycle-heading p{font-size:13px;line-height:1.65;color:#e1eaf4;margin:9px 0}\n.rr-cycle-heading small{display:block;color:#a8bdd1;font-size:11px;line-height:1.65}\n.rr-cycle-picked{display:grid;gap:5px;min-height:35px}\n.rr-cycle-choice{padding:9px 12px;border:1px solid #476d99;border-radius:8px;background:#163355;\nfont-size:13px;line-height:1.4}\n.rr-cycle-choice b{display:inline-block;min-width:36px;color:#9cceff}\n.rr-cycle-instruction{font-size:13px;font-weight:800;color:#fff4dc;text-align:center}\n.rr-cycle-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}\n.rr-cycle-card{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #59749a;\nborder-radius:10px;background:#15263d;color:#eff7ff;min-height:74px;text-align:left;font-size:13px;\nfont-weight:750;min-width:0;overflow-wrap:anywhere}\n.rr-cycle-card img,.rr-cycle-no-poster{width:43px;height:60px;object-fit:cover;border-radius:5px;\nbackground:#31435b;flex:none}\n.rr-cycle-card small{display:block;margin-top:4px;color:#a8bcd3;font-weight:400}\n.rr-cycle-actions{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}\n.rr-cycle-actions button{border:1px solid #5c7596;border-radius:8px;background:#244366;\ncolor:#eaf4ff;font-size:12px;padding:10px 12px;min-height:40px}\n.rr-cycle-actions button.active{background:#6c4e20;color:#fff7db;border-color:#f1c36e}\n.rr-cycle-actions button:disabled{opacity:.3}\n.rr-cycle-actions #rrCycleDefer{background:#24303c;color:#c4ceda}\n@media(max-width:400px){.rr-cycle-cards{grid-template-columns:1fr}.rr-cycle-card{min-height:62px}\n.rr-cycle-card img,.rr-cycle-no-poster{width:36px;height:50px}}\n";
rrStyle.textContent += "\n.rr-cycle-explain{margin:12px 0 4px;border:1px solid #627c9b;border-radius:10px;\n background:#122c47;padding:11px 12px;min-width:0}\n.rr-cycle-explain>strong{display:block;font-size:13px;color:#f5d6a3;margin-bottom:7px}\n.rr-cycle-chain{font-size:14px;font-weight:800;color:#f9f7ea;line-height:1.75;\n overflow-wrap:anywhere;white-space:normal}\n.rr-cycle-explain-note{font-size:11px;color:#a9c5df;margin-top:8px;line-height:1.55}\n.rr-cycle-details{margin-top:10px}\n.rr-cycle-details summary{cursor:pointer;padding:6px 0;font-size:12px;color:#add6ff;\n font-weight:750}\n.rr-cycle-evidences{display:flex;flex-direction:column;gap:6px;padding-top:8px}\n.rr-cycle-evidence{display:flex;align-items:flex-start;gap:9px;padding:7px;\n border-radius:7px;background:#203a56}\n.rr-cycle-evidence-held{background:#4c3026;border:1px solid #bc8059}\n.rr-cycle-evidence-index{display:flex;align-items:center;justify-content:center;\n border-radius:50%;background:#365b80;color:#eef7ff;min-width:22px;height:22px;\n font-size:11px;font-weight:800}\n.rr-cycle-evidence-held .rr-cycle-evidence-index{background:#98633e}\n.rr-cycle-evidence-text{flex:1;min-width:0;overflow-wrap:anywhere;font-size:12px;\n line-height:1.45;color:#f1f6ff}\n.rr-cycle-evidence-text small{display:block;color:#aec9df;font-size:10px;\n margin-top:4px}\n.rr-cycle-evidence-held .rr-cycle-evidence-text small{color:#ffddb8}\n.rr-cycle-heading .rr-cycle-explain{background:#10263a}\n";
document.head.appendChild(rrStyle);
rrInstall();
})();
