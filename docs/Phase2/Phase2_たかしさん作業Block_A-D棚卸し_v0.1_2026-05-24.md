---
title: たかしさん作業 Block A-D 棚卸し v0.1
date: 2026-05-24
author: Uさん(InvokeAide 実装補助 / 横串整合)
status: 棚卸しのみ(実行はしない、たかしさんへの依頼内容を箇条書き化)
purpose: 起草済みインフラ手順書(WIF / Cloud Run deploy / docker-compose)を「実行に移す」ために、たかしさんに何を依頼すれば動けるかを Block 単位で整理
upstream:
  - docs/Phase2/Phase2_Cloud_Run_事前調査_v0.1_2026-05-19.md §9(Block A-D の元定義)
  - docs/Phase2/Phase2_WIF_GitHub_Actions_手順書_v0.1_2026-05-19.md(Block C を 15-30 分で完走する手順)
  - docs/Phase2/Phase2_CloudRun_deploy_ワークフロー_v0.1_2026-05-19.md(Block B+C 完了後に Run workflow 一発で動く)
  - docs/Phase2/Phase2_docker_compose_ローカル動作確認_v0.1_2026-05-19.md(Cloud Run 課金前にローカル検証)
  - docs/Phase2/Phase2_工程マップ_v0.1_2026-05-24.md(本書と同日成果物、Block の時系列配置)
  - 技術顧問申し送り(2026-05-24): 日付は「逆算の目安」、ゲート / 必達 / 最遅などの重い表現は使わない
---

# たかしさん作業 Block A-D 棚卸し v0.1

## 0. このリストについて

### 0.1 目的

Uさん が Sprint 1 で起草した 3 本のインフラ系手順書(WIF / Cloud Run deploy / docker-compose)は **すべて「実行未」**。これらを実行に移すには、たかしさん側で 4 つの Block(A-D)の作業が必要。本書は **「何を依頼すれば動けるか」を Block 単位で箇条書き化** したもの。

**実行はしない**。本書は依頼内容の棚卸しまで。

### 0.2 申し送り尊重: 日付は「目安」

本書では「X までに完了が望ましい」のような目安表現で扱う。「ゲート」「必達」「最遅」「期限」のような追い立てる表現は意図的に使わない。たかしさんの隙間時間に応じて、Block 単位で分散して進める前提。

### 0.3 4 Block の全体マップ

```
┌──────────────────────────────────────────────────────────────┐
│ Block A (ライセンス確認)                                      │
│   └─ 法務 / 規約 / クレジット表記                              │
│      └─ 並列で進行可、本書他 Block の前提条件にならない         │
│                                                                │
│ Block B (Google Cloud アカウント)                              │
│   └─ プロジェクト作成 / 課金 / API 有効化 / リージョン           │
│      └─ Block C の前提条件(必須)                              │
│                                                                │
│ Block C (GitHub 連携 + WIF + Secrets)                          │
│   └─ リポジトリ / WIF Pool・Provider / Secrets                  │
│      └─ Cloud Run deploy ワークフロー実行の前提条件(必須)     │
│                                                                │
│ Block D (ドメイン)                                              │
│   └─ ベータでは Cloud Run 標準 URL でカバー                     │
│      └─ ベータでは作業 0 分、商品化版で再検討                   │
└──────────────────────────────────────────────────────────────┘

依存関係: A は並列可、B → C は順序固定、D はベータでは省略可
合計見込み時間: A(60 分) + B(30 分) + C(30-60 分) + D(0 分) = 90-150 分
```

---

## 1. Block A: ライセンス確認(法務 / 規約)

### 1.1 含まれる項目(Cloud Run 事前調査 §9 より)

| # | 項目 | 入手先(2026-05-19 時点) |
|---|---|---|
| A-1 | VOICEVOX エンジン本体 利用規約 最新版 | https://voicevox.hiroshiba.jp/term/ |
| A-2 | ずんだもん 個別規約 | zunko.jp 系の公式ページ |
| A-3 | 青山龍星 個別規約 | VirVox Project 公式 |
| A-4 | 玄野武宏 個別規約 | VirVox Project 公式 |
| A-5 | クレジット表記実装位置の合意 | 仕様書 v1.5 / 法的書類 v0.4 連動 |

