# Q-U-j 9件 Sさん contract 確認回答 v0.1

**起草日**: 2026-05-26(火)
**起草者**: Sさん(Sonnet、 contract 確定起草)
**宛先**: 技術顧問経由で Uさん、 たかしさん
**前提**:
- `docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md`(Uさん 起草、 §8 で Q-U-j 13件提示)
- `docs/Phase2/B2_contract引き継ぎメモ_Sさん_to_Uさん_2026-05-24.md`(Sさん 引き継ぎ、 §6.2 で WebSpeech 論点)
- `src/interfaces/`(B2 contract 6本、 2026-05-24 起草)
**範囲**: Q-U-j 13件のうち **Sさん 担当 9件**(Q-U-j-1 / 2 / 3 / 5 / 6 / 7 / 10 / 12 / 13)。 Uさん 内判断 4件(Q-U-j-4 / 8 / 9 / 11)は対象外。
**優先順**: Q-U-j-1(Uさん SecretStore 着手解除のため)→ Q-U-j-13(v0.2 畳み込み前提の最重要)→ 残 7件。
**取り決め**:
- 実装コード本体には触らない(GO-C: 後日 ユニット依存順)
- contract 修正は本回答メモを起点に v0.2 で一括反映(タイミングは技術顧問判断、 Sさん が `src/interfaces/*.ts` を Edit)

---

## 0. このメモについて

### 0.1 目的

Uさん 実装設計 v0.1 §8 で提示された Q-U-j 13件のうち **Sさん 担当 9件** に対し、 contract 確定の根拠つき回答を一括で出す。 Uさん が「Sさん 確認待ち」 で止まっている箇所を解除し、 実装設計 v0.2 畳み込みの前提を揃える。

### 0.2 回答の凡例

各 Q について以下構造で記述:

- **問題**: Uさん 実装設計 v0.1 から要約
- **Sさん 結論**: 採用する選択 + 一行サマリ
- **根拠**: なぜその選択か(2〜4点)
- **contract 影響**: v0.2 反映候補かどうか、 反映する場合の差分
- **Uさん 実装時の補足**: 実装着手時に気をつける点

### 0.3 contract 修正サマリ(§10 に再掲)

- Q-U-j-1 / 5 / 6 / 7 / 10 / 13 の 6 件で contract 修正候補が発生(v0.2 で一括反映)
- Q-U-j-2 / 3 / 12 は contract 影響なし(実装側 / 環境設定 / Cloud Run 側で対応)

---

## 1. Q-U-j-1【★優先確定 — Uさん SecretStore 着手解除】

### 問題

`SecretStoreDeps` を contract 側 (`src/interfaces/SecretStore.ts`) に追記するか、 Uさん 拡張として `IndexedDbSecretStore.ts` 内に閉じるか。 現 contract は `initialize(): Promise<SecretStoreInitResult>` で引数なし、 Clock 抽象を入れるには deps 注入が必要。

### Sさん 結論

**(a) contract 側に追記する**。 `SecretStore.initialize(deps: SecretStoreDeps)` に変更し、 `SecretStoreDeps` を contract から export。

### 根拠

1. **Provider 化原則との一貫性**([[feedback_provider_pattern_principle]]): AuthProvider / StorageProvider はすでに `initialize(deps: ...)` パターン。 SecretStore も揃えると「全 Provider が同じ adapter pattern」 が崩れない
2. **テスト容易性**: deps 経由で Clock / Logger を差し替え可能 → `fake-indexeddb` + fake clock のテストハーネスが綺麗に組める
3. **「未来縛らない」**([[feedback_future_unbound_two_layer]]): 将来 SecretStore に `metricsCollector` / migration runner 等の deps 追加時、 既に deps スロットがあれば差分最小
4. Uさん 実装設計 §1.2 で既に `interface SecretStoreDeps { clock: Clock; logger?: Logger }` と提示済み、 contract 化するだけで設計差分なし

### contract 影響(v0.2 反映候補)

`src/interfaces/SecretStore.ts`:

```typescript
import type { Clock, Logger } from './types';

export interface SecretStore {
  initialize(deps: SecretStoreDeps): Promise<SecretStoreInitResult>;
  putSecret(key: SecretKey, value: string): Promise<SecretOpResult>;
  getSecret(key: SecretKey): Promise<string | null>;
  removeSecret(key: SecretKey): Promise<SecretOpResult>;
  clearAll(): Promise<SecretOpResult>;
  hasMasterKey(): Promise<boolean>;
}

export interface SecretStoreDeps {
  clock: Clock;
  logger?: Logger;
}
```

