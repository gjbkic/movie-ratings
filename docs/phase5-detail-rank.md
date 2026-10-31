# 第⑤段階：詳細画面の順位計算を軽くする

基準ccb66dc。app-detail-layout.jsのranksは、詳細対象までの点数帯をすべて抽出・整列していた。全体順位は上位の作品数だけ分かればよく、上位帯の内部順序は使わない。計算をapp-rank-queries.jsのdetailRankへ移し、全作品を1回走査して上位数・採点済み総数・同点作品を得て、対象の点数帯だけ既存rankSortedで整列する。

保存済みrankOrder、既存originalSortによる補完、同点内順位、0点・null・未採点の区別を維持する。登録一覧に存在しない対象についても、同点帯なしならnull、同点帯ありなら順位nullという旧戻り値を維持。新しい状態キャッシュや保存処理は導入せず、次の呼出しで採点・順序変更を即時に読む。

旧関数をdetail-ranks-baseline.txtにそのまま固定。架空740作品全件と未登録作品3件で旧/新の戻り値一致と全state不変を確認。順位変更・点数変更後も比較。既存rank-queriesの旧互換テストも成功。

下位の80点作品1件の計算で、effectiveScore呼出し15341→741、rankSorted呼出し19→1。これは関数呼出し回数の比較であり、画面が同じ割合で高速になるとは主張しない。上位の点数帯は数えるだけになり、旧来の全点数帯ごとの全件再走査を除いた。

通常runnerにdetail-ranksを追加（unit対象）。前回未登録だったposter-refreshも通常UIスイートに登録。現時点のallは32スイート。関連UI、HTMLスナップショット、ui-profile結果は最終確認後に追記する。全回帰は直前LB版の30スイート結果と混同しない。

次の非同期ポスター/DOM監視の統合は別設計。v89/v90/v99は既にそれぞれフレーム内集約があり、同じ要素に複数の補正がかかる。監視の発火元・処理順・外部ノード追加・ドラッグ中・詳細切替を計測してから変更する。各ラップを機械的に移しただけで重複仕事が減ったとは扱わない。

main・本番・保存形式・実データは未変更。公開前のiPhone確認は未実施。

最終確認：detail-ranks、既存rank-queries、detail-unified、poster-refresh、html-snapshot、sheet-data-uiが成功。変更前にはposter-refresh/pending-posters/detail-unified/sheet-data-uiの4スイートも成功。ui-profileは全state不変で完了（test-results/ui-after-detail-rank.json）。今回の最終ソースでall32の再実行は行っていない。
