# Sさん 進捗メモ（セッション横断）

**最終更新**: 2026-06-06（Sさん、Sprint 2 メイン実装 1日目）

---

## いま何をやっているか（一言）

**Sprint 2 メイン実装**（6/20ターゲット「とりあえず使える形」）の S2-1〜S2-6 を、優先順位順に実装中。
指示はたかしさんからチャットで口頭GO（指示文ファイルは無い）。担当分担: **Sさん=メイン実装 / Tさん=テスト・品質 / Uさん=VoicevoxTTSProvider 並行実装**。

## ブランチ

- **作業ブランチ: `feature/sprint2-main`**（origin に push 済み、すべて反映済み）
- 2026-06-06 終了時の先端: `a9a4f52`。未コミット・未push なし（クリーン）。
- main からの差分 = Sprint2 の全15コミット。

## 今日(6/6)の到達点 — S2-1〜S2-3 完了、実機で会話成立 ✅

| ユニット | 状態 | 主な成果物 |
|---|---|---|
| **S2-1 設定画面** | ✅完了 | `src/app/composition.ts`（コンポジションルート）、`src/stores/secrets.ts`・`auth.ts`、`src/views/SettingsView.vue`・`AuthCallbackView.vue`、router に `/settings`・`/auth/callback` |
| **S2-2 GeminiProvider** | ✅完了 | `src/interfaces/AIProvider.ts`（契約・I接頭辞なし）、`src/implementations/GeminiProvider.ts`（BYOK, gemini-2.5-flash）、composition に配線 |
| **S2-3 召喚UI＋対話UI** | ✅完了 | `src/stores/chat.ts`、`src/views/SummonView.vue`（/）・`ChatView.vue`（/chat）。旧 HomeView 削除 |

**S2-1→2→3 が繋がり「最低限使える形」に到達。たかしさんが実機で会話成功を確認済み。**

### 途中で起きた重要トピック
1. **OAuth 400 "client_secret is missing"**: 当初「code_verifier 消失」の見立てだったが、調査で code_verifier は localStorage 永続化済みと判明（誤診を回避）。真因は confidential client で client_secret 必須だったこと。`exchangeCodeForTokens` と `refreshAccessToken` の両方に client_secret を追加して解決（commit `54e460a`）。診断のため token endpoint の 400 応答本文をログ出力する改修も入れた（`c87c48a`）。
2. **AIProvider 命名**: 指示文 literal は `IAIProvider` だったが、既存4契約が全てI接頭辞なしのため `AIProvider` に統一（たかしさん「既存規約に合わせる」決定に従う）。
3. **並行ワークツリー衝突**: 同一ツリー共有で HEAD が他者ブランチに切替わる事象に遭遇・解決。以降**全コミット前に `git branch --show-current` 検証**を徹底。詳細は [[Shared_worktree_branch_collision_2026-06-06]]。

## 明日(6/7)最初にやること = **S2-4（カレンダー/Tasks 連携）に着手**

S2-4 着手の GO はまだ口頭で出ていない（S2-3 完了報告で「GO待ち」状態）。**朝イチでたかしさんに S2-4 GO を確認**してから着手すること。

S2-4 の中身（原指示より）:
- `GoogleAuthProvider.getAccessToken()` で取得したトークンで Calendar イベント・Tasks を取得
- AI が「今日の予定は?」に答えられる状態にする
- 技術ノート（notes structured notation 方式）に従う ← **着手前に該当ノートを探して読むこと**
- MCP に `mcp__claude_ai_Google_Calendar__*` / Tasks 相当があるが、本番実装は GoogleAuthProvider 経由の REST が筋（アプリ内で動かす必要があるため）

その後の残り: **S2-5（会話ログの Drive 保存）** → **S2-6（Gmail 閲覧＋返信下書き、送信はしない）**。
S2-6 は技術ノート `技術ノート_Gmail返信ドラフトの作り方_MIYU_InvokeAide共通_20260605.md`（threadId/In-Reply-To/References/Subject一致の3条件必須）を参照。

## 実機検証で残っている観点（Sさん本職）
- persona MD をそのまま system prompt に渡している。応答トーンが MD 指示に沿うか実機で要確認（違和感あれば prompt 整形）。
- 会話履歴はメモリ上のみ（リロードで消える）。永続化は S2-5。

## 環境メモ（再起動時の前提）
- 起動: `npm.cmd run dev` → http://localhost:3030/
- ビルド確認: `npm.cmd run build`（vue-tsc --noEmit + vite build）。テスト: `npm.cmd run test`（現在22件パス）。
- `.env.local`（gitignore 済、たかしさん管理）に必須: `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` / `VITE_GOOGLE_REDIRECT_URI`(=http://localhost:3030/auth/callback) / `VITE_GEMINI_API_KEY_FALLBACK`。
- コミット規律: 1commit1トピック、細かく刻む、各コミット前に build グリーン＋ブランチ検証。コミットメッセージは Bash ツールでは `-m` 複数指定（PowerShell here-string `@'...'@` は使わない＝`@`混入する）。

## 関連メモリ
- [[Process_rules.md]]（判断仰ぎ後の進行ルール）/ [[Shared_worktree_branch_collision_2026-06-06]]（ブランチ衝突対処）/ [[T_to_S.md]]（Tさんからの申し送り）
