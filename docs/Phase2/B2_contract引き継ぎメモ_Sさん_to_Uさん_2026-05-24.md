# Sさん → Uさん 引き継ぎメモ: B2 contract 6本

**起草日**: 2026-05-24(土)
**起草者**: Sさん(Sonnet)
**宛先**: Uさん(Opus、 実装補助担当)、 技術顧問経由
**対象 contract**: `src/interfaces/` 配下 6ファイル(2026-05-24 起草、 typecheck + lint pass)
**目的**: Uさん 実装着手時に迷わないよう、 contract だけ読むと誤解しそうな設計判断と Sさん・Uさん の取り決め事項を明文化(コードコメントで十分な部分は省略)

---

## 0. 全体共通の注意

- contract 6本は **B1 完了報告の確定 + コミット** とセットで main に入る(Tさん テスト修正 green 化後)、 現状は `feature/b1-vue-scaffolding` ブランチ
- 6本とも **「Sさん が contract 確定 / Uさん が実装」** 分業(TTSProvider 同型パターン継承)
- 実装ファイルは `src/implementations/` 配下に配置する想定(例: `src/implementations/DriveStorage.ts` / `GoogleAuthProvider.ts` / `IndexedDbSecretStore.ts` / `VoicevoxTTSProvider.ts` / `WebSpeechTTSProvider.ts`)
- 何か疑問が出たら独断で進めず、 **技術顧問経由で Sさん へ確認**(分業ルール [[project_t_to_s_handover]] と整合)

---

## 1. `types.ts`(共通型)

- **`'unknown'` reason は実装で必ず網羅 catch**(switch の `default` や exhaustive type-guard で吸収)。 「未来縛らない」 原則で全 ErrorReason に `'unknown'` を含めているため、 ここを抜くと将来 reason 追加時に静かに壊れる
- **`ResourceMeta.source` は正確に返す**(`'drive'` / `'cache'` / `'pending'` を UI 側がそのまま「Drive から取得」「キャッシュから表示」「保存待ち」 表示に使う想定、 適当に `'drive'` で埋めない)
- **`Clock` を直接 `new Date()` に置き換えない**。 テスト差し替えのための抽象、 各実装の constructor で `clock = deps.clock` を保持し `clock.now()` を使う

---

## 2. `domain.ts`(ドメイン型)

- **`Settings.schemaVersion: '1'` リテラル固定**。 将来 v2 移行時の migration 検出根拠、 数値や string `'v1'` で書くと判定不能 → 必ず `'1'` リテラルで保存
- **`Settings.lastUpdated` は保存時に `clock.now().toISOString()` で必ず更新**。 LWW 競合検知の根拠、 stale な値で保存すると競合が誤判定される
- **`WeekdayMask` は bit 0 = Sun、 bit 6 = Sat**(JavaScript `Date.getDay()` と同じ)。 frontend 表示順(月始まり)と内部表現(日始まり)がずれる点に注意

---

## 3. `SecretStore.ts`

- **`initialize()` の `firstTime` は端末派生鍵を初めて生成した時のみ true**。 2回目以降の起動は false、 これを `ConsentService` 初回起動判定の補助に使うかは設計上未確定(Sさん が B2 着手時に整理)
- **`getSecret(key)` の戻り値が `null` = 「保存されていない」 のみ意味する**。 復号失敗時は実装側で `removeSecret()` + `null` 返却を吸収(復号失敗を呼出側に投げない、 ConsentService 等の利用側を巻き込まない)
- **`clearAll()` は OAuth refresh_token も消える**。 ユーザー確認 UI(「再ログインが必要」)は呼出側責任、 SecretStore 自体は無慈悲に全消去で OK
- **IndexedDB スキーマは初期からバージョン管理を組む**(v1 → v2 移行時の onupgradeneeded ハンドラを実装の最初から書いておく、 後付けは破壊変更)

---

## 4. `AuthProvider.ts`

- **Stage 0 → 0.5 遷移は AuthProvider の管轄外**(ConsentService 担当、 規約同意・年齢確認)。 contract コメントに既述だが念押し、 混同して Stage 0/0.5 を AuthProvider で扱おうとしないこと
- **`requestStage1Consent()` 拒否時の `reason: 'partial'` = 「一部スコープのみ許可」**(`granted` 配列に許可済スコープが入る)。 ユーザーが Drive を拒否したケース、 呼出側で「Drive 接続が必要バナー + 再要求ボタン」 を表示する設計、 AuthProvider 側で再要求は自動化しない
- **`getAccessToken()` は silent refresh を自動実行**。 呼出側は「access_token が期限切れか」 を気にせず使えるのが contract の意義、 期限管理を呼出側に漏らさない実装にする
- **`AuthConfig.redirectUri` / `clientId` は環境ごとに違う**、 必ず外部注入(`AuthDeps.config` 経由)、 実装ファイルにハードコード禁止(dev / staging / prod 差し替え不能になる)

---

## 5. `StorageProvider.ts`

