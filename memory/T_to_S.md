# T_to_S.md — Tさん から Sさん への申し送り(永続)

このファイルは **Tさん(品質・テスト・ドキュメント) から Sさん(実装) への永続的な引き継ぎノート** 。
特定の Sprint で発生した Sさん 起草時の必須対応事項を蓄積し、 Sさん 起草開始時の参照点として機能する。

セッション横断で参照する性質のため `memory/` 配下に配置。
個別 Sprint レビュー報告(`docs/Phase1/Phase1_申し送り_Sさん_*.md`)とは別物。

---

## 凡例

- 🔴 **必須対応**: Sさん 起草 PR に必ず含める
- 🟡 **推奨対応**: Sさん 起草時に意識、 対応有無は Sさん 判断 + PR で根拠明記
- 🟢 **情報共有**: 知識として持っていてほしい情報、 対応必須ではない

---

## 1. 🔴 Sprint 2: src/App.vue 本実装時、 a11y skip 解除 + lighthouse 指摘再確認をセットで行う

### 経緯

2026-05-20 GitHub 初回 push 直後、 E2E ワークフローが赤化。
原因: `tests/a11y/sample.spec.ts` の axe-core スモークテストが、 Tさん が暫定配置した最小ダミー `src/App.vue` に対して a11y 違反を検出。

2026-05-21 週末タスクA② で「lighthouse 指摘対応」 が同じ性質と判明 — 現状のダミー段階の指摘は Sprint 2 本実装で変化するため、 ダミー段階で対応する価値が限定的。 a11y skip と同じ判断ロジックで Sprint 2 統合に確定。

### 対応(2026-05-20 / 2026-05-21 確定)

- 案A(skip + 三重ガード)で確定(エルトン承認 2026-05-20)
- 該当テストを `test.skip` 化、 直上に TODO コメント明示
- `scripts/check-skipped-tests.js` で skip 忘却防止の静的検査を CI に組み込み
- 本ファイル(T_to_S.md)に永続申し送り化
- ② lighthouse 指摘対応も同じく Sprint 2 統合に確定(案X3、 エルトン承認 2026-05-21)

### Sさん 起草時の必須アクション

Sさん が `src/App.vue` を **最小ダミーから本実装(オンボーディング/ホーム画面実装)に置き換える PR を出す時** 、 以下を **セットで** 同 PR に含めること:

#### a11y skip 解除(必須)

1. **`tests/a11y/sample.spec.ts` の `test.skip` を `test` に戻す** (1箇所)
2. その上で **axe-core 違反が 0 件になる** ことを Playwright で動作確認
3. もし違反が残る場合、 src/App.vue 側で a11y 対応してから PR を出す
4. PR description に「a11y skip 解除済み、 axe-core 0件確認済み」と明記

#### lighthouse 指摘再確認(必須、 2026-05-21 追記)

1. GitHub Actions の **E2E ワークフロー lighthouse ジョブ** の出力を確認(`lighthouserc.json` assertion 結果)
2. 4カテゴリのスコアを確認:
   - performance(warn, minScore 0.8)
   - accessibility(error, minScore 0.9)
   - best-practices(warn, minScore 0.8)
   - seo(warn, minScore 0.8)
3. assertion error(accessibility < 0.9 等)が出た場合、 同 PR 内で対応
4. PR description に「lighthouse 指摘再確認済み、 4カテゴリ閾値クリア」 と明記

#### なぜセットで行うか

- a11y(axe-core)と lighthouse の a11y は **検査軸が異なる**(axe-core はルールベース、 lighthouse は scoring ベース)
- src/App.vue 本実装が同 PR で入る = 一度のレビューで両方確認できる方が認知負荷低
- Sprint 2 で再度「やっぱり lighthouse 指摘あり、 別 PR で対応」 となるよりも、 同 PR でクローズした方が手戻り少

