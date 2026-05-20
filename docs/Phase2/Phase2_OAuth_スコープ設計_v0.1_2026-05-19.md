# Phase 2 OAuth スコープ設計 v0.1

**作成日**: 2026-05-19(火)
**起草者**: Uさん(Opus、実装補助担当)
**位置づけ**: Phase 2 Sprint 1 並列タスク a)、Uさん 担当スコープ §4-2「Drive API 統合」の前提設計
**前提**:
- 法的書類 v0.3 §6.3「段階的同意フロー(初回 Tasks のみ → 通知 ON で Calendar 追加)」
- 法的書類 v0.3 §1.2 / §6.5「未来の自分を縛らない」原則(限定表現 / 将来余地)
- Sさん 技術スタック決定提案 v0.3 §1.3 / §2.5(Calendar Event リマインダー方式、コーチング機能)
- 仕様書 v1.4 §4 / §15 / §24(サーバーレス・BYOK・OAuth 自動再認証)
- Tさん 命名規則統一案 §7.4(Phase2/ 配下サブ命名規則)

**位置づけの再確認**: 本書は **設計提案** であり、最終確定は Sさん の AuthProvider interface 定義側( §10 結合点)との擦り合わせ後となる。Uさん の感触は明示するが、独断で決めない。

---

## 0. エグゼクティブ・サマリ

| 項目 | Uさん 提案 |
|---|---|
| 基本スコープ(Stage 1) | `openid` / `email` / `profile` / `https://www.googleapis.com/auth/drive.file` / `https://www.googleapis.com/auth/tasks` |
| 拡張スコープ(Stage 2、コーチング ON 時) | `https://www.googleapis.com/auth/calendar` |
| 拡張方式 | Google OAuth の **Incremental Authorization**(`include_granted_scopes=true`)で「未来の自分を縛らない」を OAuth に適用 |
| Drive スコープ選定 | **`drive.file` 本命**(最小権限 + ユーザー透明性)、`drive.appdata` は副候補(透明性犠牲だが「秘書 = ユーザー観察対象」コアコンセプトと相性悪い) |
| リフレッシュトークン保管 | 端末内 IndexedDB(Web Crypto で暗号化、AES-GCM)。Drive には置かない |
| OAuth クライアントタイプ | ベータは Web Application(Cloudflare Pages リダイレクト URI)、商品化 Capacitor 化時に Custom URI Scheme を併設 |
| Google Verification | ベータ家族テスト時は「未確認アプリ」警告が出る前提、UX で吸収。Verification 申請は商品化前(Phase 4 着手と並行) |

---

## 1. 本書の目的とスコープ

### 1.1 目的

InvokeAide が利用する Google OAuth 2.0 スコープを **法的書類 v0.3 § 6.3 段階的同意フロー** と **Sさん v0.3 のコーチング機能要件** の双方を満たす形で具体化する。

### 1.2 スコープ

- 含む: 必要スコープ列挙、段階的同意フロー(ステート機械)、Drive サブスコープ選定、トークン保管、拒否時挙動、再認証フロー、Sさん との結合点
- 含まない: AuthProvider interface の確定(Sさん 起草)、UI 細部(Sさん 設定画面実装側)、Google Cloud Console 上のプロジェクト設定手順書(別タスク予定)

### 1.3 表現方針

法的書類 v0.3 § 1.2 「未来の自分を縛らない」原則を本書の表現にも適用する。「絶対に〜」「永久に〜」のような断定形を避け、「現時点では〜」「通常運用において〜」と限定形で記す。

---

## 2. 必要スコープの一覧と用途

| # | スコープ URI(prefix `https://www.googleapis.com/auth/` 省略) | 用途 | Stage | 機能必須度 |
|---|---|---|---|---|
| S1 | `openid` | OpenID Connect | 1 | 🔴 必須 |
| S2 | `email` | ユーザー識別 | 1 | 🔴 必須 |
| S3 | `profile` | 表示名・アバター | 1 | 🟡 推奨(設定画面で利用) |
| S4 | `drive.file` | アプリが作成・選択したファイルのみへの読み書き | 1 | 🔴 必須(Drive 完結方針) |
| S5 | `tasks` | Tasks の読み書き・完了・削除 | 1 | 🔴 必須(ToDo 運用、仕様書 § 9) |
| S6 | `calendar` | 専用カレンダー作成 + Event 作成・更新・削除 | 2 | 🟡 コーチング ON 時のみ必須 |
| S7 | (将来) `gmail.readonly` 等 | 仕様書未確定、将来検討 | 3+ | ⚪ 現時点では不要 |

