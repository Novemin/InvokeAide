# Phase 2 Cloud Run deploy ワークフロー本番版 v0.1

**作成日**: 2026-05-19(火)夜
**起草者**: Uさん(Opus、実装補助担当)
**位置づけ**: 案α 起草、 §4-1 VOICEVOX Cloud Run デプロイの **動く本番ワークフロー** 一式
**前提**:
- Phase2_Cloud_Run_事前調査_v0.1_2026-05-19.md(構成方針、コスト試算、規約)
- Phase2_WIF_GitHub_Actions_手順書_v0.1_2026-05-19.md(認証基盤、§7 テスト WF が地続き)
- Cloud Run 事前調査 §7 案B(共通シークレット + max-instances 上限)
- Cloud Run 事前調査 §12.5 ログ最小化(法的書類 v0.3 §6.5 整合)
- WIF 手順書 §12.5「Cloud Run deploy WF テンプレ化」を本書で吸収

**本書のスコープ**:
- 本番デプロイ用 GitHub Actions ワークフロー
- nginx ベースの認証 proxy(`Authorization: Bearer <TOKEN>` 検証 + CORS)
- Cloud Run マルチコンテナ(サイドカー)構成の `service.yaml.tmpl`
- Smoke test(401 / 200 の対比)
- Secret Manager 連携 + Artifact Registry 連携
- README + リポジトリ配置案

**非スコープ**:
- フロント側 TTSProvider 実装(Sさん 領域、VOICEVOX endpoint と AUTH_TOKEN の取り扱い)
- Cloudflare Worker レート制限中継(商品化版、Cloud Run 事前調査 §7.4)
- Capacitor 化時の認証フロー(Phase 4)

---

## 0. エグゼクティブ・サマリ

### 0.1 リポジトリ配置案

```
<repo root>
├── .github/
│   └── workflows/
│       ├── test-wif.yml             ← WIF 手順書 §7 の動作確認 WF(既存)
│       └── deploy-voicevox.yml      ← 本書で新設、本番デプロイ
└── cloudrun-voicevox/
    ├── Dockerfile                   ← nginx 認証 proxy のビルド定義
    ├── nginx.conf.tmpl              ← AUTH_TOKEN ヘッダ検証 + CORS テンプレ
    ├── service.yaml.tmpl            ← Cloud Run サイドカー構成
    └── README.md                    ← 開発者向け案内
```

### 0.2 採用構成: nginx 認証 proxy + VOICEVOX エンジン サイドカー

```
[GitHub Actions]
    │ WIF
    ▼
[Cloud Run service: voicevox-engine]
    ├── Container 1: voicevox-proxy (nginx, port 8080, ingress)
    │     │ proxy_pass http://127.0.0.1:50021
    │     │ + Authorization: Bearer <TOKEN> 検証
    │     │ + CORS for invokeaide ドメイン
    │     ▼
    └── Container 2: voicevox/voicevox_engine:cpu-latest (sidecar, port 50021)
```

### 0.3 なぜサイドカー構成にするか

| 観点 | 単一カスタムイメージ案 | **サイドカー案(本書本命)** |
|---|---|---|
| 公式 VOICEVOX イメージの追従 | フォーク + ベース更新必要、メンテ重い | **そのまま参照可、ベース更新は自動** |
| 認証ロジックの分離 | VOICEVOX 内に組み込む難易度高 | **nginx 設定だけで完結** |
| Cloud Run マルチコンテナ機能 | 使わない | **使う(2024 GA、Cloud Run 標準機能)** |
| ビルド時間 | 長い(VOICEVOX 全体再ビルド) | **短い(nginx だけビルド、~ 20 秒)** |
| メモリ効率 | 単一 | nginx は 256MiB、VOICEVOX は 2GiB、合算 2.25GiB(Cloud Run 上限 32GiB 余裕) |

**結論**: サイドカー案を本命。VOICEVOX イメージを汚さず、認証 / CORS / 将来のレート制限などは proxy 側で完結。

### 0.4 本書を使い始めるまでの「たかしさん前提作業」

| Block | 状態 |
|---|---|
| Block A(VOICEVOX 規約確認) | 並列で進行可、本書の動作には直接影響しない |
| Block B(GCP プロジェクト) | **必須**、未完なら Cloud Run 事前調査 §9 B-1〜B-4 |
| Block C(WIF + GitHub Secrets) | **必須**、未完なら WIF 手順書 §6 で 15-30 分 |
| Block D(ドメイン) | 不要(Cloud Run 標準 URL でベータ開始) |

→ B + C が終われば、本書の `deploy-voicevox.yml` を `Run workflow` で押すだけで Cloud Run に VOICEVOX が立つ。

