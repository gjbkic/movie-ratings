# GitHub同期の点数帯ガード

2026-10-20。`syncMetaCloud` の送信元、GitHub GET結果、GET後、PUT結果後に旧点数帯の判定を追加した。現行の `live-state.json` 形式は変更せず、無印stateは旧形式として許可する。新点数帯、未知/nullマーカー、preview-only候補は同期しない。GET後の判定はSHAや編集元の更新より前に行う。

架空740作品の隔離Chromeで、送信元balanced-v1はGETなし、remote balanced-v1はPUTなし、GET待ち中のpolicy変更はPUTなしを確認した。通常の旧形式同期、失敗後の再試行、PUT中の編集、競合と保存停止の既存回帰を含む `sync-retry.cjs` 8件成功。失敗先行では送信元balanced-v1からGETが1回発生した。テストのGitHub応答は隔離した架空データ。

初回 `live-state.json` 読込、localStorage/IndexedDB起動候補、別タブ受信、復旧・履歴の適用は未接続。新帯は有効化していない。外側typeとpolicyを削除された無印データは旧形式と識別できない。
