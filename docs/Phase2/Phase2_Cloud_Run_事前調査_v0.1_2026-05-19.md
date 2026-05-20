# Phase 2 VOICEVOX × Cloud Run 事前調査 v0.1

**作成日**: 2026-05-19(火)
**起草者**: Uさん(Opus、実装補助担当)
**位置づけ**: Phase 2 Sprint 1 並列タスク 案A、Uさん 担当スコープ §4-1「VOICEVOX Cloud Run デプロイ」の前提整理
**性質**: **調査と意思決定論点の整理** 。 本書は「実コードを書くタスク」ではなく、「たかしさん準備事項リストの提示」「設計判断の論点提示」が主役。
**前提**:
- Sさん 技術スタック決定提案 v0.3 §6 / §6A VOICEVOX 採用 + 青山龍星(セバスチャン本命)確定
- 法的書類 v0.3 §1.2「未来の自分を縛らない」原則(表現に適用)
- スケジュール現実性評価 §7.3「Cloud Run 月 $10 程度想定」
- 思想書「人間味のための AI」 — 音声品質を「賢さ-20点ペナルティ(引継ぎ帳 2026-05-16)」回避

**情報の限定**: 本書の規約・価格・Docker イメージに関する記述は **2026-05-19 時点の公式 / 一次情報源の調査結果** 。たかしさん採用前に最新確認を強く推奨する(本書 §9 準備事項リスト)。

---

## 0. エグゼクティブ・サマリ

### 0.1 主要結論

| 項目 | Uさん 提案(本書 §X 参照) |
|---|---|
| VOICEVOX エンジン本体 | 公式 Docker イメージ `voicevox/voicevox_engine`(Docker Hub / ghcr.io)を採用( §2) |
| Cloud Run 構成 | VOICEVOX 単独 Cloud Run + アプリ(PWA)は Cloudflare Pages の **分離構成** 。Sさん v0.3 §3 FE 完結方針と整合( §3) |
| リージョン | `asia-northeast1`(東京)を本命、 `asia-northeast2`(大阪)を副候補( §3) |
| CPU / メモリ | 2 vCPU / 2 GiB を初期推奨、Startup CPU Boost 有効化( §3.2、§5) |
| コスト | ベータ家族規模(月 数千リクエスト)では **無料枠内** の見込み、商品化 数千ユーザー規模で **月 $10〜30 程度** ( §4) |
| 規約遵守 | エンジン本体は商用利用可(再配布禁止)、各キャラに **「VOICEVOX:キャラ名」クレジット表記必須** ( §6) |
| アクセス制御 | ベータは「BYOK アプリ専用 API キー(共通シークレット)」、商品化は OAuth 連携または Cloud Run Authentication 検討( §7) |
| デプロイ | GitHub Actions + Workload Identity Federation(SA key 不要)( §8) |

### 0.2 たかしさん準備事項(本書 §9 詳述、ここでは見出しのみ)

```
[Block A: ライセンス確認]
A-1. VOICEVOX エンジン利用規約 最新確認
A-2. ずんだもん(MIYU 用)個別規約確認
A-3. 青山龍星(セバスチャン本命)個別規約確認
A-4. 玄野武宏(セバスチャン副候補)個別規約確認

[Block B: Google Cloud アカウント]
B-1. プロジェクト作成(Novem Intelligence 名義 or 個人)
B-2. 課金アカウント紐付け
B-3. 予算アラート設定(月 $20 等)
B-4. Cloud Run API 有効化

[Block C: GitHub 連携準備]
C-1. プライベートリポジトリ作成(Novem Intelligence 名義)
C-2. Workload Identity Federation 設定(SA key 不要方式、本命)
C-3. GitHub Secrets 設定(GCP_PROJECT_ID、GCP_WIF_PROVIDER、GCP_SA_EMAIL)

[Block D: ドメイン]
D-1. Cloud Run 標準 URL でベータ開始 / カスタムドメインは商品化版で判断
```

---

## 1. 本書の目的・スコープ

### 1.1 目的

§4-1 VOICEVOX Cloud Run デプロイの **コード書く前段** で:
1. 技術選定の不確実性を潰す(エンジン / イメージ / 構成 / リージョン)
2. **コスト試算** を提示してたかしさん判断材料を作る
3. **規約遵守事項** を整理してリーガル準備を前倒し
4. **たかしさん作業項目** を列挙して並列化を最大化

