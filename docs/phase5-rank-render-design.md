# ランキング描画の分離設計（基準98b337c）

## 更新を省略できない条件

|入力|必要な更新|
|---|---|
|点数、星、同点内順位、追加・削除|スコア帯・未採点欄・件数・順番|
|検索、カテゴリ、構造分類、v66の数値/ジャンル、v93の人物/TMDB条件|表示集合、条件表示、ジャンプ操作|
|タイトル、年、分類、メタデータ|カード文言、検索一致、装飾|
|後着ポスター・人物情報|画像と人物表示。必要なら検索一致も再評価|
|空の点数枠、表示モード|空欄・ランキング/鑑賞履歴の構成|
|ドラッグ状態|既存の描画抑止、ゴースト、保存後の位置復帰|

allFilmsの配列や作品IDだけの一致では更新不要と判定できない。renderRankの末端だけをキャッシュすると、詳細検索の条件表示、後続装飾、検索解除後のドラッグが更新されない危険がある。

## 今回の限定変更

app-core.jsの基礎renderRankだけ、未採点パネルと星別セクションをDocumentFragmentへ追加し、rootへ一括追加する。rootを空にする時点、検索判定、スコア並び、個々のマークアップ、ハンドラ登録、後続ラップ順は維持。部分再描画、キャッシュ、保存変更は導入しない。

ui-profileの前後で全state不変。反復ランキング3回のchildList通知が各3699→3691、検索96→95、解除3700→3692。属性数は不変。詳細の測定値も同じ。これは通知数の小幅な削減で、体感速度や大幅高速化を保証しない。大半は後続の装飾処理に残る。

## 次の実装単位（Sol中で実施可能）

1. 基礎renderRankのDOM生成をapp-rank-view.jsへ同じ呼出し位置で抽出する。初回はキャッシュしない。入口のBulkBoot/dragCtx判定とゴースト後始末はcoreに残す。
2. 依存関数は引数で渡す。allFilms/match/filmCategory/effectiveScore/filmStar/rankSorted/scoreListForStar/displayTitle/secondaryTitle/stars/esc、およびSTAR_ORDER、showEmpty、検索文字/カテゴリ/advanced判定を明示する。移動時は値の取得順序と参照を維持し、DOMのID・class・data属性を変えない。
3. 未採点ボタンのopenSheet、rank-editの伝播停止、startDragは既存と同じノード・時点へ結び付ける。rootへの確定後に既存後続ラップが走る契約にする。HTMLスナップショットにも新モジュールを含める。
4. 基準関数を保存し、架空740作品で新旧のカードID順・点数帯件数・未採点・文字・イベント操作を比較する。入力の同一配列内変更（点数/順位/タイトル）も比較し、古い表示を使い回さないことを確認する。
5. 抽出後、annotateTypes/fixSeriesPills/annotateRawGenres/annotateStructuredを一つずつ調べる。DOMを作ってから上書きする処理を基礎テンプレートへ移せるか、実際の差分とテストで判断する。

全体ラップの一括削除、監視の一括解除、保存・同期の分離はこの単位に含めない。次の大きなDOM再利用の導入は、上記の比較結果を得てから別途設計する。

検証結果：advanced-search、filtered-ui、search-drag、drag-touch、pending-posters、html-snapshotの6スイート成功。全35再実行・iPhone実機確認は未実施。main・本番・実データは未変更。第⑤全体の完了ではない。
