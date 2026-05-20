# Phase 2 Workload Identity Federation × GitHub Actions 手順書 v0.1

**作成日**: 2026-05-19(火)夜
**起草者**: Uさん(Opus、実装補助担当)
**位置づけ**: たかしさん作業 Block C(GitHub 連携準備、Cloud Run 事前調査 §9 C-1〜C-3) を **15-30 分で完走** するための具体手順書
**対象読者**: たかしさん本人(マウス不使用 / 概念理解優先 / キーボードショートカット優先)
**前提**:
- Phase2_Cloud_Run_事前調査_v0.1_2026-05-19.md(本書の母体)
- §11 Q-U-d-3 / Q-U-d-4 確定:認証 案B + WIF + SA key 不要
- §12.5 Cloud Run ログ最小化(法的書類 v0.3 §6.5 整合)を本書に組み込み

**本書の方針**:
- CLI(`gcloud` コマンド)中心で書く。マウスでクリックする手順を最小化
- 各コマンドに **「これは何をしているか」** を一行注記(概念理解優先)
- bash 構文で書くが、PowerShell でも変数代入だけ書き換えれば動く(§4.3 補足)
- 各ステップに **チェックポイント**(成功確認の `gcloud ... list` 等)
- トラブルシューティング 5 件で「詰まりやすい所」を先回り

---

## 0. エグゼクティブ・サマリ

### 0.1 全体の流れ(俯瞰)

```
[Step 0] gcloud CLI 入っていますか? 入っていなければ §3 でインストール
   ↓
[Step 1〜2] 変数定義 → API 有効化               (1 ファイル + 2 コマンド)
   ↓
[Step 3〜4] Service Account 作成 → 権限付与    (4 コマンド)
   ↓
[Step 5〜6] WIF Pool / Provider 作成            (2 コマンド)
   ↓
[Step 7] SA と WIF を bind                       (1 コマンド)
   ↓
[Step 8] GitHub Secrets に登録する値を確認       (1 echo)
   ↓
[Step 9] GitHub Secrets 設定(Web UI 必須、3 値) (1-2 分)
   ↓
[Step 10] VOICEVOX_AUTH_TOKEN 生成(1 コマンド)
   ↓
[動作確認] 最小テストワークフローで認証通過確認   (§7)
```

### 0.2 想定時間

- 初回:**15-30 分**(本書 §6 の Step 1〜10 を順番通り)
- 慣れた後:**5-10 分**(再構築時)

### 0.3 完了時に手元にある状態

- Cloud Run にデプロイできる Service Account 1 個(`github-deployer@...`)
- WIF Pool / Provider 1 個ずつ
- GitHub Secrets 4 件(`GCP_PROJECT_ID` / `GCP_SA_EMAIL` / `GCP_WIF_PROVIDER` / `VOICEVOX_AUTH_TOKEN`)
- 最小テストワークフローが GitHub Actions で成功する状態

---

## 1. なぜ WIF を使うのか(2 分で読める概念整理)

### 1.1 従来方式(SA key)の問題

```
従来:
[GitHub Actions] ──── Service Account の JSON Key を送信 ────▶ [Google]
                       ↑
                       この JSON Key を GitHub Secrets に置く
                       漏洩したら誰でも GCP に成り済まし可能
                       定期ローテが必要(運用負荷)
```

### 1.2 WIF 方式の改善

```
WIF:
[GitHub Actions] ── OIDC トークン(短命) ─▶ [Google: WIF Provider]
                                                    │
                                                    │「このトークンは
                                                    │  確かに GitHub Actions
                                                    │  が発行した」と検証
                                                    │
                                                    ▼
                                          [Service Account を一時的に貸す]
                                                    │
                                                    ▼
                                              [Cloud Run deploy]
```

**たかしさんが理解すべき要点**:

| 観点 | SA key 方式 | **WIF 方式** |
|---|---|---|
| 長期シークレット | 必要(JSON Key) | **不要** |
| 漏洩リスク | 高(Key の生存期間 = 漏洩したら誰でも使える) | **低(OIDC token は 1 時間で失効)** |
| 権限を絞れる粒度 | 「SA を持っている人」全員 | **「特定 GitHub repo + 特定ブランチ」だけ** |
| 初回設定の手間 | 軽い | やや重い(本書の Step 5〜7) |
| 運用負荷 | 重い(Key ローテ) | **軽い(設定したらおしまい)** |

