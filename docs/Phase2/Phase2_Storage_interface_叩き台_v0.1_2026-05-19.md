# Phase 2 Storage interface 叩き台 v0.1

**作成日**: 2026-05-19(火)
**起草者**: Uさん(Opus、実装補助担当)
**位置づけ**: Phase 2 Sprint 1 並列タスク b)、Sさん が **確定起草** する Storage contract の **叩き台**(Uさん 実装観点)
**役割関係**: TTSProvider パターン同型 = **Sさん が contract 確定 / Uさん が実装** 。本書は Uさん の実装側から「こういう契約だと実装が綺麗」を提案する叩き台で、Sさん 起草版で別物に書き直されることを織り込んでいる。
**前提**:
- Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md(Stage 機械、AuthProvider 結合点)
- Phase2_Drive_ファイルレイアウト設計_v0.1_2026-05-19.md(F1〜F9 ファイル仕様、LWW、初回作成)
- たかしさん指示書(2026-05-19): Sさん が持ち込む観点 = **暗号化要件 / SoT 同期セマンティクス / オフライン挙動** の 3 点
- 法的書類 v0.3 §1.2「未来の自分を縛らない」原則(型定義にも適用)

---

## 0. エグゼクティブ・サマリ

### 0.1 Sさん contract 確定への論点 3 つ(本書で叩き台提示)

| Sさん 観点 | Uさん 叩き台での提案 | Sさん 確定で書き換え余地 |
|---|---|---|
| **暗号化要件** | Drive 上のファイルは法的書類 v0.3 §6.5 に基づき平文。秘密鍵 / API キー / リフレッシュトークンは別 interface `SecretStore`(IndexedDB + AES-GCM)で分離。 | 会話ログを暗号化対象に追加するなら `encrypt?: boolean` を `appendConversation` に追加 |
| **SoT 同期セマンティクス** | Drive = 永続 SoT、IndexedDB = キャッシュ。Read-through / Write-through、競合は ETag ベース楽観ロック。 | キャッシュ TTL、`forceFresh` パラメータの是非、Background Sync の粒度 |
| **オフライン挙動** | 読みはキャッシュフォールバック、書きは **pending queue** で IndexedDB に保留 → オンライン復帰時に flush。UI には `SyncState` を露出。 | pending queue の永続化形式、競合発生時のユーザー通知 UX |

### 0.2 全体構造

```
Sさん 側 ─── 利用 ───┐                    ┌─── 実装 ───  Uさん 側
                     │                    │
[ChatService / UI] ──→ Storage interface ←── [DriveStorage]
                                              │
                                              ├──→ AuthProvider (a 設計)
                                              ├──→ Drive REST API
                                              ├──→ IndexedDB Cache
                                              └──→ SecretStore (別 interface)
```

---

## 1. 本書の目的・非目的

### 1.1 目的

Sさん が Storage contract を確定起草する **前段の叩き台** を、Uさん の実装観点から提示する。以下を含む:
- メイン `Storage` interface の TypeScript 草案
- 周辺型(Settings / CharacterIndex / Profile / ErrorEntry / SaveResult / SyncState 等)
- 同期 / オフライン / 暗号化 のセマンティクス案
- AuthProvider / SecretStore / 設定UI との結合点

### 1.2 非目的(明示的に避けるもの)

- contract 確定(Sさん 領域)
- メソッドシグネチャの完全網羅 — 「最低限ここを露出してくれると実装しやすい」だけ示す
- DriveStorage 実装の詳細(Drive API リクエスト構成、ETag 管理アルゴリズム等)
- UI 文言・3択ボタン設計(Sさん 領域)

### 1.3 表現方針

「未来の自分を縛らない」を **型定義にも適用** :
- 列挙型は `as const` で固定せず、 `string` リテラル合併で拡張余地
- `Result` 型に必須でない `reason` を `| 'unknown'` で開けておく
- メソッドは `Promise<...>` を返し、 throw に頼らない(エラーは値)

---

## 2. メイン Storage interface(TypeScript 草案)

