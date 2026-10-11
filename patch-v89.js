(() => {
'use strict';
const filmId='custom-1791664055006-96rv';
const cover='https://www.sonymusic.co.jp/Music/Info/utadahikaru/en/music/img/dvd/img_music_dvd_14.jpg';
let pending=false;
function refresh(){
  for(const img of document.querySelectorAll('img.movie30-poster84[data-poster-id]')){
    if(decodeURIComponent(img.dataset.posterId||'')!==filmId)continue;
    if(img.getAttribute('src')!==cover)img.src=cover;
    img.classList.add('movie30-poster-loaded84');
    img.closest('.rank-card,.watch83-item')?.classList.add('movie30-has-poster84');
  }
}
function queue(){
 if(pending)return;
 pending=true;
 requestAnimationFrame(()=>{pending=false;refresh();});
}
const oldRank=renderRank;
renderRank=function(...args){const value=oldRank.apply(this,args);queue();return value;};
const oldSheet=openSheet;
openSheet=function(...args){const value=oldSheet.apply(this,args);queue();return value;};
for(const id of ['rankRoot','watchList83','movie30PosterDetail84']){
 const el=document.getElementById(id);if(!el)continue;
 new MutationObserver(queue).observe(el,{childList:true,subtree:true});
}
queue();
window.__movie30WildLife89={refresh,source:'official-artist-cover'};
})();