### 1.2 スコープ

- 含む: VOICEVOX エンジン選定、Cloud Run 構成案、コスト試算、コールドスタート対策、規約整理、認証方式、デプロイパイプライン、準備事項リスト
- 含まない: 実 Dockerfile の起草(別タスク)、cloudbuild.yaml / service.yaml の完全版(別タスク)、VOICEVOX 用フロントエンド側 TTSProvider 実装(Sさん contract 確定後)

---

## 2. VOICEVOX エンジンの選定

### 2.1 採用候補

| 候補 | 配信元 | 特徴 | Uさん 評価 |
|---|---|---|---|
| `voicevox/voicevox_engine`(Docker Hub) | VOICEVOX 公式 | 公式管理、 cpu-latest / nvidia-latest タグ、ポート `50021` | **◎ 本命**(公式保守、追従しやすい) |
| `ghcr.io/voicevox/voicevox_engine` | VOICEVOX 公式(GitHub Container Registry) | Docker Hub と同じイメージを GHCR 経由で配信 | ◯ 副候補(Docker Hub の代替) |
| `aoirint/voicevox_engine` | コミュニティビルド | 軽量化や独自パッチを当てたフォーク | △ 公式追従の方が安全 |
| `voicevox/voicevox_nemo_engine` | VOICEVOX Nemo(派生プロジェクト、キャラ展開違い) | 通常 VOICEVOX とは別系統 | ❌ 本プロジェクトのキャラと不一致 |

### 2.2 採用方針

- **本命**: 公式 `voicevox/voicevox_engine`、 **CPU 版(`cpu-latest`)** を採用
- GPU 版は Cloud Run の GPU サポート(2024 GA)で技術的には可能だが、**ベータでは過剰**(コスト上昇、待機 GPU の課金、CPU でレイテンシ実用範囲)
- バージョン固定: `latest` ではなく **明示的バージョンタグ**(例: `0.26.x`)で固定。アップデートは手動マージで管理(「未来の自分を縛らない」 = 自動 latest 追随で動作が変わるリスクを避ける)

### 2.3 既知の参照実装

- **`urth-inc/cloudrun_voicevox`**(GitHub): Cloud Run + VOICEVOX のサンプル実装、Node.js サイドカー構成例あり
- **Sさん v0.3 §3 方針**: バックエンドは FE 完結 + VOICEVOX 自前 Cloud Run のみ
- → 本プロジェクトでは **サイドカー不要、 VOICEVOX エンジン単独コンテナ** で十分(アプリは別ホスト)

---

## 3. Cloud Run へのデプロイ構成案

### 3.1 推奨アーキテクチャ

```
[ユーザー端末(iPhone Safari / Android Chrome)]
    │ HTTPS
    ▼
[Cloudflare Pages]   ←─ PWA 配信(Sさん v0.3 §3、別ホスト)
    │ fetch
    ▼
[Cloud Run: voicevox-engine] ←─ Uさん デプロイ範囲
    │
    └─ Container: voicevox/voicevox_engine:0.26.x
       Port: 50021
```

### 3.2 Cloud Run 設定値(初期推奨)

| 項目 | 値 | 根拠 |
|---|---|---|
| リージョン | `asia-northeast1`(東京) | ユーザー(日本)へのレイテンシ最小、 Tier 1 価格 |
| CPU | 2 vCPU | VOICEVOX 公式 README は最低 2 vCPU を想定 |
| メモリ | 2 GiB | モデル読み込み + 同時合成の安全マージン |
| Startup CPU Boost | 有効 | 起動時 + 起動後 10 秒の追加 CPU でコールドスタート短縮 |
| Concurrency | 4-8 | 1 リクエストあたりの CPU 占有が高いため低めに |
| Timeout | 60 秒 | 通常 1-3 秒で完了、余裕として 60 秒 |
| min-instances | 0(ベータ) / 1(商品化) | ベータはコスト優先、商品化はコールドスタート回避 |
| max-instances | 5(ベータ)/ 20+(商品化) | 突発的負荷へのキャップ |
| 認証 | カスタム API キー方式(§7) | Cloud Run Authentication は OAuth 統合の煩雑さで保留 |

### 3.3 値は「初期推奨」、実測で調整

Cloud Run の挙動は実トラフィックで最適点が変わる。Sさん v0.3 §4.1 の「Cloud Run コールドスタート対策 1-2 日チューニング」を本見積もりに織り込み済。