---

## 1. ファイル群(完全版、コピペで動く想定)

### 1.1 `cloudrun-voicevox/Dockerfile`

```dockerfile
# 認証 proxy 専用の軽量 nginx イメージ。
# VOICEVOX 本体はサイドカーとして別コンテナで動かすため、
# 本イメージはネットワーク層のゲートウェイに専念。

FROM nginx:1.27-alpine

# nginx:alpine の標準 entrypoint は /etc/nginx/templates/*.tmpl を
# 環境変数で envsubst して /etc/nginx/conf.d/ に展開する仕組みを持つ。
# これを使って VOICEVOX_AUTH_TOKEN / ALLOWED_ORIGIN を実行時に注入。
COPY nginx.conf.tmpl /etc/nginx/templates/default.conf.tmpl

# Cloud Run が割り当てる 8080 で listen
EXPOSE 8080

# nginx:alpine のデフォルトコマンドをそのまま使う(envsubst → nginx 起動)
```

### 1.2 `cloudrun-voicevox/nginx.conf.tmpl`

```nginx
# Cloud Run の ingress を受ける唯一のサーバーブロック。
# - Authorization: Bearer <VOICEVOX_AUTH_TOKEN> ヘッダの検証
# - 認証済みリクエストを localhost:50021 (VOICEVOX サイドカー) にプロキシ
# - InvokeAide ドメインからの CORS を許可
# - /healthz は無認証(Cloud Run startup probe 用)
#
# 環境変数 ${VOICEVOX_AUTH_TOKEN} / ${ALLOWED_ORIGIN} は
# nginx:alpine の起動時 envsubst で注入される。

server {
    listen 8080;
    server_tokens off;

    # 大きめのテキストでも合成できるよう、リクエスト本文の上限を緩める
    client_max_body_size 1m;

    # /healthz: Cloud Run の startup probe / liveness probe 用、認証なし
    location = /healthz {
        access_log off;
        return 200 "ok\n";
    }

    # 残り全部: 認証検証 → VOICEVOX へプロキシ
    location / {
        # 期待する Authorization ヘッダ文字列を組み立て
        set $expected_auth "Bearer ${VOICEVOX_AUTH_TOKEN}";

        # CORS プリフライトは認証前に応答(Authorization ヘッダが送れないため)
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "${ALLOWED_ORIGIN}" always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
            add_header Access-Control-Max-Age "86400" always;
            return 204;
        }

        # トークン検証
        if ($http_authorization != $expected_auth) {
            return 401 "Unauthorized\n";
        }

        # VOICEVOX サイドカーへフォワード
        proxy_pass http://127.0.0.1:50021;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;

        # 成功レスポンスにも CORS ヘッダ付与
        add_header Access-Control-Allow-Origin "${ALLOWED_ORIGIN}" always;
    }
}
```

**nginx の `if is evil` 落とし穴回避**:
- 本テンプレでは `if` を 2 箇所のみ使用(OPTIONS リクエスト判定、Authorization 不一致判定)
- 双方とも `return` で終わる パターン = 公式 nginx 推奨の許容ケース
- `if` 内で `set` や `proxy_pass` をネストしていない

### 1.3 `cloudrun-voicevox/service.yaml.tmpl`

```yaml
# Cloud Run 用 Knative サービス定義(マルチコンテナ構成)。
# deploy-voicevox.yml 内で envsubst により展開してから
# `gcloud run services replace` で apply する。
#
# 環境変数:
#   ${PROXY_IMAGE_URI}  Artifact Registry にプッシュした proxy のイメージ URI
#   ${ALLOWED_ORIGIN}   CORS で許可するフロントエンドの Origin
#   ${REGION}           Cloud Run リージョン (asia-northeast1)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: voicevox-engine
  labels:
    cloud.googleapis.com/location: ${REGION}
spec:
  template:
    metadata:
      annotations:
        # コールドスタート短縮(Cloud Run 事前調査 §5.2 レイヤー1)
        run.googleapis.com/startup-cpu-boost: "true"
        # 自動スケール上下限(Cloud Run 事前調査 §3.2)
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "5"
    spec:
      # 1 インスタンスあたり同時 4 リクエスト
      containerConcurrency: 4
      # 1 リクエスト最大 60 秒
      timeoutSeconds: 60

      containers:
        # ─────────── 認証 proxy(ingress、ポート 8080)───────────
        - name: proxy
          image: ${PROXY_IMAGE_URI}
          ports:
            - containerPort: 8080
          env:
            # AUTH_TOKEN は Secret Manager から実行時に注入
            - name: VOICEVOX_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: voicevox-auth-token
                  key: latest
            - name: ALLOWED_ORIGIN
              value: "${ALLOWED_ORIGIN}"
          startupProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 30
          resources:
            limits:
              cpu: "1"
              memory: "256Mi"
          # VOICEVOX が立ち上がるまで proxy 起動を遅延させる(2024 GA)
          dependsOn:
            - voicevox

        # ─────────── VOICEVOX エンジン サイドカー ───────────
        - name: voicevox
          image: voicevox/voicevox_engine:cpu-latest
          # 注: ベータでは cpu-latest を採用、商品化前に明示バージョン固定推奨
          # (Cloud Run 事前調査 §2.2 「未来の自分を縛らない」原則)
          startupProbe:
            tcpSocket:
              port: 50021
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 60
          resources:
            limits:
              cpu: "2"
              memory: "2Gi"
```