(他の型 = `SecretKey` / `SecretStoreInitResult` / `SecretOpResult` は据え置き)

### Uさん 実装時の補足(SecretStore 着手解除)

- **本確定により Q-U-j-1 待ちは解除、 IndexedDbSecretStore 実装着手 GO**
- 暫定運用: contract v0.2 反映前は実装ファイル内に local で `interface SecretStoreDeps` を定義(Uさん 実装設計 v0.1 §1.2 の通り)、 v0.2 反映時に `import type { SecretStoreDeps } from '@/interfaces/SecretStore'` に切替
- v0.2 反映後の差分は import 文 1〜2行のみ、 実装ロジックへの影響なし

---

## 2. Q-U-j-13【★最重要 — v0.2 畳み込みの前提】

### 問題

`WebSpeechTTSProvider` 実装が contract と矛盾(Web Speech API は「合成 → 再生」 一体型、 ArrayBuffer 取得不可)。 Sさん 引き継ぎメモ §6.2 で提示した 3案のいずれを確定するか:
- 案 X: TTSProvider 維持、 WebSpeech は別 contract(SpeakProvider 等)に分離
- 案 Y: contract を「合成して再生」(`Promise<PlayResult>`)に変更
- 案 Z: `synthesize()` + `synthesizeAndPlay()` 二段構え、 `capabilities` で宣言

### Sさん 結論

**案 Z で確定**(synthesize + synthesizeAndPlay 二段構え、 capabilities 宣言)。

### 根拠

1. **案 X のデメリット**: 「TTS」 という 1 機能に対し 2 つの contract が並ぶ、 抽象化のシンメトリ崩壊。 将来 OpenAI TTS / BYOK TTS 追加時に「どちらに属するか」 で再判定リスク
2. **案 Y のデメリット**: VoicevoxTTSProvider 側で「ArrayBuffer 取得」 ユースケースが死ぬ。 録音保存 / 速度可変再生 / オフライン保存 / 商品化版での拡張柔軟性が大きく低下
3. **案 Z のメリット**:
   - `capabilities` 宣言で「Provider 自身が何をできるか」 を呼出側に伝える
   - BYOK TTS / OpenAI TTS / その他将来サービス追加でも破綻しない構造
   - Uさん 推奨案と一致([[feedback_推奨と確定の差]] の精神で、 Uさん 感触を最大限尊重)
4. ベータ v1.0 スコープ縮小余地: VoicevoxTTSProvider のみ実装、 WebSpeechTTSProvider は v1.1 以降

### contract 影響(v0.2 反映候補)

`src/interfaces/TTSProvider.ts`:

```typescript
export interface TTSProvider {
  readonly providerId: string;
  readonly capabilities: TTSCapabilities;
  /** capabilities.synthesize=true の場合のみ実装される */
  synthesize?(text: string, options: TTSOptions): Promise<TTSResult>;
  /** capabilities.synthesizeAndPlay=true の場合のみ実装される */
  synthesizeAndPlay?(text: string, options: TTSOptions): Promise<PlayResult>;
  isAvailable(): Promise<boolean>;
  dispose(): Promise<void>;
}

export interface TTSCapabilities {
  synthesize: boolean;
  synthesizeAndPlay: boolean;
}

export type PlayResult =
  | { ok: true; durationMs: number }
  | { ok: false; reason: TTSErrorReason };
```

ベータ v1.0 で各 Provider が宣言する capabilities:
- **VoicevoxTTSProvider**: `{ synthesize: true, synthesizeAndPlay: false }`
- **WebSpeechTTSProvider**: v1.1 で `{ synthesize: false, synthesizeAndPlay: true }`(ベータでは未実装)

### 呼出側パターン(B3 ChatService 等での参照実装)

```typescript
async function speak(provider: TTSProvider, text: string, options: TTSOptions): Promise<void> {
  if (provider.capabilities.synthesizeAndPlay && provider.synthesizeAndPlay) {
    await provider.synthesizeAndPlay(text, options);
    return;
  }
  if (provider.capabilities.synthesize && provider.synthesize) {
    const result = await provider.synthesize(text, options);
    if (result.ok) await playArrayBuffer(result.audioBuffer); // Web Audio API
    return;
  }
  throw new Error(`Provider ${provider.providerId} can neither synthesize nor play`);
}
```

