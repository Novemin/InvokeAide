// coaching-scanner.test.ts
// scripts/lib/coaching-scanner.js のユニットテスト(2026-05-21 週末タスクA-4 モジュール化に伴い追加)。
//
// 検証ポイント:
//   - scanForNgWords が純粋関数として正しく動作する
//   - 各 NG カテゴリの代表パターンがヒットする(辞書網羅性)
//   - lineExclude オプションで除外行が無視される
//   - tests/fixtures/coaching/outputs/ok-miyu-normal.txt は 9 カテゴリ辞書で 0 件検出
//   - カスタム categories オプションで辞書を差し替え可能
//
// NOTE: fixtures の NG サンプル(ng-anthropomorphism.txt / ng-preaching.txt)は
//       Sさん コーチングMD §9.2 起草版で、 現在の Tさん 辞書とは完全には一致しない箇所がある
//       (例: 「見守ってる」 「やるべき」 「ずっと」 等は Tさん 辞書にない)。
//       これは辞書同期の別タスクで、 本テストでは「辞書ロジックの動作」 を検証する範囲に留める。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scanForNgWords,
  NG_CATEGORIES,
  DEFAULT_LINE_EXCLUDE,
  // @ts-expect-error -- .js モジュール、 型推論は any 許容
} from '../../scripts/lib/coaching-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../fixtures/coaching/outputs');

describe('coaching-scanner: scanForNgWords 純粋関数', () => {
  it('空文字列で 0 件検出', () => {
    expect(scanForNgWords('')).toEqual([]);
  });

  it('NG パターンを含まないテキストで 0 件検出', () => {
    const text = 'たかし、 おつかれー!\n今日のタスクを整理するね。';
    expect(scanForNgWords(text)).toEqual([]);
  });

  it('「永遠に」 を含むテキストで 擬人化誤認 カテゴリ違反を検出', () => {
    const violations = scanForNgWords('永遠に君を見守ります');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v: { category: string }) => v.category.includes('擬人化誤認'))).toBe(
      true,
    );
  });

  it('「すべきです」 を含むテキストで 説教モード カテゴリ違反を検出', () => {
    const violations = scanForNgWords('タスクを整理すべきです');
    expect(violations.some((v: { category: string }) => v.category.includes('説教モード'))).toBe(
      true,
    );
  });

  it('複数行テキストで line 番号が正しく付与される', () => {
    const text = '1行目\n永遠に2行目\n3行目';
    const violations = scanForNgWords(text);
    expect(violations[0].line).toBe(2);
  });

  it('lineExclude オプションで除外行は無視される', () => {
    const text = '- 「永遠に」 は NG ワードの例';
    // デフォルト lineExclude(/^\s*-\s+「.*」.*$/ がマッチ)で除外される
    expect(scanForNgWords(text)).toEqual([]);
  });

  it('lineExclude を空配列で渡すと除外されない', () => {
    const text = '- 「永遠に」 は NG ワードの例';
    const violations = scanForNgWords(text, { lineExclude: [] });
    expect(violations.length).toBeGreaterThan(0);
  });

  it('カスタム categories で辞書差し替え可能', () => {
    const customCategories = [
      { category: 'テスト用カテゴリ', patterns: [/テスト用パターン/] },
    ];
    const violations = scanForNgWords('これはテスト用パターンです', {
      categories: customCategories,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0].category).toBe('テスト用カテゴリ');
  });
});

describe('coaching-scanner: NG_CATEGORIES 辞書構造', () => {
  it('9 カテゴリすべて定義されている', () => {
    expect(NG_CATEGORIES).toHaveLength(9);
  });

  it('各カテゴリは category + patterns を持つ', () => {
    for (const cat of NG_CATEGORIES) {
      expect(typeof cat.category).toBe('string');
      expect(Array.isArray(cat.patterns)).toBe(true);
      expect(cat.patterns.length).toBeGreaterThan(0);
      for (const p of cat.patterns) {
        expect(p).toBeInstanceOf(RegExp);
      }
    }
  });

  it('Tさん v0.2 §7.2.3 由来の3カテゴリと Sさん §3.2 追加の6カテゴリが含まれる', () => {
    const tCategories = NG_CATEGORIES.filter((c: { category: string }) =>
      c.category.includes('Tさん'),
    );
    const sCategories = NG_CATEGORIES.filter((c: { category: string }) =>
      c.category.includes('Sさん'),
    );
    expect(tCategories).toHaveLength(3);
    expect(sCategories).toHaveLength(6);
  });
});

describe('coaching-scanner: fixtures との照合', () => {
  it('ok-miyu-normal.txt は 9 カテゴリ辞書で 0 件検出(正常 MIYU 出力)', () => {
    const text = readFileSync(join(fixturesDir, 'ok-miyu-normal.txt'), 'utf-8');
    const violations = scanForNgWords(text);
    expect(violations).toEqual([]);
  });
});

describe('coaching-scanner: DEFAULT_LINE_EXCLUDE', () => {
  it('「NG ワード」 を含む行は除外される', () => {
    expect(DEFAULT_LINE_EXCLUDE.some((rx: RegExp) => rx.test('NG ワードの説明'))).toBe(true);
  });

  it('「避ける」 を含む行は除外される', () => {
    expect(DEFAULT_LINE_EXCLUDE.some((rx: RegExp) => rx.test('避けるべき表現'))).toBe(true);
  });
});
