# 出演者検索の計算分離

基準59cbd4d。app-cast.jsのmatchesFilmはapp-search-queries.jsのcastNamesへ委譲。fold、namesForFilmを明示依存として渡し、空/記号だけの検索ではnamesForFilmを呼ばない短絡評価を維持。casts Map、取得・IndexedDB、updateSearch、既存matchラップは変更しない。保存形式変更なし。

旧本文をsearch-cast-baseline.txtへ固定。架空740作品でname/originalName、重複名、取得前後、キャッシュ差替え、空/null/0/全角/記号の結果IDとキャッシュ呼出順を比較。未実装時失敗を確認、分離後成功。既存検索拡張6件も成功、検索候補/登録とHTMLバックアップの関連スイート成功。全24スイートは後続結果を参照。未公開、実機iPhone未確認。