```typescript
// ============================================================
// 設計原則
// ============================================================
// 1. throw に頼らない — エラーは Result 型で表現
// 2. すべて非同期 — Drive / IndexedDB / 復号 のいずれも非同期
// 3. 型は拡張余地を残す — string リテラル合併 / Result.reason に 'unknown'
// 4. 大きい / 重い操作(キャラMD読み込み、会話ログアーカイブ)は
//    キャッシュ可能性を呼び出し側に意識させる(load* と loadCached* の分離)
// ============================================================

export interface Storage {
  // -- 初期化・ライフサイクル -------------------------------
  initialize(deps: StorageDeps): Promise<InitResult>;
  ensureLayout(): Promise<EnsureLayoutResult>;
  dispose(): Promise<void>;

  // -- 設定(F3 settings.json) ------------------------------
  loadSettings(): Promise<LoadResult<Settings>>;
  saveSettings(settings: Settings): Promise<SaveResult>;
  watchSettings(cb: (s: Settings) => void): Unsubscribe;

  // -- キャラ(F2 index.json / F6 / F7) --------------------
  loadCharacterIndex(): Promise<LoadResult<CharacterIndex>>;
  saveCharacterIndex(index: CharacterIndex): Promise<SaveResult>;
  loadCharacterMd(id: string): Promise<LoadResult<string>>;
  loadCoachingMd(id: string): Promise<LoadResult<string>>;
  saveCharacterMd(id: string, md: string): Promise<SaveResult>;
  saveCoachingMd(id: string, md: string): Promise<SaveResult>;
  // ビルド同梱版 vs Drive 版の差分検出(Q-U-c-2 起動時通知 + 3択 UI 用)
  diffBundledVsDrive(id: string): Promise<CharacterDiffResult>;

  // -- プロファイル(F4 profile.md) ------------------------
  loadProfile(): Promise<LoadResult<Profile>>;
  saveProfile(profile: Profile): Promise<SaveResult>;

  // -- マニュアル(F5 manual.md、Sさん 起草、読みのみ) ----
  loadManual(): Promise<LoadResult<string>>;

  // -- 履歴(F8 / F9、追記専用)-----------------------------
  appendError(entry: ErrorEntry): Promise<AppendResult>;
  archiveConversation(date: IsoDate, content: string): Promise<AppendResult>;
  loadConversation(date: IsoDate): Promise<LoadResult<string>>;
  listConversationDates(): Promise<LoadResult<IsoDate[]>>;

  // -- 同期・オフライン -------------------------------------
  getSyncState(): SyncState;
  watchSyncState(cb: (s: SyncState) => void): Unsubscribe;
  flushPending(): Promise<FlushResult>;
  // 競合発生時のイベント(F12.1 の conflicts/ への退避通知)
  onConflict(cb: (event: ConflictEvent) => void): Unsubscribe;
}

// ============================================================
// 依存注入
// ============================================================

export interface StorageDeps {
  auth: AuthProvider;           // Phase2_OAuth_スコープ設計 §10.1
  secretStore: SecretStore;     // §6 で別 interface 切り出し
  clock: Clock;                 // テスト容易性のため
  logger?: Logger;              // 任意
}

export interface Clock { now(): Date; }
export interface Logger { warn(msg: string, ctx?: object): void; }

// ============================================================
// 結果型(throw に頼らない)
// ============================================================

export type LoadResult<T> =
  | { ok: true; value: T; meta: ResourceMeta }
  | { ok: false; reason: LoadErrorReason; cached?: T };

export type SaveResult =
  | { ok: true; meta: ResourceMeta }
  | { ok: false; reason: SaveErrorReason; pending?: boolean };

export type AppendResult =
  | { ok: true; meta: ResourceMeta }
  | { ok: false; reason: SaveErrorReason; pending?: boolean };

export type FlushResult =
  | { ok: true; flushed: number; skipped: number }
  | { ok: false; reason: SaveErrorReason | 'partial'; flushed: number };

export type InitResult =
  | { ok: true }
  | { ok: false; reason: 'auth_missing' | 'drive_denied' | 'unknown' };

export type EnsureLayoutResult =
  | { ok: true; created: string[]; existed: string[] }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'unknown' };

export type LoadErrorReason =
  | 'not_found' | 'parse_error' | 'auth' | 'rate_limit'
  | 'network' | 'offline' | 'unknown';

export type SaveErrorReason =
  | 'conflict' | 'auth' | 'rate_limit'
  | 'network' | 'offline' | 'quota' | 'unknown';

export interface ResourceMeta {
  driveFileId: string;
  modifiedTime: string;   // RFC3339 UTC
  etag: string;
  source: 'drive' | 'cache' | 'pending';
}

// ============================================================
// ドメイン型(Drive 上のファイル形態と対応)
// ============================================================

export interface Settings {
  schemaVersion: '1';
  lastUpdated: string;
  currentCharacterId: string;
  coaching: {
    enabled: boolean;
    notificationTime: string;       // 'HH:MM'
    frequency: 'daily' | 'weekday' | 'custom';
    customDays?: WeekdayMask;
    calendarConnected: boolean;
  };
  calendar: {
    dedicatedCalendarId: string | null;
    manageMainCalendar: boolean;
  };
  ai: {
    provider: AiProviderId;          // 'gemini' | 'claude' | 'openai' | string
    modelHint: string | null;
  };
  tts: {
    preferVoicevox: boolean;
    voicevoxEndpoint: string | null;
    fallbackWebSpeech: boolean;
  };
  ui: {
    fontScale: number;
    reducedMotion: boolean;
  };
  consents: {                        // Q-U-c-7 確定で Uさん 設計握り込み
    termsVersion: string;
    termsAcceptedAt: string;
    ageConfirmedAt: string;
    privacyVersion: string;
  };
}

export interface CharacterIndex {
  schemaVersion: '1';
  lastUpdated: string;
  characters: CharacterEntry[];
}

export interface CharacterEntry {
  id: string;
  displayName: string;
  characterMdPath: string;
  coachingMdPath: string;
  voicevoxSpeakerId: number;
  voicevoxCreditLine: string;
  description: string;
  bundledInBeta: boolean;
}

export interface Profile {
  // Q-U-c-6 確定: YAML フロントマター付き Markdown
  frontmatter: {
    displayName?: string;
    birthDate?: string;             // YYYY-MM-DD
    birthTime?: string;             // HH:MM
    birthPlace?: string;
    horoscopeSystem?: 'western' | 'kyusei' | 'animal' | 'none' | string;
    horoscopeFrequency?: 'weekly' | 'daily' | 'off';
  };
  body: string;                     // 「好み・興味」「メモ」自由記述
}

export interface ErrorEntry {
  occurredAt: Date;
  category: ErrorCategory;
  kind: string;                     // 'refresh_token_expired' 等の機械可読タグ
  message: string;                  // ユーザー / レビュー向け説明
  context?: object;                 // 自由メタデータ
  resolution?: string;              // 復旧手段
  relatedDoc?: string;              // 'Phase2_OAuth_スコープ設計_v0.1 §9.1' 等
}

export type ErrorCategory =
  | 'OAuth' | 'Drive API' | 'Calendar API' | 'Tasks API'
  | 'Gemini API' | 'VOICEVOX' | 'UI' | 'Sync' | 'Other' | string;

export type AiProviderId = 'gemini' | 'claude' | 'openai' | string;
export type IsoDate = string;       // 'YYYY-MM-DD'
export type WeekdayMask = number;   // bit 0=Sun … 6=Sat

// ============================================================
// 同期状態(オフライン挙動の UI 露出)
// ============================================================

export interface SyncState {
  online: boolean;
  pendingWrites: number;
  lastSyncedAt: string | null;
  conflictsAwaitingReview: number;
  authStage: 'unauth' | 'stage1' | 'stage2';
}

export interface ConflictEvent {
  file: string;
  retainedPath: string;        // 'config/conflicts/settings.json_conflict_...json'
  occurredAt: Date;
  ours: { modifiedTime: string; etag: string };
  theirs: { modifiedTime: string; etag: string };
}

// ============================================================
// キャラMD改訂時の差分(Q-U-c-2 起動時通知)
// ============================================================

export type CharacterDiffResult =
  | { kind: 'same' }
  | { kind: 'drive_only' }
  | { kind: 'bundled_newer'; bundledVersion: string; driveVersion?: string };

// ============================================================
// 共通
// ============================================================

export type Unsubscribe = () => void;
```