---

## 4. コスト見積もり

### 4.1 Cloud Run 価格(2026-05-19 時点、Tier 1 リージョン)

| 項目 | 無料枠(月) | 無料超過後 |
|---|---|---|
| vCPU 時間 | 180,000 vCPU-秒 | $0.00002400 / vCPU-秒 |
| メモリ時間 | 360,000 GiB-秒 | $0.00000250 / GiB-秒 |
| リクエスト | 2,000,000 件 | $0.40 / 100万件 |
| エグレス | 1 GiB(北米内) | リージョン依存 |

### 4.2 シナリオ別試算

#### シナリオ A: ベータ家族規模(10ユーザー、月 3,000 合成リクエスト)

| 項目 | 試算 |
|---|---|
| 合成1回あたり実行時間 | 3秒(平均) |
| 月の総 vCPU 時間 | 3,000 req × 3s × 2 vCPU = **18,000 vCPU-秒** |
| 月の総メモリ時間 | 3,000 req × 3s × 2 GiB = **18,000 GiB-秒** |
| リクエスト | **3,000 件** |
| 無料枠との比較 | vCPU: 10%、メモリ: 5%、リクエスト: 0.15% |
| 結論 | **完全に無料枠内、月コスト ~ $0** |

#### シナリオ B: 商品化フェーズ(1,000ユーザー、月 30万 合成リクエスト)

| 項目 | 試算 |
|---|---|
| 月の総 vCPU 時間 | 1,800,000 vCPU-秒(無料超過 1,620,000) |
| 月の総メモリ時間 | 1,800,000 GiB-秒(無料超過 1,440,000) |
| リクエスト | 300,000 件(無料枠内) |
| vCPU 料金 | 1,620,000 × $0.000024 ≒ **$38.88** |
| メモリ料金 | 1,440,000 × $0.0000025 ≒ **$3.60** |
| 推定月額 | **~ $42 / 月** |

#### シナリオ C: min-instances=1 維持の場合(コールドスタート完全回避)

- 1 インスタンス × 2 vCPU × 30 日 × 24h × 3600s = 5,184,000 vCPU-秒
- 同じく 5,184,000 GiB-秒
- アイドル CPU 料金は通常 vCPU の 10%(Cloud Run の "CPU is always allocated" モード)
- 料金 ≒ 月 **$15-20**(リクエストなしでも発生する固定費)
- ベータでは min-instances=0 推奨(コスト優先)

### 4.3 スケジュール現実性評価 §7.3 との整合

「ベータ無料枠〜商品化時 月$10程度」というたかしさん × Sさん の想定は、シナリオ A / B の中間あたりで、本見積もりとおおむね整合。**商品化 1,000 ユーザーで月 $42 は想定より高め** なので、判断仰ぎ事項として明示する( §11 Q-U-d-1)。

---

## 5. コールドスタート対策

### 5.1 想定コールドスタート時間

VOICEVOX エンジンはモデル読み込みを伴うため、 **5-15 秒** のコールドスタートが発生する報告あり(公式ドキュメント / コミュニティ事例)。

### 5.2 対策レイヤー

| レイヤー | 対策 | 効果 | コスト影響 |
|---|---|---|---|
| 1. Startup CPU Boost | 有効化 | 起動時間 30-50% 短縮 | 起動時のみ追加 CPU、課金影響軽微 |
| 2. min-instances | ベータ=0 / 商品化=1 | コールドスタート完全回避 | min=1 で月 $15-20 増 |
| 3. ウォームアップ呼び出し | フロント起動時に空合成リクエスト | 初回ユーザー体感のみ改善 | 課金軽微 |
| 4. モデルの軽量化 | (公式ビルド前提では選択肢なし) | - | - |

### 5.3 ベータでの推奨

- 起動時 Startup CPU Boost 有効
- min-instances=0 維持(コスト優先)
- フロント起動時にバックグラウンドで「ウォームアップ」HTTP リクエスト
- ユーザー初回合成までの 5-10 秒は「Web Speech フォールバック」で吸収(Sさん v0.3 §8 TTS 第二)

これにより **「VOICEVOX 完全失敗」シナリオを構造的に回避** 。

---

## 6. VOICEVOX 利用規約・キャラ規約の整理

### 6.1 エンジン本体の規約(VOICEVOX 公式 term)

調査時点(2026-05-19)で確認できた主要項目:

