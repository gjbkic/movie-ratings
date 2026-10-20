# 順位復旧JSONの部分適用レビュー

2026-10-21、b9a8ea6基準。app-core.jsの復旧入口、app-boot.js、fixtureルート、履歴Undoレビューを読取確認。実データ参照・通信・追加テスト実行・アプリ変更なし。activated:false。

## 結論とコード上の根拠

**次Solは順位復旧参照の全件検査と、メモリへの一括反映だけを扱う。** 履歴Undoや保存全体の再設計を混ぜない。

`app-core.js:240–265` の `movie30RestoreMissingRanks` はversion2かつ順位欠落なしなら終了。それ以外は参照JSONを取得し、correctScores→点数帯ごとのrankOrder→clearScores→rankRecoveryの順に現在stateを直接変更する。適用前の全件検査、policy・envelope検査、例外時rollbackはない。

例えば正しいcorrectScoresで点数変更後、rankOrder後半の値が配列でなければ `ids.filter` で失敗し、先行変更は残る。knownDamagedOrdersが欠落/不正でも同様。clearScoresの後半で失敗する場合も既に点数・順位・追加作品のoldScoreが変わっている。参照の重複IDや数値範囲も入口では検査しない。

catchは取得前に計算したmissingがtrueの場合だけRecoveryBlockedと保存停止表示を設定する。欠落なしでrankRecoveryが未更新の場合は失敗を黙って飲み込み、部分変更が後続保存へ進み得る。missing=trueでも部分変更を戻さず「元の記録を維持」と表示するため、メモリと表示が一致しない。

参照は完全な映画stateではないため既存の完全state gateをそのまま使えない。現在はbare JSONにnew/null/unknown scorePolicyやpreview typeが付いていても正しいフィールドがあれば適用に進む。expected policyを現在runtimeと参照双方で確認する専用の入口が必要。無印の従来参照はlegacyとしてのみ許容し、未知形式を推測採用しない。

## 保存・完了表示の順序

`:235–238` は復旧前にmovie30LastSavedJsonを設定し、復旧後にRecoveredRankCountを算出してtrueを返す。復旧関数自体は永続化しない。`app-boot.js:4–12,25–28` はStorageReadyを待ち、blockedでなければsave(false)を呼ぶが、そのPromiseを待つ前に通常画面を表示する。これは「画面が開いた＝保存確認済み」ではない。

通常saveはLS set/getの一致とIDB transaction完了で成功を判定する。IDBの独立した保存後読戻しをこの復旧入口は行わない。rankRecovery.version/restoredやRecoveredRankCountはメモリ復旧結果であり、永続化成功の証拠にしない。StorageReady成功時のcloudBase作成（:5803）も保存完了前に起こり得る。今回は同期設計へ広げず、既存保存失敗表示と再起動テストで範囲を明確にする。

## 最小実装案

1. 専用validatorでトップレベルbare identity、参照/current/runtime policy、全rankOrder/knownDamagedOrders配列、補正/解除レコードのID・有限な範囲内点数、重複や矛盾を適用前に検査する。sourceCommit等の来歴も形式検査するが、それだけで正当な順位の証明とは扱わない。未知作品IDを既存の仕様どおり無視する場合と、型の破損を拒否する場合を区別する。
2. stateをdeep cloneし、既存の「既知の破損投影だけ修復」「後日の順位はconflictsとして維持」「後から増えた作品を残す」条件をそのまま候補へ適用する。filmById/effectiveScore等のglobal state依存を候補に対する参照へ明示的に置換する。先にglobal stateを候補に入れ替えて計算する方式は避ける。
3. 全処理成功と候補の点数・順位整合を検証した後だけstateと復旧表示値を一度更新。fetch待ちの間にstateが変わっていたら採用しない。失敗時は元stateと復旧表示値を完全維持し、必要な復旧を完了できなかったことを明示して保存停止する。missingの有無で例外を黙殺しない。

保存形式移行、実参照の編集、新帯の有効化、復旧順位の推測は不要。validatorと候補計算を小さな純粋関数に切り出す場合も当入口の範囲だけとする。

## 失敗先行fixture（少数の隔離ケース）

- 欠落あり/なしを各1件。先頭correctScoresは有効、後半rankOrderを非配列にし、失敗後のstate全体・復旧表示値・LS/IDB current原文を比較。前半だけ適用されないことを確認。
- clearScores後半不正、knownDamagedOrders不正、重複ID/不正点数をパラメータ化。前半が妥当でも全体拒否する。
- preview envelope、新帯/null/unknown policy、currentとの不一致を拒否し、無印legacy参照の正常復旧は維持。
- 正常参照で新規作品、レビュー、視聴履歴、ジャンル、星、0/null/未採点、未知フィールドを保持。正当な後日順位はconflictsとして維持し、既知破損だけ修復。通常保存後のLS/IDB読戻しとreloadで同じ順位を確認。
- 参照fetchを遅延し、待機中に別編集が入った場合は古い候補を採用しない。
- 正常候補後に両保存先失敗を注入。復旧件数表示を保存成功と誤認せず、元の永続記録が維持されることを確認。

`scripts/regression/harness.cjs:21` は現在、整形式のsynthetic参照を返すだけ。既存テストがこれらの異常途中経路を検証しているという根拠は見つからなかった。新テストではそのURLをfixture応答で上書きし、実際の復旧JSONを開かない。
