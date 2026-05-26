---
title: AuthProvider 関連 Q-U-j 前倒し整理(Sさん 確認質問)
date: 2026-05-26
author: Uさん(InvokeAide 実装補助 / 横串整合)
status: Sさん 即答用の質問明確化、技術顧問経由で共有
scope: AuthProvider のブロッキング Q-U-j 2 件 (Q-U-j-3 / Q-U-j-5) を、Uさん 案 + 選択肢付きで明示
upstream:
  - docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md §2(GoogleAuthProvider 実装設計)
  - docs/Phase2/Phase2_実装設計_v0.2反映メモ_2026-05-26.md §6.2(残ブロッカー 9 件のうち AuthProvider 関連 2 件)
  - 技術顧問指示(2026-05-26): 案1 = AuthProvider 関連 Q-U-j の前倒し整理(質問明確化のみ)
取り決め:
  - 本書は実装設計 v0.2 への素材、Sさん の即答を得て v0.2 本体起草時に統合
  - GO-C 段階的 GO の範囲内、AuthProvider 実装本体には未着手
---

# AuthProvider 関連 Q-U-j 前倒し整理(Sさん 確認質問)

## 0. このメモについて

AuthProvider のブロッキング Q-U-j は 2 件(Q-U-j-3 / Q-U-j-5)。両方とも Sさん 確認領域だが、**v0.1 §2 / §8.2 の表現だと Sさん が「何を聞かれているか」を解釈する手間がある**。本書では Sさん が即答できるよう、**選択肢 + Uさん 案 + 影響範囲**をセットで明示する。

Sさん が選択肢から選んで一行返してくれれば確定 → v0.2 反映メモに追記 → AuthProvider 実装着手可能(SecretStore 完成後)。

---

## 1. Q-U-j-3: clientId / redirectUri の dev / staging / prod 切替方法

### 1.1 何を決めたいか

`GoogleAuthProvider` の `AuthDeps.config`(`AuthConfig` 型)に渡す `clientId` と `redirectUri` を、**開発環境 / ステージング / 本番** で正しく差し替えるための仕組み。引き継ぎメモ §4「実装ファイルにハードコード禁止、外部注入必須」を満たす方法を確定したい。

### 1.2 影響範囲

- B1 で `vite.config.ts` に PWA manifest を統合済(Sさん の B1 完了報告 ドラフト)
- Vite の標準的な `.env` 機構が使えるが、**どのファイル名で / どの prefix で /  GitHub Secrets との橋渡しはどうするか**を確定する必要

### 1.3 選択肢

#### 案 A: Vite `.env.<mode>` + `VITE_*` prefix(Uさん 推奨)

```
.env                     # 全 mode 共通(.gitignore 推奨)
.env.development         # npm run dev で読まれる(.gitignore 推奨)
.env.production          # npm run build で読まれる
.env.example             # コミット可、変数名のテンプレート(値は placeholder)
```

```
# .env.example
VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_OAUTH_REDIRECT_URI=https://invokeaide-beta.pages.dev/auth/callback
VITE_VOICEVOX_ENDPOINT=https://voicevox-engine-xxx.a.run.app
VITE_VOICEVOX_AUTH_TOKEN=
```

実装側:

```typescript
const authConfig: AuthConfig = {
  clientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
  redirectUri: import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI,
  // ...
}
```

GitHub Secrets との橋渡し:
- GitHub Actions deploy ワークフローで `echo "VITE_GOOGLE_OAUTH_CLIENT_ID=${{ secrets.VITE_GOOGLE_OAUTH_CLIENT_ID }}" >> .env.production` のように動的生成
- もしくは `gh secret list` で渡される値を deploy 時の env block で `vite build` に渡す

**メリット**: Vite 標準、Sさん の既存 vite.config.ts と整合、ローカル開発 / Cloudflare Pages デプロイ / GitHub Actions すべてで動く
**デメリット**: `VITE_*` prefix で公開バンドルに含まれる(`clientId` は OAuth 仕様上クライアント側に出てよい値、`redirectUri` も同様、問題なし。`VOICEVOX_AUTH_TOKEN` は **クライアントバンドルに含めるべきでない** → 別経路要、後述)