→ **設定 1 回の重さを払って、運用負荷ゼロを買う** という設計。

---

## 2. 前提条件チェック

以下が **すべて Yes** ならこの先に進めます。

| # | 確認項目 | チェック方法 |
|---|---|---|
| 1 | Google Cloud プロジェクトを作成済み | Cloud Run 事前調査 §9 Block B-1 完了 |
| 2 | プロジェクトに課金アカウントを紐付け済み | 同 B-2 完了 |
| 3 | GitHub のプライベートリポジトリを作成済み | Cloud Run 事前調査 §9 C-1 完了 |
| 4 | リポジトリのフルパス(`owner/repo` 形式)が分かる | 例: `takashi-username/invokeaide-voicevox` |
| 5 | ローカルマシンに `gcloud` CLI が入っている | `gcloud --version` で確認、なければ §3 |
| 6 | GitHub の Settings → Secrets and variables → Actions に書き込み権限がある | リポジトリオーナーなら OK |

**1〜4 が未完了** の場合、先に Cloud Run 事前調査 §9 Block B / C-1 を完了してください。

---

## 3. gcloud CLI のインストール(済みなら飛ばす)

Windows でのインストール:

### 3.1 公式インストーラー(推奨)

1. `https://cloud.google.com/sdk/docs/install` を開く
2. Windows 用インストーラー(`GoogleCloudSDKInstaller.exe`)をダウンロード
3. 実行 → 既定設定で進む(管理者権限を求められたら許可)
4. インストール完了画面で「`gcloud init` を実行」のチェックを **入れたまま** 完了
5. ターミナルが開き、Google アカウントへのログインを求められる → ブラウザで承認 → プロジェクトを選択

### 3.2 確認

```bash
gcloud --version
```

`Google Cloud SDK 4XX.0.0` のようなバージョンが表示されれば OK。

### 3.3 ログイン状態の確認

```bash
gcloud auth list
gcloud config list project
```

`ACTIVE  ACCOUNT` 行にたかしさんのメールが、`project = invokeaide` のような行が出れば OK。
プロジェクトが違う場合は `gcloud config set project <YOUR_PROJECT_ID>` で切替。

---

## 4. 変数の事前定義(本書全体で使う)

### 4.1 bash の場合

ターミナルを開いて、以下を **コピペして編集** してから実行(`<...>` 部分を埋める):

```bash
# === 編集が必要な変数 ===
export PROJECT_ID="invokeaide"                              # GCP プロジェクト ID
export GITHUB_REPO="<github-username>/<repo-name>"          # 例: takashi/invokeaide-voicevox
export REGION="asia-northeast1"                             # Cloud Run リージョン(東京)

# === 編集不要(本書既定値)===
export SA_NAME="github-deployer"                            # GitHub から使う SA の名前
export POOL_NAME="github-pool"                              # WIF プール名
export PROVIDER_NAME="github-provider"                      # WIF プロバイダ名

# === 自動取得(編集不要)===
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
```

### 4.2 チェックポイント

```bash
echo "PROJECT_ID=$PROJECT_ID"
echo "PROJECT_NUMBER=$PROJECT_NUMBER"
echo "GITHUB_REPO=$GITHUB_REPO"
echo "SA_EMAIL=$SA_EMAIL"
```

- 全部に値が入っている = OK
- `PROJECT_NUMBER` が空 = プロジェクト名のスペルミス、または gcloud のログイン未完了 → §3.3 戻る

### 4.3 PowerShell の場合(補足)

PowerShell では `export VAR=value` の代わりに `$env:VAR = "value"` を使う:

