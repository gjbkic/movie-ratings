(() => {
  // v70: Letterboxd sync is starred-items only again.
  // Manual sync still performs a fresh server-side RSS fetch via v69.
  const BUILD='20261003b';
  const parseLbRssV69=parseLbRss;
  parseLbRss=function(xml){
    return parseLbRssV69(xml).filter(x=>{
      const r=parseFloat(x?.rating);
      return Number.isFinite(r)&&r>=0.5;
    });
  };

  // Clarify the restored rule in the UI.
  const btn=document.getElementById('syncLetterboxd');
  const panel=btn?.closest('.panel');
  if(panel){
    const tip=panel.querySelector('.tip');
    if(tip)tip.textContent='「今すぐ同期」でLetterboxdを実際に確認します。★を付けた作品だけ同期し、★なし作品は取り込みません。GitHub同期トークン設定済みならサーバー側でRSSを取り直します。';
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();