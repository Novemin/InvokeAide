# InvokeAide

ユーザーが自分の右腕として AI 秘書を「召喚」し、対話を通じて日常を支援してもらう道具(仮称: 秘書召喚アプリ)。

## 位置づけ

- **コードベース名**: InvokeAide
- **プロダクト仮称**: 秘書召喚アプリ
- **正式名称**: 未定(Novem Intelligence のサブブランド検討中)
- **配信形態目標**: PWA + Capacitor で App Store / Google Play 配布
- **ベータ v1.0 配布目標**: 2026-07-04 / 05(家族集まり)
- **ステータス**: 🚧 Work in Progress(Phase 2 Sprint 1 着手段階)

## ベータ v1.0 のコア機能(現時点)

- 設定画面 + AI 明示宣言 + 年齢確認 + 規約同意
- Calendar / Tasks 連携(Google API)
- BYOK モデル(ユーザーが Gemini API キーを持つ)+ AI 抽象化レイヤー(Claude / OpenAI への切替可)
- VOICEVOX 自前 Cloud Run(できれば、無理なら Web Speech フォールバック)
- スマホ音痴対応 UX(妥協不可、家族テスター含むペルソナ別検証)
- コーチング機能(18:00 通知、ランク別プッシュ、キャラ別口調)

## チーム体制

| 役割 | 担当 |
|---|---|
| プロジェクトオーナー | たかしさん(最終判断・レビュー)|
| 戦略・整理役 | エルトン(Claude.ai プロジェクト側)|
| 主実装担当 | Sさん(Sonnet)|
| 実装補助担当 | Uさん(Opus)|
| テスト・品質・ドキュメント担当 | Tさん(本リポジトリの基盤起草者)|

詳細は `docs/CLAUDE.md` §2 参照。

## 技術スタック(Phase 1 Step 3 v0.3 で確定)

- フロントエンド: Vue 3 + Vite + TypeScript(strict mode)
- バックエンド: フロントエンド完結 + VOICEVOX 自前 Cloud Run のみ
- データ保管: ユーザーの Google Drive 内完結
- AI 抽象化: アダプタパターン(Gemini 1実装で開始、Claude/OpenAI 切替可能設計)
- 音声合成: VOICEVOX 第一 + Web Speech フォールバック
- 音声認識: OS 標準音声入力依存
- 認証: BYOK + Google OAuth(Stage 1/2 段階的同意)
- CI/CD: GitHub Actions + プライベートリポジトリ

詳細は `docs/Phase1/Phase1_技術スタック決定提案_v0.3_2026-05-18.md` 参照。

## リポジトリ構造

```
.
├── src/                    # アプリ本体(Sさん 主実装領域)
│   ├── App.vue             # 最小ダミー(Tさん 基盤段階)
│   ├── main.ts
│   └── vite-env.d.ts
├── tests/                  # テスト全般(Tさん 領域)
│   ├── unit/               # Vitest ユニットテスト
│   ├── integration/        # Vitest 統合テスト + MSW
│   ├── e2e/                # Playwright E2E
│   ├── a11y/               # @axe-core/playwright
│   ├── mocks/              # MSW handlers + server
│   └── setup.ts            # Vitest セットアップ
├── scripts/                # 静的解析(Tさん 領域)
│   ├── check-legal-expressions.js   # 法的書類 NG ワード辞書(H1/H7)
│   └── check-coaching-prompts.js    # コーチング NG ワード辞書(H8、9カテゴリ)
├── docs/                   # 設計・思想・成果物(エルトン主導、各エージェント参照)
│   ├── Phase1/             # Phase 1 各成果物
│   ├── Phase2/             # Phase 2 各成果物
│   ├── CLAUDE.md           # プロジェクト全体方針
│   └── 秘書召喚アプリ仕様書_*.md / 法的書類起草指示書_*.md / 思想書_*.md
├── handover/               # エージェント起動時の文脈ドキュメント
│   └── inception_context.md
├── memory/                 # プロジェクト共有メモリ(Sさん・Tさん・Uさん 参照)
└── .github/workflows/      # GitHub Actions(ci.yml / e2e.yml / nightly.yml)
```

### Tさん vs Sさん 領域の境界(2026-05-20 エルトン確定)