### 2.1 Calendar が `calendar.events` ではなく `calendar` フルである理由

仕様書 v1.4 § 7.3「専用サブカレンダー(MIYU 等)の自動作成」要件があり、 **新規カレンダー作成には `calendar` フルスコープが必要** (`calendar.events` は既存カレンダー内 Event のみ操作可)。

代替案として「ユーザーのメインカレンダーに通知 Event を直接作成」も技術的には可能だが、 **仕様書 § 7.3「メインカレンダーを汚染しない」設計意図を尊重し、本書では専用カレンダー方式を採用** 。

### 2.2 Tasks スコープに `tasks.readonly` の代替がない理由

`complete_task` / `delete_task` / `create_task` / `update_task` がすべて書き込み系のため、 `tasks` フル一択。仕様書 v1.4 § 9 機能群と整合。

---

## 3. 段階的同意フロー(ステート機械)

法的書類 v0.3 § 6.3 の「初回 Tasks のみ → 通知 ON で Calendar 追加」を、技術的なステート機械として展開する。

### 3.1 ステート定義

```
[Stage 0: 未認証 / 規約未同意]
   │
   │ ① 規約同意 + プライバシーポリシー同意 + 年齢確認(13歳未満不可)
   │ ② AI明示宣言の表示(EU AI Act §50)
   ▼
[Stage 0.5: ローカル同意済 / OAuth 未開始]
   │
   │ ③ 設定画面で「Google アカウントに接続」ボタンタップ
   │ ④ OAuth 同意画面 → Stage 1 スコープ(openid, email, profile, drive.file, tasks)
   ▼
[Stage 1: 基本機能稼働(コーチング通知 OFF)]
   │
   │ ⑤ 設定画面で「コーチング通知を有効にする」トグル ON
   │ ⑥ 再 OAuth(Incremental Authorization、calendar スコープのみ追加要求)
   ▼
[Stage 2: コーチング機能稼働]
```

### 3.2 各ステージで「できること」「できないこと」

| ステージ | できること | できないこと |
|---|---|---|
| 0 / 0.5 | 規約閲覧、年齢確認、初回 UI ナビ | AI 対話・データ保存・通知 |
| 1 | チャット(キャラ選択 + Gemini 経由)、ToDo 作成・編集・完了、Drive へのプロファイル / 設定保存、TaskCoachingContext 計算(コンソール表示のみ、通知は発火しない) | コーチング Event の自動発火、メイン Calendar への予定登録(仕様書 § 8 機能群は Stage 2 要件) |
| 2 | Stage 1 のすべて + 18:00 コーチング通知 Event 発火 + 仕様書 § 8 Calendar 機能群全体 | (Stage 3 以降の Gmail 等は未スコープ) |

### 3.3 Calendar 連携を Stage 2 に分離する設計判断

仕様書 v1.4 § 8 の Calendar 機能(create_event / list_events / update_event / delete_event)は **コーチング機能とは独立に有用** 。論理的には Stage 1 にあってもよい。

しかし本書では:

- 「コーチング通知 ON」 = Calendar スコープ要求のトリガー、として **段階的同意の UX 設計をシンプルに保つ**
- 仕様書 § 8 機能群は「コーチング機能の周辺ユースケース」として、Stage 2 で同時解放
- ユーザーが「コーチング通知は要らないが、予定登録だけ欲しい」と希望した場合は、設定画面に「Calendar のみ連携(通知 OFF)」オプションを追加可

これは設計上の判断で、 **Sさん 設定画面実装側との擦り合わせ事項** ( §10、 §12 Q-U-a-1)。

---

## 4. Drive サブスコープの選定: `drive.file` 本命

### 4.1 候補比較

| サブスコープ | 権限 | 透明性 | 推奨度 |
|---|---|---|---|
| `drive` | ユーザーの Drive 全体 | 高(ユーザーが全部見える) | ❌ 過剰権限、ストア審査でも警戒対象 |
| **`drive.file`** | アプリが作成 / 選択したファイルのみ | 高(マイドライブ配下に MIYU_App_Data/ が見える) | **◎ 本命** |
| `drive.appdata` | アプリ専用フォルダ(ユーザーに非表示) | 低(ユーザーから見えない) | △ 副候補 |

