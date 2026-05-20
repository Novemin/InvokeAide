# Phase 2 docker-compose ローカル動作確認 v0.1

**作成日**: 2026-05-19(火)深夜
**起草者**: Uさん(Opus、実装補助担当)
**位置づけ**: 案ω 起草、Cloud Run deploy ワークフロー v0.1 の **ローカル検証ループ短縮** ツール
**前提**:
- Phase2_CloudRun_deploy_ワークフロー_v0.1_2026-05-19.md(本書の母体、§10.1 で吸収予定と申し送りされた論点)
- 思想書「人間味のための AI」 — たかしさんが「触って覚える」体験を保つ
- 起動指示書 §8.1 「概念理解優先」 — 動かして見ながら理解できる検証ループ

**本書のゴール**:
1. `cloudrun-voicevox/` 配下の nginx 認証 proxy + VOICEVOX エンジンを **ローカル PC で 1 コマンドで起動**
2. nginx.conf 修正 → 反映 を **30 秒台** に短縮する検証ループ
3. Cloud Run deploy 設計 v0.1 への **小修正(VOICEVOX_UPSTREAM 変数化)** を併記、本番との整合を保つ
4. たかしさんが Cloud Run 課金を発生させずに proxy / nginx / VOICEVOX を触れる環境

---

## 0. エグゼクティブ・サマリ

### 0.1 追加ファイル一覧

```
cloudrun-voicevox/
├── Dockerfile                 ← 既存(変更なし)
├── nginx.conf.tmpl            ← 既存 + 1行修正(§4 で詳述)
├── service.yaml.tmpl          ← 既存 + 1ブロック追加(§5 で詳述)
├── deploy-voicevox.yml        ← 既存(変更なし、本書では .github/workflows/ 配下記載)
├── docker-compose.yml         ← 新規(§3)
├── .env.example               ← 新規(§6)
├── .gitignore                 ← 新規 or 既存に追記(§6)
├── tools/
│   └── smoke-local.sh         ← 新規(§8 動作確認の自動化、任意)
└── README.md                  ← 既存に「ローカル動作確認」セクション追記(§7)
```

### 0.2 ローカル動作確認の流れ(初回)

```
[たかしさん端末]
   │
   │ 1. cloudrun-voicevox/ に移動
   │ 2. cp .env.example .env
   │ 3. .env 内の VOICEVOX_AUTH_TOKEN を openssl で生成して埋める
   │ 4. docker compose up --build
   │ 5. (初回 700MB pull で 2-5 分待つ、2回目以降キャッシュで 10 秒)
   │ 6. 別ターミナルで curl http://localhost:8080/healthz
   ▼
[Docker Desktop on Windows / Mac / Linux]
   ├── Container A: voicevox-proxy (nginx, port 8080)
   │     │ proxy_pass http://voicevox:50021
   │     │ Authorization: Bearer 検証
   │     ▼
   └── Container B: voicevox/voicevox_engine:cpu-latest (port 50021)
```

### 0.3 本番(Cloud Run)との 1 つの差異

Cloud Run のマルチコンテナはコンテナ間が **同一 Pod の localhost** で通信する → `proxy_pass http://127.0.0.1:50021;`
docker-compose は **別コンテナ + 同一ネットワーク** で通信する → `proxy_pass http://voicevox:50021;`

→ `nginx.conf.tmpl` の `proxy_pass` を **環境変数 `VOICEVOX_UPSTREAM` で切替** することで、同じ nginx.conf が両方の環境で動く。

これが本書唯一の本番側修正(§4 / §5)。

---

## 1. ローカル動作確認の意義

### 1.1 検証ループの比較

| 手段 | 1 サイクルの所要時間 | 環境コスト |
|---|---|---|
| Cloud Run に push して試す | 5 分(ビルド + push + deploy + smoke) | クラウド課金 + GitHub Actions 分 |
| **docker-compose でローカル試行** | **20-30 秒(`docker compose restart proxy`)** | **0 円、PC リソースのみ** |

nginx.conf や docker-compose の調整は **「3回試して 1回当たる」** のが普通。Cloud Run だけで完結させると 15 分の試行錯誤がかかるが、ローカルなら 1-2 分。

### 1.2 たかしさんへの利点

- 起動指示書 §8.1「概念理解優先」 — 触って動かして「なぜこれが必要か」を体感
- 「マウス不使用」原則 — すべて CLI(`docker compose ...`)で完結
- Cloud Run 課金リスクの心理的バリアなく、 nginx.conf を試行錯誤できる