#### 案 B: `src/config/auth.ts` に環境別ハードコード + 環境判定

```typescript
// src/config/auth.ts
const isDev = import.meta.env.DEV
const isStaging = import.meta.env.MODE === 'staging'

export const authConfig: AuthConfig = isDev
  ? { clientId: 'dev-id...', redirectUri: 'http://localhost:5173/auth/callback', ... }
  : isStaging
  ? { clientId: 'staging-id...', redirectUri: 'https://staging.invokeaide.app/auth/callback', ... }
  : { clientId: 'prod-id...', redirectUri: 'https://invokeaide-beta.pages.dev/auth/callback', ... }
```

**メリット**: 環境変数管理不要、コードだけで完結
**デメリット**: 引き継ぎメモ §4「ハードコード禁止」と矛盾、3 環境分の値がリポジトリに残る

#### 案 C: 実行時 Drive `settings.json` から読む

```typescript
// settings.json に dev/staging/prod 別の設定を持たせる(初期化時に Drive から取得)
```

**メリット**: 完全外部化
**デメリット**: OAuth は **Drive 取得の前段** で動くため、設定が取れない(鶏卵問題)。**実装不可**、選択肢から除外

### 1.4 Uさん 推奨理由

**案 A**(Vite `.env.<mode>` + `VITE_*` prefix)を推奨:

- 「未来縛らない」原則: `.env.development` / `.env.production` を分けることで dev/staging/prod 増減時に柔軟
- 引き継ぎメモ §4「ハードコード禁止」を満たす
- GitHub Secrets との橋渡しも標準(`gh secret list` + `>> .env.production` の `actions/checkout` 後の処理)
- `VITE_*` prefix のセキュリティ懸念は、`clientId` / `redirectUri` は OAuth 公開値で問題なし、`VOICEVOX_AUTH_TOKEN` は別経路(Cloud Run nginx 側で検証、フロントは Cloud Run URL のみ持つ)で吸収

### 1.5 Sさん へ確認したいこと

> **Q-U-j-3**: 上記 案 A(Vite `.env.<mode>` + `VITE_*` prefix) で進めて OK か?
> 別案を推す場合は、その案を一言で。
> 
> 補足:
> - `VOICEVOX_AUTH_TOKEN` をフロントに置きたい場合、Uさん の Cloud Run deploy ワークフロー設計(nginx 側で Bearer 検証)とどう整合させるか別途相談したい

---

## 2. Q-U-j-5: refresh_token 失効時の UI 通知発火経路

### 2.1 何を決めたいか

`silentRefresh()` が `refresh_failed` を返した場合、ユーザーに **「再ログインが必要です」を伝える UI** をどう発火するか。`AuthProvider` 内では `setStage('unauth')` で内部 stage を変えるが、UI 側にこれを **どう届けるか** を決める。

### 2.2 影響範囲

- `onStageChange(cb)` リスナーで通知が飛ぶ → これだけで足りるか、追加のイベント発火が必要か
- B3 領域(Sさん)で「再ログイン必要バナー / モーダル」の UI コンポーネントを実装する想定
- StorageProvider の `initialize()` も Drive 拒否 / auth 失敗を返すため、こことの整合性

### 2.3 選択肢

#### 案 X: `onStageChange('unauth')` だけで十分(Uさん 推奨)

```typescript
// アプリ起動時 or initialize 時に登録
authProvider.onStageChange((stage) => {
  if (stage === 'unauth') {
    // 既に登録済みだった場合のみ「失効」、初回起動の unauth は除外
    if (wasAuthenticated) {
      showReLoginBanner()
    }
  }
})
```

**メリット**: contract 既存 API のみで済む、追加メソッド不要
**デメリット**: 「stage 遷移」と「失効イベント」が同じチャネル、UI 側で「直前まで stage1 だったか」を覚える必要

#### 案 Y: `onAuthExpired(cb)` を contract に追加

```typescript
// AuthProvider に新メソッド追加
onAuthExpired(cb: () => void): Unsubscribe
// silentRefresh() が 'refresh_failed' を返した瞬間に発火
```

