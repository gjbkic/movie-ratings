# 点数帯データの入口判定（未接続）

2026-10-20。app-score-entry-gate.jsは入力を読み取って判定だけを返す。index.htmlや保存・起動・同期コードへは接続していない。実データ移行を有効化しない。

入力の外側を、bare state、movie30-backup、movie30-live/schema2、fictional-score-preview-onlyに分ける。routeはrestore/startup/sync/preview、実行側はlegacy-v23/balanced-v1。state.scorePolicyなしは旧形式として後方互換を維持し、null/未知マーカーは拒否。異なる点数帯ならmigration-required。プレビュー外側種別は通常復元・起動・同期へ常にreject。同じbalanced-v1でも例外を作らない。新帯の起動・同期は専用の確定手順/同期先が未実装なのでreject。

正常な旧形式のbare stateとバックアップは旧版の復元・起動でaccept、旧live envelopeは旧版同期でaccept。これは**将来の入口に接続するときの判定契約**であり、現行アプリがこのモジュールを利用しているという意味ではない。入力stateの形は主要項目だけを見る。完全性checksum、順位所属、作品の存在、送信元SHAの検証は既存/将来の別処理が必要。

検証：最初にモジュール未実装で失敗するテストを作成。架空740作品由来の7テストで旧形式互換、同policyのpreview候補拒否、異policy、null/未知、外側種別、起動・同期、正常previewを確認。現行movie30ValidStateを抽出するとpreview候補の中身を受け入れることも比較した。score-policy10件も成功。全回帰・実ブラウザの全入口・実機は未実施。

残るリスク：外側typeやscorePolicyを除いたJSONを、正しい旧データと完全に区別することはできない。ファイル名・日時・件数だけで真偽を決めない。現行restorePackageはobj.stateを先に取り出し、movie30ValidState/起動/同期はこの入口判定を呼ばない。プレビュー候補の誤取込み防止が本番コードで完了したとは扱わない。

次工程では、現行の復元・起動候補・同期の入口を個別に列挙し、判定を通過した後にだけ状態変更や送信を行う構造を設計・実装する必要がある。初めに少数の架空ブラウザ失敗テストで各入口の旧挙動を示す。保存形式変更や自動統合は引き続き対象外。接続前にはAstraで、旧コードや別端末、公開中のバージョンを踏まえたレビューを行う。