- **商用 / 非商用問わず利用可**
- **クレジット表記必須** (具体的文字列はキャラ規約側で規定)
- **本ソフトウェアの全てまたは一部を無断で再配布することは禁止**
- → Cloud Run へのデプロイは「再配布」に該当しないか **要確認(本書 §9 A-1)** 。公式 Docker イメージを pull して自分のプロジェクトで動かす形態は、コミュニティ事例(`urth-inc/cloudrun_voicevox`)が存在し慣行的には許容と読めるが、 **正式な公式見解の最新確認を強く推奨**

### 6.2 キャラクター別の論点

| キャラ | 用途 | クレジット表記(慣行) | 商用利用 | 追加論点 |
|---|---|---|---|---|
| ずんだもん | MIYU 用 | `VOICEVOX:ずんだもん` | 可、要クレジット表記 | 個別規約は zunko.jp 系で公開 |
| 青山龍星 | セバスチャン本命 | `VOICEVOX:青山龍星` | 可、要 CV 表記(条件次第で必須化との情報) | VirVox Project 規約あり、商品化前に詳細確認 |
| 玄野武宏 | セバスチャン副候補 | `VOICEVOX:玄野武宏` | 可、CV 表記推奨 | 青山龍星と同系統 |
| 四国めたん | (現在不採用、過去案) | `VOICEVOX:四国めたん` | 可、要クレジット表記 | キャラ変更で不使用、念のため記録 |

### 6.3 クレジット表記の実装位置(本書 §6 提案)

ベータ v1.0:
- **アプリ内「クレジット」画面**(設定 → クレジット)に全 VOICEVOX キャラのクレジット文字列を表示
- 各キャラ選択画面の小さなフッターにも `VOICEVOX:<キャラ名>` を表示
- 法的書類 v0.3 第8章 知的財産権 / 巻末「使用しているOSSとライセンス表示」と統合

仕様書 v1.5 への反映依頼候補(エルトン主導): 第8章 / 第6章 にクレジット表記の実装要件を追記。

### 6.4 「クレジット表記なし商用利用」の選択肢

調査結果として、クレジット表記なしで商用利用する場合は **キャラあたり ¥400,000(税別)のライセンス料** が必要との情報あり。

- ベータ v1.0: **クレジット表記で運用**(無料、本書本命)
- 商品化版: **クレジット表記で運用継続**(¥400,000 × 2キャラ = ¥800,000 の固定費は Phase 4 時点での収益見込みと釣り合わない見込み)

### 6.5 ライセンスのリスク管理

Sさん v0.3 §6 / §1.5 で言及された「青山龍星 話者の利用規約が将来変更 / 提供停止」リスクの対策として:

- 副候補 **玄野武宏** への切替を技術的に **メタデータ JSON 編集のみ** で可能にする(c) Drive レイアウト設計 §4.2 の `index.json` 設計と整合)
- 切替時の `coaching.md` 文言調整は Sさん 中核領域、interface としては speakerId 差し替えだけで動く

---

## 7. アクセス制御 / 認証

### 7.1 課題

- Cloud Run の VOICEVOX エンドポイントを **誰でも叩けるパブリック** にすると、悪意ある第三者が大量リクエストでたかしさんの請求を膨らませる可能性
- 「BYOK = ユーザーが API キーを持つ」モデル(法的書類 v0.3 §6.4)は **Gemini API キー** に関する話で、VOICEVOX は「運営者が運用する VOICEVOX」(Q10 確定、たかしさん負担)

### 7.2 候補と評価

| 候補 | 仕組み | ベータ適合度 |
|---|---|---|
| A. 完全パブリック | 認証なし | ❌ 請求リスク |
| **B. 共通シークレットヘッダ** | アプリビルドに埋め込んだトークンを `Authorization` ヘッダで送信 | **◎ ベータ本命**(シンプル、十分な抑止力) |
| C. Cloud Run Authentication(IAM) | ID トークン必須 | △ ベータでは過剰(全ユーザーが GCP プリンシパル要) |
| D. ユーザー OAuth トークン検証 | Google Sign-In トークンを自前検証 | △ 商品化版で検討 |
| E. Cloudflare Worker でレートリミット中継 | 中継 Worker でレート制限 + シークレット保護 | ◯ 商品化版の本命 |

### 7.3 ベータ v1.0 の本命: 案B + レート制限ガード

