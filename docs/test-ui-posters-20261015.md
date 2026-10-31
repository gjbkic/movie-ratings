# 架空740作品検証版：検索候補・星ジャンプ・未確定ポスター

基準は統合検証 e3e81ff9815239157fed584e243a9ba6cd7abda5。変更先は新規ブランチ codex/test-ui-posters-20261015。main、PR #6/#7、実データJSONは変更しない。

## 原因と修正

- app-core.js / decoratePosters84 は .rank-card と鑑賞一覧だけを対象にしていた。星未確定 [data-v76-open]、点数未確定 [data-uns] にも同じ putPoster84/observePoster84 を適用する。app-unrated-panels.js の最終描画後にも呼び、既存のカード置換後に取りこぼさない。既存画像の二重追加は putPoster84 のチェックで防ぐ。
- 過去の .movie30-rank-poster84 に対する !important の指定が未確定カードにも及ぶため、未確定パネル内だけのサイズ・位置指定で文字との重なりを防ぐ。画像のタップは既存カードの操作を妨げない。
- app-enhancements.js / choose は登録済み作品の候補を押しても検索条件を変えるだけだった。入力をblurし、現在の openSheet に選択IDを渡す。人物・未登録作品の動作は維持する。
- v95–v98 のスクロール時の座標測定が sticky の top を繰り返し変更していた。ヘッダー高さ＋CSS top に基づく固定の積み上げ寸法へ変更し、scroll リスナーを外す。サイズ変更の監視は維持する。Chrome再現ではスクロール直後のtopが355px、ヘッダー高124pxだった。修正後は一致し、高速スクロール中の対象style更新は0件。

## 検証環境だけの処理

専用HTTPS originの既存検証サイトを更新する。build: iphone-synthetic-e3e81ff-20261015-v3。
preview-posters.js は fixture ID の未確定カードに /fictional-poster.svg を表示するだけ。保存状態にポスター情報を追加しない。CSPは画像に同一originを許可するが、外部画像・外部通信と資格情報書込の遮断は維持する。既存のseedマーカーは変更しないため、検証サイトで行った架空データ編集を再初期化しない。

## 結果

- 修正前の隔離Chromeで、候補タップ・星ジャンプ位置・未確定ポスターの3件を失敗として再現。
- 修正後3件成功。両未確定グループの全カードに1画像、ローカル画像のnaturalWidth=180、文字との非重複、再描画・再読み込み後のstate全体一致を確認。
- node scripts/regression/run.cjs all：正常系13スイート成功（追加pending-postersを含む）。data-contract 9件、MULTITAB 18件、sheet-data-ui 5件成功。既知問題4件は別枠で再現し、今回未修正。
- 最後の画像レイアウト調整後、検証版3件を再実行して成功。保存・競合復旧・JSON出力・下スワイプの検証版テストも成功、外部要求0、pageerror 0。
- 自動検証完了時点ではiPhone Safari / ホーム画面版の実機動作・GPU合成時の滑らかさは未確認だった。最新のユーザーによる実機結果は iphone-validation-status.md に記録する。Chromeのモバイル画面・タッチ合成を実機結果と混同しない。

## iPhoneでの確認

検証URLを再読み込みし、バナーのv3を確認する。星も未確定・点数未確定を開いてFICTIONALの画像と作品名、ジャンル編集・採点ボタンの非重複を確認。架空作品12を検索し候補タップでその詳細が開くことを確認。詳細を閉じ、検索解除後に高速上下スクロールして上部星ジャンプの遅れを確認する。Safariとホーム画面版で行う。本番サイトでは行わない。

本番へ進める場合は、この差分をレビューし、実機確認後に別途承認を得る。架空画像・preview adapterは本番に取り込まない。