### 1.3 本書を読んだ後にできるようになること

- ローカルで VOICEVOX が動く(`localhost:8080/version` に Bearer ヘッダで叩ける)
- nginx.conf を編集して「認証ロジックを変えるとどう振る舞いが変わるか」を秒単位で観察できる
- Cloud Run に行く前にバグを取り切れる

---

## 2. 前提条件

| # | 確認項目 | チェック方法 |
|---|---|---|
| 1 | Docker Desktop(または Docker Engine + Compose)がインストール済み | `docker compose version` で v2.x が出る |
| 2 | `cloudrun-voicevox/` ディレクトリと既存 4ファイル(Dockerfile / nginx.conf.tmpl / service.yaml.tmpl / README.md)が手元にある | `ls cloudrun-voicevox/` |
| 3 | Cloud Run deploy ワークフロー v0.1 §1 の内容を理解している | 未読なら本書理解の前に一読 |
| 4 | openssl が使える(`openssl rand -hex 32` で AUTH_TOKEN 生成) | Windows の場合 Git Bash 同梱でも可、無ければ PowerShell スニペット §6.3 |

Docker Desktop が未インストールの場合、 `https://www.docker.com/products/docker-desktop` から入手。Windows 11 では WSL 2 バックエンドで動作。

---

## 3. `docker-compose.yml`(全文、コピペで動く)

`cloudrun-voicevox/docker-compose.yml` に配置:

```yaml
# Cloud Run マルチコンテナ構成のローカル再現。
# Cloud Run では 1 Pod 内 localhost 通信、ローカルでは別コンテナ + ネットワーク。
# nginx.conf.tmpl の VOICEVOX_UPSTREAM 環境変数でこの差異を吸収する。

services:
  proxy:
    build: .
    container_name: voicevox-proxy
    ports:
      - "8080:8080"            # ホスト localhost:8080 → コンテナ 8080
    environment:
      # nginx.conf.tmpl で envsubst される値群
      VOICEVOX_AUTH_TOKEN: ${VOICEVOX_AUTH_TOKEN:?VOICEVOX_AUTH_TOKEN must be set in .env}
      ALLOWED_ORIGIN: ${ALLOWED_ORIGIN:-http://localhost:5173}
      VOICEVOX_UPSTREAM: voicevox:50021   # ローカルでは別コンテナを名前解決
    depends_on:
      voicevox:
        condition: service_healthy
    restart: unless-stopped

  voicevox:
    image: voicevox/voicevox_engine:cpu-latest
    container_name: voicevox-engine
    # Cloud Run 側 §1.3 service.yaml の resources.limits と揃える
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 2g
    healthcheck:
      # /version は VOICEVOX エンジンが起動完了したら 200 を返す軽量エンドポイント
      test: ["CMD-SHELL", "wget -q -O - http://localhost:50021/version || exit 1"]
      interval: 5s
      timeout: 3s
      retries: 30
      start_period: 60s        # モデル読み込みに最大 60 秒(コールドスタート)
    restart: unless-stopped

# docker-compose v2 はネットワーク明示不要(デフォルトで services 名で名前解決可)
```

### 3.1 設計ポイント

| 設定 | 意味 |
|---|---|
| `VOICEVOX_AUTH_TOKEN:?...` | `.env` で未設定なら起動エラー(うっかり空トークンで起動するのを防ぐ) |
| `VOICEVOX_UPSTREAM: voicevox:50021` | ローカル特有、Cloud Run 側は `127.0.0.1:50021`(§5) |
| `condition: service_healthy` | VOICEVOX が `/version` 200 を返すまで proxy 起動を遅延 |
| `start_period: 60s` | VOICEVOX のモデル初回読み込み中はヘルスチェック失敗を許容 |
| `container_name` 明示 | `docker logs voicevox-proxy` のように名前で参照可能 |
| `restart: unless-stopped` | ローカル開発でクラッシュしても自動復旧 |

---

## 4. `nginx.conf.tmpl` の修正(1 行)

Cloud Run deploy ワークフロー v0.1 §1.2 の `nginx.conf.tmpl` で、 `proxy_pass http://127.0.0.1:50021;` を **環境変数化** :

### 4.1 修正前(v0.1)

```nginx
proxy_pass http://127.0.0.1:50021;
```