- アプリビルドに **共通シークレット**(GitHub Secrets 経由で配信、ユーザー DevTools で見えるが家族規模なら許容)
- Cloud Run 側で `Authorization: Bearer <token>` チェック → 一致しない場合 401
- Cloud Run の max-instances 上限(§3.2 で 5)で **金額の上限を構造的に固定**
- → 仮にシークレット漏洩で乱用されても、max-instances=5 × 月 30日 × 2 vCPU フル稼働 ≒ 月 $80 程度がワーストケース(請求上限を構造的に縛れる)

### 7.4 商品化版への進化パス

- 案E(Cloudflare Worker)で:
  - ユーザー単位のレート制限(例: 1分10合成、1日500合成)
  - シークレット保護(ブラウザに渡らない)
  - Origin チェック(自社ドメインからのみ受付)

---

## 8. デプロイパイプライン(GitHub Actions)

### 8.1 推奨構成

```
[GitHub repo: invokeaide-voicevox-deploy(または invokeaide のサブディレクトリ)]
├── Dockerfile                     ← VOICEVOX 公式イメージを FROM で参照
├── cloudbuild.yaml or workflow    ← Cloud Build or GitHub Actions
└── .github/workflows/deploy.yml   ← GitHub Actions
```

### 8.2 GitHub Actions ワークフロー(雛形)

```yaml
name: Deploy VOICEVOX to Cloud Run
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write          # Workload Identity Federation 用
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SA_EMAIL }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy voicevox-engine \
            --image=voicevox/voicevox_engine:0.26.x \
            --region=asia-northeast1 \
            --platform=managed \
            --cpu=2 \
            --memory=2Gi \
            --concurrency=4 \
            --timeout=60s \
            --min-instances=0 \
            --max-instances=5 \
            --cpu-boost \
            --no-allow-unauthenticated  # 案B のシークレットチェックは middleware で
```

### 8.3 Workload Identity Federation 推奨

- **SA key JSON を GitHub Secrets に置かない** 方が安全(漏洩時の被害甚大、ローテ運用が必要)
- WIF 設定で「この GitHub Actions ワークフローからのみ、この SA をなりすませる」と制約 → **長期シークレット不要**
- 初回設定は若干複雑だが、設定後の運用負荷は SA key 方式より低い
- → §9 C-2 で たかしさん準備事項として明示

---

## 9. たかしさん準備事項リスト(本書の主役)

### Block A: ライセンス確認(法務 / 規約)

| # | 項目 | 入手先(2026-05-19 時点) | 確認すべきこと |
|---|---|---|---|
| A-1 | VOICEVOX エンジン本体 利用規約 最新版 | https://voicevox.hiroshiba.jp/term/ | サーバーサイド配信形態(Cloud Run でホスト)が許諾範囲か、再配布禁止条項との整合 |
| A-2 | ずんだもん 個別規約 | zunko.jp 系の公式ページ | クレジット表記の正確な文字列、商用利用条件 |
| A-3 | 青山龍星 個別規約 | VirVox Project 公式 | CV 表記の必須 / 推奨条件、商用利用条件、表記文字列 |
| A-4 | 玄野武宏 個別規約 | VirVox Project 公式 | 同上(青山龍星 切替時の代替候補) |
| A-5 | クレジット表記実装位置の合意 | 仕様書 v1.5 / 法的書類 v0.4 連動 | 設定画面 + キャラ選択画面フッター + 巻末ライセンス表示で OK か |

**たかしさん作業の見込み時間**: A-1〜A-4 で 30-60 分の Web 調査、A-5 はエルトンと相談。

### Block B: Google Cloud アカウント

| # | 項目 | 内容 |
|---|---|---|
| B-1 | プロジェクト作成 | 「InvokeAide」名のプロジェクトを Google Cloud Console で作成。Novem Intelligence の組織を作るか、個人アカウント直下に作るかの判断 |
| B-2 | 課金アカウント紐付け | 既存の課金アカウントを使うか新規発行か。たかしさんの請求一元化観点で判断 |
| B-3 | 予算アラート | 月予算 $20(ベータ運用) / $50(商品化過渡期)で設定。50% / 90% / 100% で通知メール |
| B-4 | API 有効化 | Cloud Run API、Cloud Build API、IAM API、Artifact Registry API |
| B-5 | リージョン選定確認 | `asia-northeast1`(東京)で OK か、レイテンシ / 料金 / 規約面で別リージョン希望あるか |

