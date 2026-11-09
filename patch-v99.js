(()=>{
'use strict';
const BUILD='20261110-rerank-v99';
let rrTriad=null,rrOrder=[],rrTie12=false,rrTie23=false;

function rrGlobal(){
  const by=new Map();
  for(const f of allFilms()){
    const sc=effectiveScore(f);
    if(sc==null||!Number.isFinite(Number(sc)))continue;
    const k=Number(sc);if(!by.has(k))by.set(k,[]);by.get(k).push(f);
  }
  const out=[];
  for(const sc of [...by.keys()].sort((a,b)=>b-a))out.push(...rankSorted(by.get(sc).slice(),sc));
  return out;
}
function rrNewSession(){
  const ids=rrGlobal().map(f=>f.id);
  return {version:1,startedAt:Date.now(),baselineIds:ids,events:[],skips:[],rangeStart:1,rangeEnd:Math.min(100,ids.length),mode:'local',backup:null};
}
function rrState(create=true){
  if(!state.rerankV1&&create)state.rerankV1=rrNewSession();
  const r=state.rerankV1;
  if(!r)return null;
  r.events=Array.isArray(r.events)?r.events:[];r.skips=Array.isArray(r.skips)?r.skips:[];
  r.baselineIds=Array.isArray(r.baselineIds)?r.baselineIds:[];
  r.rangeStart=Math.max(1,Number(r.rangeStart)||1);
  r.rangeEnd=Math.max(r.rangeStart,Number(r.rangeEnd)||Math.min(100,r.baselineIds.length));
  r.mode=['local','wide','conflict'].includes(r.mode)?r.mode:'local';
  return r;
}
function rrEnsureFresh(r){
  const current=rrGlobal().map(f=>f.id);
  const valid=new Set(current);
  const baseline=r.baselineIds.filter(id=>valid.has(id));
  for(const id of current)if(!baseline.includes(id))baseline.push(id);
  r.baselineIds=baseline;
  r.rangeEnd=Math.min(r.rangeEnd||baseline.length,baseline.length);
}
function rrSelectedIds(r){
  rrEnsureFresh(r);
  return r.baselineIds.slice(Math.max(0,r.rangeStart-1),Math.min(r.baselineIds.length,r.rangeEnd));
}
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
  const ids=rrSelectedIds(r),n=ids.length,stats=rrStats(r,ids),prior=new Map(),score=new Map();
  const spacing=.12,lambda=.42,delta=1.0;
  ids.forEach((id,i)=>{const p=(n-1-i)*spacing;prior.set(id,p);score.set(id,p)});
  const neighbors=new Map(ids.map(id=>[id,[]]));
  for(const p of stats.pairs.values()){
    if(!neighbors.has(p.a)||!neighbors.has(p.b))continue;
    const mean=p.n?p.sum/p.n:0,w=Math.min(3,p.n);
    neighbors.get(p.a).push({id:p.b,y:mean,w});neighbors.get(p.b).push({id:p.a,y:-mean,w});
  }
  for(let iter=0;iter<90;iter++){
    const next=new Map();
    for(const id of ids){
      let num=lambda*prior.get(id),den=lambda;
      for(const e of neighbors.get(id)||[]){num+=e.w*(score.get(e.id)+delta*e.y);den+=e.w}
      next.set(id,num/den);
    }
    score.clear();for(const [k,v] of next)score.set(k,v);
  }
  const basePos=new Map(ids.map((id,i)=>[id,i]));
  const order=ids.slice().sort((a,b)=>score.get(b)-score.get(a)||basePos.get(a)-basePos.get(b));
  return {ids,order,score,stats,basePos};
}
function rrTriadSig(ids){return ids.slice().sort().join('|')}
function rrChooseTriad(r,mode=r.mode){
  const m=rrModel(r),ids=m.order,n=ids.length;if(n<3)return ids;
  const used=new Set(r.events.slice(-24).map(e=>rrTriadSig(e.ids||[])).concat((r.skips||[]).slice(-12)));
  const count=id=>m.stats.counts.get(id)||0;
  const pickLocal=()=>{
    const min=Math.min(...ids.map(count));let seeds=ids.filter(id=>count(id)<=min+1);
    for(let tries=0;tries<Math.min(40,seeds.length);tries++){
      const seed=seeds[(r.events.length*7+tries*11)%seeds.length],i=ids.indexOf(seed);
      const cand=[ids[Math.max(0,i-1)],seed,ids[Math.min(n-1,i+1)]].filter((x,j,a)=>x&&a.indexOf(x)===j);
      if(cand.length<3){for(let d=2;cand.length<3&&d<n;d++)for(const x of [ids[i-d],ids[i+d]])if(x&&!cand.includes(x))cand.push(x)}
      if(cand.length===3&&!used.has(rrTriadSig(cand)))return cand;
    }
    return ids.slice(Math.max(0,Math.min(n-3,(r.events.length*3)%Math.max(1,n-2))),Math.max(0,Math.min(n-3,(r.events.length*3)%Math.max(1,n-2)))+3);
  };
  if(mode==='conflict'){
    if(m.stats.cycles.length)return m.stats.cycles[(r.events.length+r.skips.length)%m.stats.cycles.length].slice();
    const p=m.stats.contradictions.sort((a,b)=>(b.winsA+b.winsB)-(a.winsA+a.winsB))[0];
    if(p){const ia=ids.indexOf(p.a),ib=ids.indexOf(p.b),mid=Math.round((ia+ib)/2);let third=null;for(let d=0;d<n&&!third;d++)for(const k of [mid-d,mid+d]){const x=ids[k];if(x&&x!==p.a&&x!==p.b){third=x;break}}return [p.a,p.b,third].filter(Boolean)}
    return pickLocal();
  }
  if(mode==='wide'){
    const thirds=[[0,Math.ceil(n/3)],[Math.ceil(n/3),Math.ceil(2*n/3)],[Math.ceil(2*n/3),n]];
    const out=thirds.map(([a,b],z)=>ids.slice(a,b).sort((x,y)=>count(x)-count(y)||((m.basePos.get(x)+r.events.length*13+z*5)%17)-((m.basePos.get(y)+r.events.length*13+z*5)%17))[0]).filter(Boolean);
    if(out.length===3&&!used.has(rrTriadSig(out)))return out;
    return pickLocal();
  }
  return pickLocal();
}
function rrFilmCard(id,idx,m){
  const f=filmById(id);if(!f)return '';
  const path=typeof posterMeta84==='function'?posterMeta84(f)?.path:null;
  const src=typeof posterUrl84==='function'?posterUrl84(path,'w185'):'';
  const old=(m.basePos.get(id)??0)+rrState().rangeStart;
  const pred=m.order.indexOf(id)+rrState().rangeStart;
  const sc=effectiveScore(f);
  return `<div class="rr-card" data-rr-id="${encodeURIComponent(id)}">
    <div class="rr-num">${idx+1}</div>${src?`<img src="${src}" alt="" loading="lazy">`:`<div class="rr-noimg">NO<br>IMAGE</div>`}
    <div class="rr-main"><strong>${esc(displayTitle(f))}</strong><small>${f.year||''}${sc!=null?' · '+sc+'点':''}</small><small>旧 #${old} → 仮 #${pred} · 比較 ${m.stats.counts.get(id)||0}</small></div>
    <div class="rr-move"><button data-rr-up="${encodeURIComponent(id)}">↑</button><button data-rr-down="${encodeURIComponent(id)}">↓</button></div>
  </div>`;
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
function rrCommit(ambiguous=false){
  const r=rrState();if(rrOrder.length!==3)return;
  const e={id:'rr-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),at:Date.now(),ids:rrOrder.slice(),mode:r.mode};
  if(ambiguous)e.ambiguous=true;else e.groups=rrGroups();
  r.events.push(e);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();
}
function rrSkip(){const r=rrState();if(rrOrder.length===3)r.skips.push(rrTriadSig(rrOrder));if(r.skips.length>80)r.skips=r.skips.slice(-80);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrUndoEvent(){const r=rrState();if(!r.events.length)return;r.events.pop();save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrDeleteEvent(id){const r=rrState();r.events=r.events.filter(e=>e.id!==id);save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();}
function rrRebuildRankOrder(globalIds){
  const groups={};for(const id of globalIds){const f=filmById(id),sc=f&&effectiveScore(f);if(sc==null)continue;(groups[String(Number(sc))]??=[]).push(id)}
  for(const k of Object.keys(state.rankOrder||{}))if(!groups[k])state.rankOrder[k]=[];
  for(const [k,v] of Object.entries(groups))state.rankOrder[k]=v;
}
function rrApply(){
  const r=rrState(),m=rrModel(r),selected=new Set(m.ids);if(m.ids.length<2||!r.events.some(e=>!e.ambiguous)){toast('比較結果がまだありません');return}
  if(!confirm(`再ランキング結果を ${m.ids.length}本に反映します。\n点数分布は維持し、順位を動かした分だけ各作品の点数を割り当て直します。`))return;
  const global=rrGlobal(),ids=global.map(f=>f.id),slots=[];ids.forEach((id,i)=>{if(selected.has(id))slots.push(i)});
  const newOrder=m.order.filter(id=>selected.has(id));if(slots.length!==newOrder.length){toast('対象作品数が一致しません');return}
  const slotScores=slots.map(i=>Number(effectiveScore(global[i])));
  r.backup={at:Date.now(),rankOrder:deepCopy(state.rankOrder),exact:newOrder.map(id=>({id,had:Object.prototype.hasOwnProperty.call(state.exactScores,id),value:state.exactScores[id]}))};
  const reordered=ids.slice();slots.forEach((slot,i)=>{reordered[slot]=newOrder[i]});
  newOrder.forEach((id,i)=>{state.exactScores[id]=slotScores[i]});
  rrRebuildRankOrder(reordered);
  save();render();
  r.baselineIds=rrGlobal().map(f=>f.id);r.events=[];r.skips=[];r.startedAt=Date.now();r.rangeEnd=Math.min(r.rangeEnd,r.baselineIds.length);
  save();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();toast('再ランキングを反映しました');
}
function rrRestore(){
  const r=rrState(),b=r.backup;if(!b){toast('戻せる反映履歴がありません');return}
  if(!confirm('直前の再ランキング反映を元に戻しますか？'))return;
  state.rankOrder=deepCopy(b.rankOrder||{});
  for(const x of b.exact||[]){if(x.had)state.exactScores[x.id]=x.value;else delete state.exactScores[x.id]}
  r.backup=null;r.events=[];r.skips=[];r.baselineIds=rrGlobal().map(f=>f.id);save();render();rrSetTriad(rrChooseTriad(r,r.mode));rrRender();toast('元に戻しました');
}
function rrNew(){
  if(!confirm('比較履歴を消して、現在の順位を新しい基準にしますか？\n本順位そのものは変更しません。'))return;
  const backup=rrState()?.backup||null;state.rerankV1=rrNewSession();state.rerankV1.backup=backup;save();rrSetTriad(rrChooseTriad(state.rerankV1,'local'));rrRender();
}
function rrHistoryHtml(r){
  const ev=r.events.slice(-8).reverse();if(!ev.length)return '<div class="rr-muted">まだ比較履歴はありません。</div>';
  return ev.map(e=>{const names=(e.ids||[]).map(id=>displayTitle(filmById(id)||{title:id}));const txt=e.ambiguous?'三つ巴／保留':(e.groups||[]).map(g=>g.map(id=>displayTitle(filmById(id)||{title:id})).join(' ≈ ')).join(' ＞ ');return `<div class="rr-hrow"><span>${esc(txt||names.join(' / '))}</span><button data-rr-del="${e.id}">削除</button></div>`}).join('');
}
function rrPreviewHtml(r,m){
  const rows=m.order.map((id,i)=>({id,from:(m.basePos.get(id)||0)+r.rangeStart,to:i+r.rangeStart})).map(x=>({...x,d:x.from-x.to})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)||a.to-b.to).slice(0,14);
  return rows.map(x=>{const f=filmById(x.id);return `<div class="rr-prow"><span>${esc(displayTitle(f))}</span><b>${x.d===0?'±0':(x.d>0?'↑'+x.d:'↓'+Math.abs(x.d))}</b><small>#${x.from} → #${x.to}</small></div>`}).join('')||'<div class="rr-muted">変動なし</div>';
}
function rrRender(){
  const root=document.getElementById('rerankRoot');if(!root)return;
  const r=rrState();rrEnsureFresh(r);const m=rrModel(r);
  if(!rrTriad||rrTriad.some(id=>!m.ids.includes(id)))rrSetTriad(rrChooseTriad(r,r.mode));
  const pairJudgments=[...m.stats.pairs.values()].reduce((s,p)=>s+p.n,0);
  root.innerHTML=`
  <div class="rr-panel rr-head"><div><strong>再ランキング</strong><div class="rr-muted">本順位は「反映」するまで一切変わりません。比較は重ねて平均化するので、1回のミスで全体が連鎖的に崩れません。</div></div><button class="btn" id="rrNew">現在順位を基準にやり直す</button></div>
  <div class="rr-panel"><div class="rr-controls"><label>対象 <input id="rrStart" type="number" min="1" max="${r.baselineIds.length}" value="${r.rangeStart}"></label><span>〜</span><label><input id="rrEnd" type="number" min="3" max="${r.baselineIds.length}" value="${r.rangeEnd}"> 位</label><button class="btn" data-rr-range="1,100">TOP100</button><button class="btn" data-rr-range="1,300">TOP300</button><button class="btn" data-rr-range="1,99999">全部</button></div>
    <div class="rr-stats"><span>対象 ${m.ids.length}本</span><span>3本比較 ${r.events.filter(e=>!e.ambiguous).length}回</span><span>ペア判断 ${pairJudgments}件</span><span>三つ巴 ${m.stats.ambiguous}回</span><span class="${m.stats.contradictions.length?'warn':''}">逆転矛盾 ${m.stats.contradictions.length}組</span><span class="${m.stats.cycles.length?'warn':''}">三つ巴循環 ${m.stats.cycles.length}組</span></div>
  </div>
  <div class="rr-panel"><div class="rr-mode"><button class="${r.mode==='local'?'active':''}" data-rr-mode="local">近い3本</button><button class="${r.mode==='wide'?'active':''}" data-rr-mode="wide">広く点検</button><button class="${r.mode==='conflict'?'active':''}" data-rr-mode="conflict">矛盾を確認</button></div><div class="rr-muted">上ほど好きになるよう並べ替え。決め切れない2本は「≈同格」。A＞B＞CなのにC＞Aとも感じるような場合は「三つ巴」を押して無理に順番を作らない。</div></div>
  <div class="rr-panel rr-judge">${rrOrder.map((id,i)=>rrFilmCard(id,i,m)+(i<2?`<button class="rr-tie ${i===0&&rrTie12||i===1&&rrTie23?'active':''}" data-rr-tie="${i}">≈ 同格</button>`:'')).join('')}
    <div class="rr-actions"><button class="rr-primary" id="rrCommit">この順で記録</button><button id="rrAmbiguous">三つ巴・決めきれない</button><button id="rrSkip">保留して次へ</button></div>
    <div class="rr-actions minor"><button id="rrUndo">直前の比較を取消</button><button id="rrNext">別の3本</button></div>
  </div>
  <div class="rr-grid2"><div class="rr-panel"><h3>仮順位で大きく動く作品</h3>${rrPreviewHtml(r,m)}</div><div class="rr-panel"><h3>比較履歴</h3>${rrHistoryHtml(r)}</div></div>
  <div class="rr-panel rr-apply"><div><strong>本順位へ反映</strong><div class="rr-muted">現在の点数分布はそのまま使い、仮順位の順に点数を割り当て直します。直前の反映は1回だけ元に戻せます。</div></div><div class="rr-actions"><button class="rr-primary" id="rrApply">プレビュー順位を反映</button><button id="rrRestore" ${r.backup?'':'disabled'}>直前の反映を元に戻す</button></div></div>`;

  root.querySelectorAll('[data-rr-up]').forEach(b=>b.onclick=()=>rrMove(decodeURIComponent(b.dataset.rrUp),-1));
  root.querySelectorAll('[data-rr-down]').forEach(b=>b.onclick=()=>rrMove(decodeURIComponent(b.dataset.rrDown),1));
  root.querySelectorAll('[data-rr-tie]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.rrTie);if(i===0)rrTie12=!rrTie12;else rrTie23=!rrTie23;rrRender()});
  root.querySelectorAll('[data-rr-mode]').forEach(b=>b.onclick=()=>{r.mode=b.dataset.rrMode;save(false);rrSetTriad(rrChooseTriad(r,r.mode));rrRender()});
  root.querySelectorAll('[data-rr-range]').forEach(b=>b.onclick=()=>{const [a,z]=b.dataset.rrRange.split(',').map(Number);r.rangeStart=a;r.rangeEnd=Math.min(z,r.baselineIds.length);save(false);rrSetTriad(rrChooseTriad(r,r.mode));rrRender()});
  root.querySelectorAll('[data-rr-del]').forEach(b=>b.onclick=()=>rrDeleteEvent(b.dataset.rrDel));
  root.querySelector('#rrStart').onchange=e=>{r.rangeStart=Math.max(1,Math.min(Number(e.target.value)||1,r.baselineIds.length-2));r.rangeEnd=Math.max(r.rangeStart+2,r.rangeEnd);save(false);rrSetTriad(rrChooseTriad(r,r.mode));rrRender()};
  root.querySelector('#rrEnd').onchange=e=>{r.rangeEnd=Math.max(r.rangeStart+2,Math.min(Number(e.target.value)||r.baselineIds.length,r.baselineIds.length));save(false);rrSetTriad(rrChooseTriad(r,r.mode));rrRender()};
  root.querySelector('#rrCommit').onclick=()=>rrCommit(false);root.querySelector('#rrAmbiguous').onclick=()=>rrCommit(true);root.querySelector('#rrSkip').onclick=rrSkip;root.querySelector('#rrUndo').onclick=rrUndoEvent;root.querySelector('#rrNext').onclick=rrNext;root.querySelector('#rrApply').onclick=rrApply;root.querySelector('#rrRestore').onclick=rrRestore;root.querySelector('#rrNew').onclick=rrNew;
}
function rrInstall(){
  if(document.getElementById('page-rerank'))return;
  const tabs=document.querySelector('.tabs'),rankTab=tabs?.querySelector('[data-page="rank"]');if(!tabs||!rankTab)return;
  const tab=document.createElement('button');tab.className='tab';tab.dataset.page='rerank';tab.textContent='再ランキング';rankTab.insertAdjacentElement('afterend',tab);
  const page=document.createElement('section');page.id='page-rerank';page.className='page';page.innerHTML='<main id="rerankRoot"></main>';
  const rankPage=document.getElementById('page-rank');rankPage.insertAdjacentElement('afterend',page);
  const style=document.createElement('style');style.id='movie30-rerank-v99-style';style.textContent=`
  #rerankRoot{padding-bottom:40px}.rr-panel{background:var(--panel,#11151b);border:1px solid var(--line,#2a313c);border-radius:12px;padding:12px;margin:10px 0}.rr-head,.rr-apply{display:flex;gap:12px;align-items:center;justify-content:space-between}.rr-muted{font-size:11px;color:var(--muted,#97a0ad);line-height:1.55;margin-top:4px}.rr-controls,.rr-stats,.rr-mode,.rr-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.rr-controls input{width:66px;background:var(--panel2,#171d25);color:var(--text,#fff);border:1px solid var(--line,#394351);border-radius:8px;padding:7px;font-size:16px}.rr-stats{margin-top:9px;font-size:10px;color:var(--muted,#97a0ad)}.rr-stats span{border:1px solid var(--line,#394351);border-radius:999px;padding:4px 7px}.rr-stats .warn{color:#ffd58a;border-color:#7b6331}.rr-mode button,.rr-actions button,.rr-tie,.rr-move button,.rr-hrow button{background:var(--panel2,#171d25);border:1px solid var(--line,#394351);color:var(--text,#fff);border-radius:8px;padding:8px 10px}.rr-mode button.active,.rr-tie.active{border-color:#7aa7ff;background:#1c3152}.rr-judge{padding:8px}.rr-card{display:grid;grid-template-columns:28px 56px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line,#394351);background:var(--panel2,#171d25);border-radius:10px;padding:7px}.rr-card img,.rr-noimg{width:52px;height:78px;object-fit:cover;border-radius:6px;background:#0c1015}.rr-noimg{display:flex;align-items:center;justify-content:center;text-align:center;color:#6f7884;font-size:9px}.rr-num{width:24px;height:24px;border-radius:999px;background:#28364a;display:flex;align-items:center;justify-content:center;font-weight:700}.rr-main{min-width:0}.rr-main strong{display:block;font-size:13px;line-height:1.35}.rr-main small{display:block;color:var(--muted,#97a0ad);font-size:9px;margin-top:3px}.rr-move{display:flex;flex-direction:column;gap:5px}.rr-move button{padding:5px 8px}.rr-tie{display:block;margin:5px auto;padding:4px 14px;font-size:10px}.rr-actions{justify-content:center;margin-top:10px}.rr-primary{background:#275fba!important;border-color:#4384e9!important;font-weight:700}.rr-actions.minor button{font-size:10px;padding:6px 9px}.rr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rr-grid2 h3{margin:0 0 8px;font-size:12px}.rr-prow{display:grid;grid-template-columns:minmax(0,1fr) 48px 82px;gap:7px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px}.rr-prow b{text-align:center}.rr-prow small{color:var(--muted,#97a0ad);text-align:right}.rr-hrow{display:flex;gap:7px;align-items:center;border-bottom:1px solid rgba(255,255,255,.06);padding:6px 0;font-size:9px}.rr-hrow span{flex:1}.rr-hrow button{padding:4px 7px;font-size:9px}.rr-apply button:disabled{opacity:.4}.rr-head strong,.rr-apply strong{font-size:14px}@media(max-width:680px){.rr-grid2{grid-template-columns:1fr}.rr-head,.rr-apply{align-items:flex-start;flex-direction:column}.rr-card{grid-template-columns:26px 50px minmax(0,1fr) auto}.rr-card img,.rr-noimg{width:46px;height:69px}}
  `;document.head.appendChild(style);
  tab.onclick=()=>{view.page='rerank';save(false);renderHeader();const r=rrState();if(!rrTriad)rrSetTriad(rrChooseTriad(r,r.mode));rrRender()};
  const oldRenderHeader=renderHeader;renderHeader=function(...args){const v=oldRenderHeader.apply(this,args);if(view.page==='rerank')rrRender();return v};
  window.__movie30RerankV99={build:BUILD,render:rrRender,model:()=>rrModel(rrState()),newSession:rrNew};
}
rrInstall();
})();
