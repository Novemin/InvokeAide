# Google Tasks / Calendar API 実機検証スクリプト

**作成日**: 2026-05-25
**起草者**: Sさん(Sonnet)
**位置づけ**: 技術顧問が公式ドキュメントで確認した 3 観点 + 採用された「notes 構造化記法方式」 の土台確認の **実機 API 裏取り**。 ベータ実装 (B2 OAuth + StorageProvider) 着手前後で実行。
**前提**: OAuth 認証情報(`credentials.json`)+ 検証用 Google アカウント(専用テストアカウント推奨)。

---

## 検証 4 観点

| # | 観点 | 公式ドキュメントでの確認結果 | 実機裏取り |
|---|---|---|---|
| 01 | Google Tasks API の `due` は日付のみで、 時刻情報は破棄される | ✅ 確認済 | `01-verify-due-time-stripped.js` |
| 02 | Google Tasks API の Task resource に `deadline` フィールドは存在しない | ✅ 確認済 | `02-verify-deadline-not-supported.js` |
| 03 | Google Calendar API のイベントレスポンスに `taskSeries` 項目は存在しない | ✅ 確認済 | `03-verify-taskseries-not-in-calendar.js` |
| 04 | `notes` 欄に `[予定時刻:07:30]` のような構造化記法を書き込み・読み取り可能(notes 構造化記法方式の土台) | (新規実機確認) | `04-verify-notes-structured-rw.js` |

---

## 設計方針

### 安全性

- **すべての検証は「作成 → 検証 → 削除」 のセットで実行**(`lib/cleanup.js`)
- 例外発生時も削除を試みる `finally` パターン
- 検証用 Google アカウントへ書き込まれるデータは検証完了時点で消える設計
- ただし、 削除失敗時の手動 cleanup を備え、 残ったタスクの判別用に **タイトル冒頭に `[検証N]` プレフィックス** を必ず付ける

### credentials の取り扱い

- `credentials.json` は **絶対に commit しない**(`.gitignore` で除外、 `credentials.example.json` のみ commit)
- 認証情報の取得手順は本 README §「credentials の準備」 を参照
- 検証用 OAuth client は **Sさん 用 / 個人用とは別の専用 client** を推奨

### 依存

実行時に `googleapis` パッケージが必要(まだ root の `package.json` に未追加):

```bash
npm install googleapis
```

これは B2 で Uさん が AuthProvider 実装する際にも必要になるため、 B2 着手と同時に root へ正式追加される想定。

---

## ファイル構成

```
scripts/verify-tasks-api/
├── README.md (本書)
├── .gitignore (credentials.json を除外)
├── credentials.example.json (テンプレート)
├── lib/
│   ├── auth.js (OAuth credentials 読み込み + access token 取得)
│   ├── cleanup.js (作成 → 検証 → 削除 セット run 関数)
│   └── notes-codec.js (notes 構造化記法 encode/decode)
├── 01-verify-due-time-stripped.js
├── 02-verify-deadline-not-supported.js
├── 03-verify-taskseries-not-in-calendar.js
├── 04-verify-notes-structured-rw.js
└── run-all.js (4 検証を順次実行 + 結果集約)
```

---

## credentials の準備

### Step 1: Google Cloud Project を用意

- 検証専用の Google Cloud Project を作成(既存プロジェクトと混ぜない)
- 以下の API を有効化:
  - Google Tasks API
  - Google Calendar API

### Step 2: OAuth 2.0 client を作成

- API & Services → 認証情報 → OAuth クライアント ID
- アプリケーションの種類: **デスクトップ アプリ** (検証用には簡単)
- client ID + client secret を控える

### Step 3: refresh_token を取得

検証用 Google アカウントで初回 consent を経て refresh_token を取得します。 OAuth Playground(<https://developers.google.com/oauthplayground/>)が手軽:

1. 右上の歯車 → "Use your own OAuth credentials" にチェック、 client ID / secret を入力
2. 左の API 一覧から以下スコープを選択して "Authorize APIs":
   - `https://www.googleapis.com/auth/tasks`
   - `https://www.googleapis.com/auth/calendar`
3. 検証用 Google アカウントで consent 完了
4. "Exchange authorization code for tokens" → 出てきた `refresh_token` を控える

### Step 4: `credentials.json` を作成

`credentials.example.json` をコピーして `credentials.json` を作成し、 値を埋める:

```bash
cp credentials.example.json credentials.json
# credentials.json を編集して client_id / client_secret / refresh_token を埋める
```

---

## 実行方法

### 全検証を順次実行

```bash
node scripts/verify-tasks-api/run-all.js
```

### 個別実行(デバッグ用)

```bash
node scripts/verify-tasks-api/01-verify-due-time-stripped.js
node scripts/verify-tasks-api/02-verify-deadline-not-supported.js
node scripts/verify-tasks-api/03-verify-taskseries-not-in-calendar.js
node scripts/verify-tasks-api/04-verify-notes-structured-rw.js
```

### 出力形式

各検証は `observation`(観察結果)+ `verdict`(判定文)を JSON で返します。 PASS / FAIL は verdict 文頭に明示。

例:
```json
{
  "observation": {
    "sent_due": "2026-06-15T07:30:00.000Z",
    "received_due": "2026-06-15T00:00:00.000Z",
    "time_component_preserved": false,
    "date_component_correct": true
  },
  "verdict": "PASS: 時刻が破棄され、 日付のみ保持されている (公式ドキュメント通り)"
}
```

---

## 受け入れ基準連携

Tさん が起草する受け入れ基準を本書に反映予定(受領タイミング次第)。 暫定の自己受け入れ基準:

- 4 検証すべての `verdict` が PASS で始まる
- 各検証の cleanup が成功し、 検証用アカウントに残置データが無い
- `run-all.js` の exit code が 0

---

## 報告

実行後、 `run-all.js` の出力を CLAUDE.md §7 フォーマットで報告:

```
[完了報告: Tasks/Calendar API 実機検証]
完了日時:
所要時間:
成果物のファイルパス:
4 検証の結果(PASS/FAIL):
notes 構造化記法方式の土台確認結果:
主要な発見・判断:
推奨する次のアクション:
たかしさんに判断を仰ぎたい事項:
副次的に気づいた課題:
```
