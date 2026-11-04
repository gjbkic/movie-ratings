# カード種別の作品参照を描画内で共有

第⑤段階の限定変更。`app-core.js` の `annotateTypes` はカードごとに `filmById(id)` を呼んでいた。この関数は毎回 `allFilms()` を作り、先頭から該当IDを検索する。カードが多いほど同じ作品一覧の生成と探索を繰り返す。

この装飾処理の実行ごとに `allFilms()` から `Map` を作り、カードにはその参照を使う。重複IDがあれば従来の `Array.find` と同じ最初の作品を選ぶ。次の描画では参照表を作り直すため、作品の追加・編集を保持したまま、保存形式と他の作品検索処理は変更しない。

隔離Chromeの架空730枚の描画で `filmById` 呼び出しは5883回から5153回に減少。残りは別の処理による呼び出しであり、今回の変更対象ではない。`card-decoration-probe` で装飾、再描画、検索解除、ランキング外カードとstate不変を確認し、変更前の最終表示と完全一致した。`rank-view`、`filtered-ui`、`advanced-search`、`search-drag` も成功した。単回の描画時間は測定条件に左右されるため、体感速度の改善率は断定しない。iPhone Safariでの性能は未測定。

続けて同じ装飾ラップの `fixSeriesPills` にも同じ参照表を適用。こちらも従来の最初の一致作品を使い、描画間では保持しない。架空730枚で `filmById` 呼び出しはさらに5153回から4423回に減少した。装飾基準と変更前の出力は完全一致し、`rank-view`、`filtered-ui` も成功した。描画時間の単回値は約77msだが、これも速度改善率の根拠とはしない。

`annotateStructured` も同じ730カードの作品検索を繰り返していたため、同じ描画内参照表へ変更した。`filmById` 呼び出しは4423回から3693回になった。`card-decoration-probe`、`rank-view`、`advanced-search` が成功し、変更前の最終表示、描画前後のstateは一致した。フィルター判定とDOMの書換え順序は変更していない。

旧ジャンルフィルターの `renderRank` ラップは、表示カードのジャンル判定と装飾の両方で作品を検索していた。基礎描画の後に作った同じ参照表を両走査で使う。架空730枚のフィルターなし描画で呼び出しは3693回から2963回に減少。`card-decoration-probe`、`rank-view`、`filtered-ui`、`advanced-search` が成功し、変更前の最終表示とstateは一致した。フィルターありの場合の対象カード集合も `advanced-search` で検査した。後続ラップの変更やDOM書換えの統合は別途検討する。

`annotateRawGenres` にも同じ方法を適用した。架空730枚の通常描画で `filmById` は2963回から2233回に減少。`card-decoration-probe`、`rank-view`、`advanced-search` が成功し、変更前の最終表示とstateは一致した。種別バッジの末尾処理 `fixBadges34` は通常描画で参照対象が数件しかなく、参照表を毎回作る効果がないため変更しなかった。

残る全カード走査を呼出し元別に測り、構造フィルター `prune` と種別フィルター `postFilter` が各730回の検索をしていることを確認した。両関数も実行ごとの参照表を使い、`filmById` は2233回から773回に減少。残る主な767回はポスター生成 `putPoster84` で、表示・非同期画像の扱いが異なるため今回の対象外。`card-decoration-probe`、`rank-view`、`filtered-ui`、`advanced-search`、`search-taxonomy` が成功し、変更前の最終表示とstateは一致した。単回の描画時間はノイズがあり、速度改善率の保証には使わない。

別コミットでポスターの参照表化を試したが、全回帰中に詳細ポスターの `role` 属性が欠ける失敗を再現した。変更前に戻すと `poster-refresh` は3回連続で通ったため、その試行は `121d036` で撤回済み。最終的な通常描画の `filmById` 呼び出しは773回で、ポスター更新の順序と非同期処理は従来どおり残す。

`annotateStructured` の1カード内で `runtime19(f)` と `rawGenres(f)` をそれぞれ2回呼んでいた。両関数は同じstateから値を読むだけなので1回ずつ取得して同じマークアップを作る。`card-decoration-probe`、`rank-view`、`advanced-search`、`poster-refresh` が成功し、変更前の装飾基準とstateは一致した。

複数の装飾・フィルターに同じ参照表構築ループが7箇所できたため、`filmLookupForRender()` にまとめた。毎回 `allFilms()` から新しい表を作る契約は維持し、最初の重複IDを選ぶ。`card-decoration-probe`、`rank-view`、`filtered-ui`、`advanced-search`、`poster-refresh` が成功し、変更前の装飾基準とstateは一致した。描画間のキャッシュは導入していない。