### 1.2 たかしさんが実際にすること

- [ ] A-1: VOICEVOX エンジン本体規約を Web で読み、「**サーバーサイド配信形態(Cloud Run でホスト)が許諾範囲か**」を確認。再配布禁止条項との整合を見る
- [ ] A-2: ずんだもんの個別規約を読み、「クレジット表記の正確な文字列」「商用 / 非商用区分」を確認
- [ ] A-3 / A-4: 青山龍星・玄野武宏の個別規約も同様(切替候補として両方確認)
- [ ] A-5: クレジット表記の実装位置を **新担当(エルトン後継)と相談して合意**:設定画面 + キャラ選択画面フッター + 巻末ライセンス表示で OK か

**見込み時間**: 30-60 分(Web 調査 + 新担当との合意は別途数往復)

### 1.3 完了判定(目で見て分かるもの)

- A-1〜A-4 の各規約を読了し、**「ベータ(無料配布)では非商用扱いで使える」と確認できた** メモ or スクリーンショットを技術顧問に共有
- A-5 で **クレジット表記の正確な文字列** が確定し、新担当と合意したメモが残る
- 「サーバーサイド配信形態が NG」と判明した場合は **その旨を技術顧問に報告**(代替案は工程マップ R2 を参照)

### 1.4 着手前の前提条件

なし。**Block A は他に依存しない、いつでも着手可能**。

### 1.5 完了後に動けるようになること

- VOICEVOX Cloud Run 路線で進める判断を**根拠付きで確定** できる(工程マップ CP-2 のゴーサイン)
- クレジット表記の確定文字列を、Sさん の B3 統合段階で UI に組み込める
- 法的書類 v0.4 の OSS ライセンス節(法的書類 §8.7)に書き込む内容が固まる

### 1.6 たかしさんへの依頼の出し方(技術顧問への申し送り)

> 「Block A は Web 調査が主軸で 30-60 分、エルトン後継=技術顧問さんと A-5 のクレジット表記位置を合意する数往復が追加。**A-1 だけ先に着手いただきたい**(規約上 NG が判明した場合、VOICEVOX 路線全体の見直しが必要なため、早期検出を優先)」

**5/26 議論枠での確認候補**: A-1 着手の目安日(例: 5/27 〜 5/30 のどこか、Sprint 2 第 1 週の隙間時間)

---

## 2. Block B: Google Cloud アカウント

### 2.1 含まれる項目(Cloud Run 事前調査 §9 より)

| # | 項目 | 内容 |
|---|---|---|
| B-1 | プロジェクト作成 | 「InvokeAide」名のプロジェクトを Google Cloud Console で作成 |
| B-2 | 課金アカウント紐付け | 既存の課金アカウント or 新規発行 |
| B-3 | 予算アラート | 月予算 $20(ベータ)/ $50(商品化過渡期)、50% / 90% / 100% で通知 |
| B-4 | API 有効化 | Cloud Run / Cloud Build / IAM / Artifact Registry |
| B-5 | リージョン選定確認 | `asia-northeast1`(東京)で OK か |

### 2.2 たかしさんが実際にすること

- [ ] B-1: Cloud Console にログインし「新しいプロジェクト」を作成
  - プロジェクト名: `invokeaide`(または同等)
  - **判断点**: Novem Intelligence の組織を作るか個人アカウント直下か(現時点では個人直下推奨、組織化は商品化フェーズで判断)
- [ ] B-2: 課金アカウントを紐付け
  - 既存の課金アカウントを使うか新規発行か(請求一元化観点で判断)
- [ ] B-3: 「お支払い」→「予算と通知」で予算アラート設定
  - **ベータ予算 $20 を推奨**(VOICEVOX Cloud Run + 周辺 API の想定上限)
  - 通知メール: たかしさん受信可能なアドレス