### 4.2 修正後(v0.2 相当、ローカル / Cloud Run 両対応)

```nginx
proxy_pass http://${VOICEVOX_UPSTREAM};
```

### 4.3 修正の全体像(Cloud Run deploy ワークフロー v0.2 への申し送り)

`nginx.conf.tmpl` の差分:

```diff
         # VOICEVOX サイドカーへフォワード
-        proxy_pass http://127.0.0.1:50021;
+        proxy_pass http://${VOICEVOX_UPSTREAM};
         proxy_http_version 1.1;
```

それ以外の `nginx.conf.tmpl` は変更なし。

### 4.4 envsubst が VOICEVOX_UPSTREAM を展開してくれる根拠

nginx:alpine の起動 entrypoint(`/docker-entrypoint.d/20-envsubst-on-templates.sh`)は、 **`/etc/nginx/templates/*.tmpl` 内のすべての `${VAR}`** を環境変数で置換する。 つまり nginx の `set` ディレクティブを使わなくても、 起動時の環境変数で `proxy_pass` のホスト部分を切替えられる。

---

## 5. `service.yaml.tmpl` への env 追加(1 ブロック)

Cloud Run deploy ワークフロー v0.1 §1.3 の `service.yaml.tmpl` 内、 `proxy` コンテナの `env:` セクションに **1 ブロック追加** :

```yaml
        - name: proxy
          image: ${PROXY_IMAGE_URI}
          ports:
            - containerPort: 8080
          env:
            - name: VOICEVOX_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: voicevox-auth-token
                  key: latest
            - name: ALLOWED_ORIGIN
              value: "${ALLOWED_ORIGIN}"
            # ↓ ここを追加(Cloud Run では同一 Pod の localhost を指す)
            - name: VOICEVOX_UPSTREAM
              value: "127.0.0.1:50021"
```

これで Cloud Run でも `${VOICEVOX_UPSTREAM}` が `127.0.0.1:50021` に展開され、本番動作は v0.1 と完全に同等。

### 5.1 Cloud Run deploy ワークフロー の改訂提案

Cloud Run deploy ワークフロー v0.1 を **v0.2 として改訂** してもらうか、本書を「v0.1 への補足差分」として参照してもらうかはエルトン判断(§11 Q-U-f-1)。

差分の量は **2 行(`proxy_pass` 1 行 + `env:` 1 ブロック)** のみで、改訂版を起こすか追記で済ますかは軽い決定。

---

## 6. `.env.example` / `.gitignore`

### 6.1 `cloudrun-voicevox/.env.example`(新規)

```
# ローカル動作確認用の環境変数テンプレート。
# このファイルをコピーして .env を作る:
#   cp .env.example .env
# その後、VOICEVOX_AUTH_TOKEN を実値に置き換える。

# ローカル proxy が要求する Bearer トークン。
# 生成方法(任意):
#   openssl rand -hex 32
# あるいは PowerShell:
#   [byte[]]$bytes = New-Object byte[] 32; \
#   ([System.Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($bytes); \
#   ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
#
# ※ 本番(GitHub Secrets)とは別の値で問題ない。
#   ローカル用とテストで明示的に変えたい場合はそうする。
VOICEVOX_AUTH_TOKEN=replace-me-with-64-hex-chars

# CORS で許可する Origin(ローカルでは Vite デフォルトを想定)
ALLOWED_ORIGIN=http://localhost:5173
```

### 6.2 `cloudrun-voicevox/.gitignore`(新規)

```
# ローカル環境変数(秘密含む、絶対にコミットしない)
.env

# 任意のローカル一時生成物
*.local
```

リポジトリルートに既に `.gitignore` がある場合は、 `cloudrun-voicevox/.env` を追記でも可。

### 6.3 PowerShell でのトークン生成スニペット(再掲、WIF 手順書 §8 と同じ)

Windows ユーザーで openssl が無い場合:

```powershell
[byte[]]$bytes = New-Object byte[] 32
([System.Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
```

→ 出力された 64 文字の 16 進数を `.env` の `VOICEVOX_AUTH_TOKEN=` に貼る。

---

## 7. `README.md` への追記案

Cloud Run deploy ワークフロー v0.1 §1.5 の `cloudrun-voicevox/README.md` に **「ローカル動作確認」セクション追記** :

