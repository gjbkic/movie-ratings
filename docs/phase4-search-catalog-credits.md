# 第④段階：カタログ監督別名検索の分離

旧app-enhancements.jsのcatalog閉包から、監督・製作者・別名の照合をcatalogCreditsへ分離。英日監督辞書は内容を変えず関数と共に移動し、統合・削減・キャッシュは行わない。oldMatch→空query→catalog参照の順序とq.trim/NFKC/記号除去を維持。記号だけのneedleが空となる既存挙動も保存する。

元関数本文をsearch-catalog-credits-baseline.txtへ固定。架空作品のメタデータを使い、未取得/空記録、director/creator/別名、コード内の既存英日辞書、空・全角・記号を比較。実装前失敗、分離後検索関連12件成功。実作品の保存記録、live-state、復旧JSONは変更なし。直前taxonomyの関連画面5スイートも全成功。

この変更で最終match連鎖の主要な照合計算は純粋関数へ委譲できた。ラップ自体、起動途中の旧match、非同期更新イベントは維持している。第④全体の最終レビューや第⑤の描画整理は別。後続全26スイートの最終結果を追記する。
