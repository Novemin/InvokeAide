# 指示文：InvokeAide S/T/U エージェント commit・push 作業 ── 2026-05-31

**宛先**: InvokeAide 開発担当 Claude Code（PC2 / `C:\dev\InvokeAide`、S・T・U）
**作成**: 技術顧問エルトン（Claude.ai）
**承認**: たかしさん
**根拠**: InvokeAide 引き継ぎ帳 2026-05-30 §1-1, §4-2, §3-6

---

## 0. 前提（着手前に確認）

この指示は、**昨夜たかしさんが手動作業2件を完了している前提**で書かれている。未完なら、エージェント作業の前に先に済ませること。

1. 古い `.env` ファイル（5/28 作成、`Client_ID=...`、Vite 非対応）の削除
2. `.env.local` への Gemini API キー追記（`VITE_GEMINI_API_KEY_FALLBACK=AIzaSy...`、commit 対象外・gitignore 済）

---

## 1. 全体ルール（並行作業の規律）

昨日の事故（認証エラー中のキュー溜まりで複数エージェントが同じ指示を実行開始）を踏まえ、以下を厳守:

- **push は順番に: Uさん → Sさん → Tさん**（たかしさん判断 C）。同時に走らせない。1人ずつ完了を確認してから次へ。
- **各エージェントは自分が作業したファイルのみ `git add` する**（他者の変更を巻き込まない）。
- **1 commit 1 トピック**を守る。
- 認証エラーが出たら、まず `/login` で復旧してから次のコマンドを入力する。「念のため」で同じコマンドを複数回送らない。

---

## 2. Uさん（最初に実行）

**作業**: 既に commit 済みの `d58ba56`（`AuthProvider.ts` L52 のコメント例を `['calendar']` → `['calendar.events']` に修正）を origin/main に push するだけ。

手順:
1. `git log --oneline -5` で `d58ba56` がローカルにあり未 push であることを確認
2. `git status` でクリーンなことを確認（余計な変更が混ざっていないか）
3. `git push origin main`
4. 完了を報告

---

## 3. Sさん（Uさんの push 完了後に実行）

**作業**: ポート番号を **3030 に統一**する修正（たかしさん判断 A）＋ 既存の `.env.example`・README.md 更新を、**1つの commit にまとめて** push。

修正対象:
- `vite.config.ts`: ポートを `5173` → `3030`
- `.env.example`: ポート記述を `3030` に
- `.env.local`: ポート記述を `3030` に（※ commit 対象外・gitignore。**たかしさんが Gemini キーを追記済みであることを確認してから**、衝突しないよう編集する）
- README.md: 環境変数セットアップ節の記載が `3030` 前提になっているか確認・修正

手順:
1. 上記ファイルを修正（`.env.local` 以外が commit 対象）
2. `git status` で**自分が触ったファイルのみ**ステージされることを確認
3. ポート統一 ＋ `.env.example` ＋ README.md 更新を1 commit にまとめる
   - commit メッセージ例: `chore: unify dev port to 3030 and add .env.example / README setup`
4. Vite 起動チェック: `http://localhost:3030/` で起動するか確認
5. `git push origin main`
6. 完了を報告

---

## 4. Tさん（Sさんの push 完了後に実行）

**作業**: 既に作成済みの `docs/Phase2/調査_OAuth利用理由_2026-05-30.md` を commit/push するだけ（内容の変更はしない）。

手順:
1. `git status` で当該ファイルが未追跡／未 commit であることを確認
2. `git add docs/Phase2/調査_OAuth利用理由_2026-05-30.md`（**このファイルのみ**）
3. commit
   - メッセージ例: `docs: add OAuth scope justification research (Phase2)`
4. `git push origin main`
5. 完了を報告

---

## 5. 完了後

3人の push がすべて完了したら、`git log --oneline -8` で U → S → T の順に履歴が積まれていることを確認し、引き継ぎ帳に記録する。

この commit/push が終われば、エルトン主導の作業（`domain.ts` の専用カレンダー型削除、仕様書 v1.5 改訂、justification 本起草など）に進める状態になる。

---

**以上。U → S → T の順に、1人ずつ確実に。**
