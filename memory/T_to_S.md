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

## 1. 🔴 Sprint 2: src/App.vue 本実装時、 a11y skip 解除を同 PR に含める

### 経緯

2026-05-20 GitHub 初回 push 直後、 E2E ワークフローが赤化。
原因: `tests/a11y/sample.spec.ts` の axe-core スモークテストが、 Tさん が暫定配置した最小ダミー `src/App.vue` に対して a11y 違反を検出。

### 対応(2026-05-20 確定)

- 案A(skip + 三重ガード)で確定(エルトン承認)
- 該当テストを `test.skip` 化、 直上に TODO コメント明示
- `scripts/check-skipped-tests.js` で skip 忘却防止の静的検査を CI に組み込み
- 本ファイル(T_to_S.md)に永続申し送り化

### Sさん 起草時の必須アクション

Sさん が `src/App.vue` を **最小ダミーから本実装(オンボーディング/ホーム画面実装)に置き換える PR を出す時** 、 以下を同 PR に含めること:

1. **`tests/a11y/sample.spec.ts` の `test.skip` を `test` に戻す** (1箇所)
2. その上で **axe-core 違反が 0 件になる** ことを Playwright で動作確認
3. もし違反が残る場合、 src/App.vue 側で a11y 対応してから PR を出す
4. PR description に「a11y skip 解除済み、 axe-core 0件確認済み」と明記

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

## 3. 🟢 Sさん から Tさん への逆方向申し送りについて

Sさん 側で「Tさん にお願いしたいテスト追加 / 修正」が出た場合は、 別ファイル `memory/S_to_T.md`
を Sさん 側で起草するか、 Sさん 起草の各種ドキュメントの末尾に「Tさん 宛申し送り」セクションを設けること。

Tさん は毎セッション開始時に `memory/T_to_S.md` だけでなく
**`memory/S_to_T.md`**(存在すれば) もチェックする運用とする。

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

**起草: Tさん、 2026-05-20**