### Uさん 実装時の補足

- **ベータ v1.0 では VoicevoxTTSProvider のみ実装着手 OK**(Uさん 実装設計 v0.1 §4 通り)
- WebSpeechTTSProvider は contract v0.2 反映 + v1.1 計画時に再着手
- `capabilities` を readonly で固定する設計(constructor で確定、 動的に変わらない)→ TypeScript の `readonly` + class field で型安全

---

## 3. Q-U-j-2

### 問題

`localStorage` の `deviceSeed` キー名(`invokeaide.deviceSeed`)を SecretStore 内に閉じるか、 上位の constants に抽出するか。

### Sさん 結論

**SecretStore class 内に閉じる**(`private static readonly DEVICE_SEED_KEY = 'invokeaide.deviceSeed'` で定数化、 重複ハードコード回避)。

### 根拠

1. ベータ規模では SecretStore 内に閉じる方がシンプル
2. 他の実装ファイルから参照不要(`deviceSeed` は SecretStore の内部実装詳細)
3. 商品化版で複数 Storage 系実装が出てきたら `src/config/storage-keys.ts` への抽出を再検討
4. [[feedback_density_not_breadth]]: 抽出ファイル増やすより本丸(SecretStore 実装)を厚く

### contract 影響

なし(実装側で完結)。

### Uさん 実装時の補足

```typescript
class IndexedDbSecretStore implements SecretStore {
  private static readonly DEVICE_SEED_KEY = 'invokeaide.deviceSeed';
  // 全 localStorage アクセスは IndexedDbSecretStore.DEVICE_SEED_KEY 経由
}
```

---

## 4. Q-U-j-3

### 問題

`clientId` / `redirectUri` の dev / staging / prod 切替方法。

### Sさん 結論

**Vite 標準の `.env.*` + `import.meta.env` を採用**。

### 根拠

1. Vite ネイティブ、 学習コスト最小
2. GitHub Secrets と相性良(CI で `.env.production` を Secret から生成)
3. 環境変数 prefix `VITE_` 必須(Vite 規約)→ BYOK セキュリティ的にも安全(`VITE_` 以外は bundle に出ない)
4. ランタイム config (`/config.json` を fetch) より起動が早い、 ビルド時 `define` より柔軟

### ファイル構造

```
.env.example       (テンプレート、 commit 対象)
.env.development   (.gitignore、 ローカル開発用)
.env.staging       (.gitignore、 ステージング用)
.env.production    (.gitignore、 本番用 = CI で GitHub Secrets から生成)
```

`.env.example` の中身案:

```
VITE_GOOGLE_CLIENT_ID=YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_VOICEVOX_ENDPOINT=https://voicevox-engine-xxx.a.run.app
VITE_VOICEVOX_AUTH_TOKEN=YOUR_VOICEVOX_AUTH_TOKEN
```

### 参照例

```typescript
const config: AuthConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI,
  stage1Scopes: [...],
  stage2AdditionalScopes: [...],
};
```

ビルド:
- dev: `npm run dev` (`.env.development` 自動読込)
- staging: `npm run build -- --mode staging` (`.env.staging` 読込)
- production: `npm run build` (`.env.production` 読込)

### contract 影響

なし(実装側 / 環境設定の話)。

### Uさん 実装時の補足

- `.env.example` 起草は Uさん B2 着手前 or 同時に実施(Sさん レビュー対象)
- AuthConfig 等の env 変数読み込みは `src/implementations/createAuthConfig.ts` のような factory に集約推奨(直接 import.meta.env を散らさない)
- `.gitignore` に `.env.development` / `.env.staging` / `.env.production` を追加(B2 着手時)

---

## 5. Q-U-j-5

### 問題

`refresh_token` 失効時の UI 通知発火経路。 `onStageChange('unauth')` で十分か、 追加イベントが必要か。

### Sさん 結論

**既存 `onStageChange` を拡張し、 `cause` 引数を追加**。 追加イベントは作らず、 既存 API シンメトリを保つ。

### 根拠

1. UI 側で「単純なログアウト」 と「予期せぬ失効」 を区別する必要(再ログイン促し UI の文言が変わる)
2. 追加イベント(`onAuthError`)より既存 `onStageChange` 拡張の方が listener 管理がシンプル
3. `'unknown'` を含めて「未来縛らない」([[feedback_future_unbound_two_layer]])