**メリット**: 「失効」イベントが明示的、UI 側ロジックが単純
**デメリット**: contract 変更(Sさん 起草の B2 contract 再起草)、API サーフェス増加

#### 案 Z: `AuthInitResult` / `AccessTokenResult` の `reason` を UI 側で見て発火

```typescript
// 呼出側で getAccessToken() の結果を見て発火
const result = await authProvider.getAccessToken()
if (!result.ok && result.reason === 'refresh_failed') {
  showReLoginBanner()
}
```

**メリット**: contract 変更不要、呼出側で明示的
**デメリット**: getAccessToken() を呼ぶたびに UI 側でハンドリング、忘れ漏れリスク

### 2.4 Uさん 推奨理由

**案 X**(`onStageChange('unauth')` のみで完結)を推奨:

- contract 変更ゼロ → Sさん の B2 contract に追加負担なし
- 「stage 遷移」リスナーは UI / コンポーネント側のどこかで必ず購読されるため(キャラ表示 / 機能可用性判定等)、失効検出を別チャネルにする必要が薄い
- 「直前まで stage1 だったか」の状態は、Pinia store(`useAuthStore`)で `previousStage` を保持すれば吸収可能(2-3 行)
- 「未来縛らない」原則: contract に新メソッドを追加するより、既存 listener で吸収するほうが将来の柔軟性が高い

### 2.5 Sさん へ確認したいこと

> **Q-U-j-5**: 上記 案 X(`onStageChange('unauth')` のみで完結、UI 側で `previousStage` を保持して失効判定) で進めて OK か?
> 別案を推す場合は、その案を一言で。
> 
> 補足:
> - B3 領域の Pinia store(`useAuthStore`)に `previousStage: AuthStage | null` フィールドを追加することを想定
> - `signOut()` 経由の unauth(ユーザー意図)と、`silentRefresh failed` 経由の unauth(自動失効)を UI で区別したい場合、別途 `triggerReason` のような情報も必要 → これは案 X の延長で追加可能

---

## 3. Sさん 即答テンプレート(技術顧問経由で渡す想定)

Sさん が以下のテンプレートを埋めて返してくれれば確定:

```
Q-U-j-3 (clientId/redirectUri 切替): 
  □ 案 A (Vite .env.<mode> + VITE_* prefix) で OK
  □ 案 B (config ファイルにハードコード) で進める
  □ 別案: ____________________

Q-U-j-5 (refresh_token 失効 UI 通知):
  □ 案 X (onStageChange の unauth で完結) で OK
  □ 案 Y (onAuthExpired を contract 追加) で進める
  □ 案 Z (呼出側で reason を見る) で進める
  □ 別案: ____________________
```

回答到着後、Uさん が v0.2 反映メモに追加 → AuthProvider 実装設計が確定(残るは SecretStore 完成後の依存解決のみ)。

---

## 4. AuthProvider 着手までのチェックリスト

| 項目 | 状態 |
|---|---|
| Q-U-j-3 確定 | ⏳ Sさん 回答待ち(本書で前倒し整理済) |
| Q-U-j-4 確定 | ✅ Uさん 内判断(v0.2 反映メモ §1) |
| Q-U-j-5 確定 | ⏳ Sさん 回答待ち(本書で前倒し整理済) |
| SecretStore 実装完成 | 🔴 まだ着手していない(Q-U-j-1 ブロック中) |
| 技術顧問の GO サイン | ⏳ SecretStore 完成 + Q-U-j-3/5 確定後 |

→ AuthProvider 実装着手は **Q-U-j-3 / 5 確定 AND SecretStore 完成 AND 技術顧問 GO** の 3 条件揃った時点。

---

## 5. 変更履歴

| Version | 日付 | 主な変更 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-26(火) | 初版作成。Q-U-j-3 / Q-U-j-5 を Sさん 即答用に明確化、選択肢 + Uさん 案 + テンプレート提示 | Uさん(Opus) |

---

— Uさん(2026-05-26、AuthProvider 関連 Q-U-j 前倒し整理 v0.1。案 1 完了、案 2 に続く)