- [ ] B-4: 4 つの API を有効化
  - Cloud Run Admin API / Cloud Build API / IAM API / Artifact Registry API
  - **注**: WIF 手順書 §5 で gcloud CLI 経由でも有効化できるため、B-4 は WIF 手順書実行時に吸収可能(任意)
- [ ] B-5: リージョン `asia-northeast1`(東京)で OK か確認
  - レイテンシ / 料金 / 規約面で別リージョン希望があれば技術顧問に相談

**見込み時間**: 30 分(Cloud Console UI 操作)

### 2.3 完了判定

- Cloud Console の「プロジェクト切替」で `invokeaide` が選べる
- 「お支払い」→「予算と通知」に月 $20 設定が見える
- 「API とサービス」→「ライブラリ」で 4 つの API が「有効」状態
- **Block C の WIF 手順書 §2 前提条件チェックの 1〜2 番が ✓ になる**

### 2.4 着手前の前提条件

- Google アカウント保有(たかしさん既存)
- 支払い方法(クレジットカード等)が有効
- Block A の規約確認結果と矛盾しない判断(A-1 で「サーバーサイド配信 NG」と判明した場合は Block B 着手を保留)

### 2.5 完了後に動けるようになること

- Block C(WIF 設定)が着手可能
- Cloud Run deploy ワークフローを後で動かす「土台」が完成
- `gcloud projects list` で `invokeaide` が出る状態

### 2.6 たかしさんへの依頼の出し方

> 「Block B は Cloud Console 操作中心で 30 分。マウス不使用の前提でも、`gcloud` CLI でほぼ完結可能(B-1 のプロジェクト作成だけ初回 UI 推奨)。**Block A の A-1 が OK 判定された後の着手を推奨**(規約 NG なら Block B/C のコストが無駄になるため)」

**5/26 議論枠での確認候補**: Block B 着手の目安日(例: 5/31 までのどこか、Block A 完了後)

---

## 3. Block C: GitHub 連携準備(WIF + Secrets)

### 3.1 含まれる項目(Cloud Run 事前調査 §9 + WIF 手順書より)

| # | 項目 | 由来 |
|---|---|---|
| C-1 | リポジトリ作成 | プライベートリポジトリ、`<owner>/<repo>` 形式 |
| C-2 | WIF Pool / Provider 設定 | WIF 手順書 §6 Step 1〜5(SA 作成 + 権限付与 + Pool + Provider + Binding) |
| C-3 | GitHub Secrets 設定 | WIF 手順書 §7(`GCP_PROJECT_ID` / `GCP_WIF_PROVIDER` / `GCP_SA_EMAIL` / `VOICEVOX_AUTH_TOKEN`) |
| C-4(本書追記) | GitHub Variables 設定 | Cloud Run deploy ワークフロー §2.2(`ALLOWED_ORIGIN`) |

### 3.2 たかしさんが実際にすること

- [ ] C-1: GitHub でプライベートリポジトリを作成(または既存の InvokeAide リポジトリのサブディレクトリ使用)
  - リポジトリパス例: `<github-username>/invokeaide-voicevox` または `<owner>/invokeaide`(モノレポ)
- [ ] WIF 手順書 §2 前提条件チェックを実施
  - Block B 完了確認 + gcloud CLI インストール(WIF 手順書 §3)
- [ ] WIF 手順書 §4 で変数を定義(`PROJECT_ID` / `GITHUB_REPO` / その他)
- [ ] WIF 手順書 §5 で 6 つの API を有効化(Block B-4 で済んでいれば冪等で OK)
- [ ] WIF 手順書 §6 Step 1〜5 を順に実行
  - Step 1: Service Account `github-deployer` 作成
  - Step 2: 3 つの権限付与(`roles/run.admin` / `roles/iam.serviceAccountUser` / `roles/artifactregistry.writer`)
  - Step 3: WIF Pool 作成
  - Step 4: WIF Provider 作成(attribute-condition で repository_owner 制限)
  - Step 5: SA と principalSet バインド