```powershell
$env:PROJECT_ID = "invokeaide"
$env:GITHUB_REPO = "<github-username>/<repo-name>"
$env:REGION = "asia-northeast1"
$env:SA_NAME = "github-deployer"
$env:POOL_NAME = "github-pool"
$env:PROVIDER_NAME = "github-provider"
$env:PROJECT_NUMBER = (gcloud projects describe $env:PROJECT_ID --format='value(projectNumber)')
$env:SA_EMAIL = "$($env:SA_NAME)@$($env:PROJECT_ID).iam.gserviceaccount.com"
```

以降の本書の `$VAR` は PowerShell では `$env:VAR` に読み替え。

---

## 5. 必要な API を有効化

### 5.1 コマンド

```bash
# IAM Credentials API: WIF で発行されたトークンを使うために必要
# Cloud Resource Manager API: プロジェクト情報の参照に必要
# IAM API: Service Account / Pool / Provider 管理に必要
# Cloud Run Admin API: Cloud Run のデプロイに必要
# Cloud Build API: コンテナビルド(将来必要なら)に必要
# Artifact Registry API: コンテナイメージの保管に必要

gcloud services enable \
    iamcredentials.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    --project=$PROJECT_ID
```

### 5.2 チェックポイント

```bash
gcloud services list --enabled --project=$PROJECT_ID --filter="name:(iamcredentials OR run OR iam OR cloudresourcemanager OR cloudbuild OR artifactregistry)"
```

6 件すべてが `ENABLED` 状態なら OK。実行に **2-3 分** かかることがある(API 有効化はバックエンド処理あり)。

---

## 6. Step-by-Step 本編

### Step 1: Service Account を作成

**意味**: GitHub Actions が「成り済ます」相手となる、専用の Service Account(SA)。デプロイ専用で他の権限は持たせない。

```bash
gcloud iam service-accounts create $SA_NAME \
    --display-name="GitHub Actions deployer (Cloud Run for VOICEVOX)" \
    --project=$PROJECT_ID
```

**チェックポイント**:

```bash
gcloud iam service-accounts list --project=$PROJECT_ID --filter="email:$SA_EMAIL"
```

→ `github-deployer@invokeaide.iam.gserviceaccount.com` が表示されれば OK。

---

### Step 2: SA に必要な権限を付与

**意味**: この SA に「Cloud Run の管理」「他の SA を装う(deploy 時に必要)」「Artifact Registry へのイメージ書き込み」の3つだけ与える。**最小権限の原則**。

```bash
# Cloud Run の管理権限(deploy / 更新 / 削除)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.admin"

# Cloud Run の deploy 時、内部的に SA を actAs する必要があるため
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

# Artifact Registry にコンテナイメージを push する権限
# (公式 voicevox イメージをそのまま使う場合は不要だが、将来カスタムビルド時に必要)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/artifactregistry.writer"
```

**チェックポイント**:

```bash
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:${SA_EMAIL}" \
    --format="table(bindings.role)"
```

`roles/run.admin` / `roles/iam.serviceAccountUser` / `roles/artifactregistry.writer` の 3 行が出れば OK。

---

### Step 3: Workload Identity Pool を作成

**意味**: 外部 ID プロバイダ(今回は GitHub)からの認証要求を受け止める「窓口」。プロジェクトに 1 つあれば十分。

```bash
gcloud iam workload-identity-pools create $POOL_NAME \
    --location="global" \
    --display-name="GitHub Actions pool" \
    --project=$PROJECT_ID
```

**チェックポイント**:

```bash
gcloud iam workload-identity-pools list --location="global" --project=$PROJECT_ID
```

`github-pool` が `ACTIVE` で出れば OK。

---

### Step 4: Workload Identity Provider を作成(GitHub OIDC)

**意味**: 上で作った Pool の中に、「GitHub Actions の OIDC token を信頼する」設定を作る。`attribute-condition` で **特定の GitHub ユーザー / Organization からの要求だけ受け入れる** ように絞る(セキュリティの肝)。

```bash
# attribute-condition の "<github-username-or-org>" を、自分の GitHub ユーザー名 or Org 名に置き換えること

GITHUB_OWNER=$(echo $GITHUB_REPO | cut -d'/' -f1)

gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
    --location="global" \
    --workload-identity-pool=$POOL_NAME \
    --display-name="GitHub Actions provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository_owner=='${GITHUB_OWNER}'" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --project=$PROJECT_ID
```