---

## 3. 設計判断の根拠(Sさん レビュー向け)

### 3.1 「throw しない」方針

- Storage 層は Drive API レート制限・ネットワーク断・OAuth 失効を **正常系の一部** として扱う
- 例外を投げると呼び出し側で `try/catch` が肥大化、エラー復旧パスが曖昧化
- `Result` 型は ユーザーへの表示テキスト( `ErrorEntry.message` )と機械可読タグ( `reason` )を分離

### 3.2 「load と loadCached の分離」を「meta.source で表現」に集約

最初は `loadCachedSettings()` 等を別メソッドにする案も検討したが、メソッド数が倍増する。代わりに `LoadResult.meta.source` で `'drive' | 'cache' | 'pending'` を露出 → 呼び出し側が必要に応じて意思決定。

### 3.3 watchSettings / watchSyncState の存在

Vue 3 + Pinia 等のリアクティブ層との結合を意識。Storage 層が **値の変化を push** することで、UI 層は store にバインドするだけ。
- 競合検知 / マルチデバイス変更 / pending flush 完了などの通知に統一的に使う
- Unsubscribe を返す慣習で、Vue の `onScopeDispose` と相性良

### 3.4 errors / 会話ログを `append*` で分離

LWW 系メソッド( `save*` )とは別の append-only セマンティクスを明示。実装側は §5.2 の「再取得+末尾追記+再アップロード+リトライ」で吸収。