- [ ] WIF 手順書 §7 で GitHub Secrets を 4 つ登録
  - `GCP_PROJECT_ID`、`GCP_WIF_PROVIDER`、`GCP_SA_EMAIL`、`VOICEVOX_AUTH_TOKEN`(`openssl rand -hex 32` で生成)
- [ ] C-4: GitHub Variables(Settings → Secrets and variables → Actions → Variables タブ)で `ALLOWED_ORIGIN` を登録
  - Cloudflare Pages 確定前は一時的に `*`、確定後に URL に絞る
- [ ] WIF 手順書 §10 完了確認チェックリスト 11 項目をすべて ✓ にする

**見込み時間**: WIF 初設定なら 60 分、Uさん 手順書通りなら 30 分

### 3.3 完了判定

- WIF 手順書 §10 完了確認チェックリストが **11 項目すべて ✓**
- GitHub Settings → Secrets で 4 つの Secret + 1 つの Variable が見える
- 動作確認 workflow(WIF 手順書 §8)を `Run workflow` ボタンで実行 → 緑になる

### 3.4 着手前の前提条件

- Block B 完了(プロジェクト作成 + 課金紐付け、API 有効化は WIF 手順書 §5 で代行可能)
- gcloud CLI インストール(WIF 手順書 §3 を参照)
- GitHub リポジトリの管理権限(Secrets 書き込み可能)
- ローカルマシン(Windows 11、PowerShell or bash)

### 3.5 完了後に動けるようになること

- Cloud Run deploy ワークフロー(`deploy-voicevox.yml`)を `Run workflow` ボタン押下で実行可能
- → 5 分(初回)で Cloud Run に VOICEVOX エンジン + nginx proxy が立つ
- → 工程マップ CP-2 の「VOICEVOX Cloud Run 稼働」が達成

### 3.6 たかしさんへの依頼の出し方

> 「Block C は Uさん の WIF 手順書(`Phase2_WIF_GitHub_Actions_手順書_v0.1_2026-05-19.md`)を **そのままなぞるだけで 30 分**。CLI 中心で各コマンドに「何をしているか」一行注記付き。**詰まったらトラブルシュート §9 を参照、それでも詰まったら技術顧問経由で Uさん に質問可**」

**5/26 議論枠での確認候補**: Block C 着手の目安日(例: 6/7 までのどこか、Block B 完了後)

### 3.7 補足: 並行作業の選択肢

Block C 完了の **前** に、たかしさんが「ローカルで触って覚える」モードを希望する場合、`docker-compose` 経路(`Phase2_docker_compose_ローカル動作確認_v0.1_2026-05-19.md`)で proxy + VOICEVOX を Docker Desktop 上に立てられる。Block C に依存しない独立作業のため、いつでも着手可能。

---

## 4. Block D: ドメイン / 公開

### 4.1 含まれる項目

| # | 項目 | 内容 |
|---|---|---|
| D-1 | Cloud Run 標準 URL でベータ開始 | `https://voicevox-engine-xxxx.a.run.app` の自動生成 URL を使う |
| D-2 | カスタムドメイン判断 | 商品化版で `voicevox.invokeaide.app` 等を割り当てる判断、ベータでは不要 |

### 4.2 たかしさんが実際にすること

- [ ] D-1: **何もしない**(Cloud Run が自動発行する URL を Sさん / Uさん の Provider 実装で受け取る)
- [ ] D-2: **商品化版で判断** — ベータ期間中(7/4-5 まで)は D-1 のみで動く

**見込み時間**: ベータでは **0 分**、商品化版で 30-60 分

### 4.3 完了判定

- ベータ期間中: Cloud Run deploy ワークフロー実行後、自動発行された URL が `GITHUB_STEP_SUMMARY` に表示される(これで完了扱い)
- 商品化版: カスタムドメインを設定する場合のみ、DNS 設定 + Cloud Run ドメインマッピングを実施

