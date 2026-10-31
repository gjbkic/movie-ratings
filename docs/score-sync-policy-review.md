# 同期の点数帯判定レビュー

2026-10-20、b288cdb基準。読み取りレビューのみ。新帯activated:falseを維持する。score-entry-gate.mdの「未接続」は作成時点の記述で、現在は手動復元だけ接続済み。

## 確認した経路と重大点

- **P1：送信元の識別情報が落ちる。** app-core.js:5769 `livePayload` はstateの項目を列挙して新しいstateを構築する。scorePolicyを含めないため、balanced/null/未知でも外側はmovie30-live/schema2、中身は無印になる。送信payloadだけをgateに渡しても旧形式として許可される。既存レビューで架空stateによる再現済み。新しい本番破損を観測したという意味ではない。
- **P1：処理待ち中のpolicy変更を指紋が検出しない。** :3066 `fpV29` もscorePolicyを除外する。:5836の送信直前再確認はデータ指紋とmetaFpを使うため、policyだけが変化しても検出しない。:5854の再同期判定もlivePayloadを使う。これはコード上の抜けであり、今回は並行変更を実行していない。開始時だけのpolicy確認では不十分。
- :5790の起動後cloudBaseは、すでにpolicyを落としたlivePayload().stateから作られる。編集元確認より後にpolicyを確認すると、誤った編集元や送信成功判定に進む可能性がある。
- :5827の取得データ検査はapp/schema/主要state構造のみ。null/未知/新帯policyやpreview-onlyのtypeを拒否しない。検査追加は:5831の応答消失回復、:5835のcloudBase/cloudSha更新より前に行う。
- :211–215の初回live-state読込は別の採用入口。外側app/schemaを確認せず、live.stateを取り出してnormalizeStateへ渡す。これは同期GETによる編集元検証とは異なる。この入口の修正は次の最小工程に含めない。
- :2385 `syncToGithub` は現在 `window.__movie30SyncGithub` に委譲し、未準備時は送信しない。:5860の接続先は `syncMetaCloud`。旧設定ボタン・旧タイマーだけの迂回送信はこの箇所にはない。LetterboxdのputTriggerは別目的のAPIなので対象外。

## 旧形式を維持する接続条件

通常の無印stateはlegacy-v23として扱い、既存payloadへ新フィールドを追加しない。明示legacy-v23も同じ旧帯として扱える。balanced/null/未知は変換やmarker除去で通さず停止する。新帯preview実行フラグが立つruntimeも同期停止する。外側typeとpolicyを既に両方除去した無印stateを、正当な旧stateと区別できない制約は残る。

送信元判定には変換前stateを使う。現在のgateのsyncルートはlive envelope専用なので、bare stateをそのまま渡して全正常送信を拒否しないこと。例えば純粋な同期アダプタで `{app:'movie30-live',schema:2,state:source}` を検査し、runtimeを明示する。この仮のenvelopeを送信payloadとして使わない。主要構造検査と既存完全性検査は別の役割。

開始時に元state/runtimeを検査し、不適合ならネットワーク前に停止する。GET後はremote外側全体を検査し、不適合なら既存protectCloudで原文を保持する。元state/runtimeを再度検査してから既存の競合・指紋確認へ進み、PUTまたは同期済み記録に進む。awaitの間にpolicy変更が起きうるので、PUT応答後にも不適合stateを「同期しました」と表示しないこと。送信済みの旧版の結果と現在版の未同期状態を区別する。

既存のSHA、cloudBase、cloudAttempt、同一blob取得、応答消失後の照合、保存停止・別タブ競合・未完了保存による中止を置き換えない。policy判定のacceptは競合解消の証拠ではない。拒否時に同期済み指紋/時刻を書かず、ローカル映画データを変更しない。ローカルpolicy拒否とリモート差分の保護表示を区別し、取得していないremoteのJSON保存ボタンを作らない。

## 次のSol最小工程

同期pushの元stateと取得remoteのpolicy拒否に限定する。livePayloadの出力形式、起動pull、移行確定は変更しない。まずcloud-fixture.cjsとsync-retry.cjsの隔離基盤を再利用し、以下を失敗先行で確認する。

1. 元stateがbalanced/null/未知、またはpreview runtimeならGET/PUTなし。state、保存データ、同期済み指紋不変。
2. 正常な無印旧stateは既存payloadと同じ内容で通常同期可能。
3. GETでbalanced/null/未知/preview-only remoteを返すとPUTと同期済み記録なし。取得原文を退避できる。
4. GET待ち中にpolicyだけ変更するとPUTなし。PUT待ち中の変更は現在版の同期成功と誤表示しない。
5. 既存の別端末差分拒否とPUT応答消失回復の関連テストが引き続き通る。

全面テストは不要。今回は関連ソースを確認した文書のみで、新たなブラウザテスト、同期API実行、実データ参照はしていない。同期ガードの実装完了・公開可とは判定しない。
