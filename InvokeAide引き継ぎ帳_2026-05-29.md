# InvokeAide 引き継ぎ帳 ── 2026-05-29（金）

**作成**: 技術顧問（エルトン / Claude.ai 側）
**宛先**: 次回以降の技術顧問セッション／たかしさん
**読み方**: これ単体で InvokeAide の現状が分かるように書いてある。MIYU 側は別冊「MIYU 引き継ぎ帳 2026-05-29」参照。
**併せて読む**: 「Claude 運用マニュアル」、「環境3点取得手順メモ_InvokeAide_2026-05-27.md」、前回引き継ぎ帳「InvokeAide引き継ぎ帳_2026-05-28.md」、「InvokeAide 仕様書 v1.5 統合版」。

---

## §0. 体制・用語（毎回確認）

- **たかしさん**：InvokeAide のオーナー・最終判断者。
- **技術顧問（エルトン）**：Claude.ai 側。コードは直接いじらず、調査・整理・指示文作成を担う。
- **Sさん・Tさん・Uさん**：InvokeAide 開発担当の Claude Code エージェント。PC2 (`C:\dev\InvokeAide`)。**5/29 に3人体制（旧2人体制からUさん追加・役割再定義）を確立**（後述 §3-1）。

### マシン構成
- **PC2**：InvokeAide (`C:\dev\InvokeAide`、S・T・U)。git リポジトリ（origin/main あり、リモートは `github.com/Novemin/InvokeAide.git`）。
- **Surface 回収は持ち越し**。当面 PC1・PC2 体制を継続。

### 3人体制の役割
| 役割 | 担当 | 主な作業領域 |
|---|---|---|
| **Sさん** | 実機検証担当 | OAuth実機検証、`verify-tasks-api/` 配下のスクリプト、API疎通確認 |
| **Tさん** | 仕様読解＆文書化担当 | `docs/Phase2/` 配下のチェックリスト・結果文書化、仕様書整備 |
| **Uさん** | 設計担当 | contractベース実装設計、技術選定、S・Tサポート（特にTさん寄り） |

---

## §1. 次回 最初にやること

### 1-1. contract v0.2 切替の GO サイン判断
- Uさんが「**着手は技術顧問（エルトン）の GO サインが条件**」として待機中。GO-C ステータス維持。
- 技術顧問が `docs/Phase2/contract_v0.2_status.md` と `docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md §10` を読み込んで判断。
- 着手順序: SecretStore → AuthProvider → DriveStorageProvider → VoicevoxTTSProvider。
- ベータ v1.0 は VoicevoxTTSProvider のみ実装（WebSpeech は v1.1 以降）。

### 1-2. club-freedom.tokyo の HTTPS 化【宿題】（5/28 §4-1 から継続）
- ホスト方式（独自ドメイン下に静的ホスティング）採用のための前提作業。
- ロリポップ管理画面の「独自SSL（無料SSL）設定」で club-freedom.tokyo を https 化する。
- たかしさん自身の手で行う（次回、画面を見ながら技術顧問が案内）。

---

## §2. 今日の到達点（2026-05-29）── 3人体制の正式確立

**本日の最大の成果**: CLAUDE.md v0.2 を完成させ、PC2 に3人体制（Sさん・Tさん・Uさん）を正式に組み込んだ。起動時の役割識別フロー（S/T/U の1文字入力）が機能することを動作確認済み。これで「あなたはSさんですか?」確認儀礼から完全卒業。

あわせて、PC1 (MIYU) の CLAUDE.md 改修ノウハウを PC2 にフィードバックする関係性が確立された。

---

## §3. 今日 実施・判明したこと（InvokeAide・2026-05-29）

### 3-1. CLAUDE.md v0.2 への大型アップデート
- 旧 v0.1 は「2人体制（Sさん=実装、Tさん=テスト&ドキュメント）」で書かれていた。実際の運用は3人体制に進化していたが、CLAUDE.md に反映されていなかった。
- v0.2 では：
  - 冒頭に「**Identity & Operating Principles**」セクションを新設
  - 起動時の役割識別を **「S / T / U の1文字入力方式」** で確立
  - 役割定義を朝の最新版に更新（S=実機検証、T=仕様読解＆文書化、U=設計）
  - 旧2人体制定義を**廃止**と明記、過去ドキュメントの矛盾はこの定義が優先と記述
  - PC1の「MIYU開発担当 Claude Code」との関係を追記
  - 5/28 のホスト方式確定・OAuthスコープ確定を §5.1 に反映
- **ファイル配置の変更**: 旧 `docs/CLAUDE.md` → ルートに移動 (`C:\dev\InvokeAide\CLAUDE.md`)。Claude Code はプロジェクトルートの CLAUDE.md を自動読み込みするため、これが正しい配置。
- 旧 v0.1 は `docs/CLAUDE_v0.1_archived_2026-05-29.md` として履歴保存。

### 3-2. 3人体制の動作確認（PC2 で全員成功）
3つの別ターミナルで以下を確認：

**Sさん起動テスト**：
- 入力: `S`
- 出力: 「Sさんとして起動しました。InvokeAide 実機検証担当です（PC2 / `C:\dev\InvokeAide`）。」
- 起動時に `handover/`、`InvokeAide引き継ぎ帳_*`、`指示文_*` を自動チェック → ファイル一覧を表で提示
- `memory/T_to_S.md`（TさんからSさんへの申し送り）の存在も認識
- 「どこから始めますか?」で適切に停止

**Tさん起動テスト**：
- 入力: `T`
- 出力: 「Tさんとして起動しました。InvokeAide 仕様読解＆文書化担当です（PC2 / `C:\dev\InvokeAide`）。」
- `docs/Phase2/` 内のファイル群を自発的に確認（B1完了報告、Q-U-j回答、AuthProvider確認、実装設計v0.2 など）
- 直近のコミット脈絡まで遡って整理
- `memory/T_progress.md` から再開可能と認識