### 4.4 着手前の前提条件

ベータでは Block C 完了(Cloud Run deploy ワークフロー実行可能) + 実際にデプロイ済みであること。

### 4.5 完了後に動けるようになること

- ベータでは: Sさん / Uさん が `VoicevoxTTSProvider` の `endpoint` に Cloud Run URL を埋め込んで疎通テストできる
- 商品化版: ユーザー向けにブランド統一されたドメインで提供可能

### 4.6 たかしさんへの依頼の出し方

> 「Block D はベータでは作業ゼロ。商品化版で `voicevox.invokeaide.app` 等を割り当てる判断は、7/4-5 配布後の Phase 3 で再評価」

---

## 5. ベータに必要な最小組み合わせ

**ベータ v1.0(6/20 目安)で VOICEVOX 経路を稼働させるために最低限必要なもの**:

```
必須:
  Block A(A-1 だけ最優先、A-2〜A-5 はベータ前までに完了)
  Block B(B-1〜B-3 必須、B-4 は WIF 手順書で代行可、B-5 確認のみ)
  Block C(C-1〜C-4 全部)

ベータでは不要:
  Block D(D-1 自動取得のみ、D-2 商品化版で判断)
```

**着手の推奨順序**:

1. Block A の A-1(VOICEVOX 規約)を最優先 — NG 判定の早期検出のため
2. A-1 OK 判定後、Block B 着手(プロジェクト + 課金紐付け)
3. Block B 完了後、Block C 着手(WIF 手順書をなぞる)
4. Block C 完了後、Cloud Run deploy ワークフローを `Run workflow` で実行
5. デプロイ成功 = 工程マップ CP-2 達成

並行可能(Block A-C と並行で進めて OK):
- Sさん の B3 実装
- Uさん の Provider 実装(SecretStore → AuthProvider → StorageProvider)
- Tさん のテスト整備
- 新担当の仕様書 v1.5 / 法的書類 v0.4 起草

---

## 6. 棚卸しサマリ

### 6.1 Block 別の依頼単位(技術顧問が一覧で渡せる形式)

| Block | 名前 | 見込み時間 | 着手の目安 | 依存 | ベータ必須 |
|---|---|---|---|---|---|
| A | ライセンス確認 | 30-60 分 + 数往復(A-5) | 5/27 〜 5/30(隙間時間) | なし | **A-1 必須**、A-2〜A-5 はベータ前まで |
| B | GCP アカウント | 30 分 | 5/31 までを目安(A-1 OK 後) | Block A の A-1 OK 判定 | **必須** |
| C | GitHub 連携 + WIF | 30-60 分 | 6/7 までを目安(Block B 完了後) | Block B 完了 | **必須** |
| D | ドメイン | ベータでは 0 分 | 商品化版で再評価(7/4-5 以降) | Block C 完了 + デプロイ済 | **不要** |

**合計**: A + B + C の最小組み合わせで **90-150 分**、6/14 までに完了が目安(工程マップ §6 と整合)。

### 6.2 「実行」状態の現在

| 手順書 | 起草状態 | 実行状態 | 実行に必要な Block |
|---|---|---|---|
| `Phase2_WIF_GitHub_Actions_手順書_v0.1` | ✅ 起草完了 | ⏳ 未実行 | Block B 完了 + たかしさんが手順書をなぞる |
| `Phase2_CloudRun_deploy_ワークフロー_v0.1` | ✅ 起草完了 | ⏳ 未実行 | Block B + C 完了 + `Run workflow` 押下 |
| `Phase2_docker_compose_ローカル動作確認_v0.1` | ✅ 起草完了 | ⏳ 未実行 | Docker Desktop インストール + `docker compose up` |

すべて起草済、実行待ち。**実行に必要なたかしさん作業は本書 §1〜4 のチェックリストで全て明示済**。

### 6.3 たかしさんへの「次の 1 アクション」候補

以下のいずれかから始められる(優先度順):

