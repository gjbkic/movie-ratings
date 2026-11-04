# 第1段階：回帰テストとデータ保護

基準は main `2592791c9575`（20261014h を含む、2026-10-14取得）。iPhoneの現在のデータを正とし、過去の721件へ戻す作業は行わない。本PRはアプリコード、保存形式、移行処理、公開設定、live-state・復旧JSON・RSS・TMDBデータを変更しない。

第2段階①の追記: MULTITABはPR #6で正常回帰へ移行。以下の既知問題表は第1段階時点の記録であり、現在の詳細は [phase2-multitab-review.md](phase2-multitab-review.md) を参照。残り4件は未修正。

## 実行

Node 22以上を使用する。

```sh
npm install --no-save --no-package-lock playwright@1.56.1
npx playwright install chromium
node scripts/regression/run.cjs all
node scripts/regression/run.cjs data-contract
```

`CHROME_PATH` でChrome実行ファイル、`PLAYWRIGHT_MODULE` で既存Playwrightパッケージを指定できる。`MOVIE_APP_ROOT` に別チェックアウトを指定すれば、同じテスト・同じ架空データを新旧コードへ適用できる。現時点の初期データ宣言形式・DOM契約が違う場合は明示的に失敗する。

Windowsの制限された実行環境では、通常の一時コンテキストは動いても、永続プロファイルのIndexedDBが `UnknownError: Internal error opening backing store` になることがあった。プロセス再起動テストは、専用の一時プロファイルにディスクアクセス可能な環境で実行する。失敗をスキップ・成功扱いにしない。

結果はgitignore対象の `test-results/*.json`。本番作品・レビュー・画像は含めない。テストごとに4分の上限を設け、失敗後も残りを実行して全体結果を記録する。

## 隔離の境界

- 740件の架空作品をコードから生成。実際のlive-state・復旧JSONをfixture生成に利用しない。
- ブラウザは新しいコンテキスト／専用一時プロファイルのみ。通常のユーザープロファイルや公開アプリを開かない。
- 全HTTPリクエストを捕捉。許可された架空origin／既存テストのlocalhost URLにもネットワーク転送せず、明示した静的ファイルまたは架空JSONを返す。外部APIはテスト固有のモックか遮断。
- 配信応答内の `BASE_FILMS` データのみ空配列に差し替え、架空作品を保存状態から読む。アプリの関数・分岐や実ファイルは変更しない。
- Letterboxd自動同期、GitHub自動同期は初期状態で無効。同期試験のトークンは無効な文字列で、API応答も完全モック。
- リカバリーURLにも架空の参照を返す。歴史的な修復内容の正しさを今回のテスト合格条件にしない。
- CIは `contents: read`、checkout資格情報を残さず、同期ワークフローを呼び出さない。アプリコード・テスト・workflowの変更で実行し、データだけの同期コミットでは起動しない。
- テスト後に追跡ファイルの差分を検査。アーティファクトは要約JSONのみ。

## テスト一覧・対象・起動条件

以下は新しい `movie-regression.yml` でPR、対象ブランチpush、手動実行時に共通実行する。旧7ワークフローは手動の個別入口として残し、同じ実装を呼ぶ。

