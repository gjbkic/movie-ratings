# 起動時LS原文比較の不安定性

2026-10-21、9ac531d。アプリ・テストコード変更なし。架空originの限定観測を1回実施。

## 判定

`score-startup-candidates.cjs` のbalanced-partialケースは、正常legacy currentと不適合backupを置く。保存を止めるべき不適合currentではない。起動前の正常current原文まで一切変化しない、というassertは実装の契約に合っていない。

`harness.cjs` は各テストの新規browser/contextを作り、networkをrouteでfixture応答に限定する。同じURLでも異なるcontextのLS/IDBは共有しない。`node --test` の複数ファイル並列化でCPUの競合と観測時刻は変わるが、共有profileや保存領域の混入を示すコードはない。

`app-boot.js:4,11–12` はStorageReadyをawaitした後にBulkBootを解除しsave(false)する。一方テストはStorageReadyだけを待って別のevaluateでLSを読む。起動保存の前後どちらを読むかは一定でない。normalizeStateはscoreMap等を補完し、originSeeded/structuredSeededも初期化される。checksumも追加されるため、正常な保存でもraw文字列が変わる。

## 限定観測

同じbalanced-partial fixtureを単独Chromeで開き、Storage.setItemを観測して5.5秒後に比較した。LS currentへの書込は2回（起動から約1029ms/1065ms）、stackはapp-core.js:292の通常保存。差分はassignments、scoreMap、originSeeded、structuredSeeded、storageIntegrity。拒否対象のforeign-policy-filmは含まれなかった。別テストを同時に動かさなくても正常current原文は変わる。過去失敗時の完全差分を保存していないため、その失敗と完全に同一の書込順序だったとまでは断定しない。

## 保護の主張の範囲

9ac531dの不適合currentはRecoveryBlockedでsaveの早期returnを通る。追加6テストはLS/IDB current原文を保存試行後とreload後に比較し、拒否ケースの保護を支持する。DB作成・archive・UI状態は変わるため全領域不変ではない。

ただしテストの編集はpage.evaluateによるstate変更とsave呼出で、実UI操作ではない。正常legacyのafter.current/after.local比較は自己比較であり、reload後もジャンル編集が残ったことをassertしていない。「正常legacyで保存成功・reload後にblockedでない」は確認済みだが「編集内容の再起動保持」はこのテストだけでは不足。文書の強い表現はこの制限付きで扱う。

## 次Sol：テストと主張の補強だけ

アプリを変えず、candidateテストを意味上の比較へ修正する。正常currentの点数・星・順位・レビュー・作品ID/未知フィールドを比較し、不適合partialの固有作品やメタデータがruntimeと保存結果へ入らないことを確認。正常起動保存の完了をapp-boot完了とPendingSaveで待つ。backup原文と不適合current原文の厳密比較は維持する。単に待ち時間を延ばしたりassertを削除する修正にはしない。

current-protectionの正常系は自己比較をやめ、UIで編集した値をruntime/LS/IDBとreload後に確認する。拒否系も可能ならUI操作経由で確認し、保存成功表示を検査する。既存3ファイルを単独1回・並列1回で実行し、具体的な差分キーを失敗時に出す。失敗したら単独成功で打ち消さず差分を調べる。全回帰・実データは不要。

## テスト補強の実施結果

`score-startup-candidates.cjs` は正常な起動保存の完了を待ち、作品ID・点数・星・同点内順位・レビュー・未知フィールドをruntimeと保存済みcurrentで比較する。拒否されたcurrentとbackupは原文の厳密比較を維持した。balanced形式の部分データから架空の追加作品とレビューが混入しないことも確認する。旧形式の部分復元は追加作品を受け入れる既存契約として区別する。

`score-startup-current-protection.cjs` は正常な旧形式で詳細画面の点数入力を実際に操作し、92点がruntime、localStorage、IndexedDB、再読み込み後にも残ることを確認する。拒否ケースは起動停止マスク、保存停止表示、raw current/previousとlocalStorage currentの不変を確認する。起動停止マスクがあるため拒否ケースはUI操作不能であり、保存停止の確認は直接の保存呼出による。

架空740作品の隔離Chromeで、上記2ファイルは個別実行4/4・6/6成功。`score-live-startup.cjs`を含めた指定3ファイルの並列実行は15/15成功。`git diff --check`はエラーなし。アプリコード、実データ、保存形式は変更していない。全回帰テストとiPhone実機テストはこの限定作業では実施していない。
