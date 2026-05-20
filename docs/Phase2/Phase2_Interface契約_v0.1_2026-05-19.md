# Phase 2 Interface 契約 v0.1

**作成日**: 2026-05-19(火)午後
**起草者**: Sさん(Sonnet、 ロジック品質担当)
**位置づけ**: Phase 2 Sprint 1 並列タスク、 全 Provider/Service の **contract 確定**(Sさん 確定起草 / Uさん 実装)
**Sprint 識別**: Phase 2 Sprint 1(2026-05-19 着手)、 ただし本書の interface 契約は Sprint 1 以降全 Sprint で参照される横断資産
**前提**:
- Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md(Uさん 起草、 §10.1 AuthProvider 叩き台)
- Phase2_Drive_ファイルレイアウト設計_v0.1_2026-05-19.md(Uさん 起草、 ファイル形態確定)
- Phase2_Storage_interface_叩き台_v0.1_2026-05-19.md(Uさん 起草、 Storage 草案)
- Phase1_技術スタック決定提案_v0.3_2026-05-18.md(Sさん 起草、 アーキ全体方針)
- 法的書類 v0.3 §1.2「未来の自分を縛らない」 原則(型定義にも適用)
- 分業ルール: Sさん contract 定義 / Uさん 実装(TTSProvider パターン同型)

---

## 0. エグゼクティブ・サマリ

### 0.1 確定起草する 7 interfaces

| # | Interface | 役割 | 階層 | Uさん 叩き台ベース | TTSProvider 同型適用 |
|---|---|---|---|---|---|
| 1 | **StorageProvider** | Drive ファイル抽象(LWW + キャッシュ + pending queue) | 低 | Phase2_Storage_interface_叩き台 §2 を発展 | ◎ Sさん contract / Uさん DriveStorage 実装 |
| 2 | **SecretStore** | 端末内秘密保管(refresh_token / API key / 端末派生鍵) | 低 | Phase2_Storage_interface_叩き台 §3.5 / Phase2_OAuth_スコープ設計 §5.1 を統合 | ◎ Sさん contract / Uさん IndexedDB+WebCrypto 実装 |
| 3 | **AuthProvider** | OAuth フロー(Stage 機械 + Incremental Authorization) | 中 | Phase2_OAuth_スコープ設計 §10.1 を発展 | ◎ Sさん contract / Uさん 実装 |
| 4 | **SettingsService** | settings.json の get/set 抽象、 reactive watch | 高 | 新規(StorageProvider 上のドメイン抽象) | ◎ Sさん contract / Uさん UI 配線 |
| 5 | **ConsentService** | 規約同意 / 年齢確認 / プライバシー同意 状態管理 | 高 | 新規(法的書類 §6.3 / §6.4 連動) | ◎ Sさん contract / Uさん UI 配線 |
| 6 | **CharacterService** | character.md / coaching.md 動的読込、 systemInstruction 再構築 | 高 | 新規(Sさん v0.3 §3.2 / §2.3.3 を抽象化) | ◎ Sさん contract / Uさん UI 配線 |
| 7 | **NotifyProvider** | Calendar Event ベースのコーチング通知発火 | 高 | 新規(Sさん v0.3 §1.3 / Uさん OAuth §3.3 Stage 2 連動) | ◎ Sさん contract / Uさん Calendar API 実装 |

### 0.2 Sさん 確定 3 観点(指示書「暗号化要件 / SoT 同期セマンティクス / オフライン挙動」)への回答

| Sさん 観点 | 確定内容 |
|---|---|
| 暗号化要件 | (1) Drive 上のファイルは法的書類 v0.3 §6.5 表現と整合させて **平文** 、 (2) 秘密情報(refresh_token / Gemini API key / 端末派生鍵)は **SecretStore 経由で IndexedDB + AES-GCM** 、 (3) 会話ログは **ベータ v1.0 で平文** 、 商品化版で追加暗号化を再検討 |
| SoT 同期セマンティクス | (1) Drive = SoT、 IndexedDB = 性能キャッシュ、 (2) **キャッシュ TTL を SoT データ種別ごとに定義**(本書 §1.5、 Q-U-b-5 確定)、 (3) `forceFresh` パラメータ採用 `LoadResult.meta.source` で取得元を露出、 (4) Background Sync はベータでは不採用、 watch* push API + ユーザー操作起点リフレッシュ |
| オフライン挙動 | (1) pending queue は **IndexedDB 専用ストア** 永続化(Q-U-b-3 確定、 Service Worker 不採用)、 (2) overwrite 系は最新だけ保持、 append 系は全件保持・順番再生、 (3) リトライ上限 5回、 (4) `LoadResult.cached` を採用(Q-U-b-4 確定) |

### 0.3 通底する型ポリシー(法的書類 §1.2「未来縛らない」 を型に適用)

1. **throw に頼らない、 Result 型で表現**(throw は呼び出し側の `try/catch` 肥大化を招くため、 例外は値として返す)
2. **すべて非同期**(`Promise<...>`、 一見同期可能でも将来 Storage 経由になる可能性あり)
3. **string リテラル合併に `'unknown'` を含める**(将来の error reason 追加余地)
4. **メソッドの戻り値で「契約上必要な情報を全て返す」**(呼び出し側の追加 query を不要にする)
5. **watch / push API は Unsubscribe を返す**(購読解除を契約で強制)

---

## 1. 設計判断のキーポイント

### 1.1 階層構造

```
┌─ UI 層(Vue components、 Sさん 設計 / Uさん 配線実装) ─┐
│                                                       │
│   ┌─ 高レベル Service (Sさん contract / Uさん 配線) ─┐ │
│   │  SettingsService / ConsentService                │ │
│   │  CharacterService / NotifyProvider               │ │
│   └─────────┬────────────────┬───────────────────────┘ │
│             │                │                          │
│   ┌─ 中レベル(Sさん contract / Uさん 実装) ─┐         │
│   │  AuthProvider                            │         │
│   └─────────┬────────────────┬───────────────┘         │
│             │                │                          │
│   ┌─ 低レベル(Sさん contract / Uさん 実装) ─┐         │
│   │  StorageProvider     SecretStore         │         │
│   └──────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

**依存方向**: 高 → 中 → 低 の単方向。 循環依存禁止。

### 1.2 Provider vs Service の命名軸

| 接尾辞 | 意味 |
|---|---|
| `Provider` | **外部リソースを抽象化** する(Drive、 OAuth、 LLM、 TTS、 Calendar)。 実装が複数あり得て、 アダプタパターンの対象。 Phase1 v0.3 で LLMProvider / TTSProvider 採用済み、 同型を踏襲 |
| `Service` | **アプリ内ドメインロジック** を提供する。 内部実装が単一前提、 Storage / Auth を組み合わせるレイヤー |

本書では:
- 外部リソース抽象: StorageProvider / AuthProvider / NotifyProvider(Calendar API 抽象)
- ドメイン: SettingsService / ConsentService / CharacterService
- 端末内秘密保管: SecretStore(単一実装、 接尾辞は Store)

### 1.3 命名整合(Phase1 〜 Phase2 全体)

| 既存 | 本書追加 |
|---|---|
| LLMProvider(Phase1 v0.1 §4.4) | NotifyProvider |
| TTSProvider(Phase1 v0.2 §6.3) | StorageProvider、 AuthProvider |
| (なし) | SecretStore |
| (なし) | SettingsService、 ConsentService、 CharacterService |

### 1.4 「LoadResult / SaveResult」 統一型

Uさん Storage 叩き台 §2 を採用、 全 interface でこの Result 型族を共有する:

```typescript
export type LoadResult<T> =
  | { ok: true; value: T; meta: ResourceMeta }
  | { ok: false; reason: LoadErrorReason; cached?: T };