### 4.2 `drive.file` を本命にする根拠

1. **最小権限の原則**: 法的書類 v0.3 § 6.5「通常運用において収集・保存しない」と整合。アプリが触れる範囲を「自分が作ったファイル」に限定。
2. **ユーザー透明性**: 思想書「人間味のための AI」「効率化のための AI ではない」 + 仕様書 v1.4 § 1.4「ユーザーの Google Drive 内完結」 = ユーザーが **自分のデータを自分で見える場所** に置いてあることが安心材料になる。
3. **Sさん v0.3 § 2.3.3 のファイルレイアウト想定** (`MIYU_App_Data/config/characters/*.md` 等)は、ユーザーがエクスプローラで開ける前提と読める。
4. **「機が熟したら別アプリでも開ける」可能性**: 例えばユーザーが Markdown エディタで直接 character.md を開いて手で編集 → InvokeAide が次回起動時に読み直す、というワークフローを将来許容できる。

### 4.3 `drive.appdata` を副候補にしない理由

- アプリ専用フォルダはユーザーから不可視 → 仕様書 § 1.4「ユーザーの Drive 完結」のユーザー観察性が損なわれる
- 思想書「召喚」コアコンセプトと「ユーザーの目の届かない隠しフォルダ」は哲学的にミスマッチ
- ただし「秘密鍵や暗号化マテリアル」は `drive.appdata` に隔離する小規模併用は将来検討余地

### 4.4 副次論点: アプリの「ファイル選択」を要求するフロー

`drive.file` は **アプリが作成したファイル + ユーザーが Picker で選択したファイル** にアクセス可。InvokeAide は初回起動時に `MIYU_App_Data/` フォルダを作成 → 以降そのフォルダ配下が `drive.file` 範囲 → ユーザー操作不要、で問題なく動作する想定。

ただし **ユーザーが手動で `MIYU_App_Data/` を別 Drive に移動 / リネーム / 削除した場合** の挙動を Stage 1 復元フローで定義する必要あり( §9 エラー対応、 §12 Q-U-a-2)。

---

## 5. リフレッシュトークン保管設計

### 5.1 保管場所: 端末内 IndexedDB(暗号化)

- ストレージ: IndexedDB(localStorage より大容量・構造化、PWA 互換)
- 暗号化: Web Crypto API + AES-GCM(256-bit 鍵、ユーザーパスフレーズ or 端末派生鍵)
- 暗号鍵の派生:
  - 案A: ユーザーパスフレーズ + PBKDF2(セキュリティ高、UX 重い)
  - 案B: 端末派生鍵(localStorage の `crypto.randomUUID()` 等、UX 軽い、端末ロックされていなければ実質「保護なし」)
  - 案C: WebAuthn / Passkey 連携(将来、対応端末増加待ち)
- ベータ v1.0 は **案B 本命**(IT 音痴ユーザーへの導入容易性優先)、商品化版で案A / C を再検討

### 5.2 Drive に置かない理由

- リフレッシュトークン = OAuth セッションの再生資源 → Drive にあれば誰でも復元可能、というリスク
- 「データは Drive に保管」原則は **会話ログ・設定・キャラ定義** に適用、 **認証情報は端末ローカル**

### 5.3 iOS Safari 7日ポリシー対応(落とし穴集 § 4.6)

- 端末を 7日触らないと IndexedDB が削除される傾向(iOS 16.4+ で改善傾向、ただし機種・iOS バージョン依存)
- 削除された場合 → 再 OAuth が必要 → 仕様書 v1.4 § 24.2「OAuth 自動再認証」フローで対応:
  - アプリ起動時にリフレッシュトークン読み出し失敗 → 「再ログインしてください」UI を表示
  - ユーザーがタップ → 同意済みスコープを記憶していれば1クリック復旧(Stage 1 / 2 維持)

---

## 6. 拒否・部分同意時の挙動

### 6.1 Stage 1 で部分拒否された場合

| 拒否スコープ | アプリ挙動 |
|---|---|
| `openid` / `email` | アプリ利用不可(再同意を促す) |
| `profile` | 表示名「ユーザー」フォールバック、機能継続 |
| `drive.file` | **Sさん 方針「Drive 完結」と整合させるなら、利用不可とする方針が筋** だが、UX 配慮で「ローカルのみモード(IndexedDB SoT)」フォールバックも技術的には可能。 §12 Q-U-a-3 で判断仰ぎ |
| `tasks` | ToDo 管理機能のみ OFF、設定画面に再要求ボタン |

