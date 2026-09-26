(() => {
  // v49: second user-approved genre audit batch.
  // Genre metadata only; scores and ranking are untouched.
  const BUILD='20260927f';
  const KEY='movie30_genre_audit_v49_20260927f';

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
    edit(/l\.?a\.? confidential|l\.a\.コンフィデンシャル|laコンフィデンシャル/i,1997,{add:['ドラマ']});
    edit(/zodiac|ゾディアック/i,2007,{add:['ドラマ']});
    edit(/(?:^| )split(?: |$)|スプリット/i,2016,{remove:['ヒーロー']});
    edit(/midsommar|ミッドサマー/i,2019,{remove:['ファンタジー']});
    edit(/2001.*space odyssey|2001年宇宙の旅/i,1968,{remove:['時間']});
    edit(/american history x|アメリカン.?ヒストリー.?x/i,1998,{remove:['歴史']});
    edit(/la haine|憎しみ/i,1995,{add:['ドラマ'],remove:['歴史','世界観']});
    edit(/(?:^| )leon(?: |$)|léon|レオン/i,1994,{add:['クライム']});
    edit(/usual suspects|ユージュアル.?サスペクツ/i,1995,{add:['クライム']});
    edit(/life is beautiful|la vita è bella|ライフ.?イズ.?ビューティフル/i,1997,{add:['コメディ']});
    edit(/shawshank|ショーシャンク/i,1994,{remove:['大作']});
    edit(/requiem for a dream|レクイエム.?フォー.?ア.?ドリーム/i,2000,{add:['ドラマ']});
    edit(/little miss sunshine|リトル.?ミス.?サンシャイン/i,2006,{add:['コメディ']});
    edit(/amélie|amelie|アメリ/i,2001,{add:['コメディ'],remove:['社会問題・生活']});
    edit(/gran torino|グラン.?トリノ/i,2008,{remove:['大作']});
    edit(/hot fuzz|ホット.?ファズ/i,2007,{add:['アクション','クライム']});
    edit(/angels.*demons|天使と悪魔/i,2009,{add:['スリラー']});
    edit(/(?:^| )upgrade(?: |$)|アップグレード/i,2018,{add:['バイオレンス','スリラー']});
    edit(/the fugitive|逃亡者/i,1993,{add:['アクション','クライム','ドラマ']});
    edit(/(?:^| )fargo(?: |$)|ファーゴ/i,1996,{add:['コメディ','ドラマ']});
    edit(/oppenheimer|オッペンハイマー/i,2023,{add:['ドラマ','特殊構造']});
    edit(/テセウスの船|the ship of theseus/i,2020,{add:['SF']});
    edit(/king'?s speech|英国王のスピーチ/i,2010,{add:['歴史'],remove:['大作']});
    edit(/hurt locker|ハート.?ロッカー/i,2008,{remove:['歴史','差別・人権']});
    edit(/benjamin button|ベンジャミン.?バトン/i,2008,{remove:['時間','差別・人権','社会問題・生活']});
    edit(/(?:^| )arrival(?: |$)|メッセージ/i,2016,{add:['時間']});
    edit(/(?:^| )in time(?: |$)|time\/タイム|time.?タイム/i,2011,{add:['時間'],remove:['ファンタジー']});

    edit(/stand by me doraemon(?: |$)|スタンド.?バイ.?ミー.?ドラえもん(?: |$)/i,2014,{add:['時間','シリーズ劇場版']});
    edit(/stand by me doraemon 2|スタンド.?バイ.?ミー.?ドラえもん2/i,2020,{add:['時間','シリーズ劇場版']});
    edit(/(?:^| )exit 8(?: |$)|8番出口/i,2025,{add:['特殊構造','心理・内面','ホラー','ミステリー','スリラー']});
    edit(/(?:^| )inside out(?: |$)|インサイド.?ヘッド(?: |$)/i,2015,{add:['世界観']});
    edit(/project hail mary|プロジェクト.?ヘイル.?メアリー/i,2026,{remove:['ファンタジー']});
    edit(/independence day|インディペンデンス.?デイ/i,1996,{remove:['ファンタジー']});
    edit(/war of the worlds|宇宙戦争/i,2005,{remove:['ファンタジー']});
    edit(/close encounters of the third kind|未知との遭遇/i,1977,{remove:['ファンタジー']});
    edit(/jurassic park|ジュラシック.?パーク/i,null,{remove:['ファンタジー']});
    edit(/jurassic world|ジュラシック.?ワールド/i,null,{remove:['ファンタジー']});
    edit(/(?:^| )passengers(?: |$)|パッセンジャー/i,2016,{add:['恋愛'],remove:['ファンタジー']});
    edit(/e[xX]isten[zZ]|イグジステンズ/i,1999,{add:['特殊構造']});
    edit(/thirteenth floor|13f|13F/i,1999,{add:['ミステリー']});
    edit(/dark city|ダーク.?シティ/i,1998,{add:['心理・内面']});
    edit(/men in black|メン.?イン.?ブラック/i,null,{add:['コメディ']});
    edit(/john wick|ジョン.?ウィック/i,2014,{add:['世界観']});
    edit(/philosopher'?s stone|sorcerer'?s stone|賢者の石/i,2001,{add:['世界観']});
    edit(/monsters,? inc|モンスターズ.?インク/i,2001,{remove:['社会問題・生活']});
    edit(/(?:^| )toy story(?: |$)|トイ.?ストーリー(?: |$)/i,1995,{add:['コメディ','アドベンチャー']});
    edit(/zootopia|ズートピア/i,null,{add:['世界観','コメディ']});
    edit(/summer wars|サマーウォーズ/i,2009,{add:['世界観']});
    edit(/district 9|第9地区/i,2009,{add:['差別・人権']});

    edit(/whiplash|セッション/i,2014,{remove:['ミュージカル']});
    edit(/hotel transylvania|モンスター.?ホテル/i,2012,{remove:['ミュージカル']});
    edit(/bohemian rhapsody|ボヘミアン.?ラプソディ/i,2018,{remove:['ミュージカル']});

    // Interpreting the user's listed Disney titles in context as the requested musical-tag additions.
    edit(/(?:^| )frozen(?: |$)|アナと雪の女王(?: |$)/i,2013,{add:['ミュージカル']});
    edit(/tangled|ラプンツェル/i,2010,{add:['ミュージカル']});
    edit(/(?:^| )moana(?: |$)|モアナと伝説の海/i,2016,{add:['ミュージカル']});
    edit(/little mermaid|リトル.?マーメイド/i,1989,{add:['ミュージカル']});
    edit(/(?:^| )cinderella(?: |$)|シンデレラ/i,1950,{add:['ミュージカル']});
    edit(/beauty and the beast|美女と野獣/i,2017,{add:['ミュージカル']});
    edit(/(?:^| )aladdin(?: |$)|アラジン/i,1992,{add:['ミュージカル']});
    edit(/(?:^| )aladdin(?: |$)|アラジン/i,2019,{add:['ミュージカル']});
    edit(/lion king|ライオン.?キング/i,1994,{add:['ミュージカル']});
    edit(/lion king|ライオン.?キング/i,2019,{add:['ミュージカル']});
    edit(/wizard of oz|オズの魔法使い/i,1939,{add:['ミュージカル']});
    edit(/sound of music|サウンド.?オブ.?ミュージック/i,1965,{add:['ミュージカル','恋愛']});

    edit(/machinist|マシニスト/i,2004,{add:['心理・内面'],remove:['バイオレンス']});
    edit(/third murder|3度目の殺人|三度目の殺人/i,2017,{remove:['バイオレンス']});
    edit(/end of evangelion|air.?まごころ|新世紀エヴァンゲリオン.*air/i,1997,{add:['バイオレンス']});
    edit(/equalizer|イコライザー/i,2014,{add:['バイオレンス']});
    edit(/the invitation|invitation|インビテーション/i,2015,{add:['ホラー','ドラマ','心理・内面'],remove:['クライム','アクション','バイオレンス']});
    edit(/trainspotting|トレインスポッティング/i,1996,{add:['ドラマ','コメディ','心理・内面']});
    edit(/wolf children|おおかみこどもの雨と雪/i,2012,{add:['ファンタジー']});
    edit(/boss baby|ボス.?ベイビー/i,2017,{remove:['心理・内面']});
    edit(/boy and the beast|バケモノの子/i,2015,{add:['アクション','アドベンチャー','ドラマ'],remove:['社会問題・生活']});
    edit(/lilo.*stitch|リロ.*スティッチ/i,2002,{add:['コメディ']});
    edit(/wreck.?it ralph|シュガー.?ラッシュ(?: |$)/i,2012,{add:['コメディ']});
    edit(/(?:^| )brave(?: |$)|メリダとおそろしの森/i,2012,{add:['アドベンチャー']});
    edit(/finding nemo|ファインディング.?ニモ/i,2003,{add:['アドベンチャー']});
    edit(/(?:^| )snatch(?: |$)|スナッチ/i,2000,{add:['コメディ']});
    edit(/memories of murder|殺人の追憶/i,2003,{add:['クライム','ドラマ']});
    edit(/mystic river|ミスティック.?リバー/i,2003,{add:['クライム']});
    edit(/(?:^| )mother(?: |$)|母なる証明/i,2009,{add:['ドラマ']});
    edit(/chinatown|チャイナタウン/i,1974,{add:['クライム'],remove:['バイオレンス']});
    edit(/invisible guest|インビジブル.?ゲスト/i,2016,{add:['クライム']});
    edit(/lucky number slevin|ラッキーナンバー7/i,2006,{add:['クライム']});
    edit(/(?:^| )basic(?: |$)|閉ざされた森/i,2003,{remove:['戦争']});
    edit(/(?:^| )argo(?: |$)|アルゴ/i,2012,{add:['ドラマ','歴史','スリラー'],remove:['ミステリー','クライム','アクション']});
    edit(/first avenger|ザ.?ファースト.?アベンジャー/i,2011,{add:['戦争']});
    edit(/train to busan|新感染/i,2016,{remove:['恋愛']});
    edit(/thor.*ragnarok|マイティ.?ソー.*バトルロイヤル/i,2017,{add:['コメディ'],remove:['恋愛']});
    edit(/(?:^| )ant-man(?: |$)|アント.?マン(?: |$)/i,2015,{add:['コメディ']});
    edit(/ant-man and the wasp|アント.?マン.*ワスプ/i,2018,{add:['コメディ']});
    edit(/guardians of the galaxy vol\.? 2|ガーディアンズ.*リミックス/i,2017,{add:['コメディ']});
    edit(/game night|ゲーム.?ナイト/i,2018,{add:['娯楽']});
    edit(/(?:^| )bugonia(?: |$)|ブゴニア/i,2025,{add:['コメディ']});
    edit(/wake up dead man|ウェイクアップ.?デッドマン/i,2025,{add:['クライム','ドラマ','コメディ','スリラー']});
    edit(/one battle after another|ワン.?バトル.?アフター.?アナザー/i,2025,{add:['コメディ','スリラー']});
    edit(/incendies|灼熱の魂/i,2010,{remove:['comfort']});

    try{localStorage.setItem(KEY,'1')}catch(_){}
    try{save(false)}catch(_){try{save()}catch(__){}}
    try{render()}catch(_){}
    try{toast('指定したジャンル修正を反映しました')}catch(_){}
  }

  const marker=document.getElementById('movie30BuildV29');
  if(marker)marker.textContent='app build '+BUILD;
})();