### Sさん が a11y 対応で意識すべきポイント(参考)

最小ダミーで検出された violation の典型(将来本実装でも気をつけるべき):

- `<html lang="ja">` 必須(`index.html` で既に設定済み、 SPA 内で動的変更しないこと)
- `<main>` ランドマーク or `role="main"` の明示
- ボタンや入力欄に **アクセシブルな名前**(`aria-label` / `<label>` 関連付け)
- カラーコントラスト 4.5:1 以上(白背景 + 薄いグレー文字は NG)
- フォーカス可視リング を `outline: none` で消さない(消すなら代替リングを用意)

詳細は `docs/Phase1/Phase1_テスト戦略案_v0.2_2026-05-19.md §10.1 既知 skip リスト` と
`§17.5 axe-core + Lighthouse CI セットアップ` を参照。

### Tさん 側の対応(完了済み)

- ✅ tests/a11y/sample.spec.ts に `test.skip` + 解除条件コメント
- ✅ scripts/check-skipped-tests.js 新設(コメント無し skip を CI で検出)
- ✅ package.json に `check:skipped` script 追加
- ✅ .github/workflows/ci.yml に skip 検査ステップ追加
- ✅ テスト戦略 v0.2 §10 に「Sprint 1 期間中の既知 skip リスト」追加
- ✅ 2026-05-21 追記: lighthouse 指摘も Sprint 2 統合に確定、 本セクションをセット化

---

## 2. 🟡 src/ 配下に新規 skip を入れる時は必ず TODO コメント明示

### 必要性

`scripts/check-skipped-tests.js` は `.skip` 直上 8行以内に以下のコメントを必須化する:

```typescript
// TODO(誰→誰): <短い説明>
// 解除条件: <skip 解除すべき条件>
// 担当: <誰がいつ解除するか>
// 関連: <参照ドキュメント>
test.skip('テスト名', () => { ... });
```

これは「永遠の skip」を構造的に防ぐ仕組み。
コメント無し skip を入れると **CI が赤化する** ため、 Sさん 起草中の skip 利用は必ず上記形式で。

### 例(良い例)

```typescript
// TODO(Sさん→Sさん): VOICEVOX Cloud Run デプロイ完了後に解除
// 解除条件: Uさん が VOICEVOX Cloud Run を本番デプロイ完了
// 担当: Sさん が TTSProvider 本実装時、 同 PR で解除
// 関連: docs/Phase2/Phase2_Uさん_Cloud_Run設計_*.md §3
test.skip('VOICEVOX TTS が実音声を返す', () => { ... });
```

### 例(NG 例)

```typescript
// なぜか動かないので一旦 skip
test.skip('xxx', () => { ... });  // ← CI 赤化、 検査で違反検出
```

---

## 5. 🟡 Google Tasks/Calendar API 実機検証 受け入れ基準(2026-05-25 追加)

### 位置づけ

Sさん commit `73677a8` で起草された `scripts/verify-tasks-api/` の 4 検証スクリプト(01 due 時刻破棄 / 02 deadline 不存在 / 03 taskSeries 不存在 / 04 notes 構造化記法往復)に対する Tさん 受け入れ基準。

### 本文

詳細は `docs/Phase2/Phase2_GoogleTasks実機検証_受け入れ基準_v0.2_2026-05-26.md` を参照(v0.1 は旧記録)。

要点:
- **コア受け入れ基準** (9項目): C1.1.1 〜 C1.4.3(各検証スクリプトの観測値照合)
- **運用安全性** (2項目): cleanup 成功 + 残置時の手動 cleanup 可能性
- **実行整合性** (1項目): run-all.js exit code
- **食い違い検出時の取り扱い**: 隠蔽禁止、 観測値・仮説・影響範囲・対策案の4点必須記録
- **仕様§1.3 依存項目** (S1〜S6): 検証スコープ外、 B2 実装後のテストへ申し送り