### 3.5 SecretStore は別 interface(暗号化要件への分離)

Sさん 確定論点「暗号化要件」への Uさん 提案:
- Drive 上のファイル: 平文(法的書類 v0.3 §6.5 で吸収)
- 秘密情報(リフレッシュトークン / Gemini API キー / VOICEVOX 秘密鍵がある場合): 別 interface

```typescript
export interface SecretStore {
  putSecret(key: SecretKey, value: string): Promise<void>;
  getSecret(key: SecretKey): Promise<string | null>;
  removeSecret(key: SecretKey): Promise<void>;
  clearAll(): Promise<void>;
}

export type SecretKey =
  | 'oauth.refreshToken'
  | 'oauth.accessToken'
  | 'gemini.apiKey'
  | string;
```

実装: IndexedDB + Web Crypto AES-GCM(OAuth 設計 §5.1 案B、端末派生鍵)。

**Sさん 確定論点として開いている部分**:
- 会話ログを暗号化対象に追加するなら、`appendConversation(date, content, { encrypted: true })` のように API 拡張可能
- 「Drive にあるが Drive 側からは中身が見えない」モードを将来追加する場合のフックを残す

---

## 4. AuthProvider との連携

### 4.1 Stage 別の利用可能 API

| AuthStage | 利用可能な Storage API |
|---|---|
| `unauth` | `initialize` のみ可、他は `LoadResult.reason: 'auth'` で返す |
| `stage1` | settings / character / profile / manual / errors / conversation 全部可 |
| `stage2` | stage1 + Calendar 機能(これは Storage の領分でなく Calendar Service の領分) |

### 4.2 Stage 遷移時の挙動

- `auth.onStageChange` を Storage が購読
- Stage 1 になった瞬間に `ensureLayout()` を自動実行(初回作成フロー)
- Stage が 1 → 0 に落ちる(サインアウト等)場合、IndexedDB キャッシュは保持、Drive アクセスのみ停止

### 4.3 Drive 拒否時の挙動(Q-U-a-3 = (c) 起動継続+再要求)

- Stage 1 に到達したが `drive.file` だけ拒否された場合:
  - `initialize()` は `{ ok: false, reason: 'drive_denied' }` を返す
  - UI 層が「Drive 接続が必要です」バナーを常設 + 再要求ボタン
  - その間、Storage は **「不能状態」** を返し続ける(オフライン挙動と区別)
  - キャッシュにある分( IndexedDB )で **読み取りだけ機能継続** する選択肢を残す
- これは a 設計 Q-U-a-3 の判断に従う(再要求しながら起動継続)

---

## 5. SoT 同期セマンティクス(Sさん 確定論点 #2)

### 5.1 SoT は Drive、キャッシュは IndexedDB

