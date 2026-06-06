# 指示文：IndexedDbSecretStore 実装 GO ── 2026-05-31（B2 着手①）

**宛先**: InvokeAide 開発担当 Claude Code（PC2 / `C:\dev\InvokeAide`）／ **担当: Uさん（設計・実装担当）**
**作成**: 技術顧問エルトン（Claude.ai）
**承認**: たかしさん（B2 実装、本日 GO）
**前提作業**: 案A（domain.ts 型削除）の commit/push 完了後に着手すること

---

## 0. これは何の作業か（背景）

B2 本体実装の**1番目のユニット**、`IndexedDbSecretStore` を実装する。これは OAuth の refresh_token などの秘密情報を、端末内に暗号化して安全に保管する金庫の役割。AuthProvider 以降の実装は全部これに依存するので、最初に作る。

ブロッカーだった Q-U-j-1 / Q-U-j-2 は既に解決済み（後述）。実装に必要な設計はすべて揃っている。

---

## 1. 設計の参照元（ここに全部書いてある）

実装の詳細は、以下に確定済み。**この指示文で再定義せず、必ず原典を読んで従うこと**:

- **`docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md` §1（§1.1〜§1.9）** ← クラス構造・IndexedDB スキーマ・鍵導出・暗号化方式・各メソッド方針が全部ここにある
- **`docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md` §1, §3, §11** ← Q-U-j-1 / Q-U-j-2 の確定回答と着手 GO
- **`src/interfaces/SecretStore.ts`** ← 満たすべき contract 本体

---

## 2. ブロッカーの確定回答（実装方針）

### Q-U-j-1（SecretStoreDeps の置き場所）→ 暫定ローカル定義で進める

Sさん 回答 §1・§11 の確定方針に従う:

- contract 側（`SecretStore.ts`）に `SecretStoreDeps` を追記するのが最終形だが、**今はそれを待たない**
- **実装ファイル内に local で `interface SecretStoreDeps { clock: Clock; logger?: Logger }` を定義**して実装を進める（実装設計 v0.1 §1.2 の通り）
- contract v0.2 反映後に `import type { SecretStoreDeps } from '@/interfaces/SecretStore'` に切り替える。**その時の差分は import 文 1〜2 行のみで、実装ロジックには影響しない**

→ つまり、contract 修正を待たず、今すぐ実装に着手してよい。

### Q-U-j-2（deviceSeed のキー名）→ class 内に閉じる

Sさん 回答 §3 の確定方針に従う:

- `private static readonly DEVICE_SEED_KEY = 'invokeaide.deviceSeed'` として class 内に定数化
- 全 localStorage アクセスはこの定数経由

---

## 3. 実装する対象

`src/implementations/IndexedDbSecretStore.ts` を新規作成し、contract `SecretStore` を満たす本番実装を行う。

要点（詳細は §1 の参照元に従う）:
- 端末内 IndexedDB に Web Crypto **AES-GCM 256bit** で暗号化保管。**Drive には絶対に置かない**
- 端末派生鍵（master key）は localStorage の deviceSeed から PBKDF2 で導出
- メソッド: `initialize` / `putSecret` / `getSecret` / `removeSecret` / `clearAll` / `hasMasterKey`（各方針は実装設計 §1.6 の通り）
- IndexedDB スキーマは v1 + `onupgradeneeded` 雛形（将来の移行を最初から想定、実装設計 §1.3）
- 復号失敗時は `removeSecret` + `null` で吸収（実装設計 §1.5）
- iOS Safari Private Browsing 等のストレージ制限時は `{ ok: false, reason: 'storage_quota' }` 経路を確保（実装設計 §1.4）

---

## 4. 進め方とテスト

1. 着手前にバックアップ・現状確認（`git status` がクリーンか）
2. `src/implementations/IndexedDbSecretStore.ts` を実装
3. **`npm run typecheck` と `npm run build` が通ること**を確認
4. 可能なら単体テストも（実装設計 §1.8 参照: `fake-indexeddb` + `@peculiar/webcrypto`）。ただし **テスト Mock の置き場所（`tests/mocks/` か `tests/helpers/`）は Tさん 確認事項**なので、テストまで一気にやらず、まず実装本体と typecheck/build を通すことを優先し、テストの扱いは報告時に相談する

---

## 5. スコープの線引き（今回やらないこと）

- **contract（`src/interfaces/*.ts`）本体の修正はしない**。Sさん 回答 §10 にある contract 6件修正（C1〜C6）は別途 Sさん 担当・別タイミング。今回は SecretStore 実装ファイルのみ
- AuthProvider / DriveStorageProvider など2番目以降のユニットは着手しない（SecretStore 完成・確認後に順次 GO）
- テストの本格整備は Tさん 領域。今回は実装本体を優先

---

## 6. 報告してほしいこと

- 実装した内容の概要（どのメソッドを実装したか）
- `typecheck` / `build` の結果
- 設計書通りに実装できなかった点・判断に迷った点があれば、勝手に進めず報告
- テストをどこまでやるか（Tさん 確認が要る点）の相談
- commit はせず、**まず実装と動作確認の報告まで**（commit/push の可否はたかしさんが判断）

---

**以上。案A（domain.ts）の commit/push 完了後に着手。設計は §1 の参照元に全部あるので、それに忠実に。迷ったら勝手に進めず報告すること。**