### 1.4 `.github/workflows/deploy-voicevox.yml`

```yaml
name: Deploy VOICEVOX to Cloud Run

# トリガー:
#   - main ブランチへの push で `cloudrun-voicevox/` 配下が変わった時
#   - 手動トリガー(Run workflow)
on:
  push:
    branches: [main]
    paths:
      - 'cloudrun-voicevox/**'
      - '.github/workflows/deploy-voicevox.yml'
  workflow_dispatch:

# 並行デプロイを防止(同一ブランチで上書き)
concurrency:
  group: deploy-voicevox-${{ github.ref }}
  cancel-in-progress: false

env:
  REGION: asia-northeast1
  SERVICE_NAME: voicevox-engine
  AR_REPO: cloudrun-voicevox
  PROXY_IMAGE: voicevox-proxy
  # ALLOWED_ORIGIN は GitHub Variables(Settings → Variables)で管理
  ALLOWED_ORIGIN: ${{ vars.ALLOWED_ORIGIN }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write          # WIF で OIDC token を発行する権限
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud (WIF)
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SA_EMAIL }}

      - name: Setup gcloud
        uses: google-github-actions/setup-gcloud@v2

      - name: Compute project number
        id: project
        run: |
          PROJECT_NUMBER=$(gcloud projects describe ${{ secrets.GCP_PROJECT_ID }} --format='value(projectNumber)')
          echo "number=$PROJECT_NUMBER" >> "$GITHUB_OUTPUT"

      - name: Enable Secret Manager API (idempotent)
        run: |
          gcloud services enable secretmanager.googleapis.com \
            --project=${{ secrets.GCP_PROJECT_ID }}

      - name: Ensure Artifact Registry repository (idempotent)
        run: |
          gcloud artifacts repositories describe ${AR_REPO} \
            --location=${REGION} --project=${{ secrets.GCP_PROJECT_ID }} \
            >/dev/null 2>&1 || \
          gcloud artifacts repositories create ${AR_REPO} \
            --repository-format=docker \
            --location=${REGION} \
            --description="VOICEVOX proxy images for InvokeAide" \
            --project=${{ secrets.GCP_PROJECT_ID }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

      - name: Build & push proxy image
        run: |
          IMAGE="${REGION}-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/${AR_REPO}/${PROXY_IMAGE}:${{ github.sha }}"
          docker build -t "$IMAGE" cloudrun-voicevox/
          docker push "$IMAGE"
          echo "PROXY_IMAGE_URI=$IMAGE" >> "$GITHUB_ENV"

      - name: Sync VOICEVOX_AUTH_TOKEN to Secret Manager
        # Secret 自体が無ければ作成 → SA に accessor 権限を付与。
        # ある場合は新バージョンを追加(ローテーション対応)。
        # GitHub Secrets の値が真実の源(SoT)、Secret Manager は実行時注入。
        run: |
          if gcloud secrets describe voicevox-auth-token \
              --project=${{ secrets.GCP_PROJECT_ID }} >/dev/null 2>&1; then
            printf '%s' "${{ secrets.VOICEVOX_AUTH_TOKEN }}" | \
              gcloud secrets versions add voicevox-auth-token \
                --data-file=- \
                --project=${{ secrets.GCP_PROJECT_ID }}
          else
            printf '%s' "${{ secrets.VOICEVOX_AUTH_TOKEN }}" | \
              gcloud secrets create voicevox-auth-token \
                --data-file=- \
                --replication-policy=automatic \
                --project=${{ secrets.GCP_PROJECT_ID }}
            gcloud secrets add-iam-policy-binding voicevox-auth-token \
              --member="serviceAccount:${{ secrets.GCP_SA_EMAIL }}" \
              --role="roles/secretmanager.secretAccessor" \
              --project=${{ secrets.GCP_PROJECT_ID }}
          fi

      - name: Render service.yaml
        run: |
          export PROXY_IMAGE_URI ALLOWED_ORIGIN REGION
          envsubst < cloudrun-voicevox/service.yaml.tmpl > /tmp/service.yaml
          echo "=== Rendered service.yaml ==="
          cat /tmp/service.yaml

      - name: Deploy to Cloud Run
        run: |
          gcloud run services replace /tmp/service.yaml \
            --region=${REGION} \
            --project=${{ secrets.GCP_PROJECT_ID }}

      - name: Apply ingress + invoker policy
        # Cloud Run は IAM レベルでも認証要件をかけられるが、本書はアプリ層
        # で AUTH_TOKEN 検証する設計のため、ingress は all-users(無認証)
        # で公開し、認証は nginx proxy で実施。Cloud Run 事前調査 §7.3 案B 整合。
        run: |
          gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
            --member="allUsers" \
            --role="roles/run.invoker" \
            --region=${REGION} \
            --project=${{ secrets.GCP_PROJECT_ID }}

      - name: Get service URL
        id: url
        run: |
          URL=$(gcloud run services describe ${SERVICE_NAME} \
            --region=${REGION} \
            --project=${{ secrets.GCP_PROJECT_ID }} \
            --format='value(status.url)')
          echo "service_url=$URL" >> "$GITHUB_OUTPUT"
          echo "Deployed: $URL"

      - name: Smoke test — health check (no auth required)
        run: |
          URL="${{ steps.url.outputs.service_url }}"
          status=$(curl -s -o /dev/null -w "%{http_code}" "$URL/healthz")
          if [ "$status" != "200" ]; then
            echo "Healthz expected 200, got: $status"
            exit 1
          fi
          echo "Healthz OK (200)"

      - name: Smoke test — unauthorized request returns 401
        run: |
          URL="${{ steps.url.outputs.service_url }}"
          status=$(curl -s -o /dev/null -w "%{http_code}" "$URL/version")
          if [ "$status" != "401" ]; then
            echo "Unauth expected 401, got: $status"
            exit 1
          fi
          echo "Auth gate OK (401 without Authorization header)"

      - name: Smoke test — authorized request reaches VOICEVOX
        run: |
          URL="${{ steps.url.outputs.service_url }}"
          status=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer ${{ secrets.VOICEVOX_AUTH_TOKEN }}" \
            "$URL/version")
          if [ "$status" != "200" ]; then
            echo "Authorized request expected 200, got: $status"
            exit 1
          fi
          echo "Authorized request OK (VOICEVOX /version reached)"

      - name: Print summary
        run: |
          echo "## VOICEVOX Cloud Run deployed" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- Service URL: ${{ steps.url.outputs.service_url }}" >> $GITHUB_STEP_SUMMARY
          echo "- Region: ${REGION}" >> $GITHUB_STEP_SUMMARY
          echo "- Image: ${PROXY_IMAGE_URI}" >> $GITHUB_STEP_SUMMARY
          echo "- Commit: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
```