### Sさん 検証実行時のお願い

検証実行後、 以下を Tさん へ受領できる形でお願いします:

1. `node scripts/verify-tasks-api/run-all.js` の **標準出力全文**(JSON 含む)
2. プロセス **exit code**(0 = 全 PASS、 1 = 1件以上 FAIL/ERROR)
3. 実行環境メモ(Node.js バージョン / googleapis パッケージバージョン / 検証用 Google アカウント識別子 伏字 OK)
4. cleanup 警告ログの有無(stderr 確認)

Tさん は受領後、 `memory/Tech_validation_GoogleTasksAPI_<実行日>.md` を起草し、 受け入れ基準照合 + 食い違い記録 + B2 GO/NO-GO 判定を文書化します。

---

## 3. 🟢 Sさん から Tさん への逆方向申し送りについて

Sさん 側で「Tさん にお願いしたいテスト追加 / 修正」が出た場合は、 別ファイル `memory/S_to_T.md`
を Sさん 側で起草するか、 Sさん 起草の各種ドキュメントの末尾に「Tさん 宛申し送り」セクションを設けること。

Tさん は毎セッション開始時に `memory/T_to_S.md` だけでなく
**`memory/S_to_T.md`**(存在すれば) もチェックする運用とする。

---

## 4. 🔴 6月実装期間で意識して欲しい「テスト容易性 設計原則」 1ページサマリ

### 位置づけ

2026-05-22 起草。 ベータ 6/20 完成 → 7月家族配布の逆算で、 Sさん が 5/26 以降に `src/` 起草を本格化する **6月実装期間** に「Tさん 観点でテストしやすい設計」 を意識してもらうための **1ページガイダンス**。

Sさん v0.4 §9.7「Provider 化原則」 と親和的、 同方向の細則として読んでください。
本書は **設計原則** であって、 個別実装の正解を示すものではありません。 Sさん 判断を尊重しつつ、 「迷ったら こちら寄り」 の選択指針として使ってください。

### 原則1: 純粋関数を分離する(Pure Function Boundary)

副作用(fetch / localStorage / Date.now / Math.random / DOM 操作)を持つコードと、 入力 → 出力の純粋計算 部分を **同じ関数に混ぜない** 。 純粋部分は別関数として export 可能な形にしてください。

#### なぜ

- 純粋関数は Vitest 1秒テストで完全網羅可能
- 副作用付き関数は MSW / モック / E2E が必要で 100倍 遅い

#### 適用例

```typescript
// 🟢 Good: ロジックと I/O を分離
export function buildCoachingMessage(context: CoachingContext): string { /* 純粋 */ }
async function sendCoaching(context: CoachingContext): Promise<void> {
  const message = buildCoachingMessage(context); // 純粋
  await api.post('/notify', { message });       // I/O
}

// 🔴 Bad: 混在
async function sendCoaching(context: CoachingContext): Promise<void> {
  const userPrefs = await loadPrefs();          // I/O
  const message = `${context.user}, ${userPrefs.tone}...`; // ロジック
  await api.post('/notify', { message });       // I/O
}
```

#### Tさん 確認: 純粋関数化されている場合、 ユニットテスト1行で網羅できる。

---

### 原則2: Interface 経由で依存を注入する(Dependency Injection)

外部サービス(Google Drive / Tasks / Calendar / Gemini / VOICEVOX 等) は **必ず interface 経由** で受け取り、 直接 `import` しない。 Sさん v0.4 §9.7 Provider 化原則そのもの、 本項はテスト視点での補強。

#### なぜ

- 本物の API を呼ばずに `MemoryProvider` / `FlakyProvider` で差し替えてテスト可能
- Storage interface(`MemoryStorage` / `FlakyStorage`)が既に確定済み、 同パターンを LLM / TTS / STT / Auth にも横展開

#### 適用例

