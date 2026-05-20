# Coaching Test Fixtures

Tさん テスト戦略 v0.2 §14.1 / Sさん コーチングMD 2本セット v0.1 §9 と連動するテストデータ。

## 位置づけ

2026-05-20 エルトン明示 GO により、**Sさん v0.2 改訂(2026-05-26 想定)を待たずに先行配置** 。Sさん v0.2 で `assets/characters/*.coaching.md` が配置されたタイミングで、 Tさん 静的解析(`scripts/check-coaching-prompts.js`)+ Vitest フィクスチャーが **即座にセットで稼働開始** する。

## ディレクトリ構造

```
tests/fixtures/coaching/
├── contexts/                              # TaskCoachingContext サンプル(4パターン)
│   ├── context-1-all-priorities.json      # 全優先順位該当(Sさん §9.1 fixtureContext1)
│   ├── context-2-completed-only.json      # 完了肯定のみ(Sさん §9.1 fixtureContext2)
│   ├── context-3-overdue-only.json        # 期限切れのみ(Tさん 補完、Sさん §9.1 fixtureContext3 完成形)
│   └── context-4-empty.json               # 空コンテキスト(Tさん 補完、Sさん §9.1 fixtureContext4 完成形)
├── outputs/                                # LLM 応答 NG/OK サンプル(3種)
│   ├── ng-anthropomorphism.txt            # 擬人化誤認 NG 出力(Sさん §9.2)
│   ├── ng-preaching.txt                   # 説教モード NG 出力(Sさん §9.2)
│   └── ok-miyu-normal.txt                 # 正常 MIYU OK 出力(Sさん §9.2)
└── README.md                              # 本ファイル
```

## 使い方

### 1. TaskCoachingContext テスト(Tさん テスト戦略 §14.1 L3 / L4)

`contexts/*.json` を `JSON.parse(readFileSync(...))` で読み込み、 Sさん 実装側の `computeCoachingContext()` / `prioritizePush()` に入力として渡す。

```typescript
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, '../fixtures/coaching/contexts');

describe('プッシュ優先順位ロジック(L4)', () => {
  it('全優先順位該当時、上位 3〜4 論点が選ばれる', () => {
    const context = JSON.parse(
      readFileSync(join(fixtureDir, 'context-1-all-priorities.json'), 'utf-8'),
    );
    // const pushItems = prioritizePush(context); // Sさん 実装後
    // expect(pushItems.length).toBeGreaterThanOrEqual(3);
    // expect(pushItems.length).toBeLessThanOrEqual(4);
    expect(context.overdue).toHaveLength(1);
  });
});
```

### 2. NG ワード辞書テスト(Tさん テスト戦略 §14.5 / H8)

`outputs/*.txt` を `scripts/check-coaching-prompts.js` のパース対象として読み込み、 検出件数を検証する **回帰テスト** 用。

```typescript
// 将来、 check-coaching-prompts.js をモジュール化して関数 export し、
// 以下のように回帰テストを書く想定
import { scanForNgWords } from '@/scripts/check-coaching-prompts';

it('擬人化誤認 NG 出力で 2件以上検出される', () => {
  const text = readFileSync(join(__dirname, '../fixtures/coaching/outputs/ng-anthropomorphism.txt'), 'utf-8');
  const violations = scanForNgWords(text);
  expect(violations.length).toBeGreaterThanOrEqual(2);
  expect(violations.some((v) => v.category.includes('擬人化誤認'))).toBe(true);
});

it('正常 MIYU 出力で 0件検出', () => {
  const text = readFileSync(join(__dirname, '../fixtures/coaching/outputs/ok-miyu-normal.txt'), 'utf-8');
  const violations = scanForNgWords(text);
  expect(violations).toHaveLength(0);
});
```

## 連動関係

| 上流 | 当 fixtures | 下流 |
|---|---|---|
| Sさん コーチングMD §9.1 / §9.2 | `tests/fixtures/coaching/` | Tさん テスト戦略 v0.2 §14.1 / §14.5 |
| Tさん `scripts/check-coaching-prompts.js`(9カテゴリ NG ワード辞書) | 出力テキストの assertion 対象 | CI 自動品質ゲート |
| Sさん v0.2 改訂時の `assets/characters/*.coaching.md` | (将来)同辞書のスキャン対象 | `npm run check:coaching` で実稼働 |

## 改訂方針

- Sさん コーチングMD v0.2 改訂で §9 フィクスチャーに変更があれば、Tさん が本ディレクトリを後追い更新
- 家族テスター運用で「これも NG にすべき」が出れば、Sさん コーチングMD §3 + Tさん `check-coaching-prompts.js` + 本フィクスチャーの3点を同時改訂

## 関連文書

- `docs/Phase2/Phase2_コーチングMD_2本セット_v0.1_2026-05-19.md`(Sさん 起草)
- `docs/Phase1/Phase1_Sさん_コーチングMD_レビュー_2026-05-20.md`(Tさん レビュー)
- `docs/Phase1/Phase1_テスト戦略案_v0.2_2026-05-19.md`(Tさん テスト戦略 §14)
- `scripts/check-coaching-prompts.js`(9カテゴリ NG ワード辞書)