| 読み込み | 書き込み |
|---|---|
| 1. IndexedDB キャッシュ確認 | 1. UI 即時反映(楽観更新) |
| 2. ヒット → 返却 + バックグラウンドで Drive 再取得 | 2. Drive 書込 → 成功で IndexedDB 更新 |
| 3. ミス → Drive 取得 → IndexedDB 保存 | 3. 失敗(競合 / オフライン)→ pending queue |
| 4. オフライン → キャッシュ返却 + `LoadResult.meta.source='cache'` | 4. 復帰時 flush |

### 5.2 競合検知(LWW + 退避)

c 設計 §5 LWW を踏襲、実装側で:
- 書込前に ETag 確認( If-Match ヘッダ)
- 412 Precondition Failed → Drive から再取得 → `ConflictEvent` 発火 → `config/conflicts/` に退避
- errors / 会話ログ(append 系)は再取得 + 再追記でリトライ(冪等)

### 5.3 Sさん 確定で書き換え余地

- `forceFresh` パラメータ:キャッシュを無視して必ず Drive から取り直す API が必要か
- Background Sync:1分おきに全 SoT を確認するか、Push 通知ベースか
- キャッシュ TTL:`Settings` のように頻繁に変わるものは TTL 短く、`manual.md` のように静的なものは長く、というポリシー定義

---

## 6. オフライン挙動(Sさん 確定論点 #3)

### 6.1 pending queue の構造

```typescript
interface PendingWrite {
  id: string;                         // uuid
  enqueuedAt: Date;
  resource: 'settings' | 'profile' | 'characterMd' | 'coachingMd'
          | 'errors' | 'conversation' | string;
  resourceId?: string;                // キャラ id / 会話日付 等
  payload: unknown;                   // 書き込み内容
  attempts: number;
  lastError?: SaveErrorReason;
}
```

IndexedDB の専用 ObjectStore `pendingWrites` に永続化(タブ再起動でも残る)。

### 6.2 flush ポリシー

- オンライン復帰イベント( `navigator.onLine`、Service Worker `sync` イベント)で `flushPending()` 自動呼び出し
- 同一リソースへの複数 pending は **最新だけ保持** (`settings` 等の overwrite 系)
- append 系(`errors` / `conversation`)は **すべて保持**、順番通り再生
- リトライ上限( 例:5回 )を超えた pending は `pendingWrites` に保持しつつ、errors.md に記録 → UI に「同期できない書き込みがあります」表示

### 6.3 オフライン時の UI 露出

- `getSyncState().online === false` で UI に「オフライン」インジケータ
- `pendingWrites > 0` で「未同期 N 件」表示
- 思想書「人間味のための AI」整合 → 「同期失敗」を冷たく見せない、温度のあるコピーは Sさん 領域

### 6.4 Sさん 確定で書き換え余地

- pending queue の永続化を Service Worker 側にも持たせるか(タブ閉鎖後も flush)
- 競合発生時に「最新を採用 / 自分を採用 / マージ」3 択を出すタイミング(即時 vs 後でまとめて)
- iOS Safari 7日ポリシー(落とし穴集 §4.6)で pending queue ごと消える可能性 → 「重要な書き込みはオンラインで即実行を促す」UX

---

## 7. 実装層: DriveStorage(Uさん 担当範囲)

contract が `Storage` だとすると、Uさん 実装側は:

```
DriveStorage implements Storage
  ├── auth: AuthProvider        ← 注入
  ├── http: GapiClient | fetch  ← Drive REST API
  ├── cache: IndexedDBCache     ← キャッシュ層
  ├── pendingQueue: PendingQueueStore
  ├── conflictResolver: ConflictResolver
  └── pathResolver: DrivePathResolver  ← folderId / fileId キャッシュ
```

各部品は単独でテスト可能(Sさん レビュー時の Tさん テスト戦略 v0.2 との結合点)。

実装の詳細(リクエスト構成、ETag 管理、レート制限バックオフ)は **本書スコープ外** 、別タスク「Phase2_DriveStorage 実装設計」で扱う想定。

---

## 8. テスト容易性(Tさん 連携)

### 8.1 モック差し替え

```typescript
export interface Storage { /* ... */ }

// 本番
export class DriveStorage implements Storage { /* ... */ }

// テスト / Storybook
export class MemoryStorage implements Storage {
  // 全ファイルを Map<string, unknown> でホスト
}

// オフライン UX 確認用
export class FlakyStorage implements Storage {
  // ランダムに 'rate_limit' / 'offline' を返す
}
```

