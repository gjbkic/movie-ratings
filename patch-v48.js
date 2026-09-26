(() => {
  // v48: user-approved genre corrections from the full-library audit.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927e';
  const KEY='movie30_genre_audit_v48_20260927e';

  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const rawGenres=f=>uniq(state.genreOverrides?.[f?.id]||[]);
  const textOf=f=>{const x=titleInfo(f)||{};return [displayTitle(f),x.title,x.originalTitle,x.englishTitle,f?.lbTitle].filter(Boolean).join(' ')};
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();

  function find(re,year=null){
    return allFilms().filter(f=>(year==null||Number(f.year)===Number(year))&&re.test(norm(textOf(f))));
  }
  function edit(re,year,{add=[],remove=[]}={}){
    for(const f of find(re,year)){
      state.genreOverrides=state.genreOverrides||{};
      const rm=new Set(remove), s=new Set(rawGenres(f).filter(g=>!rm.has(g)));
      for(const g of add)s.add(g);
      state.genreOverrides[f.id]=[...s];
    }
  }

  let done=false;try{done=localStorage.getItem(KEY)==='1'}catch(_){}
  if(!done){
    edit(/(?:black swan|ブラック.?スワン)/i,2010,{remove:['ミステリー']});
    edit(/(?:mad max.*fury road|マッドマックス.*怒りのデス.?ロード)/i,2015,{remove:['クライム']});
    edit(/(?:grave of the fireflies|火垂るの墓)/i,1988,{remove:['差別・人権']});
    edit(/(?:porco rosso|紅の豚)/i,1992,{remove:['差別・人権']});
    edit(/(?:jojo rabbit|ジョジョ.?ラビット)/i,2019,{add:['コメディ']});
    edit(/(?:gladiator|グラディエーター)/i,2000,{remove:['差別・人権']});
    edit(/(?:wall.?e|ウォーリー)/i,2008,{remove:['ファンタジー']});
    edit(/(?:gattaca|ガタカ)/i,1997,{add:['哲学・思想']});
    edit(/(?:pan'?s labyrinth|パンズ.?ラビリンス)/i,2006,{add:['ファンタジー']});
    edit(/(?:silver linings playbook|世界にひとつのプレイブック)/i,2012,{add:['ドラマ','コメディ','心理・内面']});
    edit(/(?:2001.*space odyssey|2001年宇宙の旅)/i,1968,{remove:['心理・内面']});
    edit(/(?:cinema paradiso|ニュー.?シネマ.?パラダイス)/i,1988,{remove:['大作']});
    edit(/(?:million dollar baby|ミリオンダラー.?ベイビー)/i,2004,{add:['スポーツ']});
    edit(/(?:shutter island|シャッター.?アイランド)/i,2010,{remove:['差別・人権']});
    edit(/(?:12 angry men|十二人の怒れる男)/i,1957,{add:['ドラマ']});
    edit(/(?:pulp fiction|パルプ.?フィクション)/i,1994,{add:['コメディ']});
    edit(/(?:saving private ryan|プライベート.?ライアン)/i,1998,{add:['バイオレンス']});
    edit(/(?:parasite|パラサイト.*半地下)/i,2019,{add:['ドラマ','コメディ','スリラー']});
    edit(/(?:the sixth sense|sixth sense|シックス.?センス)/i,1999,{add:['ホラー']});
    edit(/(?:silence of the lambs|羊たちの沈黙)/i,1991,{add:['ホラー']});
    edit(/(?:minority report|マイノリティ.?リポート)/i,2002,{add:['哲学・思想']});
    edit(/(?:sonatine|ソナチネ)/i,1993,{remove:['大作']});
    edit(/(?:chainsaw man.*reze|チェンソーマン.*レゼ)/i,2025,{add:['バイオレンス']});
    edit(/(?:children of men|トゥモロー.?ワールド)/i,2006,{remove:['ファンタジー']});
    edit(/(?:the girl with the dragon tattoo|ドラゴン.?タトゥーの女)/i,2011,{add:['スリラー','バイオレンス']});
    edit(/(?:grand budapest hotel|グランド.?ブダペスト.?ホテル)/i,2014,{add:['コメディ']});
    edit(/(?:everything everywhere all at once|エブリシング.?エブリウェア|eeaao)/i,2022,{add:['SF']});
    edit(/(?:district 9|第9地区)/i,2009,{remove:['恋愛','ファンタジー']});
    edit(/(?:nightcrawler|ナイトクローラー)/i,2014,{remove:['アクション']});
    edit(/(?:prisoners|プリズナーズ)/i,2013,{remove:['comfort']});
    edit(/(?:paprika|パプリカ)/i,2006,{remove:['社会問題・生活']});
    edit(/(?:amadeus|アマデウス)/i,1984,{add:['歴史'],remove:['差別・人権']});
    edit(/(?:^| )cure(?: |$)|キュア/i,1997,{add:['ホラー','ミステリー','クライム'],remove:['社会問題・生活']});
    edit(/(?:rain man|レインマン)/i,1988,{remove:['クライム']});
    edit(/(?:howl'?s moving castle|ハウルの動く城)/i,2004,{remove:['歴史']});
    edit(/(?:perks of being a wallflower|ウォールフラワー)/i,2012,{remove:['サスペンス']});
    edit(/(?:l\.?a\.? confidential|l\.a\.コンフィデンシャル|laコンフィデンシャル)/i,1997,{add:['クライム']});
    edit(/(?:zodiac|ゾディアック)/i,2007,{add:['クライム']});
    edit(/(?:^| )split(?: |$)|スプリット/i,2016,{add:['心理・内面']});
    edit(/(?:thermae romae|テルマエ.?ロマエ)(?!.*ii|.*Ⅱ|.*2)/i,2012,{add:['時間'],remove:['戦争']});
    edit(/(?:thermae romae ii|テルマエ.?ロマエ(?:Ⅱ|2))/i,2014,{add:['時間'],remove:['戦争']});
    edit(/(?:gone girl|ゴーン.?ガール)/i,2014,{add:['心理・内面']});
    edit(/(?:the best offer|鑑定士と顔のない依頼人)/i,2013,{remove:['社会問題・生活']});
    edit(/(?:scarface|スカーフェイス)/i,1983,{add:['バイオレンス']});
    edit(/(?:snowpiercer|スノーピアサー)/i,2013,{add:['社会問題・生活','差別・人権','バイオレンス']});
    edit(/(?:hacksaw ridge|ハクソー.?リッジ)/i,2016,{add:['バイオレンス']});
    edit(/(?:donnie darko|ドニー.?ダーコ)/i,2001,{add:['SF','心理・内面']});
    edit(/(?:12 years a slave|それでも夜は明ける)/i,2013,{remove:['戦争']});
    edit(/(?:saw ii|saw 2|ソウ2|ソウ ii)/i,2005,{add:['ホラー','バイオレンス']});
    edit(/(?:midsommar|ミッドサマー)/i,2019,{add:['雰囲気・美学','心理・内面']});
    edit(/(?:school of rock|スクール.?オブ.?ロック)/i,2003,{add:['コメディ']});
    edit(/(?:sister act|天使にラブ.?ソングを)/i,1992,{add:['コメディ'],remove:['差別・人権','社会問題・生活']});
    edit(/(?:^| )yesterday(?: |$)|イエスタデイ/i,2019,{add:['恋愛','コメディ']});

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('指定したジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();