export type SaveResult =
  | { ok: true; meta: ResourceMeta }
  | { ok: false; reason: SaveErrorReason; pending?: boolean };
```

呼び出し側パターン: `if (result.ok) { /* use result.value */ } else { /* handle result.reason */ }`

### 1.5 キャッシュ TTL ポリシー(Q-U-b-5 確定)

各 SoT データ種別ごとに TTL を定義:

| ファイル | TTL(キャッシュ保持時間) | 理由 |
|---|---|---|
| `settings.json` | **5分** | 変更頻度高、 即時反映重要、 watch* で push もある |
| `config/index.json` | **1時間** | キャラ追加は稀 |
| `config/profile.md` | **1時間** | ユーザー手編集 / アプリ書込 両方あり、 中程度 |
| `config/manual.md` | **24時間** | 静的、 改訂は稀 |
| `config/characters/<id>.md` | **1時間** | キャラ性格、 中程度 |
| `config/characters/<id>.coaching.md` | **1時間** | 同上 |
| `logs/errors.md` | **N/A**(append only、 キャッシュしない) | 末尾追記のみ |
| `logs/conversations/会話ログ_*.md` | **24時間**(過去ログのみ) | 過去ログは静的 |

TTL を超過したキャッシュは「使うが、 バックグラウンドで Drive 再取得」 セマンティクス。 オフライン時は TTL 無視で返却(`meta.source='cache'` 明示)。

### 1.6 watch* セマンティクス(契約)

`watch*` メソッドは以下の契約を満たす:

1. **コールバックは少なくとも1回は呼ばれる**(購読開始直後の現在値スナップショット)
2. **値が変わった時のみ追加で呼ばれる**(同一値の重複通知禁止、 等価性は `JSON.stringify` ベースで判定可)
3. **Unsubscribe 後は呼ばれない**(購読解除を契約で保証)
4. **多重購読を許容**(同じ key に複数 cb を登録できる)
5. **エラー発生時もコールバックを呼ぶ**(`LoadResult.ok=false` で通知)

---

## 2. StorageProvider(低レベル、 Uさん 叩き台ベースで確定)

### 2.1 contract

```typescript
/**
 * StorageProvider
 * Drive ファイル抽象 + ローカルキャッシュ + pending queue + 競合検知
 * 実装: DriveStorage(本番)、 MemoryStorage(テスト)、 FlakyStorage(オフライン UX 検証)
 *
 * 前提:
 *   - initialize() を呼ぶ前に他のメソッドを呼ぶことは契約違反
 *   - dispose() 後の呼び出しは契約違反(リジェクトする)
 *
 * 事後条件:
 *   - すべての Result 型は throw せず Promise.resolve で返す
 *   - LoadResult.ok=false でも cached が undefined でない場合、 cached は最後に
 *     キャッシュにあった値(Drive アクセス前)を表す
 */
export interface StorageProvider {
  // -- ライフサイクル -----------------------------------------
  initialize(deps: StorageDeps): Promise<InitResult>;
  ensureLayout(): Promise<EnsureLayoutResult>;
  dispose(): Promise<void>;

  // -- 設定(F3 settings.json) ------------------------------
  loadSettings(opts?: LoadOptions): Promise<LoadResult<Settings>>;
  saveSettings(settings: Settings): Promise<SaveResult>;
  watchSettings(cb: WatchCallback<Settings>): Unsubscribe;

  // -- キャラ(F2 index.json / F6 / F7) --------------------
  loadCharacterIndex(opts?: LoadOptions): Promise<LoadResult<CharacterIndex>>;
  saveCharacterIndex(index: CharacterIndex): Promise<SaveResult>;
  loadCharacterMd(id: string, opts?: LoadOptions): Promise<LoadResult<string>>;
  loadCoachingMd(id: string, opts?: LoadOptions): Promise<LoadResult<string>>;
  saveCharacterMd(id: string, md: string): Promise<SaveResult>;
  saveCoachingMd(id: string, md: string): Promise<SaveResult>;
  diffBundledVsDrive(id: string): Promise<CharacterDiffResult>;

  // -- プロファイル(F4 profile.md) ------------------------
  loadProfile(opts?: LoadOptions): Promise<LoadResult<Profile>>;
  saveProfile(profile: Profile): Promise<SaveResult>;

  // -- マニュアル(F5 manual.md、 読みのみ) -----------------
  loadManual(opts?: LoadOptions): Promise<LoadResult<string>>;

  // -- 履歴(F8 / F9、 追記専用)----------------------------
  appendError(entry: ErrorEntry): Promise<AppendResult>;
  archiveConversation(date: IsoDate, content: string): Promise<AppendResult>;
  loadConversation(date: IsoDate, opts?: LoadOptions): Promise<LoadResult<string>>;
  listConversationDates(): Promise<LoadResult<IsoDate[]>>;

  // -- 同期・オフライン -------------------------------------
  getSyncState(): SyncState;
  watchSyncState(cb: WatchCallback<SyncState>): Unsubscribe;
  flushPending(): Promise<FlushResult>;
  onConflict(cb: (event: ConflictEvent) => void): Unsubscribe;
}

// -- 依存注入 -----------------------------------------------
export interface StorageDeps {
  auth: AuthProvider;
  secretStore: SecretStore;
  clock: Clock;
  logger?: Logger;
}

export interface Clock { now(): Date; }
export interface Logger { warn(msg: string, ctx?: object): void; }

