# 入口ゲート接続前レビュー

2026-10-20 / b44938f基準。アプリコード変更なし。結論：現ゲートを全入口へそのまま接続しない。activated:falseを維持し、最初は正常バックアップ互換と手動復元の1入口だけを扱う。

## 接続を妨げる具体的な問題

**P1・既存JSON互換性。** app-core.js:470のexportPackageは `{app:"movie30",version:13,exportedAt,state}` を出力する。gateはmovie30-backupのtype付き形式だけをbackupとして認め、app:movie30を認めない。実際のexportPackageを抽出して架空stateで実行し、restore/legacy-v23判定がreject/unknown-packageになることを確認。前工程の「旧backup互換」はテストで作ったtype付き形式だけに対する結果だった。通常アプリの実出力をfixtureにした契約テストが必要。

**P1・同期のフィールド抽出でpolicyが消える。** app-core.js:5767 livePayloadはstateを許可した項目だけで作り直し、scorePolicyを含めない。架空stateへbalanced-v1を付けて現関数を実行すると、出力にpolicyはなく、sync/legacy-v23ゲートはacceptとなった。ネットワークは使っていない。これを「攻撃」や本番で既に破損している証拠とはしないが、payload生成後だけの検査では保護できない。送信前には元stateのpolicyと実行プロファイルを検査し、変換によってpolicyが消える場合は拒否する必要がある。旧形式へmarkerを無条件追加する修正や、新同期形式の決定は今回行わない。

## 現ゲート外の入口と検査位置

|入口|現コード|必要な位置・注意|
|---|---|---|
|手動JSON復元|core:471 obj.state抽出→policy比較→:479以降バックアップ/合成→:497 state代入|外側を残したobj全体を最初に判定。既存policy検査・checksum・退避は維持。reject/migration-requiredはいずれも副作用前に停止|
|localStorage/IDB起動候補|core:131 movie30Candidate、:138以降load、:178–187復元|候補解析直後、normalize/選択前。互換性違反を単なる候補なしにして古い候補やliveへ黙ってフォールバックしない|
|保存版HTML/embedded|core:147 EMBEDDED_STATE|ValidStateだけの入口。候補追加前の判定が必要。先に外側を捨てて埋込む場合は元の検査契約も必要|
|部分保存補完|core:195–203|部分stateは現ゲートに渡すと構造不正になる。入口を一括差替えせず、元記録のpolicyと合成後stateを別途確認。今回は触らない|
|live-state初回取得（pull）|core:211–214|live全体を保持してschema/由来/policy確認後にstate抽出。現gate startupはbareだけなのでlive envelopeをそのまま渡しても拒否される。専用アダプタの設計が先|
|別タブ受信|core:96–98 receipt.json→candidate→normalize|現行の編集元・未保存編集・完全性保護を残し、候補採用前にpolicy確認|
|GitHub送信元/リモート取得/PUT|core:5767–5778 livePayload、:5825 remote検査、:5827–5845 SHA比較・PUT|送信元stateをpayload生成前に確認。リモートは外側を検査。SHA/cloudBase・失われたPUT応答の再確認は維持。取得は編集元照合であり、これ自体を汎用pull採用と呼ばない|
|復旧・履歴等の再適用|core:229以降の順位復旧、:6025付近の履歴適用等|このレビューでは全呼出先を網羅していない。起動・同期ガードだけで全採用経路が覆われたとは扱わない|

## markerの扱いと副作用

preview-only外側typeはstate抽出前に拒否する。同policyでも拒否。unknown/null policyは拒否。typeが付いたままstateへコピーされた場合はbare側のapp/type検査も拒否。外側を先に剥がすと出自が消えるため、その後のゲートで元のtypeを復元しようとしない。

外側typeとpolicyを両方削除されたbare JSONは、正しい旧JSONと識別不能。件数・ファイル名・日時で推測しない。通常旧JSONの後方互換を維持する以上、この制約は残る。保存先・同期先分離、固定ファイルの明示取込、旧版との並行編集の扱いが必要。

assessはDOM、保存、同期、state代入を行わず、入力を変更する記述もない。NodeでJSON.parseした通常オブジェクトを想定する。任意のgetter/Proxy等の実行可能オブジェクトを安全に扱う保証はない。返すacceptは種類と主要構造の適合だけであり、データの完全性・順位の正当性・公開許可・移行確定ではない。モジュール自体のglobal登録以外に起動処理はない。

## 次Sol工程：正常バックアップ互換＋手動復元だけ

1. 現行exportPackageの実出力を架空stateで生成し、restoreゲートの互換性失敗を先に示す。確認できたapp:movie30/version13を明示的に許可する。type付きbackup/bareも保持。未知versionを無条件許可せず、必要な旧versionはコード根拠/架空契約を調べてから追加する。
2. restorePackage入口にobj全体のゲートを接続。拒否表示だけ行い、confirm・openMovie30Db・before-import書込・state変更・save/renderへ到達させない。migration-requiredも今回は拒否で、変換や移行を始めない。
3. 架空ブラウザ失敗テスト：実exportPackageの正常往復、同policy preview-only、異policy/未知/null、拒否時のメモリ・localStorage・IDB current/previous/before-import不変。preview UIの正常fixtureと通常legacyを区別する。新帯起動の有効化はしない。
4. 既存data-contractのJSON復元ケースと入口判定テストを実行。全回帰の重複実行は不要。この工程で起動・同期・別タブまで接続しない。

今回の確認は関連ソース読み取りと、抽出したexportPackage/livePayloadの小さなNode VM実行。全回帰・ブラウザ入口全体・実機・GitHub API・本番データは検証していない。新形式・自動統合方針・移行確定は未決定。本レビューは文書のみ。