### contract 影響(v0.2 反映候補)

`src/interfaces/AuthProvider.ts`:

```typescript
export type StageChangeCause =
  | 'user_signout'        // 明示的に signOut() が呼ばれた
  | 'refresh_failed'      // silent refresh が失敗(token 失効)
  | 'consent_granted'     // requestStage*Consent 成功で昇格
  | 'restored_from_storage' // initialize 時に refresh_token から復元
  | 'unknown';

export interface AuthProvider {
  // ... 既存メソッド
  onStageChange(cb: (stage: AuthStage, cause: StageChangeCause) => void): Unsubscribe;
}
```

### 呼出側パターン

- `cause === 'user_signout'` → サイレントにログイン画面へ遷移
- `cause === 'refresh_failed'` → 「セッションが切れました、 再ログインしてください」 バナー表示
- `cause === 'consent_granted'` / `'restored_from_storage'` → 通常のステージ遷移、 特別な UI 不要

### Uさん 実装時の補足

- `signOut()` 内では `setStage('unauth', 'user_signout')`
- `silentRefresh()` 失敗時 `setStage('unauth', 'refresh_failed')`
- `requestStage*Consent()` 成功時 `setStage(newStage, 'consent_granted')`
- `initialize()` で refresh_token から復元成功時 `setStage(stage, 'restored_from_storage')`

---

## 6. Q-U-j-6

### 問題

`AuthProvider` に「granted scopes を返すメソッド」 を追加するか。 StorageProvider の `initialize` で Drive スコープ拒否を検出するため。

### Sさん 結論

**(a) `AuthProvider.getGrantedScopes(): Promise<string[] | null>` を追加**。

### 根拠

1. StorageProvider の `initialize()` で Drive スコープ拒否判定が必要(Uさん 実装設計 v0.1 §3.5 step 2)
2. `AuthInitResult.stage` から推定する方式(案 b)は脆い → 将来 scope 構成変更で判定ロジック破綻
3. 明示的に exposed する方が将来 Provider(Calendar Calendar 専用 / Gmail 等の拡張)でも使える
4. `null` は「unauth で scope 情報なし」、 `[]` (空配列)は「authorized だが scope が空(理論上ありえない)」 と区別

### contract 影響(v0.2 反映候補)

`src/interfaces/AuthProvider.ts`:

```typescript
export interface AuthProvider {
  // ... 既存メソッド
  /** 現在保持している granted scopes を返す。 unauth 時は null */
  getGrantedScopes(): Promise<string[] | null>;
}
```

### Uさん 実装時の補足

- 実装は `SecretStore.getSecret('oauth.grantedScopes')` を読んで返すだけで OK(Uさん 実装設計 v0.1 §2.5 で既に `'oauth.grantedScopes'` を SecretStore に保存する設計)
- StorageProvider 側:

```typescript
const scopes = await deps.auth.getGrantedScopes();
const hasDriveFile = scopes?.some((s) => s.includes('drive.file')) ?? false;
if (!hasDriveFile) return { ok: false, reason: 'drive_denied' };
```

---

## 7. Q-U-j-7

### 問題

`bundled` アセット返却時の `LoadResult.meta.source` をどう表現するか。 現 contract は `'drive' | 'cache' | 'pending'`、 bundled が表現不能。

### Sさん 結論

**(a) `source` に `'bundled'` を追加**(union type 拡張)。

### 根拠

1. UI 側で「初回起動時の同梱版」 と「ユーザー編集済 Drive 版」 を区別したい(例: 「ユーザー編集なし、 同梱の標準キャラ」 と表示)
2. `'cache' + meta.bundled?: boolean` 案(b)より、 union type 拡張の方が型安全(`switch` で exhaustive チェック可能)
3. UI 側で 4 分岐を素直に扱える

### contract 影響(v0.2 反映候補)

`src/interfaces/types.ts`:

```typescript
export interface ResourceMeta {
  driveFileId: string;
  /** RFC3339 UTC */
  modifiedTime: string;
  etag: string;
  source: 'drive' | 'cache' | 'pending' | 'bundled';
}
```

### Uさん 実装時の補足

- `DriveStorageProvider.loadCharacterMd` / `loadCoachingMd` で Drive 404 時に bundled fallback、 以下のように meta を返す:

