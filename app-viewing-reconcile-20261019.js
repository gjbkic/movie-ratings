/* One-time recovery for Oct 19 confirmed TV viewing records.
 * Additive to local state; does not replace scores or ranking.
 * Applied only after the complete local/IndexedDB restoration. */
(() => {
  'use strict';
  const ENTRIES=[{"film":{"id":"custom-1792420000000-001","title":"鍵のかかった部屋","originalTitle":"鍵のかかった部屋","englishTitle":"鍵のかかった部屋","year":2012,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000000,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-002","title":"ブラックペアン","originalTitle":"ブラックペアン","englishTitle":"ブラックペアン","year":2018,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000001,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-003","title":"イチケイのカラス","originalTitle":"イチケイのカラス","englishTitle":"イチケイのカラス","year":2021,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000002,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-004","title":"緊急取調室","originalTitle":"緊急取調室","englishTitle":"緊急取調室","year":2014,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000003,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-005","title":"絶対零度","originalTitle":"絶対零度","englishTitle":"絶対零度","year":2010,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000004,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-006","title":"ドラゴン桜","originalTitle":"ドラゴン桜","englishTitle":"ドラゴン桜","year":2005,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000005,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv","seasonCountV1":2}},{"film":{"id":"custom-1792420000000-007","title":"ビッグバン★セオリー","originalTitle":"ビッグバン★セオリー","englishTitle":"ビッグバン★セオリー","year":2007,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000006,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-008","title":"名探偵コナン","originalTitle":"名探偵コナン","englishTitle":"名探偵コナン","year":1996,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000007,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-009","title":"クレヨンしんちゃん","originalTitle":"クレヨンしんちゃん","englishTitle":"クレヨンしんちゃん","year":1992,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000008,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-010","title":"ドラえもん","originalTitle":"ドラえもん","englishTitle":"ドラえもん","year":1979,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000009,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-011","title":"サザエさん","originalTitle":"サザエさん","englishTitle":"サザエさん","year":1969,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000010,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-012","title":"ちびまる子ちゃん","originalTitle":"ちびまる子ちゃん","englishTitle":"ちびまる子ちゃん","year":1990,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000011,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792420000000-013","title":"銀魂","originalTitle":"銀魂","englishTitle":"銀魂","year":2006,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792420000012,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-001","title":"家族ゲーム","originalTitle":"家族ゲーム","englishTitle":"家族ゲーム","year":2013,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000000,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-002","title":"金田一少年の事件簿","originalTitle":"金田一少年の事件簿","englishTitle":"金田一少年の事件簿","year":1995,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000001,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-003","title":"真犯人フラグ","originalTitle":"真犯人フラグ","englishTitle":"真犯人フラグ","year":2021,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000002,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-004","title":"マイファミリー","originalTitle":"マイファミリー","englishTitle":"マイファミリー","year":2022,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000003,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-005","title":"グランメゾン東京","originalTitle":"グランメゾン東京","englishTitle":"グランメゾン東京","year":2019,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000004,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-006","title":"ラジエーションハウス","originalTitle":"ラジエーションハウス","englishTitle":"ラジエーションハウス","year":2019,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000005,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-007","title":"野ブタ。をプロデュース","originalTitle":"野ブタ。をプロデュース","englishTitle":"野ブタ。をプロデュース","year":2005,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000006,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-008","title":"ごくせん","originalTitle":"ごくせん","englishTitle":"ごくせん","year":2002,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000007,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-009","title":"LOST","originalTitle":"LOST","englishTitle":"LOST","year":2004,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000008,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-010","title":"ゲーム・オブ・スローンズ","originalTitle":"ゲーム・オブ・スローンズ","englishTitle":"ゲーム・オブ・スローンズ","year":2011,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000009,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-011","title":"SUITS／スーツ","originalTitle":"SUITS／スーツ","englishTitle":"SUITS／スーツ","year":2011,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000010,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-012","title":"フレンズ","originalTitle":"フレンズ","englishTitle":"フレンズ","year":1994,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000011,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-013","title":"NARUTO -ナルト-","originalTitle":"NARUTO -ナルト-","englishTitle":"NARUTO -ナルト-","year":2002,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000012,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}},{"film":{"id":"custom-1792421000000-014","title":"チェンソーマン","originalTitle":"チェンソーマン","englishTitle":"チェンソーマン","year":2022,"uri":"","category":"未確定","order":999999,"star":0,"oldScore":null,"added":true,"_seq":1792421000013,"tmdbType":"tv"},"meta":{"contentType":"tv_series","tmdbType":"tv"}}];
  const ANIMATED=new Set(['名探偵コナン','クレヨンしんちゃん','ドラえもん','サザエさん','ちびまる子ちゃん','銀魂','NARUTO -ナルト-','チェンソーマン']);
  const DINNER_ID='custom-1791919090262-czju';
  function restore() {
    if(window.__movie30RecoveryBlocked || !state || !Array.isArray(state.customFilms))return;
    const existing=allFilms(), ids=new Set(existing.map(f=>f.id));
    let added=0, corrected=false;
    for(const {film,meta} of ENTRIES){
      if(ids.has(film.id))continue;
      const duplicate=existing.some(f=>f.title===film.title &&
        Number(f.year)===Number(film.year) &&
        (f.tmdbType==='tv'||state.mediaTypeOverrides?.[f.id]==='drama'||state.letterboxdMeta?.[f.id]?.contentType==='tv_series'));
      if(duplicate)continue;
      state.customFilms.push({...film});
      ids.add(film.id);
      state.starOverrides[film.id]=0;
      state.mediaTypeOverrides[film.id]='drama';
      if(ANIMATED.has(film.title))state.formatOverrides[film.id]='animation';
      state.letterboxdMeta[film.id]={...meta};
      added++;
    }
    const dinner=state.customFilms.find(f=>f.id===DINNER_ID);
    if(dinner && Number(dinner.year)===2025 && Number(dinner.tmdbId)===279216){
      dinner.year=2011;
      dinner.title='謎解きはディナーのあとで';
      dinner.originalTitle='謎解きはディナーのあとで';
      dinner.englishTitle='The After-Dinner Mysteries';
      dinner.lbTitle='The Dinner Table Detective';
      delete dinner.tmdbId;
      const meta=state.letterboxdMeta?.[DINNER_ID];
      if(meta){
        for(const key of ['poster84','tmdbSeriesId','seasonCatalogV1','seasonCountV1','crew84','cast84','castMembers','backdrop84'])delete meta[key];
        meta.contentType='tv_series';meta.tmdbType='tv';
      }
      corrected=true;
    }
    if(added||corrected){
      state.updatedAt=Math.max(Date.now(),Number(state.updatedAt||0)+1);
      window.__movie30ViewingRecovery={added,corrected};
      console.info('Viewing history recovered (additive)',{added,corrected});
      // app-boot.js persists and renders after the restoration promise resolves.
    }
  }
  window.__movie30StorageReady=Promise.resolve(window.__movie30StorageReady).then(ok=>{
    if(ok===false)return false;
    try{restore()}catch(e){console.error('Viewing recovery failed; keeping original saved data',e)}
    return ok;
  });
})();