| suite | 出所・検証内容 | 主な対象 |
|---|---|---|
| data-contract | 新規9テスト。740件、キーなし/null/0/星のみ、全文往復、非表示順位の固定位置、容量不足・両保存先失敗、破損候補、部分順位拒否、JSON復元、シーズン評価、追加編集削除、ブラウザプロセス再起動 | core、seasons、detail-layout |
| star-editor | 既存YAMLから移設。星0/4.5、数値空欄、星だけで順位を作らない、再読込、採点済み星readonly | core |
| unrated-panels | 既存YAMLから移設。2グループ・独立開閉・永続化。通常ランキングへの遷移と再読込後の点数帯全順序も追加 | core、unrated-panels |
| detail-unified | 既存YAMLから移設。点数/時間重複なし、順位、旧種別/取得ボタン非表示、分類編集、レビュー・履歴欄、再読込 | detail-layout、core、seasons |
| filtered-ui | 既存スクリプトの検証本体を移設。実際の詳細絞込→↑↓アニメーション→非表示順位保護→再読込 | core、enhancements |
| drag-touch | 既存YAMLから移設。CDP touchによる浮遊カード、移動、保存、↑↓アニメーション。再読込比較を追加 | core、enhancements |
| long-drag | 既存YAMLから移設。上下端で保持、連続スクロール、ドラッグ終了、通常スクロール復帰。再読込比較を追加 | core |
| search-drag | 既存YAMLから移設。検索中の実タッチ、検索解除、浮遊表示から位置復帰。再読込比較を追加 | core、enhancements、search-stability |
| search-registration | 既存YAMLから移設。検索クリア、候補ポスター実タッチ、映画/TV同番号ID、登録保存、未採点TV・シーズン欄。ブラウザ例外を失敗扱いに強化 | remote-add、enhancements、seasons、search-stability、unrated-panels |
| letterboxd | 新規。実ネットワーク入口に架空RSSを返し2回同期、CSVも2回。重複防止・数値点数・順位・手動レビュー・履歴・シーズン評価を保存後に検証 | core、enhancements |
| known-issues | **安全性の合格ではなく既知問題の再現**。下記4不具合と5重取得を確認 | core、enhancements、people、cast-resolver |

既存の `scripts/test-filtered-ui.cjs` は互換入口として新実装を呼ぶ。他の旧スクリプトは削除しない。

| 既存資産 | 旧実行条件・今回の扱い |
|---|---|
| movie-star-editor / unrated-panels / detail-unified | それぞれのYAML・一部JS・indexのpushに限定されていた。今回共通ゲートへ移設 |
| movie-drag-touch / search-drag | 主に自身のYAML・index変更時のみだった。JSだけの変更も共通ゲートで検査 |
| movie-long-drag | core・index・自身のYAML変更時。共通ゲートへ移設 |
| movie-search-registration | 一部の追加JS・index・自身のYAML変更時。共通ゲートへ移設 |
| movie-ui-diagnostic | 自身のYAML変更・手動。故障解析用として未変更、必須ゲートにはしない |
| test-persistence.cjs / test-recovery.cjs | 手動。過去コミットや721件・追加作品145件固定、実live-state依存。現在データの正解判定に利用しない。歴史的再現用として残す |
| test-people.cjs / test-cast-bulk.cjs | 手動、実データ依存、Windows Chromeパス固定等あり。今回の共通ゲートへ未統合。人物ページ全経路・一括取得の将来の架空fixture化候補 |
| test_cast_resolver.py | 手動。APIモックの単体検査と実カタログ件数依存が混在。今回未変更・未統合 |
| sync-letterboxd-on-push | トリガーファイルpushでデータ更新。今回未変更・呼出なし |
| update-letterboxd | 手動のデータ更新。今回未変更・呼出なし |
| update-tmdb | 週次、手動、指定updater変更時にデータ更新。今回未変更・呼出なし |

作業前にGitHub上でも旧7回帰ワークフローの直近成功を確認した。例：詳細 `38461598546`、星 `38460935480`、未確定 `38460934999`、ドラッグ `38460935192`、長距離 `38460935236`、検索移動 `38460935081`、登録 `38460935247`。これらは本PRのCI結果とは区別する。

## 再現できた問題（今回修正しない）

`known-issues` の結果は `known-defects-reproduced` と記録する。終了コード0は「期待どおり問題が再現した」の意味で、安全・修正済みの意味ではない。問題が直った場合は再現テストが失敗するので、次段階で正常動作の契約テストへ置換する。通常テストの失敗をこの区分に自動変換しない。