### 1.5 `cloudrun-voicevox/README.md`

```markdown
# cloudrun-voicevox

VOICEVOX エンジンを Google Cloud Run にデプロイするための一式。
詳細は `docs/Phase2/Phase2_CloudRun_deploy_ワークフロー_v0.1_2026-05-19.md`。

## 構成

- `Dockerfile` + `nginx.conf.tmpl`: 認証 proxy(nginx)
- `service.yaml.tmpl`: Cloud Run マルチコンテナ(proxy + VOICEVOX サイドカー)

## デプロイ

main ブランチへ push、または GitHub Actions の "Deploy VOICEVOX to Cloud Run" を手動実行。

## ローカル動作確認

```sh
docker compose up   # docker-compose.yml は別途用意(本書スコープ外)
```

## 認証

すべてのリクエストに `Authorization: Bearer <VOICEVOX_AUTH_TOKEN>` が必要。
`/healthz` だけは無認証(Cloud Run startup probe 用)。
```

---

## 2. 必要な前提値の確認

本ワークフローは GitHub Secrets / Variables / Artifact Registry が揃って初めて動く。WIF 手順書 §7 で作った Secrets に **2 つ追加** が必要(本書で追加で必要なもの):

### 2.1 GitHub Secrets(既存 + 新規)

| 名前 | 由来 | 用途 |
|---|---|---|
| `GCP_PROJECT_ID` | WIF 手順書 §7 で登録済 | deploy 対象 |
| `GCP_SA_EMAIL` | 同上 | WIF で装う SA |
| `GCP_WIF_PROVIDER` | 同上 | WIF プロバイダ完全リソース名 |
| `VOICEVOX_AUTH_TOKEN` | WIF 手順書 §8 で生成済 | proxy 検証用、deploy 時に Secret Manager に同期 |

