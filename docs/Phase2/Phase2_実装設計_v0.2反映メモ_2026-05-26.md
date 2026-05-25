---
title: 実装設計 v0.2 反映メモ(Uさん 内判断 4 件の確定)
date: 2026-05-26
author: Uさん(InvokeAide 実装補助 / 横串整合)
status: v0.2 への畳み込み素材、Sさん 回答到着後に v0.2 本体として統合
upstream:
  - docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md(本書のベース)
  - 技術顧問指示(2026-05-26): Uさん 内判断 4 件の確定、v0.2 反映メモ作成
取り決め:
  - v0.2 は v0.1 + Sさん 回答の畳み込みで軽く(技術顧問 2026-05-26 方針)
  - 本書は Sさん 回答到着前の先行確定分(Uさん 内判断 4 件)
---

# 実装設計 v0.2 反映メモ(Uさん 内判断 4 件の確定)

## 0. このメモについて

技術顧問の 2026-05-26 指示「Q-U-j 13 件のうち、Uさん 内判断の 4 件を確定 + v0.2 への反映メモにまとめる」に対応。v0.2 本体は Sさん 回答到着後に統合する想定で、本書は **先行確定分の差分メモ** として位置づける。

対象 4 件:

| # | 領域 | 内容 | v0.1 §位置 |
|---|---|---|---|
| Q-U-j-4 | AuthProvider | PKCE code_verifier の保持場所 | §2.14 |
| Q-U-j-8 | StorageProvider | PendingQueueStore / ConflictResolver を独立クラスにするか | §3.7 |
| Q-U-j-9 | StorageProvider | IndexedDB キャッシュの TTL 値 | §3.7 |
| Q-U-j-11 | TTSProvider | Cloud Run コールドスタート時の synthesize リトライ戦略 | §4.10 |

---

## 1. Q-U-j-4 確定:PKCE code_verifier は `localStorage` に保存

### 1.1 確定内容

- **保持場所**: `localStorage`
- **キー名**: `'invokeaide.pkce.codeVerifier'`
- **ライフサイクル**: `requestStage1Consent()` / `requestCalendarConsent()` 開始時に保存、コールバック(`/auth/callback` での `exchangeCodeForTokens()`)完了時に即削除

### 1.2 選択理由

| 候補 | 評価 |
|---|---|
| `localStorage`(採用) | リダイレクトベース OAuth でブラウザ再起動 / タブ切替に耐える、SPA 標準 |
| `sessionStorage` | ブラウザ実装によってタブ越え時に消える可能性、リスクあり |
| Pinia ストア | リロードで消える、リダイレクトベース OAuth と相性悪い |
| IndexedDB(SecretStore 経由) | PKCE は短命用途、暗号化までは不要、過剰 |

### 1.3 v0.1 §2.6 / §2.14 への差分

v0.1 §2.14 の `Q-U-j-4: 「PKCE の code_verifier を localStorage に保持するか、Vuex/Pinia store に保持するか(リダイレクト前後で同一が必要、localStorage が無難)」` を **削除**、§2.6 `OAuth フロー実装` の手順 1 に以下を加筆:

> 1. PKCE 用 code_verifier / code_challenge を生成
>    - code_verifier は `localStorage.setItem('invokeaide.pkce.codeVerifier', verifier)` で保存
>    - `/auth/callback` の `exchangeCodeForTokens()` 完了直後に `localStorage.removeItem('invokeaide.pkce.codeVerifier')`

---

## 2. Q-U-j-8 確定:PendingQueueStore / ConflictResolver は独立クラスとして切り出す

### 2.1 確定内容

`src/implementations/internal/` 配下に独立クラスとして配置:

- `src/implementations/internal/PendingQueueStore.ts`
- `src/implementations/internal/ConflictResolver.ts`

`DriveStorageProvider` は constructor 内で両者をインスタンス化、もしくは `StorageDeps` 拡張で DI(後述)。

### 2.2 選択理由