**ポイント**:
- `attribute-mapping`: GitHub OIDC token の中身を Google 側の属性にマッピング(`repository_owner`、`repository`、`ref` の3つを取り出している)
- `attribute-condition`: Google が「この OIDC token を受け入れるか」を決める条件式 → 上記は **「リポジトリのオーナー名が `$GITHUB_OWNER` と一致するなら受け入れる」**
- `issuer-uri`: GitHub OIDC の固定 URL(変えない)

**チェックポイント**:

```bash
gcloud iam workload-identity-pools providers list \
    --workload-identity-pool=$POOL_NAME \
    --location="global" \
    --project=$PROJECT_ID
```

`github-provider` が出れば OK。

---

### Step 5: Service Account に WIF プリンシパルを bind

**意味**: 「**特定リポジトリ** で動く GitHub Actions だけが、この SA を装える」ように絞り込む。Step 4 はオーナー単位だったが、ここでは **リポジトリ単位** までさらに絞る。

```bash
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}" \
    --project=$PROJECT_ID
```

**ポイント**:
- `principalSet://...attribute.repository/${GITHUB_REPO}` の部分が「`takashi/invokeaide-voicevox` から発行された OIDC token だけ受け入れる」を意味する
- 別リポジトリから OIDC token が来ても、ここで弾かれる

**チェックポイント**:

```bash
gcloud iam service-accounts get-iam-policy $SA_EMAIL --project=$PROJECT_ID
```

`role: roles/iam.workloadIdentityUser` の bindings に、上の `principalSet://...` が **完全一致** で含まれていれば OK。

---

### Step 6: GitHub Secrets に登録する値を取得

**意味**: 次のステップで GitHub の Web UI に貼り付ける値を、確実な形で表示する。

```bash
echo ""
echo "=== GitHub Secrets に登録する値 ==="
echo ""
echo "GCP_PROJECT_ID:"
echo "  $PROJECT_ID"
echo ""
echo "GCP_SA_EMAIL:"
echo "  $SA_EMAIL"
echo ""
echo "GCP_WIF_PROVIDER:"
echo "  projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"
echo ""
echo "===================================="
```

**ポイント**: `GCP_WIF_PROVIDER` の値は **完全リソース名(`projects/...` で始まる長い文字列)** 。 ID だけ(`github-provider`)ではないので注意。

---

### Step 7: GitHub Secrets を設定(Web UI、3 値)

ここだけはマウス操作またはキーボードでブラウザ操作:

1. ブラウザで GitHub のリポジトリページを開く
2. `Settings` タブ(キーボード: `T S`(GitHub のショートカット)or 直接 `/settings` を URL に追加)
3. 左サイドバー → `Secrets and variables` → `Actions`
4. `New repository secret` ボタン(または `n` キーで一覧操作可)
5. 以下 3 件を順に登録:

| Name | Value |
|---|---|
| `GCP_PROJECT_ID` | Step 6 で表示された `PROJECT_ID` 値 |
| `GCP_SA_EMAIL` | Step 6 で表示された `SA_EMAIL` 値 |
| `GCP_WIF_PROVIDER` | Step 6 で表示された `GCP_WIF_PROVIDER` 値(`projects/...` で始まる長い文字列) |

**チェックポイント**: `Repository secrets` 一覧に 3 件出ていれば OK。値は伏せられるが、Name が確認できれば十分。

---

### Step 8: VOICEVOX_AUTH_TOKEN を生成

**意味**: Cloud Run 事前調査 §7 案B「共通シークレット」。アプリビルド時に埋め込み、Cloud Run 側でヘッダ検証に使う共通の乱数文字列。

```bash
VOICEVOX_AUTH_TOKEN=$(openssl rand -hex 32)
echo ""
echo "=== VOICEVOX_AUTH_TOKEN(GitHub Secrets に登録)==="
echo ""
echo "$VOICEVOX_AUTH_TOKEN"
echo ""
echo "================================================="
```

**注意**: この値は **画面に1回だけ表示** され、後で再表示する仕組みは作らない。**この場で GitHub Secrets に貼ること**:

- GitHub Secrets 名: `VOICEVOX_AUTH_TOKEN`
- 値: 上で表示された 64 文字の 16 進数

万が一控え忘れた場合は、もう一度 `openssl rand -hex 32` を実行して新しい値を生成 → GitHub Secrets を上書き → Cloud Run 側も次回デプロイで自動的に新値に追従(まだデプロイしていないなら何もしなくて OK)。

**Windows ネイティブで openssl が無い場合**:

```powershell
# PowerShell の代替コマンド
[byte[]]$bytes = New-Object byte[] 32
([System.Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
```

---

## 7. 動作確認(最小テスト workflow)

### 7.1 確認用のワークフロー雛形

リポジトリに `.github/workflows/test-wif.yml` を作成:

```yaml
name: Test WIF Authentication
on:
  workflow_dispatch:  # 手動トリガー(自動実行はさせない)

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write       # WIF で OIDC token を発行する権限(必須)
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud (WIF)
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SA_EMAIL }}

      - name: Setup gcloud
        uses: google-github-actions/setup-gcloud@v2

      - name: Verify identity
        run: |
          echo "=== Authenticated as ==="
          gcloud auth list
          echo ""
          echo "=== Project ==="
          gcloud config get-value project
          echo ""
          echo "=== Service Accounts (read-only test) ==="
          gcloud iam service-accounts list --project=${{ secrets.GCP_PROJECT_ID }}
```

### 7.2 実行手順

1. リポジトリの `Actions` タブ → 左に `Test WIF Authentication` が出る
2. `Run workflow` ボタン → ブランチ `main` を選択 → 実行
3. ワークフローのログを開く

### 7.3 成功時の表示

`Verify identity` ステップで:

```
Authenticated as: github-deployer@invokeaide.iam.gserviceaccount.com
Project: invokeaide
Service Accounts (read-only test): (一覧が表示される)
```

→ **WIF 認証が成立した証拠**。これで本番の Cloud Run デプロイワークフローを書ける状態に到達。

### 7.4 失敗時の対処

§9 トラブルシューティング参照。

---

## 8. Cloud Run ログ最小化の設定(§12.5 反映)

Cloud Run 事前調査 §12.5 で記載した「ログには日本語の発話テキストが含まれる可能性 → 法的書類 v0.3 §6.5 整合のためログ最小化」の具体実装。**本ステップはここでは設定の指針のみ記載し、実際のデプロイ時(Cloud Run deploy ワークフロー作成時)に組み込む**。

### 8.1 標準ログの内容(2026-05-19 時点 Cloud Run 仕様)

Cloud Run の **標準アクセスログ** には:
- リクエスト URL / メソッド / ステータスコード / レイテンシ / リクエスト ID は含まれる
- **HTTP リクエストボディ(発話テキスト)は含まれない** が、URL クエリパラメータは含まれる

→ VOICEVOX エンジンは発話テキストを **HTTP POST ボディ** で送る形式(`/audio_query` エンドポイント等)なので、 **標準ログには発話テキストは入らない**(本書の方針: POST ボディで送る、クエリパラメータには載せない、を Sさん の TTSProvider 実装側でも遵守してもらう)

### 8.2 Cloud Logging の保持期間を短くする

デフォルトの `_Default` ログバケットは保持期間 30 日。これは Cloud Run 事前調査の方針として現状維持で OK だが、明示的に確認:

```bash
gcloud logging buckets describe _Default \
    --location=global \
    --project=$PROJECT_ID
```

`retentionDays: 30` 程度なら OK。長い場合(例: 365 日)は短縮検討:

```bash
gcloud logging buckets update _Default \
    --location=global \
    --retention-days=30 \
    --project=$PROJECT_ID
```

### 8.3 Cloud Run deploy 時のフラグ(将来のデプロイワークフロー用、本書では設定のみ記録)

実際の Cloud Run deploy コマンドに付ける推奨フラグ:

```bash
gcloud run deploy voicevox-engine \
    --image=voicevox/voicevox_engine:0.26.x \
    --region=$REGION \
    --no-allow-unauthenticated \
    --memory=2Gi \
    --cpu=2 \
    --cpu-boost \
    --concurrency=4 \
    --timeout=60s \
    --min-instances=0 \
    --max-instances=5
```

