# Phase 2 Drive 内ファイルレイアウト設計 v0.1

**作成日**: 2026-05-19(火)
**起草者**: Uさん(Opus、実装補助担当)
**位置づけ**: Phase 2 Sprint 1 並列タスク c)、Uさん 担当スコープ §4-2「Drive API 統合」の中核設計
**前提**:
- Phase2/Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md(本書と対) — `drive.file` 単独で確定(Q-U-a-2)
- Sさん 技術スタック決定提案 v0.3 §2.3.3「coaching.md は character.md とは別ファイル化」
- Sさん 技術スタック決定提案 v0.3 §3.2 キャラメタデータ JSON 案
- 仕様書 v1.4 §1.4 / §4「ユーザーの Google Drive 内完結」
- 仕様書 v1.3 §20 設定値保存 / §21 マニュアル運用 / §24.2 エラー対応履歴 / §25.1 占い情報
- 仕様書 v1.4 §7.3 専用カレンダー、§9.3 「時刻あり=Calendar、時刻なし=Tasks」
- 法的書類 v0.3 §1.2「未来の自分を縛らない」原則(限定表現)
- Q-U-a-6 確定:OAuth エラーログは本書で扱う

**位置づけの再確認**: 本書は **設計提案** 。Storage interface の確定は Sさん 起草、本書は実装側からの「Drive 上のファイル形態」叩き台。

---

## 0. エグゼクティブ・サマリ

### 0.1 全体構造

```
[ユーザーの Google Drive のマイドライブ]
└── MIYU_App_Data/                          ← drive.file アンカー
    ├── README.md                            ← ユーザー向け案内(任意)
    ├── config/                              ← 設定・キャラ定義(機械 + 人間が触る)
    │   ├── index.json                       ← キャラ一覧メタデータ
    │   ├── settings.json                    ← アプリ設定
    │   ├── profile.md                       ← ユーザープロファイル(占い情報含む)
    │   ├── manual.md                        ← マニュアル(仕様書 v1.3 §21)
    │   └── characters/
    │       ├── miyu.md                      ← 性格定義
    │       ├── miyu.coaching.md             ← コーチングテンプレート
    │       ├── sebastian.md                 ← 性格定義
    │       └── sebastian.coaching.md        ← コーチングテンプレート
    └── logs/                                ← 履歴・エラー(基本ログのみ)
        ├── conversations/                   ← 会話ログアーカイブ
        │   └── 会話ログ_YYYY-MM-DD.md
        └── errors.md                        ← エラー履歴(OAuth エラー含む)
```

### 0.2 設計の核心3原則

| # | 原則 | 根拠 |
|---|---|---|
| 1 | **ユーザーが目で見て分かる構造** | 思想書 / 仕様書 §1.4 / Q-U-a-2 で確定した「透明性」を Drive レイアウトでも貫徹 |
| 2 | **Google Calendar / Tasks は SoT、Drive は重複保存しない** | 仕様書 §9.3 整合、データ二重管理を避ける |
| 3 | **「未来の自分を縛らない」レイアウト** | 法的書類 v0.3 §1.2、新機能でディレクトリ追加できる余地を予約(`cache/` 等は予約だけしない) |

---

## 1. 本書の目的とスコープ

### 1.1 目的

`MIYU_App_Data/` 配下に置くファイル / フォルダの **名前・形式・責務・書込頻度・競合リスク・SoT 位置づけ** を確定し、Drive API 実装(Uさん 担当)と Storage interface 起草(Sさん 担当)双方の合意土台を作る。

### 1.2 スコープ

- 含む: ディレクトリ構造、ファイル一覧、ファイル形式選定(Markdown vs JSON)、SoT 位置づけ、競合解決、初回作成フロー、errors.md 仕様、会話ログアーカイブ
- 含まない: Storage interface 草案(b で扱う)、ファイル別の Markdown スキーマ完全定義(Sさん 性格定義 / コーチングテンプレート起草と擦り合わせ後)、PC1 既存 MIYU との同期(Sさん v0.3 §3.3、エルトン調整領域)

---

## 2. ファイル形式選定の基準

「ユーザーが手で触るか / 触らないか」を軸に決める(Q-U-a-2 で確定した透明性原則と整合)。

