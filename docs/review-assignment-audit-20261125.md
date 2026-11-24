# 感想欄の誤紐づけ監査（2026-11-25）

対象データ: 2026-11-24T19:57:11.174Z。全867作品、感想あり776作品。
過去112版のRSSから228件の原本を復元。保存済み117レビューIDは全件原本に照合。現存する混入は68作品・124組（作品×レビュー）。

## 原因

旧取り込みが作品一覧とRSS XMLを配列番号で結合していた。前段では★なし作品を除外（Number.isFinite(r)&&r>=0.5）するが、後段のXML配列では除外しないため位置がずれ、別作品のレビュー本文・GUIDが付与された。既存メモへ追記する実装で混入が蓄積し、手編集保護が混入部分も残した。

10月31日の修正 48f2f5916ee84a363bd838db7a24cccbbe4843a4 で配列番号結合をURL・タイトル年・ID照合に変更済み。ただし既存の混入本文を取り除く移行処理はなかった。

## 現存する混入の全一覧

| 混入先の感想欄 | 本来の作品（原本の作品名） | レビューID |
|---|---|---|
|ハクソー・リッジ|ネットワーク|letterboxd-review-1548243593|
|怒り|秒速5センチメートル|letterboxd-review-1523149890|
|ドラゴンボール超 ブロリー|怒り|letterboxd-review-1523033962|
|鬼滅の刃|ドラゴンボール超 ブロリー|letterboxd-review-1522095691|
|ドラゴンボールZ 神と神|鬼滅の刃|letterboxd-review-1522093506|
|秒速5センチメートル|呪術廻戦|letterboxd-review-1523384888|
|秒速5センチメートル|THE BATMAN－ザ・バットマン－|letterboxd-review-1523432514|
|THE BATMAN－ザ・バットマン－|狼たちの午後|letterboxd-review-1527147732|
|THE BATMAN－ザ・バットマン－|マネーボール|letterboxd-review-1527260886|
|呪術廻戦|THE BATMAN－ザ・バットマン－|letterboxd-review-1523432514|
|呪術廻戦|狼たちの午後|letterboxd-review-1527147732|
|狼たちの午後|マネーボール|letterboxd-review-1527260886|
|狼たちの午後|サブスタンス|letterboxd-review-1527314714|
|マネーボール|サブスタンス|letterboxd-review-1527314714|
|マネーボール|容疑者 室井慎次|letterboxd-review-1527410502|
|サブスタンス|容疑者 室井慎次|letterboxd-review-1527410502|
|サブスタンス|世にも奇妙な物語 '26夏の特別編|letterboxd-review-1527414969|
|世にも奇妙な物語35周年SP 秋の特別編|世にも奇妙な物語35周年SP ～伝説の名作 一夜限りの復活編～|letterboxd-review-1527435634|
|世にも奇妙な物語35周年SP 秋の特別編|世にも奇妙な物語 '24冬の特別編|letterboxd-review-1527442877|
|世にも奇妙な物語35周年SP ～伝説の名作 一夜限りの復活編～|世にも奇妙な物語 '24冬の特別編|letterboxd-review-1527442877|
|世にも奇妙な物語35周年SP ～伝説の名作 一夜限りの復活編～|シュレック|letterboxd-review-1527595314|
|世にも奇妙な物語 '24冬の特別編|シュレック|letterboxd-review-1527595314|
|世にも奇妙な物語 '24冬の特別編|Zootopia+|letterboxd-review-1527604345|
|容疑者 室井慎次|世にも奇妙な物語 '26夏の特別編|letterboxd-review-1527414969|
|容疑者 室井慎次|世にも奇妙な物語35周年SP 秋の特別編|letterboxd-review-1527422553|
|世にも奇妙な物語 '23夏の特別編|世にも奇妙な物語 '22秋の特別編|letterboxd-review-1527669748|
|世にも奇妙な物語 '23夏の特別編|世にも奇妙な物語 '22夏の特別編|letterboxd-review-1527670832|
|世にも奇妙な物語 '23夏の特別編|世にも奇妙な物語 '22秋の特別編|letterboxd-review-1527634938|
|ズートピア＋|世にも奇妙な物語 '22秋の特別編|letterboxd-review-1527634938|
|ズートピア＋|世にも奇妙な物語 '23秋の特別編|letterboxd-review-1527666410|
|ズートピア＋|世にも奇妙な物語 '22夏の特別編|letterboxd-review-1527670832|
|ズートピア＋|世にも奇妙な物語 '24夏の特別編|letterboxd-review-1527461283|
|シュレック|Zootopia+|letterboxd-review-1527604345|
|シュレック|世にも奇妙な物語 '22秋の特別編|letterboxd-review-1527634938|
|シュレック|世にも奇妙な物語 '22夏の特別編|letterboxd-review-1527670832|
|世にも奇妙な物語 '22秋の特別編|世にも奇妙な物語 '23秋の特別編|letterboxd-review-1527666410|
|世にも奇妙な物語 '22秋の特別編|世にも奇妙な物語 '21夏の特別編|letterboxd-review-1527672976|
|世にも奇妙な物語 '22秋の特別編|世にも奇妙な物語 '23夏の特別編|letterboxd-review-1527667717|
|世にも奇妙な物語 '22秋の特別編|世にも奇妙な物語 '24夏の特別編|letterboxd-review-1527461283|
|世にも奇妙な物語 '21夏の特別編|世にも奇妙な物語 '24夏の特別編|letterboxd-review-1527695582|
|世にも奇妙な物語 '21夏の特別編|世にも奇妙な物語 '21秋の特別編|letterboxd-review-1527712560|
|世にも奇妙な物語 '24夏の特別編|世にも奇妙な物語 '21秋の特別編|letterboxd-review-1527712560|
|世にも奇妙な物語 '24夏の特別編|ブラック・ミラー「国歌」|letterboxd-review-1528433518|
|世にも奇妙な物語 '21秋の特別編|ブラック・ミラー「国歌」|letterboxd-review-1528433518|
|世にも奇妙な物語 '21秋の特別編|ブラック・ミラー「1500万メリット」|letterboxd-review-1528519693|
|ブラック・ミラー「国歌」|ブラック・ミラー「1500万メリット」|letterboxd-review-1528519693|
|ブラック・ミラー「国歌」|ブラック・ミラー「人生の軌跡のすべて」|letterboxd-review-1528552817|
|ブラック・ミラー「1500万メリット」|ブラック・ミラー「人生の軌跡のすべて」|letterboxd-review-1528552817|
|ブラック・ミラー「1500万メリット」|ブラック・ミラー「ずっと側にいて」|letterboxd-review-1528714702|
|ブラック・ミラー「ずっと側にいて」|ブラック・ミラー「シロクマ」|letterboxd-review-1528740267|
|ブラック・ミラー「ずっと側にいて」|世にも奇妙な物語 '20秋の特別編|letterboxd-review-1528829250|
|ブラック・ミラー「人生の軌跡のすべて」|ブラック・ミラー「ずっと側にいて」|letterboxd-review-1528714702|
|ブラック・ミラー「人生の軌跡のすべて」|ブラック・ミラー「シロクマ」|letterboxd-review-1528740267|
|世にも奇妙な物語 '20秋の特別編|世にも奇妙な物語 '20夏の特別編|letterboxd-review-1528879786|
|世にも奇妙な物語 '20秋の特別編|世にも奇妙な物語 '19秋の特別編|letterboxd-review-1529941273|
|ブラック・ミラー「シロクマ」|世にも奇妙な物語 '20秋の特別編|letterboxd-review-1528829250|
|ブラック・ミラー「シロクマ」|世にも奇妙な物語 '20夏の特別編|letterboxd-review-1528879786|
|世にも奇妙な物語 '20夏の特別編|世にも奇妙な物語 '19秋の特別編|letterboxd-review-1529941273|
|世にも奇妙な物語 '20夏の特別編|ブラック・ミラー「拡張現実ゲーム」|letterboxd-review-1530087324|
|ブラック・ミラー「拡張現実ゲーム」|ブラック・ミラー「ランク社会」|letterboxd-review-1530090180|
|ブラック・ミラー「拡張現実ゲーム」|ブラック・ミラー「秘密」|letterboxd-review-1530165831|
|ブラック・ミラー「ランク社会」|ブラック・ミラー「秘密」|letterboxd-review-1530165831|
|ブラック・ミラー「ランク社会」|ブラック・ミラー「サン・ジュニペロ」|letterboxd-review-1530254741|
|ブラック・ミラー「秘密」|ブラック・ミラー「サン・ジュニペロ」|letterboxd-review-1530254741|
|ブラック・ミラー「秘密」|ブラック・ミラー「殺意の追跡」|letterboxd-review-1531175356|
|ブラック・ミラー「サン・ジュニペロ」|ブラック・ミラー「殺意の追跡」|letterboxd-review-1531175356|
|ブラック・ミラー「サン・ジュニペロ」|ブラック・ミラー「虫けら掃討作戦」|letterboxd-review-1531262418|
|ブラック・ミラー「殺意の追跡」|ブラック・ミラー「虫けら掃討作戦」|letterboxd-review-1531262418|
|ブラック・ミラー「殺意の追跡」|Hikaru Utada Live Sessions from AIR Studios|letterboxd-review-1531624887|
|ブラック・ミラー「虫けら掃討作戦」|Hikaru Utada Live Sessions from AIR Studios|letterboxd-review-1531624887|
|ブラック・ミラー「虫けら掃討作戦」|Hikaru Utada Laughter in the Dark Tour 2018|letterboxd-review-1531632764|
|HIKARU UTADA SCIENCE FICTION TOUR 2024|ブラック・ミラー「宇宙船カリスター号」|letterboxd-review-1534442741|
|HIKARU UTADA SCIENCE FICTION TOUR 2024|Black Mirror: Hang the DJ|letterboxd-review-1534558654|
|Luv Live|HIKARU UTADA SCIENCE FICTION TOUR 2024|letterboxd-review-1531654548|
|Luv Live|ブラック・ミラー「宇宙船カリスター号」|letterboxd-review-1534442741|
|Utada Hikaru: Wild Life|Luv Live|letterboxd-review-1531651964|
|Utada Hikaru: Wild Life|HIKARU UTADA SCIENCE FICTION TOUR 2024|letterboxd-review-1531654548|
|Hikaru Utada Laughter in the Dark Tour 2018|Utada Hikaru: Wild Life|letterboxd-review-1531646459|
|Hikaru Utada Laughter in the Dark Tour 2018|Luv Live|letterboxd-review-1531651964|
|Hikaru Utada Live Sessions from AIR Studios|Hikaru Utada Laughter in the Dark Tour 2018|letterboxd-review-1531632764|
|Hikaru Utada Live Sessions from AIR Studios|Utada Hikaru: Wild Life|letterboxd-review-1531646459|
|ブラック・ミラー「ブラック・ミュージアム」|All Too Well: The Short Film|letterboxd-review-1535139086|
|ブラック・ミラー「ブラック・ミュージアム」|BOHEMIAN SUMMER ～宇多田ヒカル Circuit Live 2000|letterboxd-review-1535157574|
|Black Mirror: Hang the DJ|ブラック・ミラー「ブラック・ミュージアム」|letterboxd-review-1534621132|
|Black Mirror: Hang the DJ|All Too Well: The Short Film|letterboxd-review-1535139086|
|ブラック・ミラー「宇宙船カリスター号」|Black Mirror: Hang the DJ|letterboxd-review-1534558654|
|ブラック・ミラー「宇宙船カリスター号」|ブラック・ミラー「ブラック・ミュージアム」|letterboxd-review-1534621132|
|All Too Well: The Short Film|BOHEMIAN SUMMER ～宇多田ヒカル Circuit Live 2000|letterboxd-review-1535157574|
|All Too Well: The Short Film|ブラック・ミラー「ヘンリー湖」|letterboxd-review-1535341239|
|ブラック・ミラー「ヘンリー湖」|UH LIVE STREAMING 20代はイケイケ！|letterboxd-review-1536101060|
|BOHEMIAN SUMMER ～宇多田ヒカル Circuit Live 2000|ブラック・ミラー「ヘンリー湖」|letterboxd-review-1535341239|
|BOHEMIAN SUMMER ～宇多田ヒカル Circuit Live 2000|UH LIVE STREAMING 20代はイケイケ！|letterboxd-review-1536101060|
|ブラック・ミラー「ビヨンド・ザ・シー」|ブラック・ミラー「普通の人々」|letterboxd-review-1536661803|
|ブラック・ミラー「ビヨンド・ザ・シー」|ブラック・ミラー「ユーロジー」|letterboxd-review-1536735574|
|ブラック・ミラー「普通の人々」|ブラック・ミラー「ユーロジー」|letterboxd-review-1536735574|
|ブラック・ミラー「普通の人々」|Utada Hikaru: Unplugged|letterboxd-review-1537823838|
|ブラック・ミラー「ユーロジー」|Utada Hikaru: Unplugged|letterboxd-review-1537823838|
|ブラック・ミラー「ユーロジー」|Utada Hikaru in Budokan 2004|letterboxd-review-1538730109|
|Utada Hikaru: Unplugged|Utada Hikaru in Budokan 2004|letterboxd-review-1538730109|
|Utada Hikaru: Unplugged|ブラック・ミラー「宇宙船カリスター号: インフィニティの中へ」|letterboxd-review-1540575757|
|UH LIVE STREAMING 20代はイケイケ！|ブラック・ミラー「ビヨンド・ザ・シー」|letterboxd-review-1536523784|
|UH LIVE STREAMING 20代はイケイケ！|ブラック・ミラー「普通の人々」|letterboxd-review-1536661803|
|ブラック・ミラー「宇宙船カリスター号: インフィニティの中へ」|クレヨンしんちゃん 嵐を呼ぶ モーレツ!オトナ帝国の逆襲|letterboxd-review-1540677847|
|クレヨンしんちゃん 嵐を呼ぶ モーレツ!オトナ帝国の逆襲|タンポポ|letterboxd-review-1542192038|
|クレヨンしんちゃん 嵐を呼ぶ モーレツ!オトナ帝国の逆襲|ハウス|letterboxd-review-1543256393|
|タンポポ|ハウス|letterboxd-review-1543256393|
|タンポポ|別離|letterboxd-review-1543375367|
|ハウス|別離|letterboxd-review-1543375367|
|ハウス|下妻物語|letterboxd-review-1543852049|
|別離|下妻物語|letterboxd-review-1543852049|
|別離|UTADA UNITED 2006|letterboxd-review-1544978774|
|Utada Hikaru in Budokan 2004|ブラック・ミラー「宇宙船カリスター号: インフィニティの中へ」|letterboxd-review-1540575757|
|Utada Hikaru in Budokan 2004|クレヨンしんちゃん 嵐を呼ぶ モーレツ!オトナ帝国の逆襲|letterboxd-review-1540677847|
|Master and Commander: The Far Side of the World|自殺サークル|letterboxd-review-1545533582|
|リバー、流れないでよ|ブギーナイツ|letterboxd-review-1546888727|
|ブギーナイツ|ハクソー・リッジ|letterboxd-review-1547111921|
|ネットワーク|マインド・ゲーム|letterboxd-review-1549214670|
|マインド・ゲーム|リプリー|letterboxd-review-1552093388|
|リプリー|紀子の食卓|letterboxd-review-1552401285|
|嫌われ松子の一生|チェイサー|letterboxd-review-1553934884|
|チェイサー|Steins;Gate|letterboxd-review-1554299401|
|UTADA UNITED 2006|Master and Commander: The Far Side of the World|letterboxd-review-1545261983|
|世にも奇妙な物語 '22夏の特別編|世にも奇妙な物語 '22秋の特別編|letterboxd-review-1527634938|
|世にも奇妙な物語 '23秋の特別編|世にも奇妙な物語 '24夏の特別編|letterboxd-review-1527461283|

## 本文以外に残る誤った登録

| 保存先 | 原本の作品 | 状態 |
|---|---|---|
|世にも奇妙な物語 '22秋の特別編|世にも奇妙な物語 '22夏の特別編|本文に完全一致なし、登録だけ残存|
|custom-1793382511630-rbdf|タンポポ|非表示・統合済み作品の保存記録|

## 調査の範囲と限界

全文一致・正規化一致と原本GUIDに基づく監査。元RSSが残らない古いZIP由来の感想や、手編集で原文と大きく変わった部分は、この方法だけで誤りなしとは保証できない。感想本文の意味だけで強制移動・削除はしていない。採点・順位・感想本文の変更なし。
