# 指示文: Sさん — .env.example 起草と OAuth クライアント ID 設置

**作成**: 技術顧問エルトン（Claude.ai 側） / 2026-05-30
**宛先**: Sさん（実機検証担当、PC2 / `C:\dev\InvokeAide`）
**承認**: たかしさん（2026-05-30）
**前提**:
- `docs/Phase2/Phase2_QUj_Sさん_contract確認回答_v0.1_2026-05-26.md` §4（Q-U-j-3 の `.env.*` + `import.meta.env` 方針）
- `InvokeAide引き継ぎ帳_2026-05-28.md` §1（OAuth クライアント ID 設置が「次回最初にやること」と明記）
- 5/28 取得済み OAuth クライアント ID: `774404505928-blg7ck65c8fp0l1valtjdhe5c3ofm1ak.apps.googleusercontent.com`

---

## 1. 背景

Sさん 自身が起草した Q-U-j-3 回答（2026-05-26）で「**Vite 標準の `.env.*` + `import.meta.env` を採用**」と確定済み。`.env.example` の中身案も既に Q-U-j-3 §4 で提示されている。

5/28 に取得した OAuth クライアント ID（`774404505928-...`）が、まだプロジェクトに設置されていない。引き継ぎ帳 §1 で「次回最初にやること」と明記されている宿題。

本指示文では、Sさん（実機検証担当）に以下2点を依頼:

1. **`.env.example` の起草**（commit 対象、テンプレート）
2. **`.env.local` への実 OAuth クライアント ID 設置**（commit 対象外、ローカルのみ）

これは Uさん の contract v0.2 切替作業と独立しており、並行で進められます。

## 2. やってほしいこと

### 2-1. `.env.example` の作成

プロジェクトルートに `.env.example` ファイルを新規作成。Q-U-j-3 §4 で提示された内容をベースに、現状を反映:

```
# Google OAuth Client (取得手順: 環境3点取得手順メモ_InvokeAide_2026-05-27.md §C)
VITE_GOOGLE_CLIENT_ID=YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com

# OAuth リダイレクト URI（ローカル開発: 5173 / 本番: club-freedom.tokyo 配下）
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback

# VOICEVOX エンジン（ベータ v1.0 は Cloud Run 経由を想定、現時点では localhost も可）
VITE_VOICEVOX_ENDPOINT=http://localhost:50021
VITE_VOICEVOX_AUTH_TOKEN=

# Gemini API (BYOK モデルだが、テスト用にデフォルトを env で渡す場合のフォールバック)
# 本番ではユーザーが設定画面から入力するため、ここは空でOK
VITE_GEMINI_API_KEY_FALLBACK=
```

注意点:
- **`.env.example` には実際のキー・トークンを書かない**（テンプレートのみ）
- コメント行（`#`）で各変数の用途を簡潔に説明
- 「YOUR_OAUTH_CLIENT_ID」のような明示的なプレースホルダを使う

### 2-2. `.env.local` の作成（ローカル専用）

プロジェクトルートに `.env.local` を新規作成。**実際の OAuth クライアント ID を設置**:

```
VITE_GOOGLE_CLIENT_ID=774404505928-blg7ck65c8fp0l1valtjdhe5c3ofm1ak.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_VOICEVOX_ENDPOINT=http://localhost:50021
VITE_VOICEVOX_AUTH_TOKEN=
VITE_GEMINI_API_KEY_FALLBACK=
```

⚠️ **重要**: `.env.local` は **commit してはいけない**（既に `.gitignore` で除外されているはず、要確認）。

### 2-3. `.gitignore` の確認・修正

`.gitignore` を開いて、以下が含まれているか確認:
```
.env
.env.local
.env.development
.env.staging
.env.production
.env.*.local
```

もし不足があれば追記してください。`.env.example` だけは commit するので、除外しないこと。

### 2-4. README または docs/ への記載

`.env.local` の存在を README.md または `docs/` 配下の適切な場所に記載:

例:
> ## 開発環境のセットアップ
> 
> 1. `.env.example` を `.env.local` にコピー
> 2. 実際の OAuth クライアント ID 等を設定
> 3. `.env.local` は commit 対象外（個人の認証情報のため）

具体的に書く場所は、既存 README の構造を見て判断してください。新規ファイル作成より、既存ドキュメントへの追記を優先。

## 3. 動作確認

### 3-1. ファイル存在確認

```powershell
ls .env.example
ls .env.local
git check-ignore .env.local  # 除外されていることを確認
```

### 3-2. Vite から環境変数が読めるか（軽量チェック）

`npm run dev` で開発サーバーが起動し、`import.meta.env.VITE_GOOGLE_CLIENT_ID` が正しい値を返すこと。簡易確認のため、コンソールに値を出力する一時コード（後で削除）を入れても良い。

ただし、現時点で B2 実装が未着手なので、Vite が起動しないか機能不全の可能性もある。**起動エラーが出た場合、深追いせず「起動失敗、確認は B2 実装後に持ち越し」と報告**してください。

### 3-3. git status 確認

```powershell
git status
```

期待される結果:
- `.env.example`: untracked（commit 対象）
- `.env.local`: 表示されない（gitignore 効いている）

`.env.local` が git status に出てきたら、`.gitignore` の設定を見直してください。

## 4. やらないこと

- **B2 本体実装は範囲外**（別ターンで GO 判断）
- **本番用 `.env.production` の起草は範囲外**（GitHub Secrets 経由で CI で生成する設計、Q-U-j-3 §4 参照）
- **Gemini API キーの実取得・実設置は範囲外**（テスト用なので fallback 空でOK）

## 5. 完了時の報告

1. 作成したファイル一覧（`.env.example` / `.env.local` / .gitignore 更新 / README 追記）
2. `.env.local` が git で除外されていることの確認結果
3. Vite 起動チェックの結果（成功 / 失敗 / 持ち越し）
4. その他、想定外の挙動
5. メモリ更新

完了後、Sさん は「.env 整備完了。次の指示を待ちます。」と出力して停止してください。

## 6. 想定工数

15〜30分。短時間で終わるタスク。

## 7. 注意

- **.env.local には実 OAuth クライアント ID を書く（commit しない）**
- **.env.example はプレースホルダで書く（commit する）**
- この区別を間違えると、認証情報が GitHub に流出する。Sさん は実機検証担当として、この種の事故防止を本職とする立場。慎重に。

---

このファイル名は引き継ぎ帳の規約 `指示文_<topic>_<YYYY-MM-DD>.md` に従っています。