### 8.2 Tさん テスト戦略への接続

Tさん が Phase 1 テスト戦略案で扱った Drive 暗号化 / プロバイダ切替の単体テスト論点は、本書 `MemoryStorage` の存在で大幅に書きやすくなる(実際の Drive API を叩かずに Storage 経由のロジックをテスト可能)。

---

## 9. リスク・トレードオフ

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | interface が広すぎて Sさん 確定起草の認知負荷大 | 🟡 中 | 本書 §2 の TypeScript を圧縮、メソッド名は維持しつつ Sさん が捨てたい部分は遠慮なく削除可と明示 |
| 2 | watch* メソッドの実装が `EventTarget` ベースで複雑化 | 🟢 低 | 軽量 EventEmitter 実装(20行)で吸収 |
| 3 | pending queue の永続化が iOS Safari 7日ポリシーで消える | 🟡 中 | 落とし穴集 §4.6 / §6.4 で論点提示、Sさん 確定で UX 補強 |
| 4 | SecretStore を分離したことで「全部 Storage 経由で済むはず」という直感とずれる | 🟢 低 | §3.5 で分離理由を明示、Sさん 確定で再統合の判断もあり |
| 5 | `Result` 型の `reason` を string リテラル合併で開いておくと、型 narrowing が緩い | 🟢 低 | 各 `reason` のドキュメントコメントを充実、特殊扱いは `'unknown'` で吸収 |
| 6 | LoadResult.cached を返す API があるため、呼び出し側が誤って古いデータを表示するリスク | 🟡 中 | `meta.source` で `'cache'` を明示、UI 層で「最新を取得中」表示を出すパターンをガイド |
| 7 | `dispose()` を呼び忘れて IndexedDB ハンドルがリークする | 🟢 低 | Vue のライフサイクル(onBeforeUnmount)でラップする雛形を Sさん 設定画面実装と擦り合わせ |

---

## 10. たかしさんに判断を仰ぎたい事項

| # | 事項 | Uさん 感触 |
|---|---|---|
| Q-U-b-1 | 本書の TypeScript 草案を **Sさん 確定起草の出発点として使う** で OK か、 **Sさん がゼロから起草** が望ましいか | 出発点として使う方が時間効率良し(Sさん 確定時に削除 / 改名 / 拡張は自由)、ただし TTSProvider パターン同型の役割関係を尊重して Sさん が望む方式に従う |
| Q-U-b-2 | `SecretStore` を Storage から分離するアプローチで OK か | **分離 OK** 推奨(暗号化要件の境界明確化、IndexedDB アクセス箇所の凝集) |
| Q-U-b-3 | pending queue の永続化を IndexedDB + Service Worker 両方持たせるか(iOS Safari 7日ポリシー対策) | ベータ v1.0 は **IndexedDB のみ** 推奨(複雑性回避)、商品化版で Service Worker 併用検討 |
| Q-U-b-4 | LoadResult に `cached?` を持たせるか(オフラインで「古いが見える」UX) | **持たせる** 推奨。完全ブラックアウトより、`meta.source='cache'` 表示付きで見える方が UX 良い |
| Q-U-b-5 | キャッシュ TTL のデフォルト方針(settings 短い / manual 長い等) | 本書では未指定、Sさん 確定起草で決定推奨 |
| Q-U-b-6 | watch* (push 型 API)を採用するか、 ポーリング前提で **削除** するか | **採用** 推奨。マルチデバイス LWW で「他端末の変更を即反映したい」UX に必須、Vue 3 リアクティブとも相性良 |

---

## 11. 副次的に気づいた課題

### 11.1 SecretStore の起草も Sさん 領域か

OAuth 設計 §5 / 本書 §3.5 で言及した SecretStore は、 Storage と並ぶレベルの interface 。 **Sさん 確定起草対象に SecretStore も含めるか** をエルトン経由で確認したい(本書では Storage 内 §3.5 で叩き台示唆のみ)。

### 11.2 Path Resolver の責務範囲

`config/characters/<id>.md` のような相対パスを Drive の fileId に解決する `DrivePathResolver` は Storage 内部実装の詳細。 ただし **Sさん が `loadCharacterMd(id)` ではなく `loadByPath(path)` のような generic API を望む** 可能性もあり、要確認。