```typescript
// 🟢 Good: コンストラクタ注入
class CoachingService {
  constructor(
    private readonly llm: AIProvider,
    private readonly storage: StorageProvider,
  ) {}
}
// テストでは new CoachingService(new MockAI(), new MemoryStorage())

// 🔴 Bad: モジュールスコープで生成
import { geminiClient } from './gemini'; // ← 差し替え不能
class CoachingService {
  async run() { return geminiClient.generate(...); }
}
```

#### Tさん 確認: テスト時に new XxxProvider() で差し替え可能か?

---

### 原則3: 時刻・乱数を引数で受け取る(Time / Random Injection)

`Date.now()` / `new Date()` / `Math.random()` / `crypto.randomUUID()` を関数内で **直接呼ばず**、 引数や DI で受け取る。

#### なぜ

- 時刻依存テスト(優先順位ロジック §2.2.2、 6段階優先順位、 18:00 通知時刻判定 等)が**決定的に**書ける
- vitest の `vi.useFakeTimers()` だけだと「タイムゾーン考慮」 等で漏れが出やすい

#### 適用例

```typescript
// 🟢 Good: 引数で受け取る
export function prioritizePush(tasks: Task[], now: Date = new Date()): PushItem[] {
  return tasks.filter((t) => isOverdue(t, now));
}
// テスト: prioritizePush(tasks, new Date('2026-06-20T18:00:00+09:00'))

// 🔴 Bad: 関数内で直接呼ぶ
export function prioritizePush(tasks: Task[]): PushItem[] {
  const now = new Date(); // ← テストで制御不能
  return tasks.filter((t) => isOverdue(t, now));
}
```

#### Tさん 確認: 任意の時刻でテストを再現できるか?

---

### 原則4: ファイル境界 = テスト境界

Vue SFC(`*.vue`)の `<script setup>` 内に複雑なロジックを書くと、 Vitest からの直接テストが困難。 ロジックは `*.ts` ファイルに切り出して `import` する形を基本とする。

#### なぜ

- `*.vue` の単体テストは `@vue/test-utils` 経由で重い(マウント時間 100ms〜)
- `*.ts` 純粋ロジックは vitest 1ms 未満で網羅可能

#### 適用例

```vue
<!-- 🟢 Good: 薄いコンポーネント -->
<script setup lang="ts">
import { computeCoachingContext } from './coaching/context';
import { ref } from 'vue';
const tasks = ref<Task[]>([]);
const context = computed(() => computeCoachingContext(tasks.value));
</script>
```

```typescript
// coaching/context.ts(別ファイル、 純粋関数)
export function computeCoachingContext(tasks: Task[]): CoachingContext { /* 純粋 */ }
```

#### Tさん 確認: `*.vue` の `<script>` 内に長いロジックがないか?

---

### 原則5: SSR-safe / dynamic import 制御

`window` / `document` / `localStorage` / `navigator` 等の **ブラウザ専用 API** をモジュールトップレベルで参照しない。 関数内 or `onMounted` 内に閉じ込める。

#### なぜ

- Vitest jsdom 環境では多くがエミュレートされているが、 一部欠落(`navigator.serviceWorker`、 `MediaRecorder` 等)
- 将来 SSR / SSG / Astro 等へ移行する余地を残す

#### 適用例

```typescript
// 🟢 Good: 関数内
function getStorageValue(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('key');
}

// 🔴 Bad: モジュールトップレベル
const stored = localStorage.getItem('key'); // ← jsdom や SSR で即エラー
```

#### Tさん 確認: jsdom 環境(`tests/unit/`)で import するだけでエラーが出ないか?

---

### 原則6: 依存の方向は「外 → 内」 だけ

ドメイン層(`src/domain/`)や interface 定義(`src/interfaces/`)は、 UI 層(`src/components/`)や Provider 実装(`src/providers/`)を **import してはいけない**。 一方向の依存だけ許す。

#### なぜ