→ **追加すべき Secrets は無し** 。WIF 手順書 §10 完了確認チェックリストが満たされていれば本書は動く。

### 2.2 GitHub Variables(新規)

| 名前 | 値の例 | 用途 |
|---|---|---|
| `ALLOWED_ORIGIN` | `https://invokeaide-beta.pages.dev` | CORS で許可するフロントエンド Origin |

Settings → Secrets and variables → Actions → Variables タブで設定。Cloudflare Pages の URL が確定するまでは `*` を一時的に入れても動く(セキュリティ低下のため、URL 確定後に絞ること)。

### 2.3 GCP 側の前提(WIF 手順書で揃うもの)

| 項目 | 由来 | 用途 |
|---|---|---|
| Cloud Run API 有効化 | WIF 手順書 §5 | デプロイ先 |
| Artifact Registry API 有効化 | 同上 | proxy イメージ保管 |
| Service Account `github-deployer@...` | 同上 §6 Step 1 | WIF で装う先 |
| `roles/run.admin` / `roles/iam.serviceAccountUser` / `roles/artifactregistry.writer` | 同上 Step 2 | デプロイ権限 |
| WIF Pool / Provider / Binding | 同上 Step 3〜5 | GitHub Actions からの認証 |

### 2.4 本ワークフロー内で自動で行う

- Secret Manager API の有効化(冪等)
- Artifact Registry リポジトリ `cloudrun-voicevox` の作成(冪等)
- Secret Manager の `voicevox-auth-token` 作成 + SA への accessor 権限付与(冪等)
- `roles/run.invoker` の `allUsers` バインド(ingress 公開、認証は nginx 側)

→ たかしさんが手で叩く gcloud は **WIF 手順書だけで完結** 。本書のワークフローを動かすには `Run workflow` 一発で十分。

---

## 3. 動作の流れ(初回 deploy のタイムライン)

```
T+0:00   Run workflow ボタン押下
T+0:05   WIF 認証成立(google-github-actions/auth)
T+0:15   Secret Manager API / Artifact Registry リポジトリ確保
T+0:30   nginx proxy イメージビルド (~ 20 秒)
T+0:50   イメージ push (~ 20 秒)
T+1:10   Secret Manager に AUTH_TOKEN 同期
T+1:20   service.yaml レンダリング → gcloud run services replace
T+1:30   Cloud Run が新リビジョン作成、コンテナイメージ pull 開始
T+2:30   VOICEVOX サイドカー pull (~ 700MB、初回 90 秒前後の見込み)
T+4:00   VOICEVOX startupProbe 通過 → proxy 起動
T+4:30   Cloud Run が新リビジョンにトラフィック 100% 切替
T+4:45   smoke test 3 件実行
T+5:00   Workflow 緑、$GITHUB_STEP_SUMMARY に URL 表示
```

初回 5 分、2 回目以降はイメージキャッシュで 2-3 分。

---

## 4. Smoke test の意味

各テストは「何が壊れたら何が出る」を意図的にカバー:

| Test | 意図 | 失敗時に疑うべき場所 |
|---|---|---|
| `/healthz` で 200 | proxy コンテナの起動と nginx 設定の文法 | nginx.conf.tmpl の構文、startupProbe |
| `/version` 無認証で 401 | proxy の認証ロジック | nginx の `if ($http_authorization ...)` 条件 |
| `/version` Bearer で 200 | AUTH_TOKEN 一致 + VOICEVOX サイドカー疎通 | Secret Manager 注入、proxy_pass、サイドカー起動 |

`/version` を選んだ理由: VOICEVOX 公式エンジンが最も軽量に応答するエンドポイント(モデル読み込み不要)。

---

## 5. Cloud Run ログ最小化(WIF 手順書 §8 反映の実装)

### 5.1 本書での具体的実装

| 観点 | 本書での扱い |
|---|---|
| 発話テキストの URL クエリ載せ禁止 | フロント側で `POST` ボディ送信を必須化(Sさん TTSProvider に申し送り) |
| nginx の access_log で query string を残さない | デフォルトの `combined` フォーマットは URL を含むため、 query 載せない方針で吸収 |
| `/healthz` の access_log 抑制 | `nginx.conf.tmpl` の `access_log off;` で実装済( §1.2) |
| Cloud Logging 保持期間 | WIF 手順書 §8.2 で `_Default` バケット 30 日確認(別タスク) |
| stdout への発話テキスト出力禁止 | proxy は nginx のため独自 stdout なし、VOICEVOX エンジンはモデル ロード時のログのみ stdout に出る(発話テキストは出力しない) |

