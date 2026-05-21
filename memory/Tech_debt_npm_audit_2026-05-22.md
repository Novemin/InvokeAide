# 技術的負債: npm audit 18件 内訳精査(2026-05-22 起草)

ESLint v9 移行(2026-05-21 commit `a3caf4f`) 後の `npm audit` 結果整理。
P3「内訳精査 + 影響範囲整理、 対応はせず一覧化のみ」 の成果物。

**位置づけ**:
- Phase 2 末別タスクのインプット
- 対応着手時はタイムボックス制(ESLint v9 移行と同じ「動けばラッキー、 詰まったら巻き戻し」 方針)
- セッション横断で参照可能、 memory/ 配下に永続化

**最終更新**: 2026-05-22 朝

---

## 1. サマリ

```
high:     5 件
moderate: 7 件
low:      6 件
──────────────
Total:   18 件
```

(週末タスクA-3 commit message 時点で「17件」 と記述したが、 install 後の再 audit で 18件、 1件は集計差。 本書が正)

### 直接依存 vs 推移依存

| 種別 | 件数 | パッケージ |
|---|---|---|
| **Direct(直接依存)** | 4 | `@lhci/cli` / `@vitest/coverage-v8` / `vite` / `vitest` |
| **Transitive(推移依存)** | 14 | 残り(下記クラスタ参照) |

### クラスタ分類

ほぼすべてのvulnerability が **2つのクラスター** に集中:

| クラスタ | 親パッケージ | 関連件数 |
|---|---|---|
| クラスタA | `@lhci/cli`(Lighthouse CI) | 13件(直接1 + 推移12) |
| クラスタB | `vite` + `vitest`(ビルド/テストツール) | 6件(直接2 + 推移4、 一部重複) |

---

## 2. クラスタA: @lhci/cli 関連(13件)

### 構成

```
@lhci/cli  (direct, moderate)
├── @lhci/utils       (transitive, low)
├── inquirer          (transitive, low)
│   └── external-editor (low)
│       └── tmp         (low)
└── lighthouse        (transitive, high)
    ├── @sentry/node    (low)
    │   └── cookie       (low)  [GHSA-pxg6-pf52-xh8x]
    └── puppeteer-core (high)
        ├── @puppeteer/browsers (high)
        │   └── tar-fs           (high) [GHSA-vj76-c3g6-qr5v / GHSA-8cj5-5rvv-wf4v / GHSA-pq67-2wwv-3xjx]
        └── ws                  (high) [GHSA-3h5v-q93c-6h6q / GHSA-58qx-3vcg-4xpx]
└── uuid              (transitive, moderate) [GHSA-w5hq-g745-h8pq]
```

### 主要 advisory(代表3件)

1. **tar-fs**: symlink validation bypass(GHSA-vj76-c3g6-qr5v) — high、 任意ファイル抽出
2. **ws**: DoS via 多数 HTTP headers(GHSA-3h5v-q93c-6h6q) — high
3. **uuid**: Missing buffer bounds check v3/v5/v6(GHSA-w5hq-g745-h8pq) — moderate

### 修復方針(npm audit 提案)

- 全件で `npm audit fix --force` の修復先が `@lhci/cli@0.1.0` (SemVerMajor、 **大幅な downgrade**)を要求
- これは現実的でない(@lhci/cli 0.1.0 は古いプレリリース版)
- **実質的な修復経路**:
  - 案A: `@lhci/cli` の新メジャー版(0.14 以降?)リリース待ち、 アップグレードで連鎖修復
  - 案B: Lighthouse CI 自体を `lhci` から `lighthouse` 直接呼び出しに切り替え(`.github/workflows/e2e.yml` 改修)
  - 案C: 受容して `npm audit` を `--audit-level=high` 等で抑制(Sprint 2 以降の継続課題化)

### 影響範囲

- **本番ビルド成果物**: 影響なし(devDependencies のみ、 ユーザーに配布されるバンドルには含まれない)
- **CI 実行環境**: 影響あり(Lighthouse ジョブで tar-fs 等を使用)、 ただし攻撃には外部から細工した tar ファイル等が必要 → リスク現実性は低
- **ローカル開発**: 影響あり(同上)

### 緊急性: **低**

Phase 2 末タスク化で問題なし。 ベータ家族配布物には影響しない。