| 観点 | 内部に閉じる | 独立クラスで切出し(採用) |
|---|---|---|
| `DriveStorageProvider` の規模 | 既に巨大(public 22 + 内部 9)、さらに肥大 | スリム化、責務単一に近づく |
| 単体テスト容易性 | DriveStorageProvider 経由でしかテストできない | PendingQueueStore 単独でテスト可、ConflictResolver も同様 |
| Mock 化 | 全体 Mock(MemoryStorage)が必要 | 該当部分のみ Mock 可能、テストが局所化 |
| 責務分離 | LWW 競合 / 保存待ちキューが混在 | LWW は ConflictResolver、保存待ちは PendingQueue で明確 |

### 2.3 切り出し範囲(暫定)

#### `PendingQueueStore`

```
責務: オフライン書き込みの順序保証付きキュー、IndexedDB 永続化
公開 API:
  - initialize(): Promise<void>
  - enqueue(operation: PendingOperation): Promise<void>
  - dequeueAll(): Promise<PendingOperation[]>
  - size(): Promise<number>
  - clear(): Promise<void>
内部:
  - IDB スキーマ(DB: 'invokeaide.pending'、ObjectStore: 'queue'、key: auto-increment)
  - 順序保証: auto-increment key で FIFO
依存:
  - clock: Clock(enqueuedAt 用)
  - logger?: Logger
```

#### `ConflictResolver`

```
責務: LWW + ETag 412 検知 + conflicts/ への退避 + ConflictEvent 発火
公開 API:
  - handleConflict(args: ConflictArgs): Promise<ConflictEvent>
  - onConflict(cb: (ev: ConflictEvent) => void): Unsubscribe
内部:
  - conflicts/ 配下への退避は driveApi 呼出が必要 → DriveStorageProvider から渡される
依存:
  - driveApi: <T>(method, url, opts?) => Promise<T>(DriveStorageProvider から関数渡し)
  - clock: Clock
  - logger?: Logger
```

### 2.4 v0.1 §3.3 / §3.5 への差分

v0.1 §3.3 のクラス構造図に以下を追記:

```
class DriveStorageProvider implements StorageProvider
├─ private pendingQueue: PendingQueueStore         // 独立クラス、constructor or initialize で生成
├─ private conflictResolver: ConflictResolver      // 独立クラス、同上
├─ ...(他フィールドは v0.1 のまま)
```

v0.1 §3.5 `handleConflict()` 内部の処理を以下に置換:

> 旧: `handleConflict(logicalPath, ours, theirs) 内部:` 5 ステップ
>
> 新: `await this.conflictResolver.handleConflict({ logicalPath, ours, theirs, driveApi })` の 1 行に集約、内部処理は ConflictResolver 側に移動

v0.1 §3.7 の `Q-U-j-8` を **削除**(確定済)。

---

## 3. Q-U-j-9 確定:IndexedDB キャッシュ TTL は階層化

### 3.1 確定内容

リソース種別ごとに TTL を分ける:

| リソース種別 | TTL | 理由 |
|---|---|---|
| `settings.json`(F3) | **60 秒** | ユーザー操作後の即時反映が必要、設定変更時の UX 担保 |
| `index.json`(F2、CharacterIndex) | **60 秒** | キャラ追加/削除/切替時の即時反映 |
| `profile.md`(F4) | **60 秒** | ユーザー編集後の即時反映 |
| `manual.md`(F5、読みのみ) | **1 時間** | 更新頻度低、bundled fallback あり |
| `characters/*.md`(F6) | **1 時間** | 更新頻度低、bundled fallback あり |
| `characters/*.coaching.md`(F7) | **1 時間** | 同上 |
| `errors.md`(F8、追記専用) | キャッシュなし | 書き込み専用、読み戻し時は常に Drive |
| `conversations/*.md`(F9、追記専用) | キャッシュなし | 同上 |

`LoadOptions.allowStaleCache = true` で TTL を無視、`forceFresh = true` で TTL 無視して Drive 取得。