// -- LoadOptions(キャッシュ制御) ----------------------------
export interface LoadOptions {
  /**
   * true の場合、 キャッシュを無視して必ず Drive から取得する。
   * オフライン時は LoadResult.ok=false + reason='offline' + cached?(あれば)を返す。
   * 既定 false。
   */
  forceFresh?: boolean;

  /**
   * キャッシュが TTL を超過していても許容する(オフライン UX 優先)。
   * 既定 false。 既定では TTL 超過時に Drive 再取得を試みる。
   */
  allowStaleCache?: boolean;
}

// -- WatchCallback 共通型 -----------------------------------
export type WatchCallback<T> = (value: T) => void;
export type Unsubscribe = () => void;

// -- Result 型族 --------------------------------------------
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
  | { ok: false; reason: SaveErrorReason | 'partial' | 'unknown'; flushed: number };

export type InitResult =
  | { ok: true }
  | { ok: false; reason: 'auth_missing' | 'drive_denied' | 'unknown' };

export type EnsureLayoutResult =
  | { ok: true; created: string[]; existed: string[] }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'unknown' };

/**
 * 読み込みエラーの理由列挙。
 * 'unknown' を含めることで「未来縛らない」 原則を型に適用。
 */
export type LoadErrorReason =
  | 'not_found'      // Drive 上にファイルが無い
  | 'parse_error'    // JSON/Markdown パース失敗
  | 'auth'           // OAuth トークン無効 / スコープ不足
  | 'rate_limit'     // Drive API レート制限
  | 'network'        // ネットワーク障害
  | 'offline'        // オフライン(navigator.onLine===false)
  | 'unknown';

export type SaveErrorReason =
  | 'conflict'       // LWW 競合(ETag mismatch)
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'offline'
  | 'quota'          // Drive 容量不足
  | 'unknown';

export interface ResourceMeta {
  driveFileId: string;
  modifiedTime: string;   // RFC3339 UTC
  etag: string;
  source: 'drive' | 'cache' | 'pending';
}

// -- 同期状態(SyncState) -----------------------------------
export interface SyncState {
  online: boolean;
  pendingWrites: number;
  lastSyncedAt: string | null;
  conflictsAwaitingReview: number;
  authStage: 'unauth' | 'stage1' | 'stage2';
}

// -- 競合イベント -------------------------------------------
export interface ConflictEvent {
  file: string;
  retainedPath: string;
  occurredAt: Date;
  ours: { modifiedTime: string; etag: string };
  theirs: { modifiedTime: string; etag: string };
}

// -- キャラMD 差分 ------------------------------------------
export type CharacterDiffResult =
  | { kind: 'same' }
  | { kind: 'drive_only' }
  | { kind: 'bundled_newer'; bundledVersion: string; driveVersion?: string };

// -- ドメイン型(Drive ファイル形態) -----------------------
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
    provider: AiProviderId;
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
  consents: {
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
  frontmatter: {
    displayName?: string;
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    horoscopeSystem?: 'western' | 'kyusei' | 'animal' | 'none' | string;
    horoscopeFrequency?: 'weekly' | 'daily' | 'off';
  };
  body: string;
}

export interface ErrorEntry {
  occurredAt: Date;
  category: ErrorCategory;
  kind: string;
  message: string;
  context?: object;
  resolution?: string;
  relatedDoc?: string;
}

export type ErrorCategory =
  | 'OAuth' | 'Drive API' | 'Calendar API' | 'Tasks API'
  | 'Gemini API' | 'VOICEVOX' | 'UI' | 'Sync' | 'Other' | 'unknown' | string;

export type AiProviderId = 'gemini' | 'claude' | 'openai' | string;
export type IsoDate = string;       // 'YYYY-MM-DD'
export type WeekdayMask = number;   // bit 0=Sun … 6=Sat
```

### 2.2 Sさん 確定で Uさん 叩き台から書き換えた点

| 項目 | 叩き台 | 確定 | 理由 |
|---|---|---|---|
| `forceFresh` パラメータ | §5.3 で「Sさん 確定で書き換え余地」 | **採用、 LoadOptions に統合** | キャッシュ無視取得は UI 「最新を取得中」 ボタンで必要 |
| キャッシュ TTL | 未定義 | **§1.5 でデータ種別ごとに定義** | Q-U-b-5 確定 |
| Background Sync | 「Sさん 確定で書き換え余地」 | **ベータでは不採用** | 過剰設計回避、 watch* + ユーザー起点で足りる |
| Result 型の `'unknown'` | LoadErrorReason / SaveErrorReason に既に含む | **維持** | 「未来縛らない」 原則 |
| `LoadResult.cached` | Q-U-b-4 で叩き台提案 | **採用** | 完全ブラックアウトより、 古いが見える方が UX 良い |
| `dispose()` | ある | **維持、 ただし呼び忘れ防止のため Vue ライフサイクル統合を実装側で工夫推奨** | リスク §10 #7 |

---

## 3. SecretStore(低レベル、 Uさん §3.5 / §11.1 を Sさん 確定対象に取り込み)

### 3.1 contract

```typescript
/**
 * SecretStore
 * 端末内の秘密情報保管。 Drive には絶対に置かない。
 * 実装: IndexedDB + Web Crypto AES-GCM(端末派生鍵、 ベータ v1.0)
 *
 * 前提:
 *   - WebCrypto がサポートされていない環境(古い iOS Safari < 11 等)では
 *     initialize() が { ok: false; reason: 'unsupported' } を返す
 *   - 暗号鍵は端末固有(localStorage に保存された crypto.randomUUID() ベース)
 *     → 端末を変えると復号できなくなる(設計通り、 マルチデバイス時は再認証)
 *
 * 事後条件:
 *   - getSecret() で取得した値はメモリ上では平文だが、 永続化層では暗号化
 *   - clearAll() 後に getSecret() は必ず null を返す
 */
export interface SecretStore {
  initialize(): Promise<SecretStoreInitResult>;
  putSecret(key: SecretKey, value: string): Promise<SecretOpResult>;
  getSecret(key: SecretKey): Promise<string | null>;
  removeSecret(key: SecretKey): Promise<SecretOpResult>;
  clearAll(): Promise<SecretOpResult>;
  /** 端末派生鍵の有無確認(初回起動判定に使う)*/
  hasMasterKey(): Promise<boolean>;
}

export type SecretKey =
  | 'oauth.refreshToken'
  | 'oauth.accessToken'    // 短命キャッシュ、 永続化は任意
  | 'gemini.apiKey'        // BYOK
  | 'voicevox.apiKey'      // 将来用、 現状は未使用
  | string;                // 「未来縛らない」 原則で拡張余地

export type SecretStoreInitResult =
  | { ok: true; firstTime: boolean }   // firstTime=true なら端末派生鍵を新規生成済み
  | { ok: false; reason: 'unsupported' | 'storage_quota' | 'unknown' };