**ポイント**:
- `--no-allow-unauthenticated` だが、Cloud Run 側の IAM 認証ではなく **アプリレベルの共通シークレット**(`VOICEVOX_AUTH_TOKEN`)で認証する設計のため、これは Cloud Run deploy 時に少し書き換える(別タスク「DriveStorage / Cloud Run deploy ワークフロー設計」で詳述)
- ログ最小化のための **本書時点での確実な選択肢は §8.2 保持期間** 。アクセスログそのものを止めることは可能だが、デバッグ性とのトレードオフで現状維持を推奨

### 8.4 後で再確認するチェックリスト

VOICEVOX 実デプロイ時に以下を確認:
- [ ] 発話テキストは POST ボディで送られているか(URL クエリに載っていないか)
- [ ] アプリ側 `console.log` で発話テキストを print していないか(Cloud Logging に流出する)
- [ ] Cloud Logging 保持期間が 30 日以下か

---

## 9. トラブルシューティング(よくある失敗 5 件)

### 9.1 「Permission denied to impersonate the service account」エラー

**症状**: GitHub Actions のログで `Permission 'iam.serviceAccounts.getAccessToken' denied on resource`

**原因**:
- (a) Step 5 の WIF プリンシパル bind で `GITHUB_REPO` のスペルミス
- (b) WIF プロバイダの `attribute-condition` で別オーナーを設定してしまった
- (c) GitHub repo のフルパス(`owner/repo`)を Step 5 に渡していない

**対処**:
1. 設定値を確認:
   ```bash
   gcloud iam service-accounts get-iam-policy $SA_EMAIL --project=$PROJECT_ID
   ```
   `principalSet://...attribute.repository/<owner>/<repo>` が **正しい値** か確認
2. ズレていれば bind を削除して再実行:
   ```bash
   gcloud iam service-accounts remove-iam-policy-binding $SA_EMAIL \
       --role="roles/iam.workloadIdentityUser" \
       --member="principalSet://...(古い値)" \
       --project=$PROJECT_ID
   ```
   → Step 5 を正しい値で再実行

### 9.2 「The given credential is rejected by the attribute condition」エラー

**症状**: GitHub Actions のログで `the given credential is rejected by the attribute condition`

**原因**: Step 4 の `attribute-condition` で指定した `GITHUB_OWNER` と、実際のリポジトリオーナーが一致していない

**対処**:
1. リポジトリオーナーを確認(GitHub の URL `github.com/<owner>/<repo>` の `<owner>` 部分)
2. 既存のプロバイダを更新:
   ```bash
   gcloud iam workload-identity-pools providers update-oidc $PROVIDER_NAME \
       --location="global" \
       --workload-identity-pool=$POOL_NAME \
       --attribute-condition="assertion.repository_owner=='<正しいオーナー名>'" \
       --project=$PROJECT_ID
   ```

### 9.3 「id-token: write permission missing」エラー

**症状**: GitHub Actions のログで `Failed to get OIDC token` または `permissions: id-token: write` 関連

**原因**: ワークフロー YAML に `permissions: id-token: write` を書き忘れている

**対処**: ワークフローファイルの `jobs:` 直下またはジョブ単位に以下を追加:

```yaml
permissions:
  contents: read
  id-token: write
```

`permissions` がデフォルトの場合、組織レベルで `id-token` がブロックされている可能性もある(GitHub Org の Settings → Actions → General → Workflow permissions)。

### 9.4 「Service Account does not exist」エラー(Step 5)

**症状**: Step 5 で `Resource github-deployer@... was not found`

**原因**: Step 1 が完了していない / プロジェクトが違う

**対処**:
```bash
gcloud iam service-accounts list --project=$PROJECT_ID --filter="email:$SA_EMAIL"
```
で SA が見えない場合、Step 1 から再実行。プロジェクトの一致も確認:
```bash
echo $PROJECT_ID
gcloud config get-value project
```

### 9.5 「API has not been used in project ...」エラー(Step 3 / Step 4)

