# 起動時保存候補のscorePolicy検査

2026-10-20。新点数帯は引き続き `activated:false`。本番データ、保存形式、同期処理は変更していない。

`app-core.js` の `movie30Candidate` は従来、形とchecksumだけを確認していたため、新帯のlocalStorage/IndexedDB保存候補も起動時に選ばれた。さらに不完全な新帯記録のオブジェクト値が、旧形式の正常な候補へ部分補完され、文字列の `scorePolicy` は補完されなかった。判定から元の形式が消える危険があった。

完全候補は元のbare stateを既存の `Movie30ScoreEntryGate` のstartup/legacy-v23で検査する。localStorage、IndexedDB current/previousに共通の候補関数を使い、embedded候補も同様に検査する。部分記録は完全stateとして判定できないため、bare形式で、policyが欠落または明示的なlegacy-v23の場合だけ従来の補完対象とする。new/null/unknown/外側envelopeは補完しない。raw記録の退避・拒否時の保存停止は従来経路に従う。

架空740作品・通信遮断Chromeで修正前に新帯完全候補の採用、新帯partialの補完を再現した。修正後は `score-startup-candidates.cjs` で新帯完全・新帯partialの拒否、旧形式の完全・partialの互換、localStorage原文の維持を確認する。`score-live-startup.cjs` の初回live-state 5ケースも併せて確認する。IndexedDB候補は共通関数を通るが、この追加テストで独立のIndexedDB行は配置していない。全回帰、実機、他の入口は未確認。

起動前の全領域不変は約束しない。保存可否のprobe、IDB作成、rawのarchiveが候補判定前にも行われる。`load` が先に暫定候補を置く動作や、候補間の既存メタデータ合成は変更していない。同期pull、別タブ受信、履歴復元は次の独立した検討対象。