export type SecretOpResult =
  | { ok: true }
  | { ok: false; reason: 'not_initialized' | 'crypto_error' | 'storage_quota' | 'unknown' };
```

### 3.2 暗号鍵戦略の確定

| 項目 | 確定 |
|---|---|
| 暗号鍵派生 | **端末派生(localStorage の `crypto.randomUUID()` ベース)、 Uさん OAuth 設計 §5.1 案B** |
| 鍵長 | AES-GCM 256-bit |
| IV(nonce) | エントリごとにランダム生成、 暗号文と同梱保存 |
| Drive 配置 | **絶対に置かない**(端末内のみ) |
| 商品化版での拡張 | パスフレーズ派生(案A)/ Passkey(案C)を Phase 4 で再検討 |

### 3.3 端末再インストール / iOS Safari 7日ポリシー時の挙動

- IndexedDB が消えると **すべての SecretStore データが消失** (端末派生鍵もろとも)
- 復旧フロー: 再 OAuth(refresh_token 再取得)+ Gemini API キー再入力
- ユーザーへの説明: 「設定画面 → セキュリティ → 再認証が必要です」 と促す UI
- Drive 上の `MIYU_App_Data/` は無事 → 設定 / キャラ / プロファイル は復元される(Uさん Drive レイアウト §6.3 整合)

---

## 4. AuthProvider(中レベル、 Uさん OAuth §10.1 を Sさん 確定)

### 4.1 contract

```typescript
/**
 * AuthProvider
 * Google OAuth フロー(Stage 機械 + Incremental Authorization)
 * 実装: GoogleAuthProvider(本番)、 MockAuthProvider(テスト)
 *
 * Stage 機械(Uさん OAuth §3.1):
 *   unauth → stage1(Drive + Tasks) → stage2(+ Calendar)
 *
 * 前提:
 *   - initialize(deps) を呼ぶ前に他メソッドを呼ぶことは契約違反
 *   - SecretStore.initialize() が先行している必要あり(refresh_token 保管に使う)
 *
 * 事後条件:
 *   - currentStage() は副作用なし、 内部状態を返すだけ
 *   - requestStage*Consent() 成功時は内部状態が更新され、 onStageChange リスナー
 *     に新しい Stage が通知される
 */
export interface AuthProvider {
  initialize(deps: AuthDeps): Promise<AuthInitResult>;
  currentStage(): AuthStage;
  /** Stage 0/0.5 → Stage 1 へ昇格、 Drive + Tasks スコープを要求 */
  requestStage1Consent(): Promise<AuthResult>;
  /** Stage 1 → Stage 2 へ昇格、 Calendar スコープを Incremental Authorization */
  requestCalendarConsent(): Promise<AuthResult>;
  /** access_token を返す(期限切れなら silent refresh)*/
  getAccessToken(): Promise<AccessTokenResult>;
  /** silent refresh のみ強制(access_token を更新)*/
  silentRefresh(): Promise<AccessTokenResult>;
  signOut(): Promise<void>;
  onStageChange(cb: (stage: AuthStage) => void): Unsubscribe;
}

export interface AuthDeps {
  secretStore: SecretStore;
  clock: Clock;
  logger?: Logger;
  /** OAuth クライアント設定(環境ごとに差し替え)*/
  config: AuthConfig;
}

export interface AuthConfig {
  clientId: string;
  redirectUri: string;          // 'https://invokeaide-beta.pages.dev/auth/callback' 等
  stage1Scopes: string[];       // ['openid', 'email', 'profile', 'drive.file', 'tasks']
  stage2AdditionalScopes: string[]; // ['calendar']
}

export type AuthStage = 'unauth' | 'stage1' | 'stage2';

export type AuthInitResult =
  | { ok: true; restored: boolean; stage: AuthStage }
  | { ok: false; reason: 'secret_store_unavailable' | 'config_invalid' | 'unknown' };

export type AuthResult =
  | { ok: true; granted: string[]; newStage: AuthStage }
  | { ok: false; reason: 'denied' | 'partial' | 'network' | 'unknown'; granted?: string[] };

export type AccessTokenResult =
  | { ok: true; token: string; expiresAt: number }   // expiresAt: unix ms
  | { ok: false; reason: 'no_refresh_token' | 'refresh_failed' | 'network' | 'unknown' };
```

### 4.2 Stage 0 → 0.5 → 1 → 2 遷移の契約

| 遷移 | 契約 |
|---|---|
| 0 → 0.5 | **AuthProvider の管轄外**(ConsentService が規約同意 / 年齢確認を担当、 §5)|
| 0.5 → 1 | `requestStage1Consent()` を呼ぶ、 成功で stage=1 |
| 1 → 2 | `requestCalendarConsent()` を呼ぶ、 成功で stage=2、 既得スコープは維持 |
| 任意 → unauth | `signOut()` を呼ぶ |

### 4.3 Stage 1 で Drive 拒否時の挙動(Q-U-a-3 連動)

Q-U-a-3 はたかしさん判断が確定していないが、 contract としては **「拒否時は (c) 再要求しながら起動継続」** を選べるよう余地を残す:
- `requestStage1Consent()` が `{ ok: false, reason: 'partial', granted: ['openid', 'email', ...] }` を返した場合、 呼び出し側(設定画面 UI)が「Drive 接続が必要です」 バナー表示 + 再要求ボタンを設置
- StorageProvider 側は `InitResult.reason='drive_denied'` を返し、 読み書き不能状態で動く
- ユーザー判断で「ローカルのみモード」 にするか「再要求」 するかが UI 上で選べる(Sさん 設定画面実装で対応)

---

## 5. ConsentService(高レベル、 法的書類 §6.3 / §6.4 連動、 新規)

### 5.1 contract

```typescript
/**
 * ConsentService
 * 規約同意 / 年齢確認 / プライバシー同意 状態管理。
 * 法的書類 v0.3 §6.3(年齢制限)/ §6.4(規約同意フロー)整合。
 *
 * 同意ログは settings.consents ブロックに保存(StorageProvider 経由)。
 *
 * 前提:
 *   - StorageProvider.initialize() が先行
 *   - settings.json 取得が成功している(取得失敗時は同意ログを「未取得」 扱い)
 *
 * 事後条件:
 *   - acceptTerms 後、 isTermsAccepted(version) が true を返す
 *   - 規約バージョンが変わると(termsVersion 引数が settings.consents の値と異なる)、
 *     再同意が必要(isTermsAccepted は false を返す)
 */
export interface ConsentService {
  initialize(deps: ConsentDeps): Promise<void>;

