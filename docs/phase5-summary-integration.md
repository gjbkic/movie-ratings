# 詳細生成統合の全体確認

対象は1bbdd58、作業ブランチcodex/phase4-storage-integration-20261018。外部通信を遮断した架空740作品のChromeで確認する。main・本番・実データ・既存PRには変更を加えない。

## 計測

ui-profile.cjsを実行しtest-results/ui-after-summary.jsonへ出力。操作前後の全stateは一致。同じ詳細のrefresh3回はすべてchildList/attributes/characterDataが0。新旧生成比較のdetail-render-contractは、従来のrankInfoが5回から0回になることを検証している。

ランキング再描画3回は各childList3699件、属性8103件。検索解除もchildList3699件。これはMutationObserverの通知レコード数で、レイアウト回数や描画時間そのものではない。既存の詳細計測との比較では、表示切替の変更件数が混在しており、速度向上率は断定しない。全体テストと並行した計測のためsyncMsは性能評価に使用しない。

## 次の設計境界

ランキングの全面再描画を減らすには、作品・点数・順位・絞り込み・検索・ポスター設定のどの変更で何を更新するかを定義する必要がある。単純な同一配列キャッシュやrenderRankの省略では、配列内の作品変更、外部メタデータ、古い関数を捕捉したイベント、ドラッグ中の表示を取りこぼしうる。

次はAstra中で更新条件とDOM所有を設計する。実装前に同じ状態での再描画、検索解除、フィルター変更、採点、同点内入替、未採点、後着ポスター、ドラッグ後の保存を比較する境界を決める。検索ジャンプの再配置タイマーとv89の個別ポスター補正は役割が残るため削除しない。大規模な監視統合、保存の責任分離（第⑥）は含めない。

第⑤は進行中。第⑥・第⑦および今回変更のiPhone実機確認は未完了。

## 統合結果

node scripts/regression/run.cjs allは全34スイート成功、失敗0。MULTITAB18件、storage-reconnect6件、data-contract9件、sheet-data-ui5件を含む。保存容量不足、IndexedDBのみの保存とプロセス再起動、競合候補の復帰、JSON/HTML保存・復元、点数0/null、未知フィールド、検索解除、タッチドラッグ、TVシーズン、LBレビュー保護とGUID重複防止も各既存スイートで確認。既知不具合の再現スイートを成功件数に加えていない。

app-*.jsとscripts/regression/*.cjsの計62ファイルの構文確認も成功。結果はtest-results/all.json、実行ログはtest-results/detail-summary-all.log（いずれもローカル生成物）。本番通信・実データ同期は実施していない。

再開指示：1bbdd58の全34回帰確認済み状態を基準に、Astra中でランキング描画の更新条件とDOM所有を設計する。現在の操作・データ形式を維持し、まず新旧比較で省略可能な処理を特定する。承認なしのマージ・本番公開は禁止。