### 6.2 Stage 2 で Calendar 拒否された場合

- コーチング通知 OFF 状態に戻る(Stage 1 同等)
- 設定画面のトグルは ON のままだが、横に「Google Calendar の同意が必要です」表示
- ユーザーが再度トグル操作 → 再 OAuth 要求

### 6.3 拒否時の UX 原則

- **「使えない理由」と「どうすれば使えるか」をセットで提示** (法的書類 v0.3 § 6.5 表現方針との整合: 何ができて何ができないかが明確)
- **再 OAuth 導線をいつでも開ける** (設定画面 → 「Google 連携を再設定」項目を常設)

---

## 7. OAuth クライアントタイプとリダイレクト URI

### 7.1 ベータ v1.0 構成

- **クライアントタイプ**: Web Application
- **承認済み JavaScript 生成元**: Cloudflare Pages の本番 URL(例: `https://invokeaide-beta.pages.dev`)+ ローカル開発用 `http://localhost:5173`(Vite デフォルト)
- **リダイレクト URI**: 同上 + `/auth/callback`
- **OAuth フロー**: PKCE + Authorization Code(BYOK アプリで Client Secret 不要、PKCE で十分な保護)

### 7.2 商品化フェーズ(Capacitor 化時)

将来 Capacitor で App Store / Google Play 配布する場合、Custom URI Scheme(例: `com.novemintelligence.invokeaide:/auth/callback`)を併設する必要あり。これは Phase 4 中盤で着手見込み(仕様書 v1.4 § 26.2)、本書スコープ外。

### 7.3 Google Verification

- ベータ家族テスト時は **「未確認のアプリ」警告画面** が表示される
- 対策(ベータ期間):
  - 起動指示書 § 7.4「分からないを共有する文化」に沿って、 **規約同意フローに「Google の警告画面が出ますが、これは設計どおりです」説明** を組み込む
  - 100ユーザー未満なら警告画面で「詳細 → 安全でないページに移動」で進める運用
- 商品化前(Phase 4)に Google Cloud Console 上で Verification 申請を行う(エルトン主導案件)

---

## 8. Incremental Authorization の具体実装

### 8.1 リクエストパラメータ

Stage 1 → Stage 2 拡張時、OAuth リクエストに以下を含める:

```
include_granted_scopes=true
scope=https://www.googleapis.com/auth/calendar
```

これにより:
- ユーザーには **「Calendar スコープのみ」の同意画面** が表示される(既得スコープは再同意不要)
- 同意後、サーバーが返すアクセストークンは **全既得スコープ + 新スコープ** をカバー

### 8.2 「未来の自分を縛らない」原則の適用

将来スコープ追加(例: Gmail 連携、Maps 連携)が発生した時、 **既存ユーザーに「初回からこれが必要だった」と再同意を強いない** こと。新機能の都度、Incremental Authorization で追加することで:

- ユーザーは「使う機能の分だけ同意する」体験
- 規約・プライバシーポリシーに「将来追加される可能性のあるデータ収集」(法的書類 v0.3 § 6.5)を **断定形でなく限定形で予告** することで、追加時の規約矛盾を回避

---

## 9. エラー / 再認証フロー

### 9.1 仕様書 v1.4 § 24.2「OAuth 自動再認証」との対応

| 状況 | アプリ挙動 |
|---|---|
| アクセストークン期限切れ | リフレッシュトークンで silent refresh(ユーザー操作不要) |
| リフレッシュトークン失効(ユーザーが Google 側で取り消し / 7日ポリシーで削除) | アプリ起動時にエラー → 「再ログイン」UI 表示 → 1クリック再 OAuth |
| ユーザーがアカウント切替 | 設定画面 → 「Google アカウントを切り替える」 → サインアウト + 再 OAuth |

### 9.2 errors.md への記録

仕様書 v1.4 § 24.2 のエラー対応履歴は `errors.md` に蓄積される。OAuth エラーも同形式で記録:

```markdown
- 2026-MM-DD HH:MM | OAuth | refresh_token_expired | ユーザー再ログインで復旧
```

errors.md の Drive 上の置き場所は本書スコープ外(c) Drive 内ファイルレイアウト設計で扱う)。

---

## 10. Sさん との結合点(interface 起草依頼候補)