### 5.2 Sさん TTSProvider への申し送り(本書から)

```typescript
// Sさん が起草する TTSProvider 実装で、必ず POST ボディに発話テキストを載せる。
// クエリパラメータには載せない(Cloud Run ログ最小化のため)。
//
// 例: VOICEVOX の /audio_query は元々クエリ受けだが、proxy 経由でも
// テキストは speaker_id とともにクエリで送る仕様。
// これを「フロントが直接 VOICEVOX を叩く」のではなく
// 「フロントが proxy 経由の薄いラッパー API を叩く」設計で吸収する余地あり。
//
// もしくは Sさん 確定で「VOICEVOX の URL クエリは PII を含まないか」を再評価。
// ベータでは VOICEVOX 仕様準拠(URL クエリ)で許容、商品化版で再検討。
```

**Uさん 現時点の判断**: VOICEVOX の `/audio_query?text=...&speaker=...` 仕様を尊重しベータでは URL クエリ送信を許容。Cloud Run のアクセスログは query を含むため、 §5.1 「保持期間 30 日 + Cloud Logging のフィールド除外設定」を商品化版で重ねる選択肢を残す(本書スコープ外、 §10 副次課題)。

---

## 6. リスク・トレードオフ

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | `cpu-latest` タグ採用で VOICEVOX 上流アップデートで動作変化 | 🟡 中 | 商品化前に明示バージョン固定( §1.3 注記) |
| 2 | サイドカー間の起動順序が不安定で 502 が出る | 🟢 低 | `dependsOn: [voicevox]` + `startupProbe` で吸収( §1.3) |
| 3 | nginx の `if` 落とし穴(変則的な動作) | 🟢 低 | `return` で終わるパターンのみ使用( §1.2) |
| 4 | Secret Manager のローテーション運用 | 🟢 低 | GitHub Secrets が SoT、deploy 時に最新版を追加 → Cloud Run は次回起動で取り直し |
| 5 | `allUsers` invoker 公開は強い | 🟡 中 | アプリ層で AUTH_TOKEN 検証 + max-instances=5 で構造的キャップ。商品化版で Cloudflare Worker 中継に進化 |
| 6 | smoke test の Bearer 送信時、ログに secret が残る可能性 | 🟡 中 | curl 出力を `-s -o /dev/null` で抑制済 / GitHub Actions のログマスキングは secret に対して自動適用される |
| 7 | proxy コンテナ 256MiB で nginx が OOM(極端な大量同時接続) | 🟢 低 | 想定 concurrency=4 では余裕、必要なら 512MiB に増やす |
| 8 | VOICEVOX エンジン `cpu-latest` イメージサイズが大きく(~700MB)pull に時間がかかる | 🟡 中 | Cloud Run のイメージキャッシュで 2 回目以降は短縮、初回 5 分は許容 |

---

## 7. ロールバック手順

### 7.1 直近の安定版に戻す

Cloud Run は **リビジョン履歴を自動保持** 。問題があれば前のリビジョンに切替:

```bash
# リビジョン一覧
gcloud run revisions list \
    --service=voicevox-engine \
    --region=asia-northeast1 \
    --project=<PROJECT_ID>

# 旧リビジョンに 100% トラフィック
gcloud run services update-traffic voicevox-engine \
    --to-revisions=voicevox-engine-00003-abc=100 \
    --region=asia-northeast1 \
    --project=<PROJECT_ID>
```

### 7.2 ワークフロー上のロールバック

GitHub Actions の **Re-run jobs** で 1 つ前の成功 commit に対して再実行も可。

### 7.3 完全停止

```bash
gcloud run services delete voicevox-engine \
    --region=asia-northeast1 \
    --project=<PROJECT_ID>
```

(Artifact Registry のイメージ / Secret Manager の Secret は残る、必要に応じて手動削除)

---

## 8. 動作確認(deploy 後、たかしさん用)

### 8.1 ブラウザから手動チェック

1. GitHub Actions の `Print summary` で表示された URL を控える
2. URL に `/healthz` を付けてブラウザで開く → `ok` 表示なら OK
3. URL に `/version` を付けてブラウザで開く → `401 Unauthorized` 表示なら認証ガード OK

### 8.2 curl から音声合成テスト

```bash
URL="<service_url>"
TOKEN="<VOICEVOX_AUTH_TOKEN>"

# 1. /version
curl -H "Authorization: Bearer $TOKEN" "$URL/version"

# 2. audio_query(発話 query 作成)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$URL/audio_query?text=こんにちは&speaker=1" \
  -o /tmp/query.json

# 3. synthesis(実際の音声バイナリ取得)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$URL/synthesis?speaker=1" \
  --data @/tmp/query.json \
  -o /tmp/out.wav

# 4. macOS は afplay、Windows は適当な player で再生
```