  // -- 規約 -----------------------------------------------
  isTermsAccepted(currentVersion: string): Promise<boolean>;
  acceptTerms(version: string): Promise<ConsentOpResult>;

  // -- プライバシーポリシー -------------------------------
  isPrivacyAccepted(currentVersion: string): Promise<boolean>;
  acceptPrivacy(version: string): Promise<ConsentOpResult>;

  // -- 年齢確認 -------------------------------------------
  isAgeConfirmed(): Promise<boolean>;
  /** 13歳以上であることの確認、 confirmed=true で記録 */
  confirmAge(confirmed: boolean): Promise<ConsentOpResult>;

  // -- 状態スナップショット -------------------------------
  getConsentState(): Promise<ConsentState>;
  watchConsentState(cb: WatchCallback<ConsentState>): Unsubscribe;
}

export interface ConsentDeps {
  storage: StorageProvider;
  clock: Clock;
  logger?: Logger;
}

export interface ConsentState {
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  privacyVersion: string | null;
  privacyAcceptedAt: string | null;
  ageConfirmed: boolean;
  ageConfirmedAt: string | null;
  /** すべての同意が現バージョンで揃っているか(UI ゲート判定用)*/
  allConsentsCurrent: (currentTermsVer: string, currentPrivacyVer: string) => boolean;
}

export type ConsentOpResult =
  | { ok: true }
  | { ok: false; reason: 'storage_failed' | 'invalid_input' | 'unknown' };
```

### 5.2 「未来縛らない」 原則の適用

- 規約 / プライバシー バージョンが上がると **`isTermsAccepted` が自動で false を返す** → 再同意フロー発火
- バージョン比較はセマンティックバージョニングではなく **文字列完全一致**(`'v0.3' !== 'v0.4'` で再同意)
- 同意取り消し API は **ベータ v1.0 で実装しない**(法的書類 §6.10「データ自己削除手順」 で代替)、 商品化版で追加検討

### 5.3 年齢確認 13 歳未満の扱い

- `confirmAge(false)` は記録するが、 アプリ利用不可
- UI 側で「13歳以上ですか?」 質問 → 「いいえ」 で利用継続不可 + 案内画面
- 法的書類 §6.3「虚偽申告について運営者は責任を負わない」 表現と整合

---

## 6. SettingsService(高レベル、 settings.json 抽象、 新規)

### 6.1 contract

```typescript
/**
 * SettingsService
 * settings.json の get/set 抽象。 StorageProvider 上の高レベル API。
 *
 * 前提:
 *   - StorageProvider.initialize() が先行
 *
 * 事後条件:
 *   - setX() 後、 getX() / watchX() が新しい値を返す
 *   - StorageProvider.saveSettings() が pending queue に積まれた場合でも、 メモリ上の
 *     状態は更新される(楽観更新)
 */
export interface SettingsService {
  initialize(deps: SettingsDeps): Promise<void>;

  // -- スナップショット -----------------------------------
  getSettings(): Promise<Settings>;
  watchSettings(cb: WatchCallback<Settings>): Unsubscribe;

  // -- パーシャル更新 -------------------------------------
  setCurrentCharacterId(id: string): Promise<SaveResult>;
  setCoachingEnabled(enabled: boolean): Promise<SaveResult>;
  setNotificationTime(time: string): Promise<SaveResult>;      // 'HH:MM'
  setNotificationFrequency(freq: 'daily' | 'weekday' | 'custom', customDays?: WeekdayMask): Promise<SaveResult>;
  setAiProvider(provider: AiProviderId, modelHint?: string | null): Promise<SaveResult>;
  setTtsConfig(config: { preferVoicevox?: boolean; voicevoxEndpoint?: string | null; fallbackWebSpeech?: boolean }): Promise<SaveResult>;
  setUiConfig(config: { fontScale?: number; reducedMotion?: boolean }): Promise<SaveResult>;

  // -- 一括上書き(設定画面の「保存」 ボタン等で使用)-----
  applyPatch(patch: Partial<Settings>): Promise<SaveResult>;
}

export interface SettingsDeps {
  storage: StorageProvider;
  clock: Clock;
  logger?: Logger;
}
```

### 6.2 設計判断

- **パーシャル更新メソッドを個別に提供**: UI 側で「通知 ON ボタン」 を押した時に `setCoachingEnabled(true)` 1行で済む、 設定画面の典型操作を最短記述で可能
- **`applyPatch`** で複雑な部分更新も可能(設定画面の「保存」 ボタン等)
- **`lastUpdated` は SettingsService が自動更新**(呼び出し側は触らない、 ResourceMeta.modifiedTime と一致させる)

---

## 7. CharacterService(高レベル、 キャラ管理、 新規)

### 7.1 contract

```typescript
/**
 * CharacterService
 * キャラクター選択 + character.md / coaching.md の動的読込
 * systemInstruction の再構築(LLMProvider 呼出時)
 *
 * 前提:
 *   - StorageProvider.initialize() が先行
 *
 * 事後条件:
 *   - selectCharacter(id) 後、 getCurrentCharacter() が id を返す
 *   - getSystemInstruction() は character.md + プロファイル + 現在時刻 + ツール利用ルール を連結
 *   - getCoachingPrompt(context) は character.md + coaching.md(テンプレ + 変数差し込み)を返す
 */
export interface CharacterService {
  initialize(deps: CharacterDeps): Promise<void>;

  // -- 一覧 / 選択 ---------------------------------------
  listCharacters(): Promise<CharacterEntry[]>;
  getCurrentCharacter(): Promise<CharacterEntry | null>;
  selectCharacter(id: string): Promise<SelectCharacterResult>;
  watchCurrentCharacter(cb: WatchCallback<CharacterEntry | null>): Unsubscribe;

  // -- systemInstruction(通常チャット用)------------------
  getSystemInstruction(opts?: SystemInstructionOptions): Promise<string>;

  // -- コーチングプロンプト(コーチングモード起動時)-------
  getCoachingPrompt(context: TaskCoachingContext): Promise<string>;

  // -- 改訂検出(Q-U-c-2 連動、 ビルド版 vs Drive 版 差分通知)
  checkForBundledUpdates(): Promise<CharacterUpdateInfo[]>;
  applyBundledUpdate(id: string, strategy: 'overwrite' | 'backup_then_overwrite' | 'skip'): Promise<SaveResult>;
}

export interface CharacterDeps {
  storage: StorageProvider;
  clock: Clock;
  logger?: Logger;
}

export interface SystemInstructionOptions {
  /** ユーザー表示名(profile.frontmatter.displayName を上書きする時)*/
  displayNameOverride?: string;
}

