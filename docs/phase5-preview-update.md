# 第⑤段階：詳細分類の同値DOM更新を省略

基準2e1ab82（直前検索分離は全26スイート成功）。分類previewをDocumentFragmentへ構築し、現在の子ノードとisEqualNodeで一致するときだけ実DOMの置換を省く。変化した場合は一括置換する。文字列キャッシュで判定しないため、古いラップによるDOM再作成にも追従する。0/120ms遅延、selectedIdガード、旧イベント、順位/保存は変更しない。

Chrome155/架空740作品の同一シナリオ計測でdetail-refreshのchildList変更は10,11,10→5,6,5。属性変更は3→3。操作前後の全state一致。計測中は他テストを並列実行せず、前後JSONはtest-results/ui-before-preview.json・ui-after-preview.json。全体速度の改善率やiPhoneでの滑らかさは未測定。

関連回帰：detail-unified、star-editor、sheet-data-ui、pending-posters、html-snapshotを実行。最終結果は後続追記。

次の大きい第⑤作業は、renderRank/openSheetの多重ラップを明示的な描画後処理へ置換する設計。静的代入数31/30を削除可能数と誤認しない。起動途中に捕捉済みのrender参照、非同期人物/シーズン、ドラッグ中の後処理順、pendingポスター最終装飾、詳細整形遅延との依存がある。置換順と互換アダプタをAstra中でレビューしてから実装へ戻す。今回、小さい同値更新省略以外のラップ統合は行っていない。

最終結果：関連5スイートすべて成功、diffチェック成功。直前検索版の全26成功とは区別する。今回の詳細改善後は全26の再実行は行わず、変更に対応する5件と前後状態比較で検証。未公開・実機iPhone未確認。