```typescript
return {
  ok: true,
  value: bundledMd,
  meta: {
    driveFileId: `_bundled_${id}`,        // 識別用の擬似 ID
    modifiedTime: BUNDLED_BUILD_TIME,     // import.meta.env.VITE_BUILD_TIME 等から
    etag: '_bundled',
    source: 'bundled',
  },
};
```

- `BUNDLED_BUILD_TIME` は Vite の `define` で build 時に注入(`vite.config.ts` の `define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) }` 等)

---

## 8. Q-U-j-10

### 問題

`speakerId` 未指定時のデフォルトを Provider が解決するか、 呼出側責任とするか。

### Sさん 結論

**呼出側責任(Provider はフォールバック値を持たない)**。 加えて、 未指定時の reason を明示するため `TTSErrorReason` に **`'speaker_required'` を追加**。

### 根拠

1. Provider はインフラ層、 「現在のキャラ = どの speakerId か」 はドメインロジック(CharacterService の責任) → 関心分離を保つ
2. Provider 側でフォールバック値持つと、 デフォルト変更が Provider 修正になる(現状 MIYU = ずんだもん 想定だが、 将来変動)
3. 明示的に呼出側責任にすれば、 ChatService 等が `currentCharacter.voicevoxSpeakerId` を必ず渡す pattern が定着
4. 既存 `'invalid_text'` で代替するより `'speaker_required'` の方が呼出側の対処が明確(text 入力 UI vs キャラ選択 UI へ誘導)

### contract 影響(v0.2 反映候補)

`src/interfaces/TTSProvider.ts`:

```typescript
export type TTSErrorReason =
  | 'not_available'
  | 'unsupported_speaker'
  | 'speaker_required'     // ← 新規追加
  | 'rate_limit'
  | 'network'
  | 'auth'
  | 'invalid_text'
  | 'unknown';
```

### Uさん 実装時の補足

- `VoicevoxTTSProvider.synthesize(text, options)` の冒頭で:

```typescript
if (options.speakerId == null) {
  return { ok: false, reason: 'speaker_required' };
}
```

- 呼出側(B3 ChatService 等)で必ず `speakerId` を渡す pattern を強制

---

## 9. Q-U-j-12

### 問題

VOICEVOX 公式 `/audio_query?text=<text>&speaker=<id>` は URL クエリで text を渡す。 Cloud Run の access log に記録されるリスク。 POST ボディ化(プライバシー保護)を検討。

### Sさん 結論

**ベータ v1.0 は VOICEVOX 公式仕様準拠(URL クエリ)で許容、 Cloud Run / nginx 側で `text` パラメータを access log から除外する設定で運用**。 商品化版で proxy ラッパー(Uさん 推奨方針)を実装。

### 根拠

1. VOICEVOX 公式 API を変更すると VOICEVOX 本体改修が必要、 ベータ v1.0 のスコープ外
2. nginx 側で `log_format` カスタマイズ + `access_log` で text パラメータマスクが現実的
3. Privacy Policy 「音声合成のため一時的に処理、 保存しない」([[feedback_future_unbound_two_layer]] の言語表現側)と整合 — log に残らない設計で「保存しない」 を構造的に担保
4. 商品化版で proxy ラッパー(Cloud Run 内に nginx + Lua or Node.js wrapper)で POST 化、 v1.x 拡張余地

### contract 影響

なし(Cloud Run deploy ワークフロー側 / VoicevoxTTSProvider 実装側で対応)。

### Uさん 実装時の補足

- VoicevoxTTSProvider の実装は VOICEVOX 公式仕様準拠で OK、 ログ最小化は Cloud Run / nginx 側で対応
- nginx の `log_format` 例(Cloud Run deploy ワークフロー v0.2 で Uさん が追加):

```nginx
log_format minimal '$remote_addr $time_iso8601 $request_method $status $body_bytes_sent';
access_log /var/log/nginx/access.log minimal;
```

- 法的書類 v0.4 起草担当に「音声合成サーバーの access log には text 本文は含めない」 を Privacy Policy に明記依頼(`Phase1_技術選定_法的書類連携メモ_2026-05-22.md` §1.4 確認事項に追加)

---

## 10. contract 修正サマリ(v0.2 反映候補)