**症状**: `Cloud Identity API has not been used in project before or it is disabled`

**原因**: Step 5(本書の §5)の API 有効化が反映されるまで時間がかかる(API 有効化はバックエンドで非同期処理)

**対処**:
- 2〜3 分待って再実行
- それでも出る場合は明示的に IAM API を有効化:
  ```bash
  gcloud services enable iam.googleapis.com --project=$PROJECT_ID
  ```

---

## 10. 完了確認チェックリスト

すべて Yes なら **Block C 完走**:

- [ ] §3 `gcloud --version` が動く
- [ ] §4 変数定義で `echo` すべてに値が入っている
- [ ] §5 6 つの API が有効化済み
- [ ] §6 Step 1: SA `github-deployer@...` が `gcloud iam service-accounts list` に出る
- [ ] §6 Step 2: SA に 3 つのロール(`run.admin` / `serviceAccountUser` / `artifactregistry.writer`)が付いている
- [ ] §6 Step 3: WIF Pool `github-pool` が ACTIVE
- [ ] §6 Step 4: WIF Provider `github-provider` が作成済み、`attribute-condition` が正しい
- [ ] §6 Step 5: SA に WIF プリンシパルが bind されている(`principalSet://...` が SA IAM ポリシーに含まれる)
- [ ] §6 Step 6: 3 つの値が手元にある(`GCP_PROJECT_ID` / `GCP_SA_EMAIL` / `GCP_WIF_PROVIDER`)
- [ ] §7 GitHub Secrets に 4 件登録済み(上 3 件 + `VOICEVOX_AUTH_TOKEN`)
- [ ] §7 動作確認ワークフローが緑(✅ 成功)

---

## 11. 次のステップ(エルトン経由で Uさん 次タスクへ)

本書 Block C 完走後の流れ:

1. **Uさん 次タスク候補**:
   - VOICEVOX Dockerfile + Cloud Run deploy ワークフロー(`.github/workflows/deploy-voicevox.yml`)起草
   - Sさん TTSProvider interface 確定起草の受領後、Uさん DriveStorage 実装設計に着手
2. **たかしさん 並行作業**:
   - Block A(VOICEVOX ライセンス確認)
   - Block B(GCP プロジェクト周辺の細部、予算アラート設定など)
   - Block D(ベータでは不要、商品化版で)
3. **Sさん との結合点**:
   - TTSProvider interface に `VOICEVOX_AUTH_TOKEN` を Authorization ヘッダで送るパスを含める
   - 二段フォールバック(synthesize / synthesizeFallback) — Cloud Run 事前調査 §12.1

---

## 12. 副次的に気づいた課題

### 12.1 GitHub Org でリポジトリを持つ場合の attribute-condition

Step 4 の `attribute-condition` を「個人ユーザー名」基準にしているが、 **将来 Novem Intelligence の GitHub Organization にリポジトリを移管する場合は `repository_owner` 値が変わる** ため、 §9.2 の手順で `attribute-condition` を更新する必要あり。移管時の手順書を別途用意する候補(エルトン経由でリマインダー化を提案)。

### 12.2 GitHub Environments の併用余地

GitHub の Environments 機能(`production` 環境への手動承認ゲート等)を併用すると、 `attribute.environment` を `attribute-condition` に追加して **「production 環境のデプロイのみ Cloud Run prod に届く」** ように絞れる。本書ベータでは過剰、商品化版で再検討。

### 12.3 「個人プロジェクト → 法人プロジェクト」移管時の影響

Q-U-d-5 確定で「個人で開始 → 法人化時に移管」方針。プロジェクト移管時に **WIF Pool / Provider / SA は移管先プロジェクトに作り直しが必要** (プロジェクトリソースなので)。移管時の移行手順も別途。

### 12.4 仕様書 v1.5 への反映依頼候補

- 仕様書 v1.5 第15章(セキュリティ)に「Cloud Run デプロイの WIF 方式」「SA key を持たない」運用方針を追記
- 仕様書 v1.5 第26章(配信インフラ)に Cloud Run デプロイパイプラインの概略を追加

