# 指示文：DriveStorageProvider 実装 GO（段階1：土台部分）── 2026-05-31（B2 着手③-1）

**宛先**: InvokeAide 開発担当 Claude Code（PC2 / `C:\dev\InvokeAide`）／ **担当: Uさん（設計・実装担当）**
**作成**: 技術顧問エルトン（Claude.ai）
**承認**: たかしさん（B2 実装、本日 GO）
**前提**: SecretStore・GoogleAuthProvider が実装完了・マージ済み（`05ca945` / `32b71e4`）。DriveStorageProvider はこの2つに依存するため、前提は満たされている。

---

## 0. このユニットは大きいので「2段階」に分ける

DriveStorageProvider は B2 で最も大きく複雑なユニット（設計見積もり 8〜15時間）。一度に全部実装せず、**2段階**に分ける。本指示文は**段階1（土台部分）のみ**。

- **段階1（本指示文）**: Drive に繋いで基本的な読み書きができる最小の形を作る
  - `initialize` / `ensureLayout`（Drive に `MIYU_App_Data/` フォルダ構造を作る）/ 内部ヘルパー `driveApi` / 設定の読み書き（`loadSettings` / `saveSettings`、ただし**競合検知の複雑な部分は段階2に回す**）
- **段階2（後日・別指示文）**: IndexedDbCache（キャッシュ層）/ PendingQueue（保存待ちキュー）/ ConflictResolver（LWW競合解決）/ bundledアセット対応 / watch系

**段階1では、まず「Drive に繋がって設定ファイルを読み書きできる」ことをゴールにする。** オフライン・競合・キャッシュの作り込みは段階2。

---

## 1. ★まず現状確認（実装に入る前に必ず報告）

GoogleAuthProvider の時と同様、**いきなり実装せず、まず現状を確認して報告**すること（指示文の前提とコードの実態がズレる事故を防ぐため。今日それで2回手戻りがあった）。

確認して報告してほしい項目:

1. **`DriveStorageProvider.ts` のスケルトンの現状**: 今どのメソッドがスケルトン（not implemented）か。一部でも実装済みの箇所はあるか。
2. **依存部品の有無**:
   - `StorageDeps`（contract）に `clock` / `auth` / `logger` 等が定義されているか
   - `IndexedDbCache` / `PendingQueue` / `ConflictResolver` のクラスやファイルが既に存在するか、それともこれから作るか（Uさん 反映メモ §2 で「`src/implementations/internal/` 配下に独立クラスで切り出す」と確定していたが、実体があるか確認）
   - `Clock` 抽象は使える状態か
3. **contract `StorageProvider.ts` の現状**: 満たすべきメソッド一覧と、Sさん回答で確定した `getGrantedScopes`（C3）/ `source: 'bundled'`（C4）が反映済みか。
4. **Drive ファイルレイアウト設計**: `docs/Phase2/Phase2_Drive_ファイルレイアウト設計_v0.1` の F1-F9 が参照できるか。

→ この4点を**短い調査メモ**で報告。実装方針（特に段階1でどこまで作るか、内部部品を段階1で作るか段階2に回すか）を、報告を踏まえて最終確定する。

---

## 2. 設計の参照元（再定義せず原典に従う）

- **`docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md` §3（§3.1〜§3.5）** ← クラス構造・Driveレイアウト・各メソッド方針。**最重要**
- **`docs/Phase2/Phase2_Drive_ファイルレイアウト設計_v0.1`** ← F1-F9 のファイル配置
- **`docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md` §6（Q-U-j-6）, §7（Q-U-j-7）** ← getGrantedScopes、source: 'bundled' の確定
- **`src/interfaces/StorageProvider.ts`** ← 満たすべき contract 本体
- 依存先（完成済み）: `src/implementations/IndexedDbSecretStore.ts`、`src/implementations/GoogleAuthProvider.ts`

---

## 3. 段階1で実装する対象（現状確認後に最終確定）

設計書 §3.5 に忠実に従う。段階1のスコープ:

- **`initialize(deps)`**（§3.5）: auth の stage 確認 → Drive スコープ確認（`deps.auth.getGrantedScopes()` を使う）→ deps 保存 → `{ ok: true }`。
  - ※ 段階1では IndexedDbCache / PendingQueue の初期化は「最小（無い前提でも動く）」でよい。本格的な復元は段階2
- **`ensureLayout()`**（§3.5・冪等）: Drive に `MIYU_App_Data/` とその配下（config/ 等）を作る。既にあれば created/existed に振り分け
- **内部ヘルパー `driveApi<T>(method, url, opts?)`**（§3.3）: access_token を `deps.auth.getAccessToken()` で自動取得して Drive API を叩く。auth/rate_limit エラーの振り分け
- **`resolveOrCreateFile(logicalPath)`**（§3.3）: 論理パス → driveFileId の解決。`appProperties` の `invokeaide.role` で識別（§3.4）
- **`loadSettings(opts?)`**（§3.5）: Drive から settings.json を読む。**段階1ではキャッシュ無しでも可**（cache hit 経路は段階2で作り込む）。404/parse_error の振り分けは入れる
- **`saveSettings(settings)`**（§3.5）: `lastUpdated` を `deps.clock.now().toISOString()` で更新、`schemaVersion = '1'` 固定。Drive へ PATCH。
  - ※ **段階1では LWW 競合検知（If-Match / 412 / handleConflict）の本格実装は段階2に回してよい**。まず素直に保存できる形を作る。ただし「段階2で競合検知を足す」前提のコメントを残す

---

## 4. スコープの線引き（段階1でやらないこと＝段階2へ）

- **IndexedDbCache（キャッシュ層）の本格実装** → 段階2
- **PendingQueue（オフライン保存待ち）** → 段階2
- **ConflictResolver / handleConflict（LWW競合解決）** → 段階2
- **bundledアセット対応（loadCharacterMd の 404 fallback）** → 段階2
- **watch系（watchSettings / watchCharacter / watchSyncState）** → 段階2
- **contract（`src/interfaces/*.ts`）本体の修正はしない**（C系の修正は Sさん 領域）
- VoicevoxTTSProvider など他ユニットには着手しない

段階1は「Drive に繋がって設定を読み書きできる」最小ゴール。迷ったら段階2に回して、その旨をコメントと報告に残す。

---

## 5. 進め方とテスト

1. **まず §1 の現状確認を報告**（実装はその後）
2. 着手前にバックアップ・`git status` 確認
3. 段階1スコープを実装
4. **`npm run typecheck` と `npm run build` が通ること**を確認
5. 単体テストは今回も未着手でよい（Mock配置が Tさん 確認事項のため）。実装本体と typecheck/build を優先

---

## 6. 報告してほしいこと

- **§1 の現状確認メモ（実装前）**
- 実装したメソッドの概要、段階2に回した部分
- `typecheck` / `build` の結果
- 設計書通りに実装できなかった点・迷った点（勝手に進めず報告）
- commit はせず、まず実装と動作確認の報告まで（commit/push 可否はたかしさん判断）

---

**以上。まず §1 の現状確認を報告してから段階1の実装へ。競合検知・キャッシュ・キュー等の重い部分は段階2に回し、段階1は「Driveに繋がって読み書きできる」最小ゴールに集中。迷ったら勝手に進めず報告すること。**
