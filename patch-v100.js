(()=>{
'use strict';
const BUILD='20261111-independent-v100';
let rrTriad=null,rrOrder=[],rrTie12=false,rrTie23=false;

function rrHash(id){
  let h=2166136261;const t=String(id)+"|fresh-2026";
  for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function rrGlobal(){
  // Eligibility only: no old ranks or scores are used to initialize the new order.
  return allFilms().filter(f=>Number(filmStar(f))>=3 &&
    String((state.mediaTypeOverrides||{})[f.id]||f.mediaType||"movie")==="movie")
    .sort((a,b)=>rrHash(a.id)-rrHash(b.id)||String(a.id).localeCompare(String(b.id)));
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
function rrModel(r){
  const ids=rrSelectedIds(r),stats=rrStats(r,ids),prior=new Map(),score=new Map();
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
  return {ids,order,score,stats,basePos};
}
function rrTriadSig(ids){return ids.slice().sort().join('|')}
function rrChooseTriad(r,mode=r.mode){
  const m=rrModel(r),ids=m.order,n=ids.length;if(n<3)return ids;
  const used=new Set(r.events.slice(-35).map(e=>rrTriadSig(e.ids||[])).concat((r.skips||[]).slice(-35)));
  const count=id=>m.stats.counts.get(id)||0;
  const unseen=ids.filter(id=>count(id)===0);
  // Coverage stage: connect each new trio to already judged films to avoid
  // disconnected mini-rankings. Refresh candidates after each judgement.
  if(unseen.length && mode==="local"){
    const seen=ids.filter(id=>count(id)>0);
    for(let attempt=0;attempt<Math.min(n+12,90);attempt++){
      const start=(r.events.length*7+r.skips.length*11+attempt*17)%unseen.length;
      const candidate=[];
      const needed=seen.length?Math.min(2,unseen.length):Math.min(3,unseen.length);
      for(let k=0;k<unseen.length&&candidate.length<needed;k++)candidate.push(unseen[(start+k)%unseen.length]);
      if(seen.length)candidate.push(seen[(r.events.length*13+attempt*7)%seen.length]);
      for(const f of ids)if(candidate.length<3&&!candidate.includes(f))candidate.push(f);
      if(candidate.length===3&&!used.has(rrTriadSig(candidate)))return candidate;
    }
  }
  if(mode==="conflict"){
    if(m.stats.cycles.length)return m.stats.cycles[(r.events.length+r.skips.length)%m.stats.cycles.length].slice();
    const p=m.stats.contradictions.sort((a,b)=>b.n-a.n)[0];
    if(p){
      const mid=Math.round((ids.indexOf(p.a)+ids.indexOf(p.b))/2);
      const third=ids.slice().sort((a,b)=>Math.abs(ids.indexOf(a)-mid)-Math.abs(ids.indexOf(b)-mid))
        .find(x=>x!==p.a&&x!==p.b);
      if(third)return [p.a,p.b,third];
    }
  }
  if(mode==="wide"){
    const borders=[0,Math.floor(n/3),Math.floor(2*n/3),n];
    for(let t=0;t<20;t++){
      const c=[0,1,2].map(i=>{
        const part=ids.slice(borders[i],borders[i+1]);
        return part.slice().sort((a,b)=>count(a)-count(b)||rrHash(a+"|"+t)-rrHash(b+"|"+t))[0];
      }).filter(Boolean);
      if(c.length===3&&!used.has(rrTriadSig(c)))return c;
    }
  }
  // Compare nearby and under-tested movies; never permanently insert or lock.
  const windows=[];
  for(let i=0;i<=n-3;i++){
    const a=ids.slice(i,i+3),sig=rrTriadSig(a);
    if(used.has(sig))continue;
    const minCount=a.reduce((z,id)=>z+count(id),0);
    const pairRepeat=[[0,1],[0,2],[1,2]].reduce((z,p)=>z+(m.stats.pairs.get(rrPairKey(a[p[0]],a[p[1]]))?.n||0),0);
    windows.push({a,weight:minCount+pairRepeat*3});
  }
  windows.sort((a,b)=>a.weight-b.weight||rrHash(a.a.join("|"))-rrHash(b.a.join("|")));
  if(windows.length)return windows[0].a;
  const offset=(r.events.length+r.skips.length)%n;
  return [ids[offset],ids[(offset+Math.floor(n/3))%n],ids[(offset+Math.floor(2*n/3))%n]];
}
function rrFilmCard(id,idx,m){
  const f=filmById(id);if(!f)return "";
  const path=typeof posterMeta84==="function"?posterMeta84(f)?.path:null;
  const src=typeof posterUrl84==="function"?posterUrl84(path,"w185"):"";
  const img=src?'<img src="'+esc(src)+'" alt="" loading="lazy">':'<div class="rr-noimg">NO IMAGE</div>';
  return '<div class="rr-card" data-rr-id="'+encodeURIComponent(id)+'">'+
    '<div class="rr-num">'+(idx+1)+'</div>'+img+
    '<div class="rr-main"><strong>'+esc(displayTitle(f))+'</strong><small>'+(f.year||"")+
    ' · 比較 '+(m.stats.counts.get(id)||0)+'件</small></div>'+
    '<div class="rr-move"><button data-rr-up="'+encodeURIComponent(id)+'">↑</button>'+
    '<button data-rr-down="'+encodeURIComponent(id)+'">↓</button></div></div>';
}
function rrGroups(){
  if(rrOrder.length!==3)return [];
  if(rrTie12&&rrTie23)return [[rrOrder[0],rrOrder[1],rrOrder[2]]];
  if(rrTie12)return [[rrOrder[0],rrOrder[1]],[rrOrder[2]]];
  if(rrTie23)return [[rrOrder[0]],[rrOrder[1],rrOrder[2]]];
  return rrOrder.map(id=>[id]);
}
function rrSetTriad(ids){
  rrTriad=ids.slice(0,3);rrOrder=rrTriad.slice();rrTie12=false;rrTie23=false;
}
function rrNext(){const r=rrState();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrMove(id,d){const i=rrOrder.indexOf(id),j=i+d;if(i<0||j<0||j>=rrOrder.length)return;[rrOrder[i],rrOrder[j]]=[rrOrder[j],rrOrder[i]];rrTie12=false;rrTie23=false;rrRender();}
function rrCommit(kind="rank"){
  const r=rrState();if(rrOrder.length!==3)return;
  const e={id:"rr2-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
    at:Date.now(),ids:rrOrder.slice(),mode:r.mode,kind};
  if(kind==="rank")e.groups=rrGroups();
  else e.ambiguous=true;
  r.events.push(e);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();
}
function rrSkip(){const r=rrState();if(rrOrder.length===3)r.skips.push(rrTriadSig(rrOrder));if(r.skips.length>80)r.skips=r.skips.slice(-80);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrUndoEvent(){const r=rrState();if(!r.events.length)return;r.events.pop();save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrDeleteEvent(id){const r=rrState();r.events=r.events.filter(e=>e.id!==id);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrNew(){
  if(!confirm("新ランキングの比較履歴だけを消してやり直しますか？\n旧ランキング・星・点数・レビューは変更しません。"))return;
  state.rerankV2=rrNewSession();save();
  rrSetTriad(rrChooseTriad(state.rerankV2,"local"));rrRender();
}
function rrHistoryHtml(r){
  const ev=r.events.slice(-12).reverse();
  if(!ev.length)return '<div class="rr-muted">比較履歴はまだありません。</div>';
  return ev.map(e=>{
    const names=(e.ids||[]).map(id=>displayTitle(filmById(id)||{title:id}));
    const v=e.kind==="cycle"?"三すくみ":e.kind==="hold"?"判断保留":
      (e.groups||[]).map(g=>g.map(id=>displayTitle(filmById(id)||{title:id})).join(" ≈ ")).join(" ＞ ");
    const txt=e.ambiguous?v+"： "+names.join(" / "):v;
    return '<div class="rr-hrow"><span>'+esc(txt)+'</span><button data-rr-del="'+e.id+'">削除</button></div>';
  }).join("");
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
function rrRender(){
  const root=document.getElementById('rerankRoot');if(!root)return;
  const r=rrState();rrEnsureFresh(r);const m=rrModel(r);
  if(!rrTriad||rrTriad.some(id=>!m.ids.includes(id)))rrSetTriad(rrChooseTriad(r,r.mode));
  const pairJudgments=[...m.stats.pairs.values()].reduce((s,p)=>s+p.n,0);
  root.innerHTML=`
  <div class="rr-panel rr-head"><div><strong>新ランキング · ★3以上の映画</strong><div class="rr-muted">旧ランキング、点数、星、レビューは完全に別管理で変更しません。旧順位は新順位の計算にも使いません。</div></div><button class="btn" id="rrNew">新ランキングだけやり直す</button></div>
  <div class="rr-panel"><div class="rr-muted">対象：★3.0以上で種別が「映画」の全作品。旧ランキングの並び・点数は参照しません。</div>
    <div class="rr-stats"><span>対象 ${m.ids.length}本</span><span>順位判定 ${r.events.filter(e=>!e.ambiguous).length}回</span><span>ペア判断 ${pairJudgments}件</span><span>三すくみ ${r.events.filter(e=>e.kind==="cycle").length}回</span><span>判断保留 ${r.events.filter(e=>e.kind==="hold").length}回</span><span class="${m.stats.contradictions.length?'warn':''}">逆転矛盾 ${m.stats.contradictions.length}組</span><span class="${m.stats.cycles.length?'warn':''}">三つ巴循環 ${m.stats.cycles.length}組</span></div>
  </div>
  <div class="rr-panel"><div class="rr-mode"><button class="${r.mode==='local'?'active':''}" data-rr-mode="local">近い3本</button><button class="${r.mode==='wide'?'active':''}" data-rr-mode="wide">広く点検</button><button class="${r.mode==='conflict'?'active':''}" data-rr-mode="conflict">矛盾を確認</button></div><div class="rr-muted">上ほど好きになる順に並べます。「≈同格」は順位の接戦、「三すくみ」は循環する好み、「判断保留」は決められない場合です。</div></div>
  <div class="rr-panel rr-judge">${rrOrder.map((id,i)=>rrFilmCard(id,i,m)+(i<2?`<button class="rr-tie ${i===0&&rrTie12||i===1&&rrTie23?'active':''}" data-rr-tie="${i}">≈ 同格</button>`:'')).join('')}
    <div class="rr-actions"><button class="rr-primary" id="rrCommit">この順で記録</button><button id="rrAmbiguous">三すくみ</button><button id="rrHold">判断保留</button><button id="rrSkip">別の3本にする</button></div>
    <div class="rr-actions minor"><button id="rrUndo">直前の比較を取消</button><button id="rrNext">別の3本</button></div>
  </div>
  <div class="rr-grid2"><div class="rr-panel"><h3>新しい暫定ランキング（全作品）</h3>${rrPreviewHtml(r,m)}</div><div class="rr-panel"><h3>比較履歴</h3>${rrHistoryHtml(r)}</div></div>
  <div class="rr-panel"><div class="rr-muted">新ランキングの判定結果はこの端末に自動保存されます。旧ランキングへの反映ボタンはありません。全体バックアップのJSONにも比較履歴が含まれます。</div></div>`;

  root.querySelectorAll('[data-rr-up]').forEach(b=>b.onclick=()=>rrMove(decodeURIComponent(b.dataset.rrUp),-1));
  root.querySelectorAll('[data-rr-down]').forEach(b=>b.onclick=()=>rrMove(decodeURIComponent(b.dataset.rrDown),1));
  root.querySelectorAll('[data-rr-tie]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.rrTie);if(i===0)rrTie12=!rrTie12;else rrTie23=!rrTie23;rrRender()});
  root.querySelectorAll('[data-rr-mode]').forEach(b=>b.onclick=()=>{r.mode=b.dataset.rrMode;save(false);rrSetTriad(rrChooseTriad(r,r.mode));rrRender()});
  root.querySelectorAll('[data-rr-del]').forEach(b=>b.onclick=()=>rrDeleteEvent(b.dataset.rrDel));
  root.querySelector('#rrCommit').onclick=()=>rrCommit('rank');root.querySelector('#rrAmbiguous').onclick=()=>rrCommit('cycle');root.querySelector('#rrHold').onclick=()=>rrCommit('hold');root.querySelector('#rrSkip').onclick=rrSkip;root.querySelector('#rrUndo').onclick=rrUndoEvent;root.querySelector('#rrNext').onclick=rrNext;root.querySelector('#rrNew').onclick=rrNew;
}
function rrInstall(){
  if(document.getElementById('page-rerank'))return;
  const tabs=document.querySelector('.tabs'),rankTab=tabs?.querySelector('[data-page="rank"]');if(!tabs||!rankTab)return;
  const tab=document.createElement('button');tab.className='tab';tab.dataset.page='rerank';tab.textContent='新ランキング';rankTab.insertAdjacentElement('afterend',tab);
  const page=document.createElement('section');page.id='page-rerank';page.className='page';page.innerHTML='<main id="rerankRoot"></main>';
  const rankPage=document.getElementById('page-rank');rankPage.insertAdjacentElement('afterend',page);
  const style=document.createElement('style');style.id='movie30-rerank-v99-style';style.textContent=`
  #rerankRoot{padding-bottom:40px}.rr-panel{background:var(--panel,#11151b);border:1px solid var(--line,#2a313c);border-radius:12px;padding:12px;margin:10px 0}.rr-head,.rr-apply{display:flex;gap:12px;align-items:center;justify-content:space-between}.rr-muted{font-size:11px;color:var(--muted,#97a0ad);line-height:1.55;margin-top:4px}.rr-controls,.rr-stats,.rr-mode,.rr-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.rr-controls input{width:66px;background:var(--panel2,#171d25);color:var(--text,#fff);border:1px solid var(--line,#394351);border-radius:8px;padding:7px;font-size:16px}.rr-stats{margin-top:9px;font-size:10px;color:var(--muted,#97a0ad)}.rr-stats span{border:1px solid var(--line,#394351);border-radius:999px;padding:4px 7px}.rr-stats .warn{color:#ffd58a;border-color:#7b6331}.rr-mode button,.rr-actions button,.rr-tie,.rr-move button,.rr-hrow button{background:var(--panel2,#171d25);border:1px solid var(--line,#394351);color:var(--text,#fff);border-radius:8px;padding:8px 10px}.rr-mode button.active,.rr-tie.active{border-color:#7aa7ff;background:#1c3152}.rr-judge{padding:8px}.rr-card{display:grid;grid-template-columns:28px 56px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line,#394351);background:var(--panel2,#171d25);border-radius:10px;padding:7px}.rr-card img,.rr-noimg{width:52px;height:78px;object-fit:cover;border-radius:6px;background:#0c1015}.rr-noimg{display:flex;align-items:center;justify-content:center;text-align:center;color:#6f7884;font-size:9px}.rr-num{width:24px;height:24px;border-radius:999px;background:#28364a;display:flex;align-items:center;justify-content:center;font-weight:700}.rr-main{min-width:0}.rr-main strong{display:block;font-size:13px;line-height:1.35}.rr-main small{display:block;color:var(--muted,#97a0ad);font-size:9px;margin-top:3px}.rr-move{display:flex;flex-direction:column;gap:5px}.rr-move button{padding:5px 8px}.rr-tie{display:block;margin:5px auto;padding:4px 14px;font-size:10px}.rr-actions{justify-content:center;margin-top:10px}.rr-primary{background:#275fba!important;border-color:#4384e9!important;font-weight:700}.rr-actions.minor button{font-size:10px;padding:6px 9px}.rr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rr-grid2 h3{margin:0 0 8px;font-size:12px}.rr-prow{display:grid;grid-template-columns:minmax(0,1fr) 48px 82px;gap:7px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px}.rr-prow b{text-align:center}.rr-prow small{color:var(--muted,#97a0ad);text-align:right}.rr-hrow{display:flex;gap:7px;align-items:center;border-bottom:1px solid rgba(255,255,255,.06);padding:6px 0;font-size:9px}.rr-hrow span{flex:1}.rr-hrow button{padding:4px 7px;font-size:9px}.rr-apply button:disabled{opacity:.4}.rr-head strong,.rr-apply strong{font-size:14px}@media(max-width:680px){.rr-grid2{grid-template-columns:1fr}.rr-head,.rr-apply{align-items:flex-start;flex-direction:column}.rr-card{grid-template-columns:26px 50px minmax(0,1fr) auto}.rr-card img,.rr-noimg{width:46px;height:69px}}
  `;document.head.appendChild(style);
  tab.onclick=()=>{view.page='rerank';save(false);renderHeader();const r=rrState();if(!rrTriad)rrSetTriad(rrChooseTriad(r,r.mode));rrRender()};
  const oldRenderHeader=renderHeader;renderHeader=function(...args){const v=oldRenderHeader.apply(this,args);if(view.page==='rerank')rrRender();return v};
  window.__movie30RerankV100={build:BUILD,render:rrRender,model:()=>rrModel(rrState()),newSession:rrNew};
}
const rrStyle=document.createElement("style");
rrStyle.textContent=".rr-rank-scroll{max-height:520px;overflow-y:auto;margin-top:9px;border-top:1px solid #394351}.rr-rank-row{display:grid;grid-template-columns:28px minmax(0,1fr) 60px;gap:9px;padding:8px 5px;border-bottom:1px solid #27313e;align-items:center;font-size:12px}.rr-rank-row b{color:#a6beeb}.rr-rank-row small{color:#8b9ab0;text-align:right;font-size:10px}";
document.head.appendChild(rrStyle);
rrInstall();
})();