| ID | 条件と観測 | 次段階 |
|---|---|---|
| DUPLICATE-EPISODE | Hang the DJ相当の同年重複、片方未採点、メモ/履歴なし、異なるURIで `sameEnglish` ReferenceError | 優先修正。識別条件を固定し、異なる作品を誤って隠さない検査も追加 |
| HTML-SNAPSHOT | 現在の外部JS構成でsnapshotHtmlを呼ぶと埋込位置エラー | 単体HTMLとして何を保持するか仕様確定後に修正 |
| MULTITAB | 別タブから、更新日時だけ新しく完全な形を持つ無署名の空作品・空順位が届くと、起動時検査と違い状態全体が置換される | 最優先。未保存編集・欠落検査・版の競合を統一。複数実端末の検証は別途必要 |
| SYNC-RETRY | GitHub PUTを503にすると、同期指紋だけ記録され、同じ内容のsaveでは再予約されない | 成功時のみ指紋確定、失敗の再試行状態を分離 |
| CATALOG | 通常起動で同じメタデータへ5回要求（表示、候補、絞込、出演者、人物）。前回の4系統は人物分を含んでいなかった | 共有Promise/カタログへ統合。時間短縮率は未測定 |

新規の数値採点では、即座にrankOrderへIDが追加されず `rankSorted()` のフォールバックで表示順を決める経路がある。テスト開発中の「採点済みIDは必ず配列内」という仮定は現行仕様と一致しなかった。現在は通常ランキングへの表示、点数帯全体の実効順序、再読込後の同一性を検証する。既存の保存順位配列・非表示作品の位置検査は維持している。

## 未検証と限界

- 実機iPhone Safari、ホーム画面追加版、OSによる領域破棄、強制終了のタイミング、実キーボード収納は未検証。Chromiumのモバイル画面・CDP touch・プロセス再起動を代替と表現しない。
- 外部API・GitHub実同期はモック。実アカウント、実トークン、複数の物理端末間の競合を試していない。
- JSONの生成・構造・復元・再読込は検証するが、Safariでのファイル保存ダイアログや実ファイルダウンロード完了は未検証。
- 人物画面の全機能、ポスター拡大の全閉じ方、出演者一括取得の旧全シナリオは、この第1段階の新共通ゲートでは未網羅。既存テストは保存している。
- 実作品タイトルやTMDB照合の網羅性は架空fixtureでは証明しない。保存容量も無制限に保証しない。
- ブランチ保護の必須チェック設定はリポジトリ管理設定なので変更していない。

## 次段階の順序

1. 今回のPRレビュー。テストのみであり、アプリ修正や公開の承認とは扱わない。
2. 別タブ競合・同期成功判定・未定義参照を、それぞれ独立した修正PRと正常契約テストで扱う。
3. 人物・出演者旧テストの架空fixture化、iPhone実機の確認手順整備。
4. TMDBカタログ5重取得を共有化。取得数・解析数と初期表示時間を測る。
5. `movie30ArchiveStartup` の未使用ハッシュ計算、作ってから消す旧未採点パネル、複数sticky計算を個別に整理。見えている新パネルやタッチ補正は維持。
6. `save` の履歴コピー/同期指紋計算、タブ切替の全文保存、`render` と `renderRank` の補正走査を分離。保存形式変更は別承認。

## 次のWorkへの引き継ぎ

> gjbkic/movie-ratings の codex/phase1-regression-safety ブランチとPRを確認してください。テスト基盤のみで、main・本番公開・ユーザーデータは未変更です。最新mainとの差分を取得し、同期JSONの変更とアプリコード変更を区別してください。iPhone上の現在の点数・順位が正しく、721件の過去復旧を再適用してはいけません。docs/phase1-regression.md の実行手順と既知問題一覧を読み、scripts/regression/run.cjs で検証してください。known-issuesは不具合再現の確認であり修正済みではありません。今回許可された範囲を確認してから次段階へ進み、承認なしのmerge・公開・保存データ修正はしないでください。