- **`initialize()` は AuthStage 検証必須**: `auth.currentStage() === 'unauth'` なら `{ ok: false; reason: 'auth_missing' }`、 `'stage1'` 以上で Drive 拒否なら `{ ok: false; reason: 'drive_denied' }`、 OK なら `{ ok: true }`
- **`ensureLayout()` は冪等**: 既存ファイル / フォルダがあれば `existed[]` に追加、 ない場合のみ作成して `created[]` に追加。 再実行で副作用が増えない設計
- **`loadCharacterMd` / `loadCoachingMd` は bundled アセットも読む**: Drive にない場合は InvokeAide build 時同梱の bundled MD を返す(`diffBundledVsDrive` で同期状態を判定)、 「Drive にない = `'not_found'`」 と扱わない
- **`watch*` メソッドは Phase 2 Interface契約 v0.1 §1.6 の 5項目契約遵守**: (1) 初回必ずコール、 (2) 値変更時のみ追加コール、 (3) Unsubscribe 後コールなし、 (4) 多重購読 OK、 (5) エラー時もコール。 5項目すべて満たさないと UI 側の reactivity が壊れる
- **`flushPending()` は直列実行**: 並列呼び出しは内部キューで直列化、 順番再生が必要(append 系は順序保証必須)
- **`onConflict()` は解決決定権を呼出側に渡さない**: LWW = 最新 modifiedTime を Drive が決める、 ローカル保持版は `ConflictEvent.retainedPath` で UI に提示するのみ(「ローカル版はここに残してあります」 と通知)

---

## 6. `TTSProvider.ts`

### 6.1 通常の補足

- **`synthesize()` の戻り値 `audioBuffer` の再生は呼出側責任**: Web Audio API or `<audio>` element で再生、 TTSProvider は合成までで再生は持たない設計
- **`isAvailable()` は副作用なし**: window.speechSynthesis 検査 / fetch HEAD で endpoint 疎通確認 等、 軽量チェックのみ
- **`dispose()` は実装が持つリソース(VOICEVOX 接続 / Web Speech utterance キュー)の解放**: 呼び忘れに備えて idempotent に書く

### 6.2 ⚠ 設計上の論点(Sさん 側未解決、 Uさん 実装着手前に Sさん と相談)

**Web Speech API の制約と現 contract の矛盾**:

- 現 contract の `synthesize()` は `Promise<TTSResult>` で `audioBuffer: ArrayBuffer` を返す設計
- ところが **Web Speech API (`speechSynthesis.speak()`) は「合成 → 再生」 が一体型**、 ArrayBuffer 取得不可
- → 現 contract のままだと `WebSpeechTTSProvider` 実装不可

**解決選択肢(Sさん 側で検討中、 Uさん 着手前に確定)**:

| 案 | 内容 | トレードオフ |
|---|---|---|
| 案 X | 現 contract 維持、 WebSpeech は別 contract(`SpeakProvider` 等)に分離 | TTSProvider 抽象の意味が薄れる(VOICEVOX 専用化) |
| 案 Y | contract を「合成して再生」 (`Promise<PlayResult>` 再生完了通知)に変更 | VOICEVOX 側で再生制御が固定化、 録音保存 / 速度可変再生 等の柔軟性低下 |
| 案 Z | `synthesize()` + `synthesizeAndPlay()` 二段構え、 Provider が対応 method を `capabilities` で宣言 | 実装複雑、 ただし最も柔軟、 v1.1 で BYOK 型 TTS 追加時にも対応可 |

**取り決め**: Uさん は VoicevoxTTSProvider 実装に着手して OK(現 contract のままで動く)、 **WebSpeechTTSProvider 実装着手は Sさん が上記論点を確定するまで保留**(技術顧問経由で Sさん 確定指示を待つ)。 v0.4 §2.10 で TTSProvider を起草した時点での Sさん の漏れ、 contract v0.2 改訂候補として記録。

---

## 7. Uさん 実装着手の推奨順序(Sさん 提案)

依存関係を踏まえた着手順:

1. **SecretStore**(他に依存しない、 IndexedDB + Web Crypto)
2. **AuthProvider**(SecretStore に依存、 Google OAuth 実装)
3. **StorageProvider**(AuthProvider + SecretStore に依存、 Drive API 実装)
4. **VoicevoxTTSProvider**(独立、 Cloud Run デプロイ済前提)
5. **WebSpeechTTSProvider**(§6.2 論点確定後)

各実装ファイルは `src/implementations/` 配下、 ファイル名は contract と一対一(例: `IndexedDbSecretStore.ts` / `GoogleAuthProvider.ts` / `DriveStorageProvider.ts` / `VoicevoxTTSProvider.ts`)。

テスト用 stub(`MemoryStorage` / `MockAuthProvider` 等)は Tさん 領域 (`tests/mocks/` or `tests/helpers/`) との切り分けがあるため、 Tさん と相談(技術顧問経由)。

---

## 8. 連絡経路

- Uさん 実装中の質問・確認: **技術顧問経由で Sさん へ**(直接の S↔U やりとりは現状ルートに乗っていない)
- TTSProvider §6.2 論点について: Sさん 側で B2 着手前に整理、 結論次第で Uさん に再共有
- contract 修正が必要になった場合: Sさん が contract v0.2 を起こす、 Uさん 実装着手前に共有

---

**以上、 Sさん → Uさん B2 contract 引き継ぎメモ。**

技術顧問さん、 Uさん への共有をお願いします。