| # | 対象ファイル | 変更内容 | 起源 Q |
|---|---|---|---|
| C1 | `src/interfaces/SecretStore.ts` | `initialize()` に `deps: SecretStoreDeps` 引数追加、 `SecretStoreDeps` interface を export | Q-U-j-1 |
| C2 | `src/interfaces/AuthProvider.ts` | `onStageChange` の cb 引数に `cause: StageChangeCause` 追加、 `StageChangeCause` type export | Q-U-j-5 |
| C3 | `src/interfaces/AuthProvider.ts` | `getGrantedScopes(): Promise<string[] | null>` メソッド追加 | Q-U-j-6 |
| C4 | `src/interfaces/types.ts` | `ResourceMeta.source` に `'bundled'` を追加 | Q-U-j-7 |
| C5 | `src/interfaces/TTSProvider.ts` | `TTSErrorReason` に `'speaker_required'` を追加 | Q-U-j-10 |
| C6 | `src/interfaces/TTSProvider.ts` | `TTSProvider` に `capabilities` 追加 / `synthesize` と `synthesizeAndPlay` を optional 二段構え / `TTSCapabilities` / `PlayResult` を export | Q-U-j-13 |

**反映タイミング**: 本回答メモを起点に、 技術顧問判断で「contract v0.2」 として Sさん が `src/interfaces/*.ts` を Edit、 別 PR で main へマージ。 Uさん の v0.2 反映メモ起草とタイミング揃える。

contract 修正なし(実装側 / 環境設定 / Cloud Run 側で対応):
- Q-U-j-2(SecretStore 内 class 定数化)
- Q-U-j-3(Vite `.env.*` + `import.meta.env`)
- Q-U-j-12(Cloud Run / nginx 側で text パラメータマスク)

---

## 11. Uさん 実装着手解除の合図

- **Q-U-j-1 確定 → IndexedDbSecretStore 着手 GO**(本回答メモ §1 を確認後)
  - 暫定: 実装ファイル内に local で `interface SecretStoreDeps { clock: Clock; logger?: Logger }` を定義
  - contract v0.2 反映後に `import type { SecretStoreDeps } from '@/interfaces/SecretStore'` に切替
  - 差分は import 文 1〜2行のみ、 実装ロジックへの影響なし

- **Q-U-j-13 確定 → VoicevoxTTSProvider 着手 GO**(capabilities = `{ synthesize: true, synthesizeAndPlay: false }`)
  - WebSpeechTTSProvider は v1.1 計画時に再着手(ベータ v1.0 では未実装)

- 他の実装(GoogleAuthProvider / DriveStorageProvider)は Q-U-j-3 / 5 / 6 / 7 の確定を踏まえつつ、 contract v0.2 反映を待たずに暫定で進行可(local 定義 + import 切替 pattern)

---

## 12. 副次的気づき

### 12.1 contract v0.2 反映は Sさん 起草

実装設計 v0.2 反映メモ(Uさん 起草、 2026-05-26 配置済)とは別軸で、 contract `src/interfaces/*.ts` の Edit は **Sさん 領域**。 反映タイミングは技術顧問判断、 Sさん が別 PR で起こす。

### 12.2 Q-U-j-3 .env.example 起草の連携

`.env.example` 起草は Uさん B2 着手前 or 同時に実施、 Sさん レビュー。 これは contract ではなく実装側 / 環境側の話だが、 起草の責任配分を明示化([[project_t_to_s_handover]] の精神)。

### 12.3 Q-U-j-12 法的書類連携の追加項目

法的書類 v0.4 起草担当に「音声合成サーバーの access log には text 本文を含めない」 を Privacy Policy に明記依頼。 `docs/Phase1/Phase1_技術選定_法的書類連携メモ_2026-05-22.md` §1.4 確認事項に追加項目として申し送り(本メモのスコープ外、 別途 Sさん が追記)。

### 12.4 「未来縛らない」 原則の運用テスト

本回答で 4 件(Q-U-j-1 / 5 / 7 / 10)の contract 修正候補が出たが、 いずれも「現状 + `'unknown'` / `'bundled'` / `'speaker_required'` / 拡張余地」 の形で「未来縛らない」 を貫けている([[feedback_future_unbound_two_layer]] の 2層構造)。 contract 修正の質的安全性を確認。

---

**以上、 Sさん(Sonnet) Q-U-j 9件 contract 確認回答 v0.1。**

技術顧問さん経由で Uさん へ共有をお願いします。 Uさん は本回答を確認次第 SecretStore / VoicevoxTTSProvider 着手 GO。 contract v0.2 反映は別途 Sさん が `src/interfaces/*.ts` を Edit + PR(タイミング技術顧問指示)。
