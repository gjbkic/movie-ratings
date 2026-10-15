/* Unrated panels: star-unset -> score-unset. UI-only, 20261014g. */
(() => {
'use strict';
const KEY='movie30_pending_folds_v1';
let folds={star:false,score:false};
try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x)folds={star:x.star===true,score:x.score===true}}catch(_){}
const css=document.createElement('style');css.textContent=[
'#rankRoot .pending-g .uns-head{cursor:pointer;position:relative;padding:5px 27px 5px 2px;min-height:34px;gap:8px;border-radius:7px;user-select:none;-webkit-user-select:none}',
'#rankRoot .pending-g .uns-head:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
'#rankRoot .pending-g .uns-head::after{content:"⌃";position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:20px;color:#a9e8bd}',
'#rankRoot .pending-g.folded .uns-head::after{content:"⌄"}',
'#rankRoot .pending-g.folded .uns-head{margin-bottom:0}',
'#rankRoot .pending-g .uns-grid[hidden]{display:none!important}',
'#rankRoot .pending-g .uns-head .meta{font-size:10px;text-align:right;min-width:0;line-height:1.35}',
'#rankRoot .pending-g .uns-head strong{white-space:nowrap;flex-shrink:0}'
].join('\n');document.head.append(css);
function panel(p,k){
 if(!p)return;
 p.classList.add('pending-g');p.dataset.pendingKind=k;
 const h=p.querySelector('.uns-head'),grid=p.querySelector('.uns-grid');
 if(!h||!grid)return;
 const label=k==='star'?'星も未確定':'点数未確定';
 const strong=h.querySelector('strong');if(strong)strong.textContent=label;
 const count=grid.querySelectorAll(k==='star'?'[data-v76-open]':'[data-uns]').length;
 const meta=h.querySelector('.meta')||h.querySelector('small');
 if(meta)meta.textContent=count+'本'+(k==='star'?' · 星を決めると下へ':' · 星は設定済み');
 grid.id='pending-grid-'+k;
 h.tabIndex=0;h.setAttribute('role','button');h.setAttribute('aria-controls',grid.id);
 h.setAttribute('aria-label',label+'を開閉');
 const apply=()=>{p.classList.toggle('folded',folds[k]);grid.hidden=folds[k];h.setAttribute('aria-expanded',String(!folds[k]))};
 const toggle=()=>{folds[k]=!folds[k];try{localStorage.setItem(KEY,JSON.stringify(folds))}catch(_){}apply()};
 h.onclick=e=>{if(!e.target.closest('button,a,input'))toggle()};
 h.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}};
 apply();
}
function jump(){
 const bar=document.getElementById('starJumpBar');if(!bar)return;
 bar.querySelector('[data-pending-star-jump]')?.remove();
 const star=document.querySelector('#rankRoot .pending-g[data-pending-kind="star"]');
 const score=document.querySelector('#rankRoot .pending-g[data-pending-kind="score"]');
 let b=bar.querySelector('[data-jump-uns]');
 if(!score&&b){b.remove();b=null}
 if(score){
   if(!b){b=document.createElement('button');b.type='button';b.dataset.jumpUns='1';b.className='unrated';bar.insertBefore(b,bar.querySelector('[data-jump-star]'))}
   b.textContent='点数未確定';b.onclick=()=>score.scrollIntoView({behavior:'smooth',block:'start'});
 }
 if(star){
   const c=document.createElement('button');c.type='button';c.className='unrated';
   c.dataset.pendingStarJump='1';c.textContent='星も未確定';c.onclick=()=>star.scrollIntoView({behavior:'smooth',block:'start'});
   bar.insertBefore(c,b||bar.querySelector('[data-jump-star]'));
 }
}
const old=renderRank;
renderRank=function(...args){
 const result=old.apply(this,args);
 if(dragCtx)return result;
 const ps=[...document.querySelectorAll('#rankRoot .uns-panel')];
 panel(ps.find(p=>p.querySelector('[data-v76-open]')),'star');
 panel(ps.find(p=>p.querySelector('[data-uns]')),'score');
 jump();window.__movie30PosterDecorate84?.();return result;
};
renderRank();
})();