export type SelectCharacterResult =
  | { ok: true; character: CharacterEntry }
  | { ok: false; reason: 'not_found' | 'load_failed' | 'unknown' };

export interface CharacterUpdateInfo {
  id: string;
  displayName: string;
  diff: CharacterDiffResult;
}
```

### 7.2 `getCoachingPrompt` の動作仕様

```typescript
export interface TaskCoachingContext {
  countByRank: { A: number; B: number; C: number; D: number };
  staleTasks: {
    A: TaskSummary[];    // 3日以上経過
    B: TaskSummary[];    // 7日以上経過
    C: TaskSummary[];
    D: TaskSummary[];
  };
  dueWithinDays: TaskSummary[];    // 期限 3 日以内(Q14 拡張で「期限間近」)
  overdue: TaskSummary[];
  completedToday: TaskSummary[];
  now: Date;
}

export interface TaskSummary {
  id: string;
  title: string;
  rank: 'A' | 'B' | 'C' | 'D' | string;
  due: string | null;             // YYYY-MM-DD
  addedDaysAgo: number;
  notes?: string;
}
```

呼び出し側:

```typescript
const coachingPrompt = await characterService.getCoachingPrompt(context);
// → 内部で character.md(キャラ性格)+ coaching.md(テンプレ)+ context 差し込み
// → systemInstruction として LLMProvider.generateContent に渡す
```

### 7.3 systemInstruction の構築規則

```
[キャラ性格(character.md)]
---
[ユーザープロフィール(profile.frontmatter.displayName 等から構築)]
---
[現在時刻(JST、 ISO、 タイムゾーン)]
---
[ツール利用ルール(Phase 0 デモ MIYU_demo.html:443-477 を継承、 Calendar/Tasks 操作ルール)]
```

コーチングモードの場合は末尾に追加:

```
---
[コーチングテンプレート(coaching.md、 context 差し込み済み)]
```

---

## 8. NotifyProvider(高レベル、 コーチング通知発火、 新規)

### 8.1 contract

```typescript
/**
 * NotifyProvider
 * Calendar Event ベースのコーチング通知発火。
 * Sさん v0.3 §1.3 / Uさん OAuth §3.3 Stage 2 連動。
 *
 * 前提:
 *   - AuthProvider.currentStage() === 'stage2'(Calendar スコープ取得済み)
 *   - StorageProvider から専用カレンダー ID(settings.calendar.dedicatedCalendarId)を取得可
 *
 * 事後条件:
 *   - scheduleDailyCoaching() 後、 指定時刻に MIYU 専用カレンダーに Event が存在
 *   - 同日同時刻の既存 Event があれば更新、 新規作成しない(冪等)
 */
export interface NotifyProvider {
  initialize(deps: NotifyDeps): Promise<NotifyInitResult>;

  /** 専用カレンダーを作成(まだなければ)、 dedicatedCalendarId を返す */
  ensureDedicatedCalendar(name?: string): Promise<EnsureCalendarResult>;

  /** 翌日分(または今日 18:00 前なら今日)のコーチング Event を作成 / 更新 */
  scheduleDailyCoaching(spec: CoachingScheduleSpec): Promise<ScheduleResult>;

  /** 今後 N 日分を先回りでまとめてスケジュール(オプション、 デフォルト1日先)*/
  scheduleBatch(daysAhead: number, spec: CoachingScheduleSpec): Promise<ScheduleResult>;

  /** コーチング Event のみを取り消し(Calendar 自体は残す)*/
  cancelCoaching(date: IsoDate): Promise<NotifyOpResult>;

  /** 全コーチング Event を一括取り消し(設定画面の通知 OFF 時)*/
  cancelAllCoaching(): Promise<NotifyOpResult>;
}

export interface NotifyDeps {
  auth: AuthProvider;
  storage: StorageProvider;
  clock: Clock;
  logger?: Logger;
}

export interface CoachingScheduleSpec {
  /** 'HH:MM' JST */
  time: string;
  /** 'daily' / 'weekday' / 'custom' (settings.coaching.frequency と一致)*/
  frequency: 'daily' | 'weekday' | 'custom';
  customDays?: WeekdayMask;
  /** Event 本文に入れる固定文言(Sさん 起草)、 デフォルトあり */
  bodyText?: string;
  /** Event タイトル、 デフォルト「MIYU - タスク見直しの時間」 */
  title?: string;
}

export type NotifyInitResult =
  | { ok: true }
  | { ok: false; reason: 'not_stage2' | 'storage_unavailable' | 'unknown' };

export type EnsureCalendarResult =
  | { ok: true; calendarId: string; created: boolean }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'unknown' };

export type ScheduleResult =
  | { ok: true; createdEvents: number; updatedEvents: number }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'partial' | 'unknown' };

export type NotifyOpResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'unknown' };
```

### 8.2 Event の設計

- **タイトル**: 「MIYU - タスク見直しの時間」(デフォルト)
- **開始時刻**: 設定された通知時刻(18:00 デフォルト)
- **終了時刻**: 開始 + 15分(意味のない長時間にしない、 UX 配慮)
- **本文**: 「📱 アプリを開いて MIYU と整理しよう。 タスクが {n} 件あります」 (動的)
- **リマインダー**: `{ method: 'popup', minutes: 0 }`(イベント開始時刻にプッシュ)
- **`extendedProperties.private.miyu_kind`**: `'coaching_notification'` (識別用、 PC1 既存 MIYU の `miyu_reminder=true` 慣例と同様)

### 8.3 Calendar Event リマインダー方式採用の根拠(再掲)

Sさん v0.3 §1.3 で確定、 たかしさん Q13 で確定。 本書では契約として具体化:
- FE 完結維持(バックエンドサーバー不要)
- OS ネイティブ通知(IT 音痴ユーザー親和性)
- Telegram / Web Push は本筋ではない、 商品化版で再検討

---

## 9. interface 利用の実装例 2 つ

### 9.1 例1: 初回起動 → Stage 1 同意 → 設定保存

```typescript
// 起動シーケンス
const secretStore = new IndexedDbSecretStore();
const auth = new GoogleAuthProvider();
const storage = new DriveStorage();
const settingsSvc = new DefaultSettingsService();
const consentSvc = new DefaultConsentService();

const clock: Clock = { now: () => new Date() };

await secretStore.initialize();
await auth.initialize({ secretStore, clock, config: { /* ... */ } });
await storage.initialize({ auth, secretStore, clock });
await consentSvc.initialize({ storage, clock });
await settingsSvc.initialize({ storage, clock });

// 規約・年齢確認 UI 表示判定
const termsCurrent = await consentSvc.isTermsAccepted('v0.4');
const ageConfirmed = await consentSvc.isAgeConfirmed();