- **Tさん 領域**: `tests/` / `scripts/` / `.github/workflows/` / 開発ツール設定(`package.json` / `tsconfig*.json` / `vite.config.ts` / `vitest.config.ts` / `playwright.config.ts` / `.eslintrc.cjs` / `.prettierrc.json` / `lighthouserc.json`)
- **Sさん 領域**: `src/` 配下の本格ロジック実装(現在は最小ダミー、Sさん が `src/interfaces/` / `src/implementations/` / `src/services/` / `src/components/` / `src/stores/` / `src/characters/` を追加していく)
- **共通領域**: `package.json` に Sさん が依存追加するのは通常作業として OK

## 開発フロー

### セットアップ

```bash
npm install
```

Node.js 20 LTS 以上(ローカル開発は Node 22+/24 でも動く想定、ただし CI は 20 で固定)。

### よく使うコマンド

| コマンド | 用途 |
|---|---|
| `npm run dev` | Vite 開発サーバー起動 |
| `npm run build` | 本番ビルド(`vue-tsc --noEmit && vite build`) |
| `npm run preview` | ビルド成果物のローカルプレビュー |
| `npm run lint` / `npm run lint:fix` | ESLint(Vue + TypeScript) |
| `npm run typecheck` | vue-tsc による型検査 |
| `npm run format` | Prettier フォーマット |
| `npm run test` | Vitest ユニット + 統合テスト |
| `npm run test:watch` | Vitest watch モード |
| `npm run test:coverage` | カバレッジ生成 |
| `npm run test:e2e` | Playwright E2E |
| `npm run test:a11y` | Playwright a11y |
| `npm run check:legal` | 法的書類 NG ワード辞書(H1/H7)静的検査 |
| `npm run check:coaching` | コーチング NG ワード辞書(H8、9カテゴリ)静的検査 |
| `npm run check:all` | lint + typecheck + check:legal + check:coaching + test を順次実行 |
| `npm run lighthouse` | Lighthouse CI |

### CI

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `.github/workflows/ci.yml` | PR 作成・更新 | Lint / 型検査 / 静的解析 / Vitest |
| `.github/workflows/e2e.yml` | main マージ後 | Playwright E2E / Lighthouse CI |
| `.github/workflows/nightly.yml` | 毎日 + 手動 | クロスブラウザ E2E + Uさん deploy-voicevox.yml smoke test 連携余地 |

## 設計思想

- **「効率化のためのAI」ではなく「人間味のためのAI」**(思想書 §2)
- **「未来の自分を縛らない」原則**(法的書類 v0.3 §1.2)— 断定表現を避け、限定表現を使う。コード/コメント/テスト名にも適用
- **「対等な相棒」**(仕様書 v1.4 §19、DAO 的フラット組織)
- **「言った/実装した/テストした」三位一体**(Tさん テスト戦略 v0.2 で確立、 法的書類の必須要件を実装とテストに直接マッピング)

## 法的書類

`docs/秘書召喚アプリ_法的書類起草指示書_v0_3_2026-05-17.md` でドラフトを起草中。

主要な必須要件:
- AI 明示宣言(EU AI Act §50)
- 擬人化誤認注記(キャラクター演技は「会話体験を豊かにする目的の演出」)
- 年齢確認(13歳未満不可、13–18歳保護者同意)
- BYOK モデルの明示
- 第三者 AI サービス切替可能性(Gemini / Claude / OpenAI)
- 「未来の自分を縛らない」原則(限定表現)

商品化前に AI/IT 法務専門弁護士のレビューを受ける前提。

## ライセンス

ベータ v1.0 段階では未設定。商品化前に確定予定。

OSS ライセンス整理(VOICEVOX キャラクター、npm ライブラリ等)は法的書類起草指示書 v0.3 §8.7 で論点として記録。

## このリポジトリの初回 push(2026-05-20 段階)

Tさん 主導でテスト基盤スケルトン(`tests/` / `scripts/` / `.github/workflows/` / 開発ツール設定一式 + `src/` 最小ダミー)を起草、 CI 緑化マイルストーンを達成した状態。Sさん の本格実装着手はこの後。

詳細は `docs/Phase1/Phase1_テスト戦略案_v0.2_2026-05-19.md` 参照。