```markdown
## ローカル動作確認(Cloud Run なしで動かす)

### 1. 環境変数の準備

```sh
cd cloudrun-voicevox
cp .env.example .env
# .env を開いて VOICEVOX_AUTH_TOKEN を openssl で生成した値に置き換える
```

### 2. 起動

```sh
docker compose up --build
```

初回は VOICEVOX イメージ(~ 700MB)の pull に 2-5 分かかる。
2 回目以降はキャッシュで 10 秒以内。

### 3. 動作確認

別ターミナルで:

```sh
# ヘルスチェック(認証不要)
curl http://localhost:8080/healthz
# → ok

# 認証なし → 401 が正しい
curl -i http://localhost:8080/version
# → HTTP/1.1 401 Unauthorized

# 認証あり → 200 + バージョン JSON
curl -H "Authorization: Bearer $(grep VOICEVOX_AUTH_TOKEN .env | cut -d= -f2)" \
     http://localhost:8080/version
# → 200 + {"version":"0.x.y"}
```

### 4. nginx.conf を編集して試す

`nginx.conf.tmpl` を編集 → `docker compose restart proxy` で 5 秒程度で反映。
編集ループの 30 秒台短縮。

### 5. 停止

```sh
docker compose down
```
```

---

## 8. 検証ループの実践パターン

### 8.1 nginx.conf を変えて挙動を観察するループ

```
[T+0:00] nginx.conf.tmpl を編集 / 保存
[T+0:05] docker compose restart proxy
[T+0:15] curl http://localhost:8080/...
[T+0:25] レスポンス確認 → 期待どおりか判定 → 次の編集へ
```

1 サイクル 30 秒以内。Cloud Run 経由(5分)の **10 倍速い** 。

### 8.2 任意ツール: `tools/smoke-local.sh`(本書 §0.1 の任意ファイル)

Cloud Run deploy ワークフロー v0.1 §1.4 の smoke test 3 件と等価のチェックをローカルで一発実行:

```bash
#!/usr/bin/env bash
# tools/smoke-local.sh
# ローカル docker-compose で起動中の proxy に対して 3 件 smoke test
# 使用: bash tools/smoke-local.sh

set -eu

BASE="${BASE:-http://localhost:8080}"
TOKEN="${VOICEVOX_AUTH_TOKEN:-$(grep ^VOICEVOX_AUTH_TOKEN .env 2>/dev/null | cut -d= -f2)}"

if [ -z "$TOKEN" ]; then
  echo "VOICEVOX_AUTH_TOKEN is not set (env var or .env)" >&2
  exit 1
fi

echo "→ 1) /healthz (expects 200)"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/healthz")
[ "$status" = "200" ] || { echo "  FAIL: got $status"; exit 1; }
echo "   OK"

echo "→ 2) /version without auth (expects 401)"
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/version")
[ "$status" = "401" ] || { echo "  FAIL: got $status"; exit 1; }
echo "   OK"

echo "→ 3) /version with auth (expects 200)"
status=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/version")
[ "$status" = "200" ] || { echo "  FAIL: got $status"; exit 1; }
echo "   OK"

echo ""
echo "All 3 smoke tests passed."
```

PowerShell 版が必要なら別途起こすが、Windows でも Git Bash で本スクリプトは動く想定。

---

## 9. ベータ運用に直結する副次課題の整理(エルトン指示反映)

Cloud Run deploy ワークフロー v0.1 §10 副次課題 6 点のうち、 **ベータ運用に直結するもの** を本書で再確認:

| # | 項目 | ベータ運用への直結度 | 本書での扱い |
|---|---|---|---|
| 10.1 | docker-compose.yml | 🔴 直結 | **本書で吸収** |
| 10.2 | Cloud Logging フィールド除外 | 🟢 商品化版 | 保留 |
| 10.3 | GitHub Environments(prod ゲート) | 🟢 商品化版 | 保留 |
| 10.4 | Custom Domain Mapping | 🟢 Phase 4 | 保留 |
| 10.5 | secretmanager.secretAccessor 範囲 | 🟡 ベータでも要注記 | §9.1 で再確認 |
| 10.6 | 仕様書 v1.5 反映 | 🟢 エルトン管轄 | 保留 |

### 9.1 §10.5 再確認: SA への Secret アクセス権限はベータでも現状の最小権限を維持

Cloud Run deploy ワークフロー v0.1 のワークフロー内では、Secret Manager の `voicevox-auth-token` **単体** に対して `roles/secretmanager.secretAccessor` を付与している(プロジェクト全体ではない)。

