# 手動JSON復元の入口判定

2026-10-20。`restorePackage` の最初で、外側のJSONを維持したまま `Movie30ScoreEntryGate.assess` を実行する。`accept` 以外は確認ダイアログ、退避、状態変更、保存より前に停止する。既存の点数帯検査、整合性検査、退避と復元処理はそのまま使う。

架空740作品の隔離Chromeで、preview-onlyとnull policyを拒否し、確認ダイアログなし、メモリ・localStorage・IndexedDBの現行スナップショット不変を確認。通常の `app:movie30,version:13` バックアップの復元、保存版HTML、入口判定も成功した。テストは `data-contract.cjs` の関連2件、`html-snapshot.cjs` 1件、`score-entry-gate.cjs` 8件。

起動候補、live-state取得、別タブ、GitHub同期、復旧・履歴適用には未接続。新点数帯の有効化も行っていない。今後これらの入口では、元の外側形式と変換前のpolicyを個別に検査する必要がある。