| ファイル種別 | 形式 | 理由 |
|---|---|---|
| 構造的メタデータ(キャラ一覧、設定値) | **JSON** | 機械可読性 / 構造保証。ユーザーが触らない前提 |
| ユーザーが触り得る定義(キャラ性格 / コーチングテンプレート / プロファイル / マニュアル) | **Markdown** | 可読性 / 直接編集可能 / 思想書「召喚」コンセプトと相性 |
| 履歴・ログ | **Markdown** | ユーザーがエルトン経由で見せる時に貼り付け可能 / 編集も検索もしやすい |

---

## 3. ファイル一覧(完全定義)

### 3.1 全体テーブル

| # | パス | 形式 | 責務 | 書込頻度 | SoT | 競合リスク | サイズ目安 |
|---|---|---|---|---|---|---|---|
| F1 | `README.md` | MD | ユーザー向け「このフォルダの説明」 | 初回1回(改訂時のみ更新) | InvokeAide | 🟢 低 | 1-3 KB |
| F2 | `config/index.json` | JSON | キャラ一覧メタデータ | キャラ追加 / 編集時 | InvokeAide | 🟡 中(マルチデバイス同時編集) | 1-3 KB |
| F3 | `config/settings.json` | JSON | 通知時刻 / 選択キャラ ID / トグル類 | 設定変更時 | InvokeAide | 🟡 中 | 1-5 KB |
| F4 | `config/profile.md` | MD | ユーザープロファイル(名前、生年月日、占い情報、好み等) | ユーザー編集時 | InvokeAide(かつユーザー編集可) | 🟡 中 | 1-5 KB |
| F5 | `config/manual.md` | MD | アプリ運用マニュアル(仕様書 v1.3 §21) | 改訂時 | InvokeAide(Sさん 起草) | 🟢 低 | 5-30 KB |
| F6 | `config/characters/<id>.md` | MD | キャラ性格定義 | キャラ追加 / 編集時(Sさん 起草) | InvokeAide | 🟢 低 | 2-10 KB |
| F7 | `config/characters/<id>.coaching.md` | MD | キャラ別コーチングテンプレート | キャラ追加 / 編集時(Sさん 起草) | InvokeAide | 🟢 低 | 3-15 KB |
| F8 | `logs/conversations/会話ログ_YYYY-MM-DD.md` | MD | 過去会話ログアーカイブ | 会話量が閾値超過時に自動アーカイブ | InvokeAide | 🟢 低(日付ファイル名で衝突しにくい) | 10-200 KB/日 |
| F9 | `logs/errors.md` | MD | エラー履歴(OAuth エラー含む、Q-U-a-6) | エラー発生時の追記 | InvokeAide | 🟡 中(末尾追記の競合) | 1-100 KB(累積) |

### 3.2 Drive 不保存(IndexedDB / Tasks / Calendar 側 SoT)

| 種別 | 保管場所 | 理由 |
|---|---|---|
| リフレッシュトークン | IndexedDB(端末内、AES-GCM) | OAuth 設計 v0.1 §5(セキュリティ) |
| Gemini API キー(BYOK) | IndexedDB(端末内、AES-GCM) | 法的書類 v0.3 §6.4 / 仕様書 §15 |
| 現在進行中の会話履歴 | IndexedDB(端末内、平文または軽量暗号化) | UX レスポンシブ性、Drive アーカイブは閾値後 |
| ToDo データ | **Google Tasks**(`ToDo_by_MIYU` リスト) | 仕様書 v1.4 §9.3 SoT 原則 |
| 予定データ | **Google Calendar**(専用カレンダー + メインカレンダー) | 仕様書 v1.4 §7.3 / §8 SoT 原則 |
| コーチング Event | **Google Calendar**(専用カレンダー、`extendedProperties` で識別) | Sさん v0.3 §1.3、PC1 既存 MIYU の miyu_reminder=true パターン参照 |
| TaskCoachingContext | エフェメラル(計算結果、Drive 不保存) | Sさん v0.3 §2.2.1、毎回 Tasks から再計算 |

---

## 4. 各ファイルの詳細仕様

### 4.1 F1: `README.md`(ユーザー向け案内)

**目的**: ユーザーが Drive 上で `MIYU_App_Data/` を発見した時に「これは何か / 何をしてはいけないか」が分かる短い案内。

**雛形**(初回作成時、書き換え不要):