これは:
- 「もし将来別の secret を作っても、 SA から自動アクセス可能にはならない」 → 最小権限維持
- 新 secret 追加時は明示的に bind する運用ルール

ベータ運用上は **現状の設計で問題なし** 。判断仰ぎ事項にする必要なし。

---

## 10. リスク・トレードオフ

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | VOICEVOX エンジンの 700MB pull で初回起動が遅い | 🟢 低 | ローカルでは1回 pull したら 2回目以降キャッシュ |
| 2 | docker-compose と Cloud Run でネットワーク差異(`voicevox:50021` vs `127.0.0.1:50021`) | 🟡 中 | **§4 / §5 で VOICEVOX_UPSTREAM 変数化により吸収** |
| 3 | `.env` をうっかりコミット → AUTH_TOKEN 漏洩 | 🟡 中 | `.gitignore` 必須(§6.2) + ローカル用は本番と別値が原則 |
| 4 | Windows の改行コード(CRLF)で nginx.conf.tmpl の envsubst が失敗 | 🟢 低 | リポジトリ側で `.gitattributes` で `*.tmpl text eol=lf` を指定推奨(将来) |
| 5 | Docker Desktop のメモリ割り当て不足(2GiB 必要)で voicevox が OOM | 🟢 低 | Docker Desktop の Settings → Resources で 4GB 以上を割り当て推奨 |
| 6 | ローカル AUTH_TOKEN を「忘れて再生成」する度に変わる | 🟢 低 | `.env` に保存してあるので問題なし、Cloud Run 本番側とは別系統 |

---

## 11. たかしさんに判断を仰ぎたい事項

| # | 事項 | Uさん 感触 |
|---|---|---|
| Q-U-f-1 | Cloud Run deploy ワークフロー v0.1 への 2 行修正(§4 / §5)を:(a) v0.2 として改訂版を起こす、(b) 本書を参照する形で v0.1 のまま運用、どちらにするか | **(b) 本書参照** 推奨。 修正量が 2 行で、 v0.2 起草は冗長。本書の §4 / §5 を v0.1 の補足として位置付ければ十分 |
| Q-U-f-2 | `tools/smoke-local.sh` を同梱するか(§8.2 任意ファイル) | **同梱** 推奨。ローカル検証ループの即起動性を高める、bash スクリプト 30 行のため軽量 |
| Q-U-f-3 | `.env.example` / `.gitignore` を `cloudrun-voicevox/` 配下に置くか、リポジトリルートで一括管理か | **`cloudrun-voicevox/` 配下** 推奨。 サブディレクトリ完結で他コンポーネント追加時に独立管理しやすい |

---

## 12. 副次的に気づいた課題

### 12.1 `docker-compose.yml` の Windows / macOS 動作差

- Windows + WSL2 backend: 標準的に動作
- Apple Silicon Mac: `voicevox/voicevox_engine:cpu-latest` は amd64 image のため、Rosetta 経由でかなり遅い可能性
- 商品化版で開発チーム拡大時に **Apple Silicon 向け arm64 build** または **`platform: linux/amd64` 明示** 等の対応が必要
- ベータ v1.0 ではたかしさん環境(Windows 11)で問題なし

### 12.2 ローカル証明書(HTTPS)

- ベータ家族テスト時、 PWA は HTTPS でしか Service Worker 等が動かない
- ローカルで PWA + Cloud Run 統合を試す場合、 PWA 側は `https://localhost:5173`(mkcert 等で証明書発行)、 VOICEVOX proxy は `http://localhost:8080` の混合になり、mixed content 警告が出る可能性
- → Sさん フロント実装着手後の論点、本書スコープ外

### 12.3 nginx.conf 編集後の自動再ロード

本書では `docker compose restart proxy` を明示しているが、 nginx のホットリロード機能(`docker compose exec proxy nginx -s reload`)も可。 起動コストが軽い `restart` の方が確実なため本書では restart 案を採用。

### 12.4 ログの可視化

`docker compose logs -f proxy voicevox` で両コンテナの stdout を tail できる。 nginx の access_log / VOICEVOX の合成ログを見ながら検証可。 README に追記候補。

---

## 13. 完了報告 + 待機モードへの移行宣言