if (!termsCurrent || !ageConfirmed) {
  // 規約画面 → 年齢確認 → 同意 UI 表示
  await consentSvc.acceptTerms('v0.4');
  await consentSvc.acceptPrivacy('v0.4');
  await consentSvc.confirmAge(true);
}

// Stage 1 同意(OAuth)
const stage1 = await auth.requestStage1Consent();
if (!stage1.ok) {
  // 拒否 UI 表示
  return;
}

// Storage 初回レイアウト作成
await storage.ensureLayout();

// 設定読込 + キャラ選択
const settings = await settingsSvc.getSettings();
console.log('currentCharacter:', settings.currentCharacterId);
```

### 9.2 例2: コーチング通知 ON → Stage 2 昇格 → Calendar Event 作成

```typescript
// 設定画面でユーザーが「コーチング通知を有効にする」 トグル ON
const stage2 = await auth.requestCalendarConsent();
if (!stage2.ok) {
  // Calendar 拒否、 設定画面のトグルを OFF に戻す + 「Google Calendar の同意が必要」 表示
  return;
}

// 設定を保存
await settingsSvc.setCoachingEnabled(true);
await settingsSvc.setNotificationTime('18:00');

// 専用カレンダー作成
const notifySvc = new GoogleNotifyProvider();
await notifySvc.initialize({ auth, storage, clock });

const cal = await notifySvc.ensureDedicatedCalendar('MIYU');
if (!cal.ok) {
  await storage.appendError({
    occurredAt: clock.now(),
    category: 'Calendar API',
    kind: 'ensure_calendar_failed',
    message: 'MIYU 専用カレンダーの作成に失敗しました',
    context: { reason: cal.reason },
  });
  return;
}

await settingsSvc.applyPatch({
  calendar: { dedicatedCalendarId: cal.calendarId, manageMainCalendar: false },
});

// 翌日分の Event を作成
const result = await notifySvc.scheduleDailyCoaching({
  time: '18:00',
  frequency: 'daily',
});

if (result.ok) {
  console.log(`Created: ${result.createdEvents}, Updated: ${result.updatedEvents}`);
}
```

---

## 10. リスク・トレードオフ

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | 7 interface は数が多く、 認知負荷大 | 🟡 中 | 高レベル(SettingsService 等)から学んで、 低レベル(StorageProvider)は実装時に詳細化、 と段階理解可。 サンプル §9 で典型シーケンスを示した |
| 2 | watch* セマンティクスの実装が複雑(同一値の重複通知禁止、 unsubscribe 後の発火禁止) | 🟢 低 | 軽量 EventEmitter + JSON.stringify ベース等価判定で 30行以内に収まる |
| 3 | LoadOptions.forceFresh を呼び出し側が忘れて古いキャッシュで動く | 🟢 低 | TTL ポリシー §1.5 で殆どのケースでバックグラウンド再取得、 forceFresh は「最新を取得」 明示ボタン用 |
| 4 | SecretStore の端末派生鍵が iOS Safari 7日ポリシーで消える | 🟡 中 | §3.3 復旧フロー定義済み、 Drive 上のデータは無事 |
| 5 | NotifyProvider が Stage 2 を要求する設計で「Calendar 機能だけ欲しい(通知 OFF)」 ユーザー対応漏れ | 🟢 低 | Q-U-a-1 で「Stage 2 分離 + 別オプション併設」 が推奨済み、 Sさん 設定画面実装で吸収 |
| 6 | CharacterService.getSystemInstruction の構造変更が後で必要になる(プロンプトエンジニアリング) | 🟢 低 | `SystemInstructionOptions` で拡張可、 character.md フォーマット自体は安定領域 |
| 7 | ConsentService の規約バージョンが頻繁に上がるとユーザーが「再同意疲れ」 | 🟡 中 | エルトン側で規約改訂頻度を最小化、 軽微変更時は「マイナー」 扱いで再同意不要にする規約条文を追加可 |

---

## 11. たかしさんに判断を仰ぎたい事項

| # | 事項 | Sさん 感触 |
|---|---|---|
| Q-S-1 | 7 interface(StorageProvider / SecretStore / AuthProvider / SettingsService / ConsentService / CharacterService / NotifyProvider)で確定 OK か | 推奨、 Uさん 叩き台 + SecretStore 取り込み |
| Q-S-2 | キャッシュ TTL ポリシー §1.5 で OK か | 推奨、 settings 5分 / index 1h / manual 24h / characters 1h |
| Q-S-3 | Result 型族(LoadResult / SaveResult / AppendResult / FlushResult / 各 Op 系)で OK か | 推奨、 Uさん 叩き台採用 |
| Q-S-4 | SecretStore を Sさん 確定対象に含めた件で OK か(Uさん §11.1 副次気づき採用)| 推奨、 暗号化要件の境界明確化に必要 |
| Q-S-5 | AuthProvider Stage 機械の契約(0/0.5/1/2)で OK か | 推奨、 Uさん OAuth §3.1 整合 |
| Q-S-6 | ConsentService 規約バージョン文字列完全一致での再同意発火で OK か | 推奨、 「マイナー変更時は再同意不要」 規約条文はエルトン領域 |
| Q-S-7 | CharacterService.getCoachingPrompt の TaskCoachingContext 構造で OK か | 推奨、 Sさん v0.3 §2.2.1 整合、 6段階優先順位対応 |
| Q-S-8 | NotifyProvider の Calendar Event 設計(タイトル / リマインダー方式 / extendedProperties)で OK か | 推奨、 Sさん v0.3 §1.3 / Uさん Drive レイアウト §3.2 整合 |
| Q-S-9 | 本書を Phase 2 全 Sprint で参照する横断資産として扱う件で OK か(Sprint 識別はファイル本文の前文)| 推奨、 命名規則統一案 §7.4 とエルトン書面 §Q2 整合 |

---

## 12. 副次的に気づいた課題

### 12.1 Phase 1 v0.3 §3.2 キャラメタデータ JSON 案との整合

CharacterEntry 型は Phase1 v0.3 §3.2 / Phase2_Drive_ファイルレイアウト §4.2 と一致。 確認のみ、 修正なし。

### 12.2 LLMProvider との結合

CharacterService.getSystemInstruction の出力は LLMProvider.generateContent への入力。 LLMProvider interface(Phase1 v0.1 §4.4 で確定)との接続は **本書スコープ外、 ChatService 層で実施**。 Phase 2 Sprint 2 で ChatService 設計時に確定予定。

### 12.3 ConflictResolver UI 露出(エルトン書面副次課題)

`StorageProvider.onConflict` イベントを受けた UI 設計は Sさん 領域。 仕様書 §22 3択ボタン整合で「最新を採用 / 自分を採用 / マージ」 3択を出す。 これは Sprint 2 以降の UI 実装タスクとして別途、 本書では interface のフックのみ提供。

### 12.4 PC1 既存 MIYU との同期は不要(Q17 確定)

Sさん v0.3 §3.3 / Uさん Drive レイアウト §9 で言及されていた PC1 既存 MIYU との同期は、 Q17 確定「PC1 既存 MIYU と InvokeAide は完全に別物として並走」 で **本書スコープ外** 。 InvokeAide 側だけで完結。

### 12.5 Tさん テスト戦略 v0.2 への連動

Tさん 側で本書を参照しつつ、 以下のテスト容易性確保ポイントを意識:
- StorageProvider に MemoryStorage / FlakyStorage 実装が必要(Uさん 叩き台 §8.1 を契約として明示)
- SecretStore に MemorySecretStore 実装が必要(テスト用)
- AuthProvider に MockAuthProvider が必要(stage 任意設定可)
- watch* セマンティクスの単体テスト(購読 → 値変更 → 通知 → unsubscribe → 通知禁止)

### 12.6 manual.md / character MD / coaching MD 本文起草の依頼

エルトン書面で次タスクとして示唆あり:
- `manual.md` 本文起草(Sさん 中核領域)
- `miyu.md` 本文起草(Sさん 中核領域、 Phase 0 character.md 既存を参照)
- `miyu.coaching.md` 本文起草(Sさん 中核領域、 Phase1 v0.3 §2.3.1 にドラフトあり)
- `sebastian.coaching.md` 本文起草(Sさん 中核領域、 Phase1 v0.3 §2.3.2 にドラフトあり)
- `sebastian.md` は Phase1 提案にドラフト済み、 Sさん 確認のみで配置可

本書完了報告後、 次の作業として待機。

### 12.7 仕様書 v1.5 反映依頼候補(エルトン主導)

- 仕様書 v1.5 §20 設定値保存に Settings 型(本書 §2)を採用
- 仕様書 v1.5 §15 セキュリティ・プライバシーに SecretStore 設計(本書 §3)を反映
- 仕様書 v1.5 §24 エラー対応設計に ErrorEntry 型と errors.md フォーマット(Uさん Drive レイアウト §4.8)を採用

---

## 13. 完了報告フォーマット(STさん指示書 §9 準拠)

```
[Phase 2 Sprint 1 Interface 契約 v0.1 完了報告(Sさん 確定起草)]
完了日時: 2026-05-19(火)午後 即着手
所要時間: 約 2.5時間(想定工数 2〜3時間内)
成果物のファイルパス: C:\dev\InvokeAide\docs\Phase2\Phase2_Interface契約_v0.1_2026-05-19.md