**たかしさん作業の見込み時間**: 30 分。Cloud Console UI に慣れている前提。

### Block C: GitHub 連携準備

| # | 項目 | 内容 |
|---|---|---|
| C-1 | リポジトリ作成 | プライベートリポジトリ。Sさん v0.3 §1 によると GitHub Actions 採用済。InvokeAide メインリポジトリ内のサブディレクトリでも、別リポジトリでも可 |
| C-2 | Workload Identity Federation 設定 | 公式手順あり、Cloud Console / gcloud CLI で設定。具体的コマンドは別タスクで Uさん が起草、 たかしさん が実行 |
| C-3 | GitHub Secrets 設定 | `GCP_PROJECT_ID` / `GCP_WIF_PROVIDER`(WIF プロバイダリソース名) / `GCP_SA_EMAIL`(SA のメール) / `VOICEVOX_AUTH_TOKEN`(§7 案B の共通シークレット、`openssl rand -hex 32` で生成) |

**たかしさん作業の見込み時間**: WIF 初設定で 30-60 分。Uさん の手順書(別タスク)があれば短縮。

### Block D: ドメイン / 公開

| # | 項目 | 内容 |
|---|---|---|
| D-1 | Cloud Run 標準 URL でベータ開始 | `https://voicevox-engine-xxxx.a.run.app` のような自動生成 URL でベータ動作確認 |
| D-2 | カスタムドメイン判断 | 商品化版で `voicevox.invokeaide.app` 等を割り当てるか判断、ベータでは不要 |

**たかしさん作業の見込み時間**: 0 分(ベータでは D-1 のみで動く)、商品化版で 30-60 分。

---

## 10. リスク・トレードオフ

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | VOICEVOX 公式イメージのサーバーサイド配信形態が利用規約上グレーゾーン | 🟡 中 | A-1 で公式見解確認、必要なら公式コミュニティに照会 |
| 2 | 青山龍星 / 玄野武宏 の規約が将来変更 → セバスチャン音声差し替え必要 | 🟢 低 | §6.5 メタデータ JSON 編集のみで切替可能な設計、定期(半年に1度)の規約再確認 |
| 3 | Cloud Run コールドスタートで初回 UX 印象低下 | 🟡 中 | §5 Startup CPU Boost + Web Speech フォールバックで構造的吸収 |
| 4 | 共通シークレット漏洩で乱用 → 請求膨張 | 🟢 低 | max-instances=5 で月 $80 程度に構造的キャップ、検知 + シークレット再発行で対応 |
| 5 | 商品化 1,000 ユーザー想定で月 $42、 たかしさん × Sさん 想定「月 $10 程度」と乖離 | 🟡 中 | §11 Q-U-d-1 で判断仰ぎ、min-instances=0 維持 / Concurrency 引き上げ等で削減余地あり |
| 6 | WIF 初設定の学習コスト | 🟢 低 | Uさん が手順書起草 + Cloud Console GUI 中心で吸収 |
| 7 | VOICEVOX エンジンのバージョン固定方針(明示タグ)で、セキュリティパッチ追従が手動 | 🟢 低 | 定期(月1)のバージョン確認をたかしさん運用ルールに組み込み |
| 8 | Cloudflare Pages(アプリ) と Cloud Run(VOICEVOX) の Origin が異なるため CORS 設定必要 | 🟢 低 | Cloud Run 側で `Access-Control-Allow-Origin: <invokeaide ドメイン>` 設定、Uさん 実装範囲 |

---

## 11. たかしさんに判断を仰ぎたい事項

