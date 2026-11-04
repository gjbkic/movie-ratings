# 第④段階①：作品参照と表示名の純粋関数分離

基準は統合667cade＋iPhone詳細表示修正697e6e4。main/既存PRブランチ/実作品データは変更しない。

app-film-queries.jsにfilmById、titleInfo、displayTitle、secondaryTitle、filmCategoryを分離。app-core.jsの既存グローバル関数は入口として残し、呼出し時点のallFilms()/stateを明示的に渡す。キャッシュは持たず、復元によるstate置換や作品追加・削除を次回呼出しから反映する。filmByIdは現在のallFilmsラップを通した結果から最初の一致を返す。

タイトルは手動設定のnullish優先、空文字、英題/原題、Letterboxd題名、無題、TMDB ID0を従来通り扱う。カテゴリ0を含む変換を保持。スコア・星・順位計算、保存、検索イベント、allFilmsの既存ラップは変更しない。今回はコード境界の整理で、速度改善は主張しない。

697e6e4の対象5関数だけをfilm-queries-baseline.txtへ凍結。実作品レコードを含まない。同じ架空740作品と空/null/0/false/手動情報の入力に対し、新旧の結果と非破壊性を比較する。ID重複時の先勝ち・不明ID、state置換、手動タイトル/カテゴリ変更、保存と再起動も検証。

順位計算は別作業。effectiveScoreは後続上書きがあり、null/0/未採点の意味とフィルタ中順位を維持する設計レビューを先に行う。allFilmsの無条件Map化は現行ラップ・重複ID先勝ち・削除・復元を壊す危険があるため行わない。

この枝は統合ローカルを基準とし、PR9独立枝へは直接pushしない。既存PRマージ前のmain向けPRとしても扱わない。検証サイトはv6のままで、この計算分離は未配信。

検証結果：node scripts/regression/run.cjs all の19正常スイートが全成功。追加2件、MULTITAB18、保存9、同期競合9、同期再試行5、下スワイプ/同期保存5を含む。構文チェックとgit diff --check成功。保護対象JSON差分なし。
