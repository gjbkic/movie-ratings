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

## 42e8350後の限定再レビューと次工程

2026-10-21。起動current保護とそのテスト補強は完了済み。以下はコード読取によるリスクで、今回の再現実行ではない。アプリ変更・追加テストなし。activated:falseを維持。

- **履歴Undoを先に扱う。** `app-core.js:6013–6022` の `snap` / `diff` / saveラッパーはpolicy・元envelopeを履歴に残さない。`undo(h)` は差分のフィールドや現在の形式を検査せず、直接stateを変え、`oldSave(false)`のPromiseを待たず履歴削除と成功toastへ進む。保存停止・両保存先の失敗でも履歴を失う経路がある。新帯の履歴が実際に混入したとの証拠はなく、無印履歴から由来を復元できないことが将来の形式混在リスクである。`whole`分岐は現在のdiffでは生成されないが、保存済み履歴からの読込経路がある。
- **ドラッグ専用Undoは別入口。** `app-core.js:3203–3218` はupdatedAt一致のみを確認し、4つの評価mapを戻してUndo候補を消した後にsaveする。policy・保存停止・保存結果を確認しない。この入口まで同時に直すと範囲が増えるため、次工程では履歴Undoだけを対象とし、専用Undoの残存リスクを明記する。
- **手動JSON復元は既存ガードを維持。** `restorePackage` は元envelopeとincoming/current policyを検査してから退避・state代入する。preview-only情報を剥がした後だけの検査へ退行させない。新帯拒否を追加する工程は不要。保存失敗後の復元メモリ保持は既存挙動として区別する。
- **順位復旧JSONは別設計が必要。** `movie30RestoreMissingRanks`（`app-core.js:240–264`）はcorrectScores、rankOrder、clearScores、rankRecoveryの順に直接変更する。参照JSONのpolicy/envelopeや全件の構造検査がない。後半で不正なids等により例外になると先行変更が残る。catchは欠落がある場合だけ保存停止し、欠落がない初回復旧では途中変更が後続saveへ進む可能性がある。完全state用gateをそのまま流用せず、専用参照形式を全件検査してからcloneへ適用する案を次々工程に残す。

### 次Solの一工程：履歴Undoの保存結果保護

失敗先行fixtureは架空740作品で通常の編集から履歴を作り、履歴UIのUndoを押す。(1) localStorageとIDBの書込を両方失敗させ、成功toastが出ず、履歴候補とUndo前後の内容を失わない、(2) 保存停止中はstate・履歴を変更しない、(3) 通常成功なら保存読戻しとreload後に点数・順位・レビューが一致し、その後だけ履歴が消える、(4) 異policyのcurrentまたは明示preview/new/unknown履歴は拒否して原文を維持、を確認する。未知フィールド・0/null・星のみもfixture比較に含める。旧無印履歴の互換はlegacy currentでのみ評価し、履歴に存在しないpolicyを推測しない。

最小案は、入口で停止状態/current policyと差分allowlist・形を検査し、候補をcloneに構築してUndo前後を退避、非同期保存の結果を確認するまで履歴削除と成功表示を遅らせる。連打を止め、保存待ち中に別編集・別タブ更新が来た場合は無条件rollbackで上書きせず、両候補を保持して停止通知する。既存の保存/競合機構を再利用する。退避不能なら適用前に停止。安全な候補保持と保存中の編集競合が小変更で成立しない場合は実装を広げずAstraレビューへ戻す。保存形式移行や新帯有効化は含めない。

### 履歴Undoの実装・限定検証（930aeb3、630cee8、9c6317f）

Undo入口で停止状態、runtimeと履歴のpolicy、差分形を検査する。Undo前後の完全候補をIndexedDBの`history-undo-pending`に退避できてから適用し、映画保存の成功と履歴の書込読戻しを確認して成功表示を出す。退避失敗時は適用しない。保存失敗時、他の編集がなければ元のメモリ状態へ戻し、履歴と退避候補を残す。保存中に別編集が入れば無条件には戻さず、履歴と退避候補を残して警告する。履歴書込に失敗した場合も成功表示せず保存停止にする。

架空740作品の隔離Chromeで、失敗先行のレビュー消失を再現した後、正常保存と再読み込み、停止状態、異policy、退避不能、退避後の映画保存失敗、保存中の追加編集を含む6件が成功。`data-contract.cjs`は10件中9件成功。残る1件はチェックサム破損currentを置いて`reload()`で通常起動を待つ既存テストで、現行のcurrent保護は起動停止マスクを出すため30秒待ちで失敗する。Undoの実行前の起動経路であり、期待値の更新は別作業とする。全回帰・実機・実データでは未検証。
