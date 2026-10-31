/* Keep the final ranking renderer wired to search; add a native-feeling clear control. */
(() => {
  'use strict';
  // A three-digit title query must not also match an unrelated running time
  // (for example, "107" used to return every 107-minute film).
  const previousMatch=match;
  match=function(f,q){
    const needle=String(q||'').normalize('NFKC').trim();
    if(!/^\d{3}$/.test(needle))return previousMatch(f,q);
    const info=titleInfo(f);
    return [info.title,info.originalTitle,info.englishTitle,f.lbTitle||'']
      .some(title=>String(title||'').normalize('NFKC').includes(needle));
  };
  const input=document.getElementById('searchRank');
  if(!input)return;
  const shell=input.closest('.movie92-search-wrap');
  if(!shell)return;
  const css=document.createElement('style');
  css.id='movie30-search-clear-style';
  css.textContent=[
    '#page-rank .movie92-search-wrap>#movie30ClearSearch{position:absolute;right:55px;top:4px;z-index:4;min-width:36px;width:36px;height:35px;border:0;background:transparent;color:#a9b9c9;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;touch-action:manipulation;}',
    '#page-rank .movie92-search-wrap>#movie30ClearSearch[hidden]{display:none!important}',
    '#page-rank .movie92-search-wrap>#movie30ClearSearch span{display:flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#627184;color:#101923;font-size:17px;font-weight:700;line-height:1;}',
    '#page-rank .movie92-search-wrap>#movie30ClearSearch:hover span{background:#bacde0}',
    '#page-rank .movie92-search-wrap>#movie30ClearSearch:focus-visible{outline:2px solid #8ac9ff;outline-offset:-3px;border-radius:7px}',
    '#page-rank>.tools #searchRank.movie30-search-has-value{padding-right:105px!important;}'
  ].join('\n');
  document.head.append(css);
  const clear=document.createElement('button');
  clear.type='button';clear.id='movie30ClearSearch';clear.hidden=true;
  clear.setAttribute('aria-label','検索語を消去');
  clear.title='検索語を消去';
  const icon=document.createElement('span');icon.textContent='×';icon.setAttribute('aria-hidden','true');clear.append(icon);
  shell.append(clear);
  function sync(){
    const has=!!input.value;
    clear.hidden=!has;
    input.classList.toggle('movie30-search-has-value',has);
  }
  // The initial app-core.js assigns an oninput callback to the base renderer.
  // Later feature modules decorate renderRank dozens of times, but that early
  // callback never updates. Rebind it to the CURRENT renderer, not a frozen ref.
  // Otherwise typing/searching drops the newest unrated panels, action buttons
  // and jump navigation until the next full render.
  input.oninput=function(){if(typeof renderRank==='function')renderRank();};
  input.addEventListener('input',sync);
  input.addEventListener('change',sync);
  // Keep focus from moving to the button when the search keyboard is visible.
  clear.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault();});
  clear.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(!input.value){sync();return;}
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus({preventScroll:true});
  });
  sync();
  window.__movie30SearchClear={sync,button:clear};
})();