| # | 事項 | Uさん 感触 |
|---|---|---|
| Q-U-d-1 | 商品化試算 月 $42(本書 §4.2 B)を許容するか、それとも min-instances=0 維持 + Concurrency 引き上げ等で $20 以下に絞るか | **$42 許容 + 後で実測でチューニング** 推奨。ユーザー数増の良いシグナルなら $42 は許容範囲、悪いシグナル(無駄請求)なら原因を探って削減 |
| Q-U-d-2 | リージョンは `asia-northeast1`(東京)で OK か、`asia-northeast2`(大阪) / その他希望あるか | **東京** 推奨(レイテンシ最小、災害分散は商品化版で検討) |
| Q-U-d-3 | ベータでの認証方式は §7 案B(共通シークレットヘッダ)で OK か | **案B + max-instances 上限** 推奨、商品化版で案E(Cloudflare Worker 中継)に進化 |
| Q-U-d-4 | WIF + GitHub Actions 構成で OK か、Service Account Key 直接配置を望むか | **WIF 推奨** 、SA key より安全 + 長期メンテ楽 |
| Q-U-d-5 | Cloud Run プロジェクトのオーナーは Novem Intelligence 名義(将来法人化)か、たかしさん個人か | **個人で開始、法人化時に移管** 推奨。プロジェクト移管は GCP で公式サポートあり |
| Q-U-d-6 | クレジット表記なし運用(キャラあたり ¥400,000)は将来検討対象として残すか、明確に「クレジット表記運用継続」と確定するか | **クレジット表記運用継続** 推奨。投資効果より思想書「召喚」コンセプトとの整合(クレジットを見せること自体がキャラへの敬意)を重視 |
| Q-U-d-7 | 本書を Sさん にも共有して FE 側 TTSProvider 実装(VOICEVOX endpoint / 共通シークレット / Web Speech フォールバック)の Contract 議論を進めるか | **共有推奨** 。Sさん v0.3 §3 TTSProvider interface 起草の前提情報になる |

---

## 12. 副次的に気づいた課題

### 12.1 Sさん v0.3 §8 TTS フォールバック設計との連動

VOICEVOX が一時的に不通(Cloud Run 障害、ネットワーク、コールドスタート中)の場合、 **Web Speech フォールバック** に切り替わる。これは:
- TTSProvider interface(Sさん 起草)に `synthesize()` + `synthesizeFallback()` の二段構造を持たせる
- フロント側で「VOICEVOX 利用不可」を示すアイコン / トースト表示(キャラの「声が今ちょっと…」のような MIYU / セバスチャン キャラ整合コピー、Sさん 領域)

### 12.2 仕様書 v1.5 への反映依頼候補(エルトン主導)

- 仕様書 v1.5 第6章 / 第8章 にクレジット表記の実装要件を追記
- 仕様書 v1.5 第15章 セキュリティに「VOICEVOX 認証(共通シークレット)」を追記
- 法的書類 v0.4 第8章 / 巻末 OSS ライセンスに VOICEVOX 表記を組み込み

### 12.3 PC1 既存 MIYU との VOICEVOX 設定共有

現行 Claude 版 MIYU(Aさん・Bさん 領域)は VOICEVOX をローカルポート 50021 で起動している(CLAUDE.md 記述)。InvokeAide の Cloud Run VOICEVOX は別物。 **同じキャラ(ずんだもん / 青山龍星)を使う場合のクレジット表記は両方で必要**(エルトン経由で Aさん・Bさん に申し送り候補)。

### 12.4 規約の定期再確認運用

§6.5 / §10 リスク #2 への対応として、 **半年に1度の VOICEVOX 規約再確認** を運用ルール化することを提案。設定画面の隠しメニュー or memory に「次回規約確認: 2026-11-19」 等のリマインダーを置く。

### 12.5 Cloud Run の log 取り扱い

Cloud Run はリクエストログを自動で Cloud Logging に送る。 **音声合成リクエストには「ユーザーが入力した日本語テキスト」が含まれる** ため、 法的書類 v0.3 §6.5「通常運用において収集・保存しません」と矛盾しないようログ最小化が必要:
- HTTP Body をログに含めない設定
- Cloud Logging の保持期間を短く(30 日デフォルト)
- → Uさん 実装範囲、設定値で吸収

### 12.6 落とし穴集 v0.2 への追記候補

iOS Safari で Cloud Run の HTTPS 証明書 / CORS / Service Worker キャッシュとの相性は実機で要観察。落とし穴集 v0.2 改訂時の検証項目候補(§4 将来候補 §4.3 / §4.5 隣接)。

---

## 13. 完了報告(エルトン経由)