### 3.2 選択理由

- **60 秒**: ユーザー操作後 1 分以内に再表示しても古い値で混乱しないライン、Drive API のレート消費を最小化(60 秒以内なら同一ファイルへの読み込みは 1 回)
- **1 時間**: bundled アセット fallback と組み合わせ、ネットワーク負荷を最小化。`manual.md` / `characters/*.md` は週次以下の更新頻度想定
- **キャッシュなし**(追記専用): 書き込みが頻発、最新値は Drive を見るしかない
- ベータ v1.0 用の暫定値として確定、運用後に再評価(技術顧問判断で再調整可)

### 3.3 「UX 影響あれば たかしさん 確認」の扱い

v0.1 §8.3 で「UX 影響あれば たかしさん 確認」と保留した条件付きの件:

→ 上記の値は「UX 上問題が出る前の暫定値」。ベータ v1.0 リリース後にたかしさんの体感で違和感があれば再調整。設計上はリソース種別ごとの定数(`CACHE_TTL_SETTINGS = 60_000` 等)を `src/implementations/internal/cache-config.ts` に分離し、変更が容易な構造にする。

### 3.4 v0.1 §3.5 / §3.7 への差分

v0.1 §3.5 `loadSettings(opts?)` の手順 1 を以下に修正:

> 旧: `cache.get('config/settings.json') を確認 - cache hit + TTL 内 + !forceFresh → cache を返す`
>
> 新: `cache.get('config/settings.json') を確認 - cache hit + TTL 内(CACHE_TTL_SETTINGS = 60_000ms)+ !forceFresh → cache を返す`

`loadCharacterMd` / `loadCoachingMd` / `loadManual` 等にも同様の TTL 注記を追記。

v0.1 §3.7 の `Q-U-j-9` を **削除**(確定済)。

---

## 4. Q-U-j-11 確定:Cloud Run コールドスタート時のリトライは Provider 内では行わない

### 4.1 確定内容

VoicevoxTTSProvider 内では **リトライしない**(リトライ回数 = 0)。段階的タイムアウト + 呼出側でのリトライ判断に委ねる:

```
1. 初回 synthesize リクエスト: タイムアウト 120 秒(Cloud Run コールドスタート ~90 秒許容 + 余裕 30 秒)
2. タイムアウト or 5xx エラー → { ok: false, reason: 'network' } を返す
3. Provider 内ではリトライしない
4. UI 側(B3 領域)で「VOICEVOX 起動中…再試行する?」のボタン UI を出す想定
5. 2 回目以降の synthesize はタイムアウト 30 秒(通常運用)
```

タイムアウト切替は `VoicevoxTTSProvider` 内部状態で管理:

```
private hasSucceededOnce: boolean = false
// synthesize() 成功時に true にセット
// hasSucceededOnce ? TIMEOUT_NORMAL_MS : TIMEOUT_COLD_START_MS
```

### 4.2 選択理由

| 観点 | Provider 内リトライ | 呼出側リトライ(採用) |
|---|---|---|
| 無限ループリスク | リトライ回数管理が必要、バグ混入リスク | 呼出側のユーザー操作で 1 回ずつ実行 |
| UX | ユーザーは「リトライ中」を認識できない、待たされる | UI で「VOICEVOX 起動中…再試行する?」を明示、ユーザーが状況を把握 |
| Cloud Run 課金 | サイレントリトライで課金増加リスク | ユーザー判断、無駄打ち抑制 |
| 「未来縛らない」原則 | リトライ戦略を Provider 内に固定化 | 呼出側で柔軟に設計可能 |

### 4.3 `isAvailable()` の運用との接続

引き継ぎメモ §6.1 で「`isAvailable()` は副作用なし、軽量チェック」と確定済。`synthesize()` の前段で `isAvailable()` を呼ぶことを **B3 領域(Sさん)に申し送り**:

