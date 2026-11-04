# カードの同一ジャンル文字列の再設定を省略

第⑤段階の限定変更。`app-core.js` の `annotateRawGenres` は、先行する描画が作った `.genre-line` と同じ文字列でも `textContent` を再設定していた。後続の `annotateStructured` はカードの `.rank-meta` 全体を再生成するため、同じ文字列の再設定は表示を変えずにDOM書込みだけを増やしていた。

既存の `.genre-line` が1個のテキストノードを持ち、内容が新しいジャンル文字列と完全一致する場合だけ再設定を省略する。異なる文字列、空欄、複数子ノードの場合は従来どおり更新する。ラップの順序、対象範囲、ジャンルの算出方法、点数・順位・保存形式は変えない。

隔離Chromeの架空730枚の再描画で、この箇所の `textContent` 書込みは730回から0回。先行・後続の `.rank-meta.innerHTML` 各730回は残る。カード装飾の基準テストではmovie/series/drama/documentary/other/未知種別、複数ジャンル、ランキング外カード、再描画、検索解除の最終表示が変更前と完全一致し、描画前後のstateも一致した。通常runnerへ `card-decoration-probe` を追加。`rank-view`、`filtered-ui`、`advanced-search`、`search-drag`、`poster-refresh` の関連テストも成功した。

単回の描画時間は変更前約111ms、変更後約103msで、ノイズを含むため速度改善率として扱わない。中間DOMや監視処理を一括削除する判断は別途行う。iPhone Safariの体感速度は未測定。