### 11.3 マイグレーション(schemaVersion)

`Settings.schemaVersion` が `'1'` から `'2'` に上がる時のマイグレーション戦略を本書では未定義。Sさん 確定起草で `migrateSettings(v1: any): Settings` のような関数を `StorageDeps` に注入する方式が一案。

### 11.4 ConflictResolver の UI 露出

`onConflict` イベントを受けた UI が「最新を採用 / 自分を採用 / マージ」3 択を出すフロー(仕様書 §22 3択ボタン式)は Sさん 領域。本書では interface のフックのみ提供。

### 11.5 Tさん テスト戦略 v0.2 への連動

§8 で示した `MemoryStorage` / `FlakyStorage` の存在を、 Tさん が Phase 2 でのテスト戦略 v0.3 (新規起草想定)に組み込むと、 E2E 抜きで Storage 経由ロジックを単体テスト可能。エルトン経由で Tさん 連携依頼候補。

### 11.6 仕様書 v1.5 への反映依頼候補(エルトン主導)

- 仕様書 v1.5 §20 設定値保存 本文化時に `Settings` 型を採用
- 仕様書 v1.5 §24 エラー対応設計 本文化時に `ErrorEntry` フォーマットを採用

---

## 12. 完了報告(エルトン経由)

```
[Phase 2 Sprint 1 並列タスク b) Storage interface 叩き台 完了報告]
完了日時: 2026-05-19(火)午後
所要時間: 約90分(想定工数 60-90分の上限)
成果物のファイルパス:
  C:\dev\InvokeAide\docs\Phase2\Phase2_Storage_interface_叩き台_v0.1_2026-05-19.md

主要な発見 / 判断:
  - Storage interface 草案(メソッド 20 + 周辺型 15 + 結果型 5)を TypeScript
    で起こした
  - SecretStore を別 interface に切り出し、暗号化要件の境界を明示
  - Sさん 確定論点 3 つ(暗号化 / SoT 同期 / オフライン)それぞれに叩き台
    と「Sさん 確定で書き換え余地」を明記
  - LoadResult / SaveResult を Result 型に統一、throw に頼らない
  - watch* メソッドで Vue 3 リアクティブ層との結合を簡潔化
  - 実装層 DriveStorage / IndexedDBCache / PendingQueueStore / ConflictResolver
    の分割を §7 で示唆(本格的な実装設計は別タスク)
  - MemoryStorage / FlakyStorage の存在で Tさん テスト戦略 v0.3 と接続

Sさん との結合点(エルトン経由で Sさん に通知依頼):
  - 本書 §2 TypeScript 草案を出発点として使うか(Q-U-b-1)
  - SecretStore も Sさん 確定起草の対象に含めるか(§11.1)
  - キャッシュ TTL / Background Sync 粒度(§5.3、Q-U-b-5)
  - Conflict resolution の UI フロー設計(§11.4)
  - manual.md / character MD / coaching MD の本文起草(c) 報告で依頼済)

推奨する次のアクション:
  - 本書レビュー、§10 Q-U-b-1〜Q-U-b-6(6点)のたかしさん判断
  - Sさん に Storage contract 確定起草を依頼(本書を叩き台として共有、エルトン経由)
  - Sさん 確定起草受領後、Uさん は DriveStorage 実装設計に着手(別タスク)
  - 並行で着手可能: Phase 2 Sprint 1 残タスクへの着手判断
    (例: Sさん 設定画面の進捗待ちで手が空くなら、Cloud Run の事前調査 or
     Drive REST API クライアントの足回り実装等)

たかしさんに判断を仰ぎたい事項: 本書 §10 に 6点
副次的に気づいた課題: 本書 §11 に 6点
```

---

## 13. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火) | 初版作成。Storage interface 叩き台(TS草案 + 周辺型) / SecretStore 分離 / Sさん 確定論点 3 への叩き台 / 実装層分割 / 判断仰ぎ 6点 | Uさん(Opus) |

---

**以上、Uさん b) Storage interface 叩き台 v0.1。Sさん 確定起草の出発点となれば幸い。 §10 判断 6 点と Sさん レビューを待って、 Sprint 1 残期間の追加タスクに進みます。**