本書を実装に落とすには、以下の interface を **Sさん 起草 / Uさん 実装** で確定したい:

### 10.1 AuthProvider interface(Sさん 起草候補)

```typescript
// Sさん 起草を待つ。Uさん の感触としての叩き台:
interface AuthProvider {
  currentStage(): Promise<'unauth' | 'stage1' | 'stage2'>;
  requestStage1Consent(): Promise<AuthResult>;
  requestCalendarConsent(): Promise<AuthResult>;   // Stage 1 → 2 昇格
  silentRefresh(): Promise<AccessToken>;
  signOut(): Promise<void>;
  onStageChange(cb: (stage) => void): Unsubscribe;
}

type AuthResult =
  | { ok: true; granted: Scope[] }
  | { ok: false; reason: 'denied' | 'partial' | 'error'; granted?: Scope[] };
```

### 10.2 設定画面 UI との結合(Sさん 実装の Sprint 1 設定画面)

Sさん 担当の設定画面に以下のトリガーが必要:

- 「Google アカウントに接続」ボタン(Stage 0.5 → Stage 1)
- 「コーチング通知を有効にする」トグル(Stage 1 → Stage 2)
- 「Google アカウントを切り替える」項目(任意時)
- 「Google 連携を再設定」項目(エラー復旧時)

これらの **トリガー位置 / コピー文言 / 3択ボタン確認(仕様書 § 22)** は Sさん 設計領域。Uさん は AuthProvider 側の挙動契約を満たす実装を提供。

### 10.3 Sさん への通知事項(エルトン経由)

- 本書の本命方針(Stage 分離、Drive `drive.file`、Calendar フル、Incremental Authorization、IndexedDB トークン保管)を共有
- AuthProvider interface の確定起草を依頼
- 設定画面の OAuth トリガー UI の文言設計を依頼(Sさん が「中身」担当のため)

---

## 11. リスク・トレードオフ

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | iOS Safari 7日ポリシーで IndexedDB のリフレッシュトークンが消える | 🟡 中 | § 5.3 再 OAuth 1クリック復旧 + 落とし穴集 § 4.6 で実機検証 |
| 2 | Google Verification 未通過状態でベータ家族が「未確認警告」に動揺 | 🟡 中 | § 7.3 規約同意フローで事前説明、家族テスター事前案内 |
| 3 | `drive.file` の「ユーザーが MIYU_App_Data/ を手動移動」リスク | 🟢 低 | 起動時にフォルダ存在チェック → 無ければ再作成、内容欠落は errors.md に記録 |
| 4 | Stage 1 で Drive 拒否された場合の挙動が方針未確定 | 🟡 中 | § 12 Q-U-a-3 で判断仰ぎ |
| 5 | Calendar スコープが強い(フル)ため拒否率が上がる可能性 | 🟢 低 | § 7.3 同意画面に「専用カレンダーを作るためにフルスコープが必要」と短い説明文を表示 |
| 6 | 商品化フェーズで Capacitor 化時、Custom URI Scheme 設定漏れで認証不可 | 🟢 低 | Phase 4 中盤の着手項目として記録、本書スコープ外 |
| 7 | Web Crypto API の暗号鍵管理(端末派生案B)はセキュリティが弱い | 🟡 中 | ベータ受容、商品化版で案A(パスフレーズ)/ 案C(Passkey)再検討 |

---

## 12. たかしさんに判断を仰ぎたい事項

| # | 事項 | Uさん 感触 |
|---|---|---|
| Q-U-a-1 | Calendar 連携を Stage 2(コーチング ON 時のみ)に分離する方針で OK か。「Calendar 機能だけ欲しい(通知 OFF)」ユーザー向けに別オプションを設けるか | **Stage 2 分離 + 別オプション併設** が UX 配慮として推奨。Sさん 設定画面実装側と擦り合わせ要 |
| Q-U-a-2 | Drive サブスコープは `drive.file` で確定 OK か。`drive.appdata` 併用案(秘密鍵だけ隠す)を加えるか | **`drive.file` 単独で開始**、`drive.appdata` は商品化版の再検討項目とする |
| Q-U-a-3 | Stage 1 で Drive 拒否された場合、(a) 利用不可 (b) ローカルのみモード (c) 再要求しながら起動継続、どの方針か | Sさん v0.3「Drive 完結方針」と整合させるなら **(a) 利用不可** が筋。ただし IT 音痴ユーザーへの導入容易性を優先するなら (c) も検討余地 |
| Q-U-a-4 | リフレッシュトークン暗号鍵は ベータ v1.0 で 案B(端末派生)で OK か | **案B 推奨**(UX 軽さ優先)、商品化版で 案A or C 移行 |
| Q-U-a-5 | Google Verification 申請のタイミング(Phase 4 中盤 vs もっと早期)| **Phase 4 中盤** 推奨。ベータ家族テスト規模(100ユーザー未満想定)では未通過運用が現実的 |
| Q-U-a-6 | OAuth エラー(errors.md)の保存先は Drive `MIYU_App_Data/errors.md` か別形式か | 本書スコープ外、c) Drive レイアウト設計で扱う |