```
[Phase 2 Sprint 1 案ω) docker-compose ローカル動作確認 完了報告]
完了日時: 2026-05-19(火)深夜
所要時間: 約75分(想定 60-90分内)
成果物のファイルパス:
  C:\dev\InvokeAide\docs\Phase2\Phase2_docker_compose_ローカル動作確認_v0.1_2026-05-19.md

主要な発見 / 判断:
  - docker-compose v2 構文で 2 コンテナ(proxy + voicevox)、healthcheck +
    condition: service_healthy で起動順序を制御
  - Cloud Run と docker-compose の唯一の差異(コンテナ間通信先)を
    `VOICEVOX_UPSTREAM` 環境変数で吸収 → 本書 §4 / §5 が本番側への小修正
    (Cloud Run deploy ワークフロー v0.1 への 2 行追加)
  - .env.example + .gitignore で AUTH_TOKEN 漏洩リスクを構造的に回避
  - tools/smoke-local.sh で Cloud Run 側 smoke test 3 件と等価のローカル
    実行スクリプト(任意同梱)
  - 検証ループ 5 分 → 30 秒台、Cloud Run 課金ゼロ、たかしさん「触って覚える」
    ハードルを大幅低下
  - ベータ運用に直結する副次課題(Cloud Run deploy v0.1 §10)を §9 で
    再確認、§10.5 SA Secret アクセス権限は最小権限で OK と判定

Sさん との結合点(エルトン経由で Sさん に通知依頼):
  - フロント側 Vite 開発時、ローカル proxy として VITE_VOICEVOX_ENDPOINT=
    http://localhost:8080 + VITE_VOICEVOX_AUTH_TOKEN=... を環境変数で渡す
    パターンが Sさん 設定画面 / TTSProvider 実装に便利
  - 本書 docker-compose を立ち上げておけば、Sさん フロント実装の VOICEVOX
    結合テストが Cloud Run 課金ゼロで可能

Tさん との結合点(エルトン経由で Tさん に通知依頼):
  - tools/smoke-local.sh は Tさん CI 基盤の前段でも使える(GitHub Actions
    上で docker compose up → smoke-local.sh 実行 → 結果評価)
  - PR ごとの自動 nginx.conf / Dockerfile 変更検証に発展可能

たかしさんに判断を仰ぎたい事項: 本書 §11 に 3点
  Q-U-f-1: Cloud Run deploy ワークフロー への 2 行修正を v0.2 改訂か参照運用か
           (感触:(b) 本書参照で運用)
  Q-U-f-2: tools/smoke-local.sh を同梱するか(感触:同梱)
  Q-U-f-3: .env.example / .gitignore の配置(感触:cloudrun-voicevox/ 配下)

副次的に気づいた課題: 本書 §12 に 4点(うちベータ直結なし、すべて将来検討)

---
【待機モード移行宣言】

エルトン 2026-05-19 夜の「ペース調整提案」を尊重し、本書をもって Uさん は
純粋待機モードに移行します。

待機中:
  - Uさん 側から新しい起草タスクを開始することはしない
  - たかしさん作業(Block A〜D + WIF 手順書実行 + cloudrun-voicevox 配置)
    の進捗報告 / 質問 / エラー報告を受けたら、本書群を参照して支援
  - Sさん の Storage / TTSProvider interface 確定起草の完了報告を待つ
  - Tさん の CI 基盤構築の完了報告を待つ
  - 上記 2 エージェントの成果物を受領した時点で、Uさん 側の整合性確認と
    次タスク選定(DriveStorage 実装設計、TTSProvider 実装 等)を提案

本日 6 本(a / c / b / Cloud Run 事前調査 / WIF 手順書 / deploy WF / docker-compose)
の起草で Sprint 1 Uさん 並列領域は概ね埋まり、たかしさんの実作業着手 →
Sさん contract 確定 → Tさん CI 統合 を待つ局面に到達。

おやすみなさい、エルトン。本日の伴走、ありがとうございました。
```

---

## 14. 変更履歴

| 版 | 日時 | 変更内容 | 起草者 |
|---|---|---|---|
| v0.1 | 2026-05-19(火)深夜 | 初版作成。docker-compose.yml 全文 / nginx.conf.tmpl + service.yaml.tmpl の 2 行修正 / .env.example + .gitignore / README 追記案 / smoke-local.sh / 副次課題ベータ直結再確認 / 判断仰ぎ 3点 / 待機モード移行宣言 | Uさん(Opus) |

---

**以上、Uさん 案ω) docker-compose ローカル動作確認 v0.1。これにて Uさん 本日 Sprint 1 起草を完了し、純粋待機モードに移行します。**