1. **Block A の A-1 着手**(VOICEVOX 規約読了、30 分、Web 調査だけ)
2. **Block B 着手**(GCP プロジェクト作成、30 分、Cloud Console + 課金)
3. **docker-compose ローカル動作確認の着手**(任意、Block A-C と独立、Docker Desktop インストール + `docker compose up`)

新担当の判断で「いつ」「どれから」を決め、たかしさんに依頼する形が想定。

---

## 7. 次のアクション

### 7.1 本書配布直後

- [ ] 技術顧問: 本書 v0.1 のレビュー、たかしさんに **Block A の A-1 着手を依頼するタイミング** を判断
- [ ] 技術顧問: 5/26 議論枠で本書を「Block A-D のタイムライン提案」として参照

### 7.2 Block A 着手後(NG 判定リスク対応)

- A-1 で VOICEVOX サーバーサイド配信が NG と判明した場合 → 工程マップ R2 / R3(WebSpeech 単独 fallback 経路)に切替の判断を技術顧問が主導
- A-1 が OK なら、A-2〜A-4 と並行で Block B 着手指示

### 7.3 5/26 議論枠での確認候補(本書から派生)

1. **Block A の A-1 着手の目安日**(5/27 〜 5/30 のどこか)
2. **Block B-C 着手の目安日**(5/31 〜 6/7 のどこか)
3. **A-5 クレジット表記の合意プロセス**(誰が起案、誰がレビュー、いつまでに合意)
4. **docker-compose ローカル動作確認の取り扱い**(任意で進めるか、ベータ前必須にするか)

### 7.4 本書の次バージョン

- **v0.2 更新トリガー**: Block A の A-1 完了時(規約解釈の結果を反映)
- **v0.3 更新トリガー**: Block B 完了時(プロジェクト ID / リージョンの確定値を反映)
- **v0.4 更新トリガー**: Block C 完了時(WIF Pool / Provider / SA Email の確定値を反映、Cloud Run デプロイ完了とセット)

---

## 8. 統計

### 8.1 たかしさん作業の構造

| Block | 項目数 | 自動化可能 | UI 操作必須 |
|---|---|---|---|
| A | 5(A-1〜A-5) | 0(Web 調査) | 0(ただし A-5 は新担当と相談) |
| B | 5(B-1〜B-5) | 1(B-4 は WIF 手順書で代行可) | 4(B-1 / B-2 / B-3 / B-5 確認) |
| C | 4(C-1〜C-4) | 3(WIF 手順書 §6 / §7 は CLI、Variables 設定だけ UI) | 1(C-4 GitHub Variables の UI 操作) |
| D | 2(D-1 / D-2) | 1(D-1 自動取得) | 0(ベータでは UI 操作なし) |
| **合計** | **16** | **5(31%)** | **5(31%)** |

→ たかしさん作業の半分は「自動化済」か「不要」、実質手動は 5 項目程度。マウス不使用前提でも CLI 中心で完走可能(WIF 手順書設計の意図どおり)。

### 8.2 Block 別の見込み時間レンジ

| Block | 最短 | 想定 | 最長 |
|---|---|---|---|
| A | 30 分 | 45 分 | 60 分 + 数往復(A-5) |
| B | 20 分 | 30 分 | 45 分 |
| C | 30 分(手順書通り) | 45 分 | 60 分(初回 + トラブルシュート発動) |
| D | 0 分(ベータ) | 0 分 | 0 分(商品化版で別途) |
| **合計** | **80 分** | **120 分** | **165 分 +** |

→ 1 日 30 分の隙間時間でも、**4-6 日で全完了できる規模**。週末 1 日に集中させれば 1 日で完走可能。

---

## 9. 変更履歴

| Version | 日付 | 主な変更 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-24(土) | 初版作成。Block A-D の依頼単位を箇条書き化、ベータ最小組み合わせ、たかしさん作業の構造分析、5/26 議論枠での確認候補 4 件 | Uさん(Opus) |

---

— Uさん(2026-05-24、Block A-D 棚卸し v0.1 起草)