---

## 13. 副次的に気づいた課題

### 13.1 規約同意フローと OAuth の順序

法的書類 v0.3 § 6.3 は「年齢確認(13歳未満不可)」「規約同意」を OAuth より前に置く設計。本書 § 3.1 ステート機械の Stage 0 → 0.5 で表現したが、 **規約改訂時の再同意フロー** をどう設計するかは設定画面の Sさん 領域。

### 13.2 マルチアカウント

仕様書 v1.4 では明示されていないが、 **「家族共用端末で複数 Google アカウントを切り替えたい」** ユースケース対応が必要かもしれない。ベータ v1.0 では「単一アカウント前提、切替時はサインアウト → 再 OAuth」で割り切る方針を提案、確定は別途。

### 13.3 BYOK の Gemini API キーとの分離

本書 OAuth は Google アカウント連携(Drive / Tasks / Calendar)用。一方、Gemini API への BYOK(法的書類 v0.3 § 6.4)は **別系統の認証情報**(API キー文字列、ユーザーが Google AI Studio で発行)で、 OAuth とは独立。

両者を設定画面でどう並べるか(Sさん 領域)は、UX 上の混乱を避けるための重要論点。本書スコープ外だが副次的に申し送り。

### 13.4 仕様書 v1.5 への反映依頼候補(エルトン主導)

- 仕様書 v1.5 § 15 セキュリティ・プライバシーに「OAuth スコープ一覧」「Incremental Authorization」を追記
- 仕様書 v1.5 § 24 エラー対応設計に「OAuth 失効時の 1クリック復旧」を追記

### 13.5 命名規則の自己適用

本書ファイル名 `Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md` は Tさん 命名規則統一案 § 7.4「Phase期間のサブ成果物」サブ命名規則準拠。

---

## 14. 完了報告(エルトン経由)

```
[Phase 2 Sprint 1 並列タスク a) OAuth スコープ設計 完了報告]
完了日時: 2026-05-19(火)午前
所要時間: 約60分(想定工数 60-90分内)
成果物のファイルパス:
  C:\dev\InvokeAide\docs\Phase2\Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md

主要な発見 / 判断:
  - Stage 1 = openid/email/profile/drive.file/tasks、Stage 2 = +calendar
  - Incremental Authorization で「未来の自分を縛らない」OAuth 適用
  - Drive は drive.file 本命(透明性 + 最小権限)
  - リフレッシュトークンは IndexedDB 暗号化(ベータは端末派生鍵)
  - iOS Safari 7日ポリシー対応として 1クリック再 OAuth フロー

Sさん との結合点(エルトン経由で Sさん に通知依頼):
  - AuthProvider interface の確定起草(§10.1 叩き台あり)
  - 設定画面 OAuth トリガー UI の文言設計(§10.2 トリガー位置一覧あり)

推奨する次のアクション:
  - 本書レビュー、§12 Q-U-a-1 〜 Q-U-a-6(6点)の判断
  - Sさん に AuthProvider interface 起草を依頼(エルトン経由)
  - Uさん 次タスク c) Drive 内ファイルレイアウト設計に着手

たかしさんに判断を仰ぎたい事項: 本書 §12 に 6点
副次的に気づいた課題: 本書 §13 に 5点
```

---

## 15. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火) | 初版作成。Stage 機械 / Drive スコープ選定 / リフレッシュトークン保管 / 拒否時挙動 / Sさん 結合点 / 判断仰ぎ 6点 | Uさん(Opus) |

---

**以上、Uさん a) OAuth スコープ設計 v0.1。Sさん との結合点 §10 の確定と §12 判断 6 点を待って、c) / b) に進みます。**