```markdown
# MIYU_App_Data

ここは「秘書召喚アプリ」(仮称、コードベース名 InvokeAide)が、あなたの設定や
キャラクター定義、エラー履歴を保管するフォルダです。

## 触っていいもの
- `config/profile.md` — あなた自身の情報(生年月日、好み等)
- `config/characters/*.md` — キャラの性格定義(カスタマイズ可能)

## できれば触らないでほしいもの
- `config/index.json` — アプリが読むメタデータ。手動編集すると壊れる可能性
- `config/settings.json` — アプリの設定。設定画面から変更してください

## アプリが書き込むもの(触る必要なし)
- `logs/` — 会話ログとエラー履歴

---
このフォルダを丸ごと削除すると、アプリの設定が初期化されます。
アプリのアンインストール時はこのフォルダの削除をお勧めします。
```

**設計判断**:
- 規約上の文言は法的書類本体に委ね、本ファイルは **運用案内のみ**
- 「未来の自分を縛らない」原則に従い、「絶対に触らないで」とは書かない(限定表現)

**判断仰ぎ Q-U-c-1**: 本ファイルを置くか否か(Drive UX 視点)

---

### 4.2 F2: `config/index.json`(キャラ一覧メタデータ)

**目的**: アプリが起動時に「どんなキャラが利用可能か」を読むメタデータ。Sさん v0.3 §3.2 を継承。

**スキーマ(叩き台、Sさん 確認要)**:

```json
{
  "schemaVersion": "1",
  "lastUpdated": "2026-05-19T10:00:00+09:00",
  "characters": [
    {
      "id": "miyu",
      "displayName": "MIYU",
      "characterMdPath": "config/characters/miyu.md",
      "coachingMdPath": "config/characters/miyu.coaching.md",
      "voicevoxSpeakerId": 1,
      "voicevoxCreditLine": "VOICEVOX:ずんだもん",
      "description": "ギャル口調、 親友のように対等",
      "bundledInBeta": true
    },
    {
      "id": "sebastian",
      "displayName": "セバスチャン",
      "characterMdPath": "config/characters/sebastian.md",
      "coachingMdPath": "config/characters/sebastian.coaching.md",
      "voicevoxSpeakerId": 13,
      "voicevoxCreditLine": "VOICEVOX:青山龍星",
      "description": "ベテランコンシェルジュ、 静かな観察と丁寧な助言",
      "bundledInBeta": true
    }
  ]
}
```

**設計判断**:
- `schemaVersion` を追加 → 将来スキーマ変更時のマイグレーション余地(「未来の自分を縛らない」)
- `lastUpdated` で LWW 競合解決の補助
- voicevoxSpeakerId は **採用前に VOICEVOX 公式話者リストで再確認**(Sさん v0.3 §3.2 注記そのまま)

---

### 4.3 F3: `config/settings.json`(アプリ設定)

**目的**: 仕様書 v1.3 §20 設定値保存。通知 ON/OFF、選択キャラ、通知時刻等。

**スキーマ(叩き台)**:

```json
{
  "schemaVersion": "1",
  "lastUpdated": "2026-05-19T10:00:00+09:00",
  "currentCharacterId": "miyu",
  "coaching": {
    "enabled": false,
    "notificationTime": "18:00",
    "frequency": "daily",
    "calendarConnected": false
  },
  "calendar": {
    "dedicatedCalendarId": null,
    "manageMainCalendar": false
  },
  "ai": {
    "provider": "gemini",
    "modelHint": null
  },
  "tts": {
    "preferVoicevox": true,
    "voicevoxEndpoint": null,
    "fallbackWebSpeech": true
  },
  "ui": {
    "fontScale": 1.0,
    "reducedMotion": false
  },
  "consents": {
    "termsVersion": "v0.3",
    "termsAcceptedAt": "2026-05-19T10:00:00+09:00",
    "ageConfirmedAt": "2026-05-19T10:00:00+09:00",
    "privacyVersion": "v0.3"
  }
}
```

**設計判断**:
- `coaching.enabled` と `coaching.calendarConnected` を分離 → OAuth Stage 2 昇格状態と UI トグル状態を区別(OAuth 設計 §3 ステート機械整合)
- `consents` ブロックで規約・年齢確認の同意状態を保持 → 改訂時の再同意フローで参照(OAuth 設計 §13.1 副次論点を吸収)
- `ai.provider` は Gemini 固定でなく抽象化 → 法的書類 v0.3 §6.9 第三者AIサービス抽象化と整合
- `voicevoxEndpoint` は Uさん 担当の Cloud Run デプロイ後に確定

---

### 4.4 F4: `config/profile.md`(ユーザープロファイル)

**目的**: ユーザー自身の情報。占い・運勢機能(仕様書 v1.4 §25.1)の入力源。

**雛形**:

```markdown
# プロファイル

## 基本情報
- 表示名: 
- 生年月日: 
- 出生時刻: 
- 出生地: 

## 占い設定(オプトイン、仕様書 v1.4 §25)
- メイン体系: (西洋占星術 / 九星気学 / 動物占い / 利用しない)
- サブ体系: 
- 提供頻度: (週1 / 毎日 / OFF)

## 好み・興味(自由記述)
- 

## メモ
- 
```

**設計判断**:
- ユーザーが手書きで書ける Markdown(JSON だと敷居が高い)
- 「占い設定」はオプトイン明示(仕様書 §25.3)
- 設定画面から構造化入力 → このファイルに反映、というフローが UX 上は理想だが、 **手書き編集も許容**(透明性原則)

---

### 4.5 F5: `config/manual.md`(マニュアル)

**目的**: 仕様書 v1.3 §21 マニュアル運用。「使い方リファレンス」。

**叩き台構成(Sさん 領域、本書では章立てのみ提案)**:

```markdown
# 秘書召喚アプリ マニュアル

## はじめに
## キャラクターの選び方
## 予定の入れ方
## ToDo の管理
## コーチング通知の使い方
## 困った時(OAuth 再認証、Drive フォルダの場所、etc.)
## 設定項目リファレンス
```

**設計判断**: 本書ではファイル位置と章立てのみ確定。本文起草は Sさん 側に委ねる(Sさん 中核領域)。

---

### 4.6 F6 / F7: `config/characters/<id>.md` / `<id>.coaching.md`

**目的**: Sさん v0.3 §2.3.3「coaching.md を character.md とは別ファイル化」を踏襲。

**初期同梱(ベータ v1.0)**:
- `miyu.md` + `miyu.coaching.md`(Sさん 起草)
- `sebastian.md`(Phase1_キャラ2_セバスチャン_提案_2026-05-18.md §3 にドラフトあり)
- `sebastian.coaching.md`(Sさん 起草、Phase1_技術スタック決定提案_v0.3 §2.3.2 にドラフトあり)

**バンドル方法**:
- アプリビルドに同梱 → 初回起動時に Drive 上の `config/characters/` にコピー
- ユーザーがカスタマイズ後は Drive 側が SoT、ビルド版で上書きしない
- 「ビルド更新でデフォルト改善した」場合の追従は Sさん v0.3 §3.3 PC1 既存 MIYU との同期論点と隣接(別途設計)

**判断仰ぎ Q-U-c-2**: 初回コピー後にビルド側で改訂があった時、ユーザーの Drive 側にどう反映するか(無反映 / 通知 / マージ提案、3案)

---

### 4.7 F8: `logs/conversations/会話ログ_YYYY-MM-DD.md`(会話ログアーカイブ)

**目的**: 現行 MIYU の慣例(HISTORY_MAX 超過時に Obsidian Vault へアーカイブ)を Drive ベースに移植。

**アーカイブ粒度**:
- **日単位** を本命(現行 MIYU と同型、ファイル名衝突しにくい)
- アーカイブトリガー: 端末内 IndexedDB の会話履歴件数が閾値(例: 21件、現行 MIYU の `HISTORY_MAX=21` を踏襲)を超えたら、古い分から日単位で切り出して Drive へ
- 同日内の追加分は **同ファイルへ追記**(末尾セクション化)

**ファイル雛形**:

```markdown
# 会話ログ 2026-05-19

## セッション 1(10:30 〜 11:15)
**ユーザー**: 今日の予定教えて
**MIYU(キャラ: miyu)**: 今日の予定はね …

## セッション 2(14:00 〜 14:30)
…
```

**判断仰ぎ Q-U-c-3**: アーカイブ粒度は日単位 vs セッション単位、どちらを採るか

---

### 4.8 F9: `logs/errors.md`(エラー履歴、Q-U-a-6 で本書に統合)

**目的**: 仕様書 v1.4 §24.2 エラー対応履歴 + OAuth エラー(Q-U-a-6 確定)を一元化。

**フォーマット**:

```markdown
# エラー履歴

## 2026-05-19

### 14:30 [OAuth] refresh_token_expired
- 状況: iOS Safari で 8日間アプリ未起動後の初回起動
- 対処: 再ログインボタンから 1クリック復旧、Stage 2 維持
- 関連: Phase2_OAuth_スコープ設計_v0.1 §9.1

### 16:45 [Calendar API] rate_limit_exceeded
- 状況: コーチング Event 再生成中に 429 応答
- 対処: 60秒バックオフ + リトライで復旧
- 関連: 仕様書 v1.4 §24.3

## 2026-05-20

…
```

**設計判断**:
- 1日ごとに `##` 見出し
- 各エントリは `### HH:MM [カテゴリ] エラー種別` で開始 → grep 容易
- カテゴリ: `OAuth` / `Drive API` / `Calendar API` / `Tasks API` / `Gemini API` / `VOICEVOX` / `UI` / `Sync` / `Other`
- 末尾追記方式 → 競合リスク 🟡 中(§5 競合解決で扱う)

**保持期間**:
- ベータ v1.0: **永続**(累積するが、想定上限 1MB 未満なので問題なし)
- 商品化版: 直近90日 + アーカイブ(`logs/errors_archive/errors_YYYY-MM.md`)に移行検討

**判断仰ぎ Q-U-c-4**: ベータ v1.0 で永続保持で OK か

---

## 5. 競合解決(マルチデバイス LWW)

### 5.1 競合発生シナリオ

| シナリオ | 発生確率 | 対象ファイル |
|---|---|---|
| PC と スマホ で同時に設定変更 | 🟡 中 | settings.json |
| PC で character.md を手編集中、スマホがビルド版で上書きしようとする | 🟢 低(初回コピー後のみ) | characters/*.md |
| 2台同時にエラー発生 → errors.md 末尾追記が衝突 | 🟢 低 | errors.md |
| 2台同時に会話アーカイブ → 同日ファイルへの追記が衝突 | 🟢 低 | conversations/* |

### 5.2 LWW(Last Write Wins)の適用

**基本方針**: ファイル単位の LWW(Drive の `modifiedTime` 比較)。

**実装手順**:
1. 読み込み時に `modifiedTime` と ETag をキャッシュ
2. 書き込み前に Drive 上の最新 `modifiedTime` を再取得
3. 自分のキャッシュ ETag と一致 → そのまま書込
4. 一致しない場合 → **競合検知** → 別ファイルへ退避 + errors.md に記録

**競合退避先**:
```
config/conflicts/settings.json_conflict_2026-05-19T14:30:00+09:00.json
```

ユーザーは「設定が同期できなかった内容を確認しますか?」と通知され、必要に応じて手動マージ。

### 5.3 errors.md / 会話ログの末尾追記競合

末尾追記は「ファイル全体置換」より細粒度の競合を起こす。対策:

- 書込前にファイル全体を再取得 → 末尾に自身のエントリを追記 → 全体置換でアップロード
- 競合検知時は退避せず **再取得 → 再追記でリトライ**(冪等な追記なので安全、最大3回)
- 3回失敗時のみ `*_conflict_*.md` 退避

### 5.4 マルチデバイス前提の明示

Sさん スケジュール現実性評価 §4.2「LWW で割り切る、CRDT は商品化版で検討」と整合。本書はその実装側叩き台。

---

## 6. 初回作成フロー(冪等)

### 6.1 ステート判定

アプリ起動時(Stage 1 OAuth 成功直後)、Drive 上の `MIYU_App_Data/` の状態を判定:

| 状態 | 検出方法 | アクション |
|---|---|---|
| フォルダ無し | `files.list q=name='MIYU_App_Data' and 'root' in parents and mimeType='application/vnd.google-apps.folder'` が空 | 初回作成(下記 §6.2) |
| フォルダ有り + 主要ファイル有り | index.json / settings.json が存在 | 何もしない(既存利用) |
| フォルダ有り + 主要ファイル欠落 | index.json or settings.json が存在しない | 部分復元(欠落分のみデフォルト生成、既存ファイルは保護) |
| 過去に削除された痕跡 | (検出方法なし、Drive ゴミ箱 API は drive.file 範囲外) | フォルダ無しと同じ扱い |

### 6.2 初回作成手順(冪等)

```
1. MIYU_App_Data/ フォルダ作成
2. config/ サブフォルダ作成
3. config/characters/ サブフォルダ作成
4. logs/ サブフォルダ作成
5. logs/conversations/ サブフォルダ作成
6. config/index.json をデフォルト内容で作成(MIYU + セバスチャン)
7. config/settings.json をデフォルト内容で作成(coaching.enabled=false 等)
8. config/profile.md をテンプレートで作成
9. config/manual.md をビルド同梱版から作成
10. config/characters/miyu.md / .coaching.md をビルド同梱版から作成
11. config/characters/sebastian.md / .coaching.md をビルド同梱版から作成
12. README.md を作成(Q-U-c-1 で確定する場合)
13. logs/errors.md を空のフォーマットで作成
```

各ステップ前に存在チェック → 既存ならスキップ。`drive.file` は **アプリが作成 / 選択したファイルのみ** に範囲が限定されるので、ユーザーが手動で `MIYU_App_Data/` を移動した場合は **アプリから見えなくなる** → ステート判定で「フォルダ無し」となり再作成(エラーログは出すが、ユーザーの旧フォルダは Drive 内に残る)。

### 6.3 復元シナリオ(端末初期化後)

ユーザーが端末を初期化 → IndexedDB が消える → 再 OAuth 完了後:
- Drive 上の `MIYU_App_Data/` が既存 → そのまま読み込む(設定 / キャラ / プロファイル復元)
- IndexedDB 限定の情報(進行中の会話履歴、Gemini API キー)は消失
  - Gemini API キーは「再度入力してください」UI
  - 進行中会話履歴は喪失(Drive アーカイブ済みのみ復元可)

---

## 7. ファイルパス命名と Drive Path 解決

### 7.1 Drive Path の考え方

Drive は厳密には「ID ベース」で「パスベース」ではないが、本書では人間可読性を優先してパス表記する。実装上は:

```
ルート(My Drive)
  └─ MIYU_App_Data (folderId = F0)
     ├─ config (folderId = F1, parent=F0)
     │  ├─ index.json (fileId = ..., parent=F1)
     │  └─ ...
     └─ logs (folderId = F2, parent=F0)
```

各 folderId / fileId は IndexedDB に **キャッシュ** し、毎回の `files.list` を回避する。キャッシュが古い(ファイル削除済み等)場合は再取得。

### 7.2 ファイル名の正規化

- ASCII + 日本語混在 OK(Drive はファイル名に日本語可)
- 区切りはアンダースコア(Tさん 命名規則 §3.1 整合)
- 日付は ISO 8601(`YYYY-MM-DD`)
- 会話ログ: `会話ログ_YYYY-MM-DD.md`(現行 MIYU 慣例踏襲)

---

## 8. ファイル容量と Drive 制約

### 8.1 1ユーザーあたりの想定容量(ベータ v1.0)

| 項目 | 容量(初年度想定) |
|---|---|
| config 配下 | < 50 KB |
| logs/conversations(1日 100KB × 365日) | < 40 MB |
| logs/errors.md | < 1 MB |
| **合計** | **< 50 MB / 年** |

ユーザーの Google Drive 標準枠 15 GB に対して **0.4% 未満** で、無視できる規模。

### 8.2 Drive API レート制限

- Drive API: 1000 req / 100sec / user(標準)
- 起動時の初回チェック・ファイル一括取得を **1セッションあたり10リクエスト以下** に抑える
- 設定変更時の頻繁な書込は、 **debounce(2-3秒) + バッチ** で吸収

### 8.3 大きい会話ログの扱い

1日 200 KB を超える長時間会話の場合:
- そのまま単一ファイル(200KB は Drive 的に問題ない)
- ただしユーザーが「過去ログを丸ごとエルトン経由でレビューしたい」時に長すぎる
- **判断仰ぎ Q-U-c-5**: 同日内で 200 KB 超えたら自動分割(`会話ログ_YYYY-MM-DD_part2.md`)するか、無分割で許容するか

---

## 9. Sさん v0.3 §3.3「PC1 既存 MIYU との同期」への申し送り

Sさん v0.3 §3.3 で「InvokeAide が source、PC1 既存 MIYU は読み取り」の単方向同期が提案されている。本書の MIYU_App_Data/ レイアウトは:

- PC1 既存 MIYU 側(Aさん・Bさん 領域)の `OBSIDIAN_DIR=G:\マイドライブ\iCloud~md~obsidian\MIYU` とは **別ディレクトリ** (ユーザーの Drive マイドライブ直下)
- 仮に Sさん 案で「同期するなら、 PC1 が読みに来るのは ここの `config/characters/` 」となる
- ただし PC1 が `drive.file` のスコープを得ていない場合、ファイル ID 共有が必要 → Aさん・Bさん 側の OAuth 設計に波及

**本書のスコープ外**、エルトン経由で Aさん・Bさん チームと擦り合わせる論点として申し送り。

---

## 10. Sさん との結合点

### 10.1 b) Storage interface 起草で確定すべき contract

本書は「Drive 上のファイル形態」を確定。Sさん 側の Storage interface ではこれを抽象化:

```typescript
// Sさん 起草を待つ。Uさん 感触の叩き台:
interface Storage {
  // 高頻度・小サイズ
  loadSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<SaveResult>;

  // 中頻度・中サイズ
  loadCharacterIndex(): Promise<CharacterIndex>;
  loadCharacterMd(id: string): Promise<string>;
  loadCoachingMd(id: string): Promise<string>;

  // ユーザー編集可
  loadProfile(): Promise<string>;
  saveProfile(md: string): Promise<SaveResult>;

  // 履歴追記
  appendError(entry: ErrorEntry): Promise<void>;
  archiveConversation(date: string, content: string): Promise<void>;

  // 競合
  onConflict(cb: (file: string, theirs, mine) => void): Unsubscribe;
}

type SaveResult =
  | { ok: true; modifiedTime: string; etag: string }
  | { ok: false; reason: 'conflict' | 'rate_limit' | 'auth' | 'network'; retryAfter?: number };
```

Storage interface 草案は b) で詳述。

### 10.2 Sさん 中核の起草物(本書の依存先)

- Sさん 起草: `manual.md` 本文、`miyu.md` / `miyu.coaching.md` / `sebastian.coaching.md`(`sebastian.md` は Phase1 ドラフトあり、確認のみ)
- Uさん 実装: Drive API クライアント、`Storage` 実装、`profile.md` の初期テンプレートと構造化入力UI(キャラ選択UIタスクとセット)

---

## 11. リスク・トレードオフ

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | ユーザーが Drive で `MIYU_App_Data/` をリネーム / 移動 | 🟡 中 | `drive.file` のスコープ仕様上アプリから見えなくなる → 再作成 + errors.md に通知 |
| 2 | ユーザーが `index.json` を手編集して JSON 構文を壊す | 🟢 低 | 起動時に JSON.parse 失敗 → デフォルトにフォールバック + 破損版を `config/index.json.broken_YYYY-MM-DD.json` に退避 |
| 3 | マルチデバイスで同時に settings.json を編集 | 🟡 中 | §5 LWW + コンフリクト退避 |
| 4 | errors.md が肥大化(数年運用後) | 🟢 低 | 商品化版でローテーション、ベータでは永続 |
| 5 | 会話ログがプライバシー上敏感(Drive 不正アクセス時の影響大) | 🟡 中 | Drive はユーザー個人領域、運営者アクセス無し(法的書類 v0.3 §6.5)で吸収。追加暗号化はベータでは見送り |
| 6 | Drive API レート制限超過 | 🟢 低 | §8.2 debounce + バッチ |
| 7 | ファイル形式選択(MD vs JSON)で機械可読性とユーザー編集性のトレードオフ | 🟢 低 | §2 の基準で決定済み、Sさん 起草時に微調整余地 |

---

## 12. たかしさんに判断を仰ぎたい事項

| # | 事項 | Uさん 感触 |
|---|---|---|
| Q-U-c-1 | `README.md` を Drive ルート(`MIYU_App_Data/README.md`)に置くか | **置く** 推奨(透明性原則 + 「ここ何?」へのオフライン応答) |
| Q-U-c-2 | キャラ MD のビルド版改訂時、ユーザーの Drive 側にどう反映するか:(a) 無反映、(b) 起動時通知のみ、(c) マージ提案 UI | **(b) 起動時通知のみ** 推奨。「新しい MIYU の定義があります、適用しますか? 既存をバックアップして適用 / 確認後に手動マージ / そのまま」の 3 択(仕様書 §22 整合) |
| Q-U-c-3 | 会話ログのアーカイブ粒度:(a) 日単位、(b) セッション単位 | **(a) 日単位** 推奨。現行 MIYU 慣例踏襲、ファイル数爆発を防ぐ |
| Q-U-c-4 | errors.md は ベータ v1.0 で永続保持で OK か | **OK** 推奨。1MB 未満想定、商品化版でローテーション再検討 |
| Q-U-c-5 | 1日 200 KB を超える会話ログの自動分割を行うか | **無分割で許容** 推奨(可読性 / Drive 容量問題なし)、ただしエルトンレビュー時の負荷は容認 |
| Q-U-c-6 | プロファイル(F4) のスキーマは Markdown フリーフォーマット vs YAML フロントマター付き Markdown | **YAML フロントマター付き** 推奨。機械が `生年月日` 等を構造的に読めて、本文はユーザー自由記述、両立可能 |
| Q-U-c-7 | settings.json の `consents` ブロックを本書で握り込んでよいか(法的書類 v0.3 連動) | エルトン領域の可能性あり、確認したい |

---

## 13. 副次的に気づいた課題

### 13.1 ユーザーがアプリをアンインストールする時の挙動

仕様書 v1.4 §15 / 法的書類 v0.3 §6.10「ユーザーが Drive 内のデータを自分で削除する手順」に対応する案内が必要。本書 F1 `README.md` 末尾でカバー済み。

### 13.2 暗号化マテリアル分離の将来余地

OAuth 設計 §4.3 で言及した「`drive.appdata` に秘密鍵を隔離」案は、本書では採用していない(リフレッシュトークンも Gemini API キーも IndexedDB)。商品化版で「Drive 経由でマルチデバイス自動同期」を実現する場合のみ再検討。

### 13.3 Capacitor 化時の挙動差

PWA から Capacitor 化(Phase 4 中盤)した時、 `drive.file` の挙動は変わらないが、 **iOS の Files アプリで `MIYU_App_Data/` がどう見えるか** は実機検証必要。落とし穴集 v0.2 改訂時の検証項目候補。

### 13.4 仕様書 v1.5 への反映依頼候補(エルトン主導)

- 仕様書 v1.5 §20 設定値保存 本文化時に `settings.json` スキーマを採用
- 仕様書 v1.5 §21 マニュアル運用 本文化時に `manual.md` の配置確認
- 仕様書 v1.5 §24.2 エラー対応履歴 本文化時に `logs/errors.md` フォーマット採用

### 13.5 PC1 既存 MIYU との同期は Sさん v0.3 §3.3 + 本書 §9 で要擦り合わせ

エルトン経由で Aさん・Bさん チームへの確認依頼候補(本書スコープ外)。

---

## 14. 完了報告(エルトン経由)

```
[Phase 2 Sprint 1 並列タスク c) Drive 内ファイルレイアウト設計 完了報告]
完了日時: 2026-05-19(火)昼
所要時間: 約75分(想定工数 60-90分内)
成果物のファイルパス:
  C:\dev\InvokeAide\docs\Phase2\Phase2_Drive_ファイルレイアウト設計_v0.1_2026-05-19.md

主要な発見 / 判断:
  - MIYU_App_Data/ 配下に 3 階層: README / config / logs
  - 全 9 ファイル(F1〜F9)を確定、形式はユーザー編集可否で MD vs JSON
  - Google Calendar / Tasks は SoT、Drive 重複保存しない原則
  - 競合解決は ファイル単位 LWW + 退避先 conflicts/、末尾追記は再取得リトライ
  - 初回作成フローは冪等、ステート判定で部分復元対応
  - errors.md は OAuth エラー含む一元化(Q-U-a-6 反映)
  - settings.json に consents ブロックで規約改訂時の再同意基盤(OAuth 設計 §13.1 吸収)

Sさん との結合点(エルトン経由で Sさん に通知依頼):
  - Storage interface 確定起草(本書 §10.1 叩き台、b) で詳述予定)
  - manual.md 本文起草(Sさん 中核領域)
  - miyu.md / miyu.coaching.md / sebastian.coaching.md 起草(Sさん 中核領域)

推奨する次のアクション:
  - 本書レビュー、§12 Q-U-c-1〜Q-U-c-7(7点)のたかしさん判断
  - Sさん に Storage interface + マニュアル + コーチングMD 起草を依頼(エルトン)
  - Uさん 次タスク b) Storage interface 叩き台 へ着手(Sさん 起草前のたたき台として)

たかしさんに判断を仰ぎたい事項: 本書 §12 に 7点
副次的に気づいた課題: 本書 §13 に 5点
```

---

## 15. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火) | 初版作成。MIYU_App_Data/ 全体構造 / 9ファイル仕様 / 競合解決 LWW / 初回作成フロー / errors.md 統合 / Sさん 結合点 / 判断仰ぎ 7点 | Uさん(Opus) |

---

**以上、Uさん c) Drive 内ファイルレイアウト設計 v0.1。§12 判断 7 点を待ちつつ、b) Storage interface 叩き台 に進みます(b は a/c 双方の前提が固まったので着手可)。**