主要な発見 / 判断:
  - 7 interface 確定(StorageProvider / SecretStore / AuthProvider / SettingsService
    / ConsentService / CharacterService / NotifyProvider)
  - Uさん 3 叩き台(OAuth / Drive レイアウト / Storage)を吸収、 SecretStore は
    Uさん §11.1 副次気づきを Sさん 確定対象として取り込み
  - キャッシュ TTL ポリシー: settings 5分 / index 1h / manual 24h / characters 1h
    (Q-U-b-5 確定)
  - LoadResult / SaveResult / AppendResult / FlushResult の Result 型族で統一
  - watch* セマンティクスを契約として明示(5項目)
  - 暗号化要件: Drive 平文 + SecretStore で IndexedDB AES-GCM(端末派生鍵)
  - SoT 同期: Drive SoT + ローカルキャッシュ、 forceFresh / allowStaleCache 採用
  - オフライン: pending queue は IndexedDB 専用、 リトライ上限5回(Q-U-b-3 確認)

推奨する次のアクション:
  - 本書レビュー、 §11 Q-S-1〜Q-S-9(9点)の判断
  - エルトン経由で Uさん に確定 contract 共有、 Storage 実装着手 GO
  - Sさん は次タスク(manual.md / miyu.md / miyu.coaching.md / sebastian.coaching.md
    起草、 sebastian.md 確認)に着手判断待ち
  - Tさん へ本書共有、 テスト戦略 v0.2 への結合反映(§12.5)

たかしさんに判断を仰ぎたい事項: 本書 §11 に 9点

副次的に気づいた課題: 本書 §12 に 7点
```

---

## 14. 運用ルール(2026-05-19 夜 たかしさん確定指示で追記)

### 14.1 ConsentService バージョン更新の運用ルール(Q-S-6 補足)

`ConsentService.isTermsAccepted(currentVersion)` は文字列完全一致で再同意を発火する仕様(本書 §5.1)。 これに伴い、 **規約 / プライバシーポリシー のバージョンを上げる時は「実質的変更時のみ」 とする運用ルール** を確定:

- **再同意発火が必要な変更(バージョンを上げる)**:
  - データ取り扱いの追加・変更(収集対象の追加、 第三者提供の追加 等)
  - ユーザーの権利・義務の変更(年齢制限変更、 禁止事項追加 等)
  - 課金・退会フローの実質的変更
  - 法令対応に伴う条文追加
- **再同意発火しなくてよい変更(バージョンを上げない)**:
  - typo 修正、 言い回しの軽微な調整
  - 連絡先の更新(運営者情報の住所変更 等、 実質的契約条件に影響しない範囲)
  - レイアウト・スタイルの変更
  - 参照文書の番号修正

これにより、 軽微改訂で家族テスター含む全ユーザーに再同意ダイアログが出る事態を回避する。

### 14.2 反映先

- 本ルールは ConsentService 利用側(設定画面 UI 実装、 法的書類本文)で参照
- 法的書類 v0.4 改訂時にも本ルールを反映予定(エルトン主導)
- 規約改訂時、 エルトンが「実質的変更か否か」 を判定し、 バージョンを上げるかを決定

---

## 15. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火)午後 | 初版作成。 7 interface 確定起草、 Uさん 3 叩き台吸収、 SecretStore 取り込み、 TTL ポリシー / Result 型族 / watch* セマンティクス 確定 | Sさん(Sonnet) |
| v0.1(本日夜追記) | 2026-05-19(火)夜 | §14 運用ルール追記(ConsentService バージョン更新の「実質的変更時のみ」 運用ルール、 Q-S-6 補足) | Sさん(Sonnet) |

---

**以上、 Sさん(Sonnet) Phase 2 Interface 契約 v0.1 確定起草。 §11 9 点の判断と次タスク(キャラMD / マニュアル起草)着手 GO を待ちます。**