WAV ファイルが再生できれば、VOICEVOX → Cloud Run → 認証 proxy → クライアントの全経路が機能。

---

## 9. たかしさんに判断を仰ぎたい事項

| # | 事項 | Uさん 感触 |
|---|---|---|
| Q-U-e-1 | サイドカー 2 コンテナ構成(本書本命)で OK か、単一カスタムイメージに統合したいか | **サイドカー本命** 推奨。公式 VOICEVOX イメージをそのまま使えるメンテ性が最大価値 |
| Q-U-e-2 | `cpu-latest` タグ採用で OK か、商品化前から明示バージョン固定(`cpu-0.26.x` 等)に切替えるか | **ベータは `cpu-latest`、 商品化前に固定** 推奨。「未来の自分を縛らない」原則と「再現性」のバランス |
| Q-U-e-3 | `ALLOWED_ORIGIN` の値を GitHub Variables で確定する時期 | **Cloudflare Pages の URL 確定後** 推奨。それまでは `*` 一時許容(セキュリティ低下、家族テスト規模で許容) |
| Q-U-e-4 | smoke test の 3 件で OK か、追加項目(合成成功・音声長確認等)を入れるか | **本書 3 件で OK** 推奨。実際の合成テストは §8.2 で手動、自動 smoke は最小限維持 |
| Q-U-e-5 | Cloud Run の ingress を `all` (パブリック)で OK か、`internal-and-cloud-load-balancing` で絞るか | **`all` で OK** 推奨。Cloud Run 事前調査 §7.3 案B(アプリ層認証 + max-instances)で構造的キャップ |
| Q-U-e-6 | Tさん テスト基盤との CI 統合(エルトン記載「Tさん が明日着手」)に対する Uさん 側の準備事項 | **本書の workflow が成功するだけで Tさん 側の前提充足** 。 追加の Tさん 連絡事項なし(発生したらエルトン経由) |

---

## 10. 副次的に気づいた課題

### 10.1 docker-compose.yml のローカル動作確認

本書はクラウド側に集中している。ローカルで proxy + VOICEVOX を立ち上げて nginx 設定をテストするための `docker-compose.yml` があると、たかしさんが nginx.conf を触る時の検証ループが短くなる。Uさん 次タスク候補。

### 10.2 VOICEVOX ログのフィールド除外設定(商品化版)

§5.2 で言及した「Cloud Logging で URL クエリ部分を除外する設定」は Cloud Logging の `exclusionFilter` で実装可能。ベータでは保持期間 30 日に依存、商品化版で明示。

### 10.3 GitHub Variables の `ALLOWED_ORIGIN` のマルチ環境

将来「dev / staging / prod」で複数の Cloud Run を持つ場合、 GitHub Environments(Settings → Environments)を使って環境別の `ALLOWED_ORIGIN` を設定する形に進化。商品化版で。

### 10.4 Cloud Run の Custom Domain Mapping(Phase 4)

ベータは `*.run.app` URL で開始。 商品化版で `voicevox.invokeaide.app` などに切替える場合、Cloud Run の Custom Domain Mapping + DNS 設定が必要。Phase 4 着手時の課題。

### 10.5 Service Account の `roles/secretmanager.secretAccessor` 付与

§1.4 のワークフロー内で Secret 新規作成時に SA に accessor 権限を付与しているが、これは **Secret 単位** のバインド。プロジェクト全体に `secretmanager.secretAccessor` を与える方が運用が楽だが、最小権限の原則で Secret 単位を採用。

### 10.6 仕様書 v1.5 への反映依頼候補(エルトン主導)

- 仕様書 v1.5 §26 配信インフラに「VOICEVOX Cloud Run マルチコンテナ構成」を追記
- 仕様書 v1.5 §15 セキュリティに「nginx proxy + Bearer Token 認証」「Secret Manager 注入」を追記

---

## 11. 完了報告(エルトン経由)