---

## 3. クラスタB: vite + vitest 関連(6件)

### 構成

```
vite       (direct, moderate)
├── esbuild (transitive, moderate) [GHSA-67mh-4wv8-2f99]
└── vite-node (transitive, moderate, via vite)
    └── vitest    (direct, moderate)
        └── @vitest/coverage-v8 (direct, moderate)

vite advisory: GHSA-4w7w-66w2-5vf9 (Path Traversal in Optimized Deps `.map` Handling)
```

### 主要 advisory

1. **esbuild**: dev server が任意ウェブサイトからのリクエストを受け付ける(GHSA-67mh-4wv8-2f99) — moderate
2. **vite**: Path Traversal in Optimized Deps `.map` Handling(GHSA-4w7w-66w2-5vf9) — moderate

### 修復方針

- `vite` を v8 系へ(現在 `^5.0.0`)、 `vitest` を v4 系へ(現在 `^1.2.0`)
- いずれも **複数バージョン跨ぎの SemVerMajor**:
  - vite: v5 → v8(2バージョンスキップ)
  - vitest: v1 → v4(3バージョンスキップ)
- API breaking changes 多数の可能性、 ESLint v9 移行よりも難度高

### 影響範囲

- **本番ビルド成果物**: 影響なし(dev サーバー / テスト ランナーの脆弱性)
- **ローカル開発 (dev サーバー)**: 影響あり、 ただし「悪意あるウェブサイトを開発者がブラウザで開いている」 等の前提が必要、 現実的攻撃シナリオは限定的

### 緊急性: **低**

Phase 2 末タスク化で問題なし。

---

## 4. 全体所感

### a) 本番リスクなし

18件すべて **devDependencies** 経由。 ベータ家族配布バンドルには含まれない = 7月配布物への直接リスクなし。

### b) 修復はメジャーバージョン跨ぎ複数で重い

全 18件で `fixSemVerMajor: true`。 ESLint v9 移行と同等以上の労力が想定される。

### c) 推奨対応タイミング

| 案 | 対応時期 | 根拠 |
|---|---|---|
| **案X**(推奨) | Phase 2 末(2026-06-20 ベータ完成後)〜 7月配布後 | ベータ家族配布物に影響しない、 配布後の安定化フェーズで対応 |
| 案Y | Sprint 2 開始前(5/26 議論時に判断) | 6月実装中に dev 環境破壊リスクは避けたい |
| 案Z | 受容 + audit-level 抑制 | 「速度より整合性」 と矛盾、 推奨しない |

**Tさん 感触**: 案X 推奨。 7月家族配布 → 8月 v1.1 開発開始時に「dev 環境メンテナンス Week」 を1週設けて、 vite/vitest メジャーアップ + Lighthouse CI 改修(クラスタA 案B 移行)をまとめて。

### d) クラスタA 案B(Lighthouse CI から lighthouse 直接呼び出しへの切り替え)について

`@lhci/cli` 依存の脆弱性 13件 を一気に解消できる選択肢。 ただし:
- `.github/workflows/e2e.yml` lighthouse ジョブの大幅改修
- `lighthouserc.json` の assertion 結果取得を独自スクリプト化
- Tさん 領域(scripts/ + ci.yml) で完結、 Sさん 領域に影響しない

これは **Phase 2 末別タスクの中の優先候補**(クラスタB 修復より難度低、 効果大)。

---

## 5. 関連

- ESLint v9 移行(2026-05-21 commit `a3caf4f`) — 同種の dev 依存メジャーアップタスク、 タイムボックス制で完走
- `memory/T_progress.md` Phase 2 末別タスクセクション
- 週末作業指示書_2026-05-21.md §2 Phase 2 後半宿題(うち ① actions @v5 / ④ check-coaching モジュール化 / ③ ESLint v9 完了済み、 ② lighthouse 指摘は Sprint 2 統合)

### MEMORY.md インデックス追記候補

`MEMORY.md` の project セクションに追記候補:
`- [npm audit 18件 整理](Tech_debt_npm_audit_2026-05-22.md) — Phase 2 末別タスクのインプット、 @lhci/cli クラスタ13件 + vite/vitest クラスタ6件 に集中、 本番リスクなし`

---

**起草: Tさん、 2026-05-22 朝 / 週末前倒し P3**
