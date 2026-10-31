# 第④段階③ 検索基礎の計算分離

構造化メタデータ導入時のmatchをapp-search-queries.jsのstructuredMatchへ移動。呼出し時にtitleInfo、mediaLabel19、origin19、formatLabel19、rawGenres、runtime19を渡す。表示や検索イベント、後続の監督/製作者/カタログ/出演者ラップの順序は変更しない。

従来どおり空のqueryはtrue、文字列化と小文字化のみを行い、ここではNFKC正規化やtrimを加えない。各ラップ固有の正規化は維持する。映画データをキャッシュせず、手動タイトルや媒体の変更は次の呼出しから反映する。

比較元はc39214dの既存match関数をsearch-base-baseline.txtへ凍結（作品レコードなし）。架空740作品で、各検索語に対する結果ID配列を手動情報変更前後で比較し、入力作品が変更されないことを確認。検索候補・検索解除/ドラッグ・フィルタ順位・カタログ・HTMLバックアップは既存の関連回帰で確認する。

これは基礎検索の分離であり、全ラップを一つのパイプラインへ統合した意味ではない。後続ラップの統合は、監督別名辞書や非同期カタログの更新契約をさらに個別に固定してから行う。性能改善率は未測定。

検証：search-base、catalog-shared、search-drag、search-registration、filtered-ui、html-snapshotの関連6スイート成功。構文・diffチェック成功、保護対象JSON差分なし。全体ゲートは続けて実行する。

後続確認：固定コードca1d34c（cafea36は文書のみ）で全21スイート成功を回収済み。
