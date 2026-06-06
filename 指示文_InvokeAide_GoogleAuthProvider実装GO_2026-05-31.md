# 指示文：GoogleAuthProvider 実装 GO ── 2026-05-31（B2 着手②）

**宛先**: InvokeAide 開発担当 Claude Code（PC2 / `C:\dev\InvokeAide`）／ **担当: Uさん（設計・実装担当）**
**作成**: 技術顧問エルトン（Claude.ai）
**承認**: たかしさん（B2 実装、本日 GO）
**前提**: SecretStore（IndexedDbSecretStore）が実装完了・マージ済み（commit 05ca945）であることを確認済み。GoogleAuthProvider は SecretStore に依存するため、この前提は満たされている。

---

## 0. これは何の作業か（背景）

B2 本体実装の**2番目のユニット**、`GoogleAuthProvider` を実装する。現状は完全なスケルトン（全メソッドが `not implemented yet` を throw）。これを本番実装にする。

役割: Google OAuth 2.0 を使い、ユーザーのログインと権限取得（Stage機械: `unauth → stage1 → stage2`）を管理する。取得した refresh_token は SecretStore（前ユニットで完成済み）に保管する。

ブロッカーだった Q-U-j-3 / 5 は Sさん 回答済み・contract v0.2 反映済み。実装に必要な設計はすべて揃っている。

---

## 1. 設計の参照元（ここに全部書いてある。再定義せず必ず原典に従う）

- **`docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md` §2（§2.1〜§2.14）** ← クラス構造・initialize・Stage判定・OAuthフロー（PKCE）・各メソッドの詳細手順が全部ここにある。**最重要**
- **`docs/Phase2/Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md` §3.1** ← Stage 機械の定義の出典
- **`docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md` §4（Q-U-j-3）, §5（Q-U-j-5）** ← clientId/redirectUri の環境切替、refresh_token 失効時の cause 通知の確定回答
- **`src/interfaces/AuthProvider.ts`** ← 満たすべき contract 本体（StageChangeCause, getGrantedScopes 等の v0.2 反映済み）
- **`src/implementations/IndexedDbSecretStore.ts`** ← 依存先（完成済み）。refresh_token / grantedScopes / lastStage の保管に使う

---

## 2. ⚠️ 実装前の最重要確認：スコープ設定は「最新の確定」に合わせる

設計書 §2.12（AuthConfig の値、5/25 時点）と、その後の確定事項に**食い違いがある可能性**がある。実装時は必ず**最新の確定を優先**すること。

最新の確定事項（5/26〜5/30）:
- **Calendar スコープは `https://www.googleapis.com/auth/calendar.events`**（フルの `calendar` ではない）
- **専用サブカレンダーは作らない**（メインカレンダーに集約。本日 `domain.ts` から `dedicatedCalendarId` / `manageMainCalendar` を削除済み）
- stage1 / stage2 のスコープ構成は、`AuthProvider.ts`（contract v0.2）と Sさん回答を正とする

→ 設計書 §2.12 の記述が上記と食い違う場合は、**最新（calendar.events / 専用カレンダー無し）を採用**し、食い違いがあった旨を報告すること。古いスコープ設定のまま実装しないこと。

---

## 3. 実装する対象

`src/implementations/GoogleAuthProvider.ts`（現スケルトン）を本番実装にする。実装するメソッドと、各々の詳細手順は**設計書 §2.4〜§2.11 に全部書いてある**ので、それに忠実に従う:

- `initialize(deps)` … §2.4（SecretStore確認 → config検証 → refresh_token復元 → silentRefresh）
- `currentStage()` … 副作用なしで現在のStageを返す
- `requestStage1Consent()` … §2.6（PKCE生成 → authUrl → リダイレクト → code交換 → SecretStore保管 → setStage）
- `requestCalendarConsent()` … §2.7（Incremental Authorization で calendar.events 追加）
- `getAccessToken()` … §2.8（キャッシュ判定 → silentRefresh）
- `silentRefresh()` … §2.9（refresh_token で token更新、失効時は unauth へ）
- `signOut()` … §2.10（secret削除 → unauth）
- `onStageChange(cb)` … §2.11（listener登録、Unsubscribe返却、cause引数付き）
- `getGrantedScopes()` … SecretStore の `oauth.grantedScopes` を読んで返す（C3 / Q-U-j-6）
- 内部ヘルパー: `buildAuthUrl` / `exchangeCodeForTokens` / `refreshAccessToken` / `setStage` / `toReason`（§2.3）

確定済みの実装方針（迷ったらこれ）:
- **PKCE の code_verifier は localStorage 保管**（キー `'invokeaide.pkce.codeVerifier'`、コールバック完了時に即削除）（Q-U-j-4 確定）
- **onStageChange の cb には cause 引数**（StageChangeCause: user_signout / refresh_failed / consent_granted / restored_from_storage）（C2 / Q-U-j-5 確定）
- **clientId / redirectUri は Vite の `import.meta.env`（VITE_ プレフィックス）から注入、ハードコード禁止**（Q-U-j-3 確定）
- SecretStore に保管する secret: `oauth.refreshToken` / `oauth.grantedScopes` / `oauth.lastStage`（§2.5）

---

## 4. スコープの線引き（今回やらないこと）

- **contract（`src/interfaces/*.ts`）本体の修正はしない**。今回は GoogleAuthProvider 実装ファイルのみ
- `/auth/callback` ルート（Vue Router）の実装は **Sさん B3 領域**。GoogleAuthProvider は「code を受け取って交換する」関数を用意するところまで。ルーティング自体は作らない（設計書 §2.6 注記）
- DriveStorageProvider / VoicevoxTTSProvider など次のユニットには着手しない（GoogleAuthProvider 完成・確認後に順次 GO）
- テストの本格整備は別途。今回は実装本体と typecheck/build を優先（テストの扱いは報告時に相談）

---

## 5. 進め方とテスト

1. 着手前にバックアップ・現状確認（`git status` がクリーンか）
2. 設計書 §2 に従って `GoogleAuthProvider.ts` を実装
3. **`npm run typecheck` と `npm run build` が通ること**を確認
4. テストは、まず実装本体と typecheck/build を通すことを優先。単体テストをどこまでやるかは報告時に相談

---

## 6. 報告してほしいこと

- 実装した内容の概要（どのメソッドを実装したか）
- **§2.12 のスコープ設定と最新確定（calendar.events / 専用カレンダー無し）に食い違いがあったか**、あった場合どう処理したか
- `typecheck` / `build` の結果
- 設計書通りに実装できなかった点・判断に迷った点があれば、勝手に進めず報告
- commit はせず、**まず実装と動作確認の報告まで**（commit/push の可否はたかしさんが判断）

---

**以上。設計は §2 に全部あるので、それに忠実に。ただしスコープだけは最新の確定（§2 の最重要確認）を優先。迷ったら勝手に進めず報告すること。**