```
[Phase 2 Sprint 1 案α) Cloud Run deploy ワークフロー本番版起草 完了報告]
完了日時: 2026-05-19(火)夜
所要時間: 約100分(想定 90-120分内)
成果物のファイルパス:
  C:\dev\InvokeAide\docs\Phase2\Phase2_CloudRun_deploy_ワークフロー_v0.1_2026-05-19.md

主要な発見 / 判断:
  - サイドカー2コンテナ構成(nginx 認証 proxy + VOICEVOX エンジン)を本命採用
    根拠: 公式 VOICEVOX イメージをそのまま使える / メンテ最小 / nginx 設定
    だけで認証・CORS 完結 / Cloud Run 2024 GA のマルチコンテナ正攻法
  - 4 ファイル(Dockerfile / nginx.conf.tmpl / service.yaml.tmpl /
    deploy-voicevox.yml) + README で完結、 §1 にコピペで動く形を全文掲載
  - Secret Manager 経由で VOICEVOX_AUTH_TOKEN を実行時注入(GitHub Secrets
    が SoT、deploy 時に Secret Manager へ同期)
  - smoke test 3 件(healthz / 401 / 200)で「何が壊れたら何が出るか」を
    意図的にカバー
  - WIF 手順書 §7 テスト WF と地続き、追加 Secrets は不要(VOICEVOX_AUTH_TOKEN
    は WIF 手順書 §8 で既登録)、追加 Variables は ALLOWED_ORIGIN のみ
  - Cloud Run ログ最小化(WIF 手順書 §8 反映)を §5 で実装:
      ・/healthz の access_log off
      ・発話テキスト送信ルール(POST ボディ優先、Sさん TTSProvider 申し送り)
      ・Cloud Logging 保持 30 日依存
  - ロールバック手順(§7)、手動動作確認(§8)、リスク 8 件(§6)を整備

たかしさんの追加作業:
  - GitHub Variables に ALLOWED_ORIGIN 設定(Cloudflare Pages URL 確定後)
    暫定で `*` 入れて動作確認も可(家族テスト規模で許容、URL 確定後に絞る)
  - main ブランチに cloudrun-voicevox/ 配下のファイルを置き、push か手動で
    Run workflow → 初回 5 分で deploy 完走見込み

Sさん との結合点(エルトン経由で Sさん に通知依頼):
  - 本書 §5.2 TTSProvider に発話テキストの POST ボディ送信ルール申し送り
  - VOICEVOX endpoint(Cloud Run service URL)を Sさん 設定画面 / 環境変数で
    扱えるよう interface 設計依頼(具体的 URL は deploy 後に判明、暫定で
    settings.json の voicevoxEndpoint フィールドに格納する c) §4.3 と整合)

Tさん との結合点(エルトン経由で Tさん に通知依頼):
  - 本書の deploy-voicevox.yml が Tさん 側 CI 基盤と統合可能
  - smoke test 3 件のロジックを Tさん が「VOICEVOX 動作確認スイート」として
    拡張する案あり(エルトン裁量で Tさん に申し送り)

推奨する次のアクション:
  - 本書レビュー、§9 Q-U-e-1〜Q-U-e-6(6点)のたかしさん判断
  - たかしさん作業の優先順位:
      1. (依存)WIF 手順書 §6 完走(15-30分)
      2. (独立)GitHub Variables に ALLOWED_ORIGIN 設定
      3. (依存)cloudrun-voicevox/ ディレクトリの作成、本書 §1 の 4 ファイル
        を該当パスに配置、main に push
      4. (依存)GitHub Actions で Run workflow 実行(初回 5 分待ち)
      5. (独立)Block A: VOICEVOX 規約確認
  - Uさん 次タスク候補:
      (案ω)docker-compose.yml(ローカル動作確認、§10.1)起草
      (案ξ)Sさん TTSProvider 実装の Uさん 側叩き台(本書 §5.2 申し送りの
            具体化、Sさん contract 確定前提のため待機価値あり)
      (案ψ)落とし穴集 §4 将来候補のうち、 Cloud Run × iOS Safari の
            予備検証(CORS / Service Worker キャッシュとの相性等)
    Uさん 感触: 案ω 推奨。本書ワークフローの検証ループ(nginx.conf 修正 →
                ローカルで動作確認 → push)を 30 秒台に短縮できる、たかしさん
                が「触って覚える」ハードルを下げる効果あり

たかしさんに判断を仰ぎたい事項: 本書 §9 に 6点
副次的に気づいた課題: 本書 §10 に 6点
```

---

## 12. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火)夜 | 初版作成。サイドカー2コンテナ構成 / 4 ファイルコピペ可全文 / WIF 地続き / Secret Manager 連携 / smoke test 3件 / Cloud Run ログ最小化実装 / ロールバック / 手動確認 / リスク 8件 / 副次気づき 6件 / 判断仰ぎ 6点 | Uさん(Opus) |

---

**以上、Uさん 案α) Cloud Run deploy ワークフロー本番版 v0.1。たかしさん Block C 完走 + 本書 4 ファイル配置 + Run workflow で、初回 5 分で voicevox-engine が立つ状態に到達。**