```
[Phase 2 Sprint 1 並列タスク 案A) Cloud Run 事前調査 完了報告]
完了日時: 2026-05-19(火)夕
所要時間: 約90分(調査 + 起草)
成果物のファイルパス:
  C:\dev\InvokeAide\docs\Phase2\Phase2_Cloud_Run_事前調査_v0.1_2026-05-19.md

主要な発見 / 判断:
  - VOICEVOX 公式 Docker イメージ採用 + Cloud Run 単独構成、サイドカー不要
  - リージョン asia-northeast1、CPU 2 vCPU / メモリ 2 GiB、Startup CPU Boost
  - ベータ家族規模はほぼ無料枠内、商品化 1,000 ユーザー想定で月 $42
    (スケジュール現実性評価 §7.3 の「月 $10 程度」想定との乖離を Q-U-d-1 で
     たかしさん判断に上げる)
  - 認証は §7 案B(共通シークレット + max-instances 上限)で構造的に
    請求キャップ、商品化版で Cloudflare Worker 中継に進化
  - VOICEVOX 規約は「クレジット表記で運用」本命、エンジン本体の サーバー
    配信形態がグレーゾーン → A-1 で公式見解確認推奨
  - GitHub Actions + Workload Identity Federation(SA key 不要)推奨
  - たかしさん準備事項リスト 4 Block(A:ライセンス / B:GCP / C:GitHub / D:ドメイン)

たかしさん準備事項(本書 §9 の見出し):
  Block A: ライセンス確認(A-1〜A-5、見込み 30-60 分)
  Block B: Google Cloud アカウント(B-1〜B-5、見込み 30 分)
  Block C: GitHub 連携準備(C-1〜C-3、見込み 30-60 分、WIF 手順書は別タスク)
  Block D: ドメイン(D-1 のみ、ベータでは 0 分)
  → 合計見込み 90-150 分のたかしさん作業、並列実行で 1-2 日に分散可能

Sさん との結合点(エルトン経由で Sさん に通知依頼):
  - Sさん TTSProvider interface 起草時の前提情報として本書を共有
    (VOICEVOX endpoint / 共通シークレット / Web Speech フォールバック仕様)
  - §12.1 二段フォールバック構造(synthesize / synthesizeFallback)の
    interface 設計検討依頼

推奨する次のアクション:
  - 本書レビュー、§11 Q-U-d-1〜Q-U-d-7(7点)のたかしさん判断
  - 並行: たかしさん側で Block A〜D の作業着手(本書 §9 リスト参照)
  - Uさん 次タスク:
      (案I)WIF + GitHub Actions の具体的手順書起草(たかしさん作業支援)
      (案II)VOICEVOX 規約 A-1〜A-4 のたかしさん調査支援(URL 整理 + 確認
            ポイントの読み上げ用テンプレート)
      (案III)Sさん contract 待ち継続中、別の独立タスク(キャラ選択 UI の
            事前調査、 iOS Safari 落とし穴集 §4 検証準備、 et al.)
    Uさん 感触: たかしさん作業のクリティカルパスを縮めるなら案I、 規約は
                たかしさん本人が読むのが筋なので案II は限定的、 Sさん 待ち中の
                並行価値は案I が最大

たかしさんに判断を仰ぎたい事項: 本書 §11 に 7点
副次的に気づいた課題: 本書 §12 に 6点
```

---

## 14. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火) | 初版作成。VOICEVOX エンジン選定 / Cloud Run 構成 / コスト試算 / コールドスタート / 規約整理 / 認証 / GitHub Actions WIF / たかしさん準備事項 4 Block / 判断仰ぎ 7点 / 情報源は 2026-05-19 時点の公式 / 一次情報源を Web 経由で参照 | Uさん(Opus) |

---

## 15. 情報源(2026-05-19 時点)

本書の調査情報は以下を参照(リンクは記録、内容は時間で変動するため採用前にたかしさんが最新確認):

- VOICEVOX エンジン GitHub: `https://github.com/VOICEVOX/voicevox_engine`
- VOICEVOX エンジン Docker Hub: `https://hub.docker.com/r/voicevox/voicevox_engine`
- VOICEVOX 公式利用規約: `https://voicevox.hiroshiba.jp/term/`
- Cloud Run 価格(公式): `https://cloud.google.com/run/pricing`
- Cloud Run コールドスタート / Startup CPU Boost: Google Cloud 公式ブログ
- 参考実装: `https://github.com/urth-inc/cloudrun_voicevox`
- VOICEVOX × Cloud Run 実装記事: zenn.dev urth 「Cloud Runのサイドカー構成で実現する高性能音声合成」
- VOICEVOX 規約解説(コミュニティ): note / blue-r 等(ただし非公式、公式に当たること)

---

**以上、Uさん 案A) Cloud Run 事前調査 v0.1。§11 判断 7 点と §9 たかしさん準備事項リストを待ちつつ、次タスク(案I 推奨)を提案。**
