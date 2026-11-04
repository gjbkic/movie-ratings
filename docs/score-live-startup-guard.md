# 初回live-state採用の点数帯ガード

2026-10-20。ローカルに採用可能な保存候補がない初回起動だけを対象に、`live-state.json` の外側形式とstateの点数帯を、state代入前に判定する。正常な無印旧形式は従来どおり採用。preview-only、新帯、null、不明なpolicyは採用せず、既存の復元失敗・保存停止経路へ進む。

`__movie30StorageReady` がfalseを返した場合は、同期の`cloudBase`を初期化しないようにした。復元失敗から編集元が確認済みであるかのように扱わないための付随変更。

架空740作品の隔離Chromeで、修正前にpreview-onlyが`live-state`として採用される失敗を再現。修正後、preview-only・balanced-v1・null・不明policyを拒否し、旧形式は採用する5件が成功した。実データ、資格情報、実GitHub通信は使用していない。

今回のテストはローカル保存記録のある起動、IDB current/previous、partial補完、別タブ受信、復旧・履歴適用までは検証していない。loadの書込テストやDB作成は取得前に実行されるため、起動前からの保存領域全体の完全不変は主張しない。新帯の有効化もしていない。