- 初回 `synthesize()` の前に `isAvailable()` で `/healthz` を叩く(タイムアウト 3 秒)
- 200 OK なら synthesize 開始(コールドスタート許容タイムアウト)
- 不通なら WebSpeech fallback or「VOICEVOX 起動中…」表示

これは Q-U-j-13(案 X/Y/Z)確定後、WebSpeechTTSProvider の運用とも連動する論点(Sさん 確認時に紐づけ提示)。

### 4.4 v0.1 §4.5 / §4.10 への差分

v0.1 §4.5 `synthesize() 詳細` の冒頭に以下を加筆:

> 0. (新規)`hasSucceededOnce` フラグ確認、false なら timeout = `TIMEOUT_COLD_START_MS`(120_000ms)、true なら `TIMEOUT_NORMAL_MS`(30_000ms)

v0.1 §4.10 の `Q-U-j-11` を **削除**(確定済)。

---

## 5. SecretStore ブロッキング状態の確認(技術顧問指示への回答)

技術顧問の指示:

> 「IndexedDbSecretStore のブロッキング Q-U-j が 4 件の中で全部片付くなら、SecretStore の実装に着手してよい」

### 5.1 SecretStore のブロッキング Q-U-j 一覧

| # | 内容 | 区分 | 状態 |
|---|---|---|---|
| Q-U-j-1 | `SecretStoreDeps` を contract 側に追記するか、実装内に閉じるか | Sさん 確認必要(contract 変更を伴う) | **未解決**、Sさん 回答待ち |
| Q-U-j-2 | `localStorage` の `deviceSeed` キー名 | 昨日 Uさん 判断で確定提案、技術顧問黙認 = 暗黙了承解釈 | **解決済**(`'invokeaide.deviceSeed'`、SecretStore 内 private const) |

### 5.2 結論

「Uさん 内判断 4 件」(Q-U-j-4 / 8 / 9 / 11)の中に SecretStore のブロッキング Q-U-j は **含まれていない**(全件 Auth / Storage / TTS 領域)。

→ **SecretStore のブロッキング Q-U-j-1 は依然 Sさん 回答待ちのため、本日時点で SecretStore 実装着手は不可。**

### 5.3 Q-U-j-1 の Sさん 回答に関する依頼経路

昨日の技術顧問への確認(2026-05-25 夜):

- (a) Uさん が Sさん 宛て質問ドラフトを起こす → 技術顧問が Sさん に渡す
- (b) 技術顧問が直接 Sさん に投げる、Uさん は本書 §8.1 で参照可能な状態

→ 指示なければ (b) 前提で純粋待機、と申し上げた。本書時点でも引き続き (b) 前提で待機中。

---

## 6. v0.2 反映メモまとめ

### 6.1 確定 4 件のまとめ

| # | 領域 | 確定内容 |
|---|---|---|
| Q-U-j-4 | Auth | PKCE code_verifier は `localStorage`(キー名 `'invokeaide.pkce.codeVerifier'`)、リダイレクトコールバック完了時に即削除 |
| Q-U-j-8 | Storage | PendingQueueStore / ConflictResolver を `src/implementations/internal/` 配下に独立クラスとして切出し |
| Q-U-j-9 | Storage | IndexedDB キャッシュ TTL を階層化(settings / index / profile = 60 秒、manual / character / coaching = 1 時間、errors / conversations = キャッシュなし) |
| Q-U-j-11 | TTS | VoicevoxTTSProvider 内ではリトライしない、初回タイムアウト 120 秒 + 2 回目以降 30 秒、リトライ判断は B3 UI 側 |

### 6.2 残ブロッカー(Sさん 確認待ち、9 件)

