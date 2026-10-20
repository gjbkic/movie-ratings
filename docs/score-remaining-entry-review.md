# 起動・別タブ・履歴・復旧入口の限定レビュー

2026-10-20、75220ff基準。コード読取のみ。新しいテスト・実通信・実データ操作なし。activated:false。

## 最優先：不適合currentを除外後、古い候補から保存できる

`app-core.js:167` はLS/currentの生JSONをdiskBaseに保持する。:178/180のIDB current/previousは共通movie30Candidateを通る。新帯・null・未知policyなどを拒否しても、別の正常な旧候補があれば:185以降はその候補を採用し、RecoveryBlockedを設定しない。:222以降（現在は:226以降）のlastSavedJsonは採用した古い候補になる。

その後のsaveは:281でdiskBaseとの「起動後に変わっていない」比較だけを行い、:284でLS、:286でIDB currentへ保存する。除外された記録の内容と採用候補の関係は比較しない。例：新帯IDB current＋旧形式previous、または新帯LS current＋正常旧backup。旧版の編集が成功表示され、異形式の現行記録を置換し得る。raw archive/previousへの退避はあるので直ちに全記録消滅とは限らないが、自動上書き許可とは別問題。これはコードから導いた経路で、今回ブラウザ再現はしていない。

IDBは `movie30ReadSnapshot` (:21) / `movie30ReadDisk` (:47–65) がsnapshots/currentを読む。previousは:180で別request。書込は:22の同一transactionでcurrent→previous、current、任意multitab-commitを保存する。startup archiveはcurrent原文を追加するがprevious原文は同じ方法では追加していない。75220ffの追加テストはLS current/backupのみを配置する。DBの作成・読取は実行されても、独立したcurrent/previous行からの選択、拒否後の編集保存、DB書込後の再起動はカバーしていない。

## 別タブと競合復帰：前工程の共有関数変更が既に波及

`movie30ReceivePeer` (:89–99) はdisk変化→multitab-commit/BroadcastChannel receiptのdisk一致→movie30Candidate→checksum・parent・未保存変更の検査→state/lastSavedJson/diskBase更新の順。75220ffでcandidateを変更したため、ここもstartup/legacy判定を既に受ける。「別タブ未接続」とする従来報告は訂正が必要。envelopeを剥がす処理はなく、生jsonを検査する。不適合はmovie30Conflictへ進み、runtime映画データを採用せず、停止フラグ・メモリ候補・IDB multitab-conflictsへ退避・通知する。映画current/LSを書き戻す経路ではない。cloudBaseは変更しない。無印legacyは従来の祖先確認を通る。

`app-conflict-recovery.js:23,29,92` の候補抽出・比較も同じ関数を使う。policyはmovie30Payloadで保持される（落ちるのはupdatedAt/storageIntegrity）。合成後の:50は構造だけの検査だが、通常UIは既に検査済みの両候補からplanを作る。:59以降で原候補退避→編集再確認→LS→IDB→読戻し→解決記録→runtime更新。拒否や失敗での退避記録変更と映画保存を区別する。外部から改変したplanの投入は通常UIの到達経路としては確認していない。既存MULTITABの再実行は今回していない。

## 履歴Undo：形式識別が残らず、保存完了も待たない

`app-core.js:6006–6014` の履歴snapはMAPSとcustomFilmsだけを取る。scorePolicy/envelopeを記録しない。undoは保存された差分を直接stateに反映し、oldSave(false)をawaitせず、履歴削除・LS履歴更新・成功toastへ進む。現在のpolicy、差分のフィールド、保存結果を入口で検査しない。保存停止中でもメモリと履歴を変更できる。旧無印履歴の由来は後から確実には判定できないので、今後の移行時には保護方針が必要。現在新帯は未有効化であり、これを既に発生した新旧混合と断定しない。

## JSON手動復元と自動順位復旧は異なる

手動restorePackage (:475–503) は元envelopeをgate→incoming/currentのpolicy一致→構造/checksum→確認→before-import退避→補完→state代入→saveの順。preview/new/null/unknownは旧runtimeで退避前に拒否する。旧無印は許可。保存失敗時は復元後メモリが残り、未保存通知となる。共有candidateの変更はchecksum付きimportにも波及している。cloudBaseの直接更新はない。

自動 `movie30RestoreMissingRanks` (:231–256) は専用復旧JSONを取得し、correctScores→rankOrder→clearScores→rankRecoveryを直接変更する。これは完全stateではなく、既存gateをそのまま使えない。refの形式/policyや全件構造を適用前に確認せず、途中例外でも既に行った変更を戻さない。通常はversion2かつ欠落なしで取得しない。形式不一致のrefが同じ数値点を持てば作用し得る。今回実データの参照内容は調べていない。ここではsaveを直接呼ばないが、後の保存やStorageReady成功時のcloudBase作成へ影響し得る。

## 次のSol工程は1つ

**不適合な現行LS/IDB記録がある起動では、古い候補からの自動保存を許さない**。正常な旧backup/previousを閲覧できる場合でも明示的な保護状態とし、対象原文を維持する。新しい統合・形式移行は加えない。共有candidateの責務をこれ以上広げず、起動時に拒否理由を識別する。

最小失敗先行テスト：架空740作品で(1) IDB current=new、previous=legacy、LSなし、(2) LS current=new、backup=legacy、(3) 全てlegacyの独立IDB行を配置。起動後に実際のUI編集・保存を試し、(1)(2)のcurrent/previous/LS原文が維持され、保存成功を出さず、再起動でも拒否が続くことを確認。(3)は選択→編集保存→再起動の互換。null/unknown/preview変種も同じ保護条件で検証する。live-state要求数も数え、保存記録がある拒否ケースでremoteに逃げないことを確認する。probe/DB作成/退避は許容されるため「全領域無変更」とはしない。runtimeはJSON出力等で内容を比較し、RestoredFromの文字列だけで合成の安全性を判定しない。

別タブ・履歴・自動復旧JSONは別工程。特に履歴の保存失敗時の消去と自動復旧の部分変更は未解決リスクとして残す。
