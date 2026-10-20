# 起動時live-state採用の限定レビュー

2026-10-20、6da965e基準。コード・テスト変更なし。既存入口文書の「未接続」は記述時点の状態であり、現在は手動復元とGitHub pushにガードがある。新帯activated:false。

## 候補選択

app-core.js:131 `movie30Candidate` はJSONと主要構造・checksumを検査するがpolicyは検査しない。元stateとjsonは保持する。:138のlocalStorage読込は原文をstartup archiveへ追加し、:149でIDB確認より先に暫定stateを代入する。:178のIDB current、:180のpreviousも同じcandidateを使う。:147 embeddedは構造だけで採用候補に入る。

`normalizeState`（:14）は元stateをspreadするため、scorePolicyを削除しない。しかし保持は適合性の証明にならない。:108 `movie30ChooseCandidate` もpolicyを比較せず、順位・作品・レビューの欠落を基準に候補やメタデータを合成する。異なるpolicy間の比較をさせない検査が必要。

部分state補完（:194–203）は型不完全な記録から作品・オブジェクトを補う。文字列policyは補完対象から自然に外れるため、新帯の部分記録が無印旧stateへ混ざる余地がある。完全state用gateをただ適用してpartialを落とすと、正当な追加作品やレビューの回収を失う。ここは別設計が必要。

## 取得・採用の順序

初回live-state採用は `movie30RestoreStorageLocked` :207–219。候補がなく、非補助のローカル記録もないときだけfetchする。`live.state` の構造確認後、外側を捨て、updatedAtをsourceUpdatedAtから作ってnormalize/代入する。外側app/schema/type、policyは未検査。preview-onlyでも中身の形が正常なら通る。成功時のみ:222でlastSavedJson設定、:223で順位復旧へ進む。

GitHub Contents APIのGET（`syncMetaCloud` :5820以降）はpush先の編集元照合であり、remote.stateをアプリstateへ取り込む汎用pullではない。今回追跡した範囲に、これ以外のGitHub評価データpull採用関数は見つからなかった。初回の相対URL fetchと混同しない。

1MB超のencoding:noneでは、最初のSHAを固定してgit/blobs/<sha>を取得し、返却SHA一致後にbase64/UTF-8/JSON/構造/外側policyを検査する（:5823–5834）。次に元state policyを再確認する。これらの拒否ではcloudBase/SHAは更新されず、remote原文をprotectCloudで保存できる。その後は応答消失照合→競合判定→初回cloudBase/SHA設定→ローカル指紋再確認の順。したがって通常編集による中止でもcloudBaseが更新される既存ケースはあり、「あらゆる中止で基準値不変」とは言えない。

PUT成功後は返されたSHAと送った版を基準に記録してからpolicyを再確認する（:5854–5856）。新帯への変化を検出すると同期済み指紋・成功表示は止まるが、送信済み旧版のcloudBase/SHAは更新済み。この扱いはremoteへ実際に送った版の記録であり、無送信の拒否とは区別する。

## 次Solの安全な入口1つ

対象を**初回live-state採用**だけにする。:213の手前で元envelope全体を検査し、acceptのときだけ既存構造検査・state代入へ進む。startup routeはbare専用なのでlive envelopeをそのまま渡すと正常JSONまで拒否する。専用live-startupアダプタで外側movie30-live/schema2と旧runtimeを確認するか、現sync判定を読取専用の互換検査として利用する。送信処理を呼んではいけない。無印旧stateと明示legacyは許可、新帯・null・未知・preview-onlyは拒否する。

拒否は現在のcatch経路へ送り、RecoveryBlockedと失敗表示を設定し、lastSavedJson更新・順位復旧へ進ませない。同期基準値も守るには:5790のStorageReady.thenがfalse解決でもcloudBaseを作る点を合わせて修正し、復元成功かつ適合stateの場合にだけ基準を設定する。これは入口処理の失敗伝播に必要な最小の付随変更。

「起動前から保存領域全体が一切不変」は現状のload内書込テスト、VIEW読込、IDB作成、startup archive、:167のdiskBase取得により保証できない。拒否直前を比較基準にし、映画snapshotのcurrent/previousと既存LS原文、現在の映画state、同期基準値に拒否候補由来の変更がないことを検証する。フラグ・警告表示など意図した変化は分ける。

必要な失敗先行fixtureは、空の架空originでlive取得を保留して拒否前状態を採取→preview-only/新帯/null/未知を返す→state未採用・保存停止・同期成功記録なし。正常無印740作品は従来通り採用する。既存ローカル正常snapshotがある場合はliveを要求しない。実GitHub・実データは使わない。localStorage/IDB候補、partial補完、別タブ、復旧・履歴はこの次工程には含めない。

今回の根拠は関連コードの読み取りのみ。新テスト、実通信、実機確認は行っていない。