| # | 内容 | 関連ユニット |
|---|---|---|
| Q-U-j-1 | SecretStoreDeps の contract 配置 | SecretStore(本日着手予定だったがブロック) |
| Q-U-j-3 | clientId / redirectUri の dev/staging/prod 切替方法 | Auth |
| Q-U-j-5 | refresh_token 失効時の UI 通知発火経路 | Auth |
| Q-U-j-6 | AuthProvider に granted scopes を返すメソッドを追加するか | Storage(Auth 経由) |
| Q-U-j-7 | bundled アセット返却時の `LoadResult.meta.source` 表現 | Storage |
| Q-U-j-10 | speakerId デフォルト解決の責任所在 | TTS |
| Q-U-j-12 | 発話テキストのログ最小化(URL クエリ vs POST ボディ) | TTS |
| Q-U-j-13 | TTSProvider 案 X / Y / Z の確定 | TTS(WebSpeech は丸ごとブロック) |

### 6.3 着手可能ユニットの状況

GO-C ルール(「依存順にユニットごとに、Q-U-j が片付き次第着手可」)に照らすと:

| ユニット | ブロッカー Q-U-j | 状態 |
|---|---|---|
| SecretStore | Q-U-j-1 のみ | **🔴 ブロック中**、Sさん 回答待ち |
| AuthProvider | Q-U-j-3 / 5(+ SecretStore 完成) | 🔴 ブロック中 |
| StorageProvider | Q-U-j-6 / 7(+ Auth + Secret 完成) | 🔴 ブロック中 |
| VoicevoxTTSProvider | Q-U-j-10 / 12(+ Cloud Run デプロイ) | 🔴 ブロック中 |
| WebSpeechTTSProvider | Q-U-j-13(contract 改訂) | 🔴 ブロック中 |

→ **本日時点で実装着手可能なユニットはなし。Sさん 回答到着を待つ。**

---

## 7. v0.2 本体への統合計画

本書は v0.2 への素材。v0.2 本体は以下のタイミングで起こす:

1. Sさん が Q-U-j-1 / 3 / 5 / 6 / 7 / 10 / 12 / 13 の回答を返す
2. Uさん が回答を本書(Uさん 内判断 4 件)と合わせて統合
3. v0.2 = v0.1 全体に対し、Q-U-j 13 件の確定内容を反映した修正版を起こす
4. 「変更履歴」節に v0.2 の更新点を列挙
5. 技術顧問の最終確認 → ユニットごとに GO 発令

軽い畳み込み運用(技術顧問 2026-05-26 指示)のため、v0.2 は v0.1 の構造を維持、確定部分のみ差し替え。本書の差分はそのまま v0.2 に転写可能な粒度で書いた。

---

## 8. 次のアクション

### 8.1 即時(本日中)

- [x] Uさん 内判断 4 件の確定(本書)
- [x] v0.2 反映メモの起草(本書)
- [ ] 技術顧問: 本書 v0.1 レビュー、Sさん 回答経路 (a)/(b) の確認

### 8.2 Sさん 回答到着後

- [ ] Q-U-j-1 〜 Q-U-j-13 のうち Sさん 回答分(9 件)の確認
- [ ] v0.2 本体の起草 = v0.1 + 13 件すべての確定内容を統合
- [ ] SecretStore 実装着手(Q-U-j-1 が解決した時点で着手可、GO-C の段階的 GO に従う)

### 8.3 並行作業の選択肢(指示があれば)

昨日 §「待機中の並行作業」で挙げた選択肢を継続:

1. AuthProvider 関連 Q-U-j の前倒し整理(Q-U-j-3 / 5 の質問内容を明確化済)
2. `src/implementations/` ディレクトリ準備 + クラススケルトン配置(typecheck 通る程度)
3. 純粋待機

指示なければ **3(純粋待機)**。

---

## 9. 変更履歴

| Version | 日付 | 主な変更 | 起草者 |
|---|---|---|---|
| v0.2 反映メモ | 2026-05-26(火) | Uさん 内判断 4 件の確定(Q-U-j-4 / 8 / 9 / 11)、SecretStore ブロッキング状態の確認、v0.2 本体への統合計画 | Uさん(Opus) |

---

— Uさん(2026-05-26、実装設計 v0.2 反映メモ 起草。SecretStore 実装着手は Q-U-j-1 ブロック中、Sさん 回答待ち)