### 12.5 Cloud Run deploy ワークフローを書く時のテンプレ

本書 §7 の最小テストワークフローを **テンプレ化して docs/Phase2/ に置いておく** と、Uさん が後続でデプロイワークフローを書く時の出発点になる。これは Uさん 次タスク内で吸収予定。

---

## 13. 完了報告(エルトン経由)

```
[Phase 2 Sprint 1 案I) WIF + GitHub Actions 手順書起草 完了報告]
完了日時: 2026-05-19(火)夜
所要時間: 約75分(想定 60-90分内)
成果物のファイルパス:
  C:\dev\InvokeAide\docs\Phase2\Phase2_WIF_GitHub_Actions_手順書_v0.1_2026-05-19.md

主要な発見 / 判断:
  - 全 10 ステップ(変数定義 → API → SA → 権限 → Pool → Provider → Bind →
    値取得 → GitHub Secrets → AUTH_TOKEN)を CLI 中心で組み立て、各コマンドに
    「何をしているか」一行注記
  - PowerShell 環境への補足(§4.3)で Windows 親和性
  - WIF の概念整理(§1)で「なぜ SA key より安全か」をたかしさん向けに 2 分で
    把握できるよう構成
  - 動作確認ワークフロー(§7)で「最小テスト → 緑」をゴール化、本番デプロイ
    前のチェックポイント明確化
  - §12.5 Cloud Run ログ最小化を §8 で組み込み(発話テキストは POST ボディで
    送るため標準ログには載らないことを確認、保持期間 30 日推奨)
  - トラブルシューティング 5 件で「permission denied / attribute condition /
    id-token / SA 不存在 / API 未有効化」の代表的ハマりを先回り
  - 完了確認チェックリスト 11 項目で「Block C 完走判定」を明確化

たかしさん向け配慮:
  - CLI 中心、マウス操作は GitHub Secrets 設定の §7 のみ
  - 各コマンドに「これは何をしているか」一行注記(概念理解優先)
  - bash / PowerShell 両方記載(§4.3)
  - 想定時間 15-30 分(エルトン要件「30-60分 → 15-30分」達成)

Sさん との結合点(エルトン経由で Sさん に通知依頼なし、Sさん 並列領域なし):
  - 本書は WIF 設定が中心で Sさん contract と独立
  - ただし §11.3 で Sさん TTSProvider 設計に VOICEVOX_AUTH_TOKEN を
    Authorization ヘッダで載せる前提を申し送り(Cloud Run 事前調査 §7 §12.1
    とセットで Sさん に既共有済み)

推奨する次のアクション:
  - 本書のたかしさんレビュー(完了確認チェックリスト §10 の項目意図確認)
  - たかしさん Block C 着手(B-1〜B-4 / C-1 完了後、本書順に 15-30 分)
  - Uさん 次タスク候補:
      (案α)Cloud Run deploy ワークフロー(.github/workflows/deploy-voicevox.yml)
            の本番版起草 — 本書 §7 テストワークフローのプロダクション版、
            VOICEVOX_AUTH_TOKEN ヘッダ検証 middleware も含む
      (案β)Sさん TTSProvider interface 確定起草を待ちつつ、 DriveStorage
            実装の前準備(Drive REST API クライアント基礎クラスのスケッチ)
      (案γ)Cloud Run deploy 時の Dockerfile + service.yaml.template 起草
    Uさん 感触: 案α 推奨。本書 §7 テストWFと地続き、たかしさんが Block C
                完了次第すぐ動かせる、§4-1 クリティカルパスを最大短縮

たかしさんに判断を仰ぎたい事項: なし(本書は手順書、判断点は含まない)
副次的に気づいた課題: 本書 §12 に 5点
```

---

## 14. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火)夜 | 初版作成。全 10 ステップ + WIF 概念整理 + 動作確認 WF + Cloud Run ログ最小化 + トラブルシュート 5件 + 完了チェックリスト 11項目 | Uさん(Opus) |

---

**以上、Uさん 案I) WIF + GitHub Actions 手順書 v0.1。たかしさん Block C 着手を 15-30 分で完走可能な状態にした。次タスク 案α 推奨で続行可。**
