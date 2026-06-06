# 指示文: Uさん — contract v0.2 切替着手 GO サイン

**作成**: 技術顧問エルトン（Claude.ai 側） / 2026-05-30
**宛先**: Uさん（設計担当、PC2 / `C:\dev\InvokeAide`）
**承認**: たかしさん（2026-05-30）
**前提**:
- `docs/Phase2/contract_v0.2_status.md`（5/26 main マージ済、commit 263d408）
- `docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md` §10（C1〜C6 詳細）
- `docs/Phase2/Phase2_OAuth_スコープ設計_v0.1_2026-05-19.md`（**ただし Calendar 部分は古い、後述 §3 参照**）

---

## 1. GO 判断結果

**GO サインを出します。** contract v0.2 切替（C1〜C6）に着手してください。

GO の根拠:

1. C1〜C6 がすでに main にマージ済み（commit 263d408、5/26）
2. Sさん が Q-U-j-9件回答で各 C の根拠を明示済み
3. 切替作業の差分は **import 文 1〜2行のみ**、実装ロジックへの影響なし
4. 着手順序が contract_v0.2_status.md / Uさん 実装設計 v0.1 §7.1 で確定済み

## 2. やってほしいこと（contract v0.2 切替）

`contract_v0.2_status.md` §「切替対象（C1〜C6 全件）」に従って、暫定 local 定義を contract import に切り替える。

### 2-1. 切替対象（再掲）

| # | 切替 import 例 |
|---|---|
| C1 | `import type { SecretStoreDeps } from '@/interfaces/SecretStore'` |
| C2 | `import type { StageChangeCause } from '@/interfaces/AuthProvider'` |
| C3 | (新規メソッド)`getGrantedScopes()` を AuthProvider impl に実装 |
| C4 | (union 拡張)`'bundled'` 値を DriveStorageProvider impl で使用 |
| C5 | (union 拡張)`'speaker_required'` を VoicevoxTTSProvider impl で返却 |
| C6 | `import type { TTSCapabilities, PlayResult } from '@/interfaces/TTSProvider'`、`capabilities` プロパティを実装側で必須宣言 |

### 2-2. 着手順序

contract_v0.2_status.md および Uさん 実装設計 v0.1 §7.1 で確定済みの順序:

**SecretStore → AuthProvider → DriveStorageProvider → VoicevoxTTSProvider**

### 2-3. 1件ずつ commit する

C1, C2, C3, ... と個別に commit すること。1つの大きな commit にまとめないこと。理由:
- レビューしやすい
- もし問題があった時に切り戻しやすい
- 履歴が読みやすい

commit メッセージ例:
```
refactor(secret-store): switch SecretStoreDeps from local to contract import (C1)
refactor(auth): switch StageChangeCause from local to contract import (C2)
feat(auth): implement getGrantedScopes() (C3)
...
```

## 3. 重要な前提変更【必ず読んで】

### 3-1. Calendar スコープは `calendar.events` を採用

Uさん が OAuth スコープ設計 v0.1（5/19）で「Calendar はフルスコープ」を提案したが、**2026-05-28 のたかしさん判断で方針変更された**:

- ✅ **新方針: Calendar スコープは `https://www.googleapis.com/auth/calendar.events`（イベントのみ）**
- ✅ **専用サブカレンダーは作成しない、ユーザーのメインカレンダーに集約**

理由:
- 二重管理を避ける（5/28 引き継ぎ帳 §3-5）
- センシティブスコープではあるが、フル `calendar` よりも審査が通りやすい
- ユーザーへの権限要求が最小限になる

### 3-2. Uさん 側で対応すべきこと

contract v0.2 切替の作業範囲内では:
- **Calendar スコープに関連するコード（AuthProvider の `stage2AdditionalScopes` 等）**を `calendar.events` に変更する
- `src/interfaces/AuthProvider.ts` のコメント例も `calendar.events` に修正
- 既存の OAuth スコープ設計 v0.1 文書本体は今は触らなくてOK（後で別途改訂、エルトン主導）

### 3-3. 専用カレンダー機能のコード

もし「専用サブカレンダー作成」のコードが既に書かれていたら、それは **削除またはコメントアウト**してください。具体的には:
- `calendar.calendars.insert` を呼ぶようなコード
- メインカレンダー以外を参照するロジック

ベータ v1.0 では、すべてユーザーのメインカレンダー（`calendarId: 'primary'`）に統一します。

## 4. 着手前の確認

切替作業の前に以下を確認:

1. 現在のブランチが `main` の最新であること（`git pull origin main`）
2. `src/interfaces/SecretStore.ts` / `AuthProvider.ts` / `TTSProvider.ts` / `types.ts` に C1〜C6 の変更が含まれていること
3. 既存実装（`src/implementations/` 配下）で local 定義された `SecretStoreDeps` / `StageChangeCause` 等を探す

## 5. 動作確認

各 C の切替ごとに:

1. `npm run typecheck`（TypeScript 型チェック）が通ること
2. 既存のテストがあれば、それも通ること
3. 切替前後で動作が変わらないこと（型レベルの変更なので、ランタイム挙動は同じはず）

最後に全体で:
- `npm run typecheck` 全体パス
- `npm run build` が通ること

## 6. やらないこと（範囲外）

- **B2 本体実装は範囲外**: SecretStore / AuthProvider / DriveStorageProvider / VoicevoxTTSProvider の **新規実装**は本指示文の範囲外。contract import 切替のみ。
- **OAuth スコープ設計 v0.1 本体の改訂**は範囲外: §3 の Calendar 部分の方針変更は、コード内のスコープ定義に反映するだけでOK。設計文書の改訂はエルトンが別途行う。
- **専用カレンダー機能の削除**は §3-3 のとおりだが、もし複雑な依存があるなら、削除せずに「使用箇所を Skip する」程度で OK。たかしさんに判断を仰ぐ。

## 7. 完了時の報告

1. C1〜C6 各々で何を変更したか（ファイル名・行番号）
2. Calendar スコープを `calendar.events` に修正した箇所
3. 専用カレンダー関連コードの扱い（削除 / コメントアウト / 残置の判断）
4. 各 commit の hash
5. `npm run typecheck` / `npm run build` の結果
6. 想定外の挙動・問題があれば
7. メモリ更新

完了後、Uさん は「contract v0.2 切替完了。次の指示を待ちます。」と出力して停止してください。**B2 本体実装には自動で進まないこと**（別途 GO 判断が必要）。

## 8. 想定工数

30〜60分。C1〜C6 が型レベルの import 切替なので、実装本体の改修より軽い作業のはず。

---

## 9. このターン以降について

contract v0.2 切替が完了したら、B2 本体実装（SecretStore → AuthProvider → DriveStorageProvider → VoicevoxTTSProvider）に進むためには別途技術顧問の GO サインが必要です。**今夜は contract v0.2 切替までで停止**してください。

たかしさんが居酒屋注文アプリ（Codex 並行作業）の合間に確認する想定なので、ターミナルが残っていれば明日朝 B2 着手の GO 判断を私から出します。

---

**以上。GO サインを出しました。着手してください。**

このファイル名は引き継ぎ帳の規約 `指示文_<topic>_<YYYY-MM-DD>.md` に従っています。