- ドメインテスト(優先順位ロジック、 コーチングコンテキスト構築 等)が Vue や Google API に依存せず単体テスト可能
- 「Provider 化原則」 の正しい運用には方向制御が前提

#### 適用例

```
src/
├── domain/           ← 何にも依存しない(純粋ロジック)
├── interfaces/       ← domain のみ依存可
├── providers/        ← interfaces 経由でドメインから呼ばれる、 外部 SDK に依存
├── application/      ← interfaces を使ってユースケース合成
└── ui/components/    ← application を使う、 最外層
```

#### Tさん 確認: `src/domain/*.ts` が `vue` / `pinia` / `gemini` をimport していないか?

---

### サマリ表(チェックリスト形式)

| # | 原則 | テスト時のメリット | Sさん 起草時の自己チェック |
|---|---|---|---|
| 1 | 純粋関数の分離 | 1ms ユニットテスト | I/O とロジック混在していないか |
| 2 | Interface 経由の DI | Memory/Flaky で差し替え | 直接 import していないか |
| 3 | 時刻・乱数の注入 | 決定的テスト | Date.now() を関数内で直接呼んでいないか |
| 4 | ファイル境界 = テスト境界 | 100倍速い vitest | *.vue の `<script>` が長くないか |
| 5 | SSR-safe | jsdom で import エラーなし | モジュールトップレベルで window 触っていないか |
| 6 | 依存の方向制御 | ドメイン単体テスト | domain が UI を import していないか |

### Tさん 側の対応(完了済み + 進行中)

- ✅ Storage interface の MemoryStorage / FlakyStorage は Uさん 設計で既に確定(原則2 の基盤)
- ✅ AIProvider interface は Sさん v0.4 §3 で確定方向(原則2 の LLM 軸)
- 🟡 Provider contract テスト 設計素案 = 5/26 スコープ議論で議題化(P1 案として保留)
- 🟢 本サマリは 6月実装期間中 PR レビューで「原則 N に該当する設計か?」 として参照される予定

### なぜ「申し送り」 という形式か

- 仕様書・テスト戦略の **正式文書ではなく**、 「Tさん から Sさん への 1ページ ガイド」 という軽量な位置づけ
- 6月実装中に Sさん がコードを書く時、 1スクロールで読める範囲に重要原則を集約
- Tさん レビュー時の共通参照点(「原則3 に該当しますね、 修正お願いします」 と短く伝えられる)
- 5/26 スコープ議論で「もっと厳密なテスト戦略 v0.3 起草が必要」 と判断されたら、 本サマリは v0.3 の出発点になる

---

## 改訂方針

- Sprint ごとに溜まった申し送りを整理、 不要になった項目は **削除せず「対応完了」ラベル化** で残置
  (Aさん 現行 MIYU 運用に倣う)
- 構造変更(セクション追加・優先度変更等)は CLAUDE.md か Process_rules.md にリンクさせる
- 本ファイル肥大化時は Sprint 単位で分割検討(`T_to_S_Sprint2.md` 等)

---

## 関連ファイル

- `memory/MEMORY.md` — メモリインデックス
- `memory/T_progress.md` — Tさん 自身の進捗
- `memory/Process_rules.md` — チーム共通プロセスルール
- `memory/Beta_v1_scope.md` — ベータ v1.0 スコープ確定事項
- `docs/Phase1/Phase1_テスト戦略案_v0.2_2026-05-19.md` — テスト戦略本体(§10 既知 skip リスト)
- `docs/Phase1/Phase1_申し送り_Sさん_コーチングMD改訂提案_2026-05-20.md` — コーチングMD レビュー申し送り
- `scripts/check-skipped-tests.js` — skip 忘却防止 静的検査
- `tests/a11y/sample.spec.ts` — 本申し送り §1 の対象テスト

---

**起草: Tさん、 2026-05-20 / §4 追加 2026-05-22**