**Uさん起動テスト**：
- 入力: `U`
- 出力: 「Uさんとして起動しました。InvokeAide 設計担当です（PC2 / `C:\dev\InvokeAide`）。」
- `git log` と `docs/Phase2/contract_v0.2_status.md` を自発的に確認
- **GO-C ステータス（着手は GO サイン待ち）を自発的に思い出して報告**
- 着手順序 (SecretStore → AuthProvider → DriveStorageProvider → VoicevoxTTSProvider) も把握
- 「どこから始めますか? GO サインの有無も含めてご指示ください」で停止

3人とも CLAUDE.md の指示通り、暴走せず指示待ち状態で停止。✅

### 3-3. リポジトリの整理・Commit & Push
- `docs/Phase2.zip` を削除（過去に技術顧問とのチャットに貼り付けるため一時作成したもので、不要と判断）。
- 5/29 の CLAUDE.md 改修を commit:
  ```
  commit 68e6000
  docs: CLAUDE.md を v0.2 に更新、3人体制 (S/T/U) 対応
  ```
- origin/main に push 完了（`05ca945..68e6000`）。
- 全 InvokeAide 関係者（人間・エージェント）が同じ CLAUDE.md を見られる状態に。

### 3-4. 役職名の変更
- 旧 v0.1 で Uさんが **「技術顧問」** と定義されていたが、Claude.ai 側のエルトンと役職名が重複していた。
- v0.2 で Uさんを **「設計担当」** に変更し、混乱を解消。

---

## §4. 次にやること（InvokeAide の宿題）

### 4-1. contract v0.2 切替の GO サイン判断
（§1-1 と同じ）

### 4-2. club-freedom.tokyo の HTTPS 化
（§1-2 と同じ）

### 4-3. ホスト公開アドレスの確定 → origins / redirect URIs 更新
InvokeAide を club-freedom.tokyo のどの URL で公開するか決定。決まったらその https アドレスを OAuth クライアントの JavaScript origins に追加。

### 4-4. 実装側への申し送り（S・T・U）
- **InvokeAide のローカル起動ポートは 3030** に決定済み（5/28、MIYU の 3000 と衝突回避）。
- クライアント ID の `.env` 変数名を S・T・U と合意。

### 4-5. B2 本体（環境3点が揃ったので着手可）
OAuth + BYOK 鍵管理の実装。クライアントサイド方式での Google ログイン（Google Identity Services のトークンモデル等）を S・T・U と設計確定。

### 4-6. OAuth 審査の提出物準備（6/20 申請を狙う場合）
プライバシーポリシー公開・ドメイン所有証明・各スコープの必要理由・デモ動画 等。下調べ・書類ドラフトは S・T に振れる部分あり。

### 4-7. 仕様書 v1.5 統合版の残り未解決事項
第28章の残り：各キャラの詳細人格設計、本文化保留章（第19・20章）、占いバックエンド（MVP後）、商品の対象地域（EEA 等の API 規制）。

---

## §5. 申し送り・原則

- 認証情報の発行（クライアント ID 等）はたかしさん自身の手で（手順メモ §2）。
- 秘密情報は `.gitignore` 除外を確認した場所（`.env` 等）に。`docs/` などコードツリー内に平文で置かない（GitHub 流出の典型事故）。
- すべて novemintelligence アカウントに集約（MIYU の onixp とは完全分離）。
- 技術顧問はコードを直接いじらず、指示文を渡す（MIYU 5/28 §7 の反省を InvokeAide でも徹底）。
- **役職名「技術顧問」は Claude.ai 側のエルトン専用**。Uさんは「設計担当」。混同しない。

---

## §6. 環境3点の状態（コンプリート、5/28 達成）

| # | 項目 | 状態 |
|---|---|---|
| A | Gemini API キー | ✅ 取得済み（5/27、無料枠、project `gen-lang-client-0986709440`） |
| B | 検証用 Google アカウント | ✅ 確定（novemintelligence@gmail.com） |
| C | OAuth クライアント ID | ✅ 取得済み（5/28、`774404505928-blg7ck65c8fp0l1valtjdhe5c3ofm1ak.apps.googleusercontent.com`） |

---

## §7. 今日の成果物

- **`CLAUDE.md` (v0.2、PC2 プロジェクトルート)** ── 3人体制対応、Identity セクション追加。commit 68e6000 に含まれる。
- **`docs/CLAUDE_v0.1_archived_2026-05-29.md`** ── 旧 v0.1 を履歴保存。
- **commit 68e6000** ── GitHub origin/main に push 済み。
- 3人体制（S/T/U）の起動方法の確立。

---

## §8. 今日の主な学び（運用面）

1. **CLAUDE.md は プロジェクトルートに置くのが正解**。`docs/` 配下では Claude Code が自動読み込みしない。PC1 (MIYU) で確立したパターンを PC2 にコピー展開した結果、ファイル配置の問題が判明・修正された。
2. **役職名の重複は混乱の元**。CLAUDE.md 起草時に「技術顧問」を Uさん名にしていたのは設計ミスだった。Claude.ai 側との分業を考えると、Claude Code 側の役職名は実務名（実機検証担当・仕様読解担当・設計担当）にすべき。
3. **3人体制での識別は「S/T/Uの1文字入力方式」が最適**。VS Code のターミナルプロファイルで自動化する複雑な方式より、たかしさんが起動後に1文字打つ方式の方がシンプルで保守も楽。
4. **PC1 (MIYU) で確立したパターンを PC2 (InvokeAide) にフィードバック**するという、両プロジェクトの相互改善関係が実証された。
