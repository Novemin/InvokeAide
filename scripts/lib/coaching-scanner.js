/**
 * coaching-scanner.js
 * H8 NG ワード辞書(9カテゴリ)スキャナーの **純粋ロジック層** 。
 *
 * モジュール化方針(2026-05-21 週末タスクA-4):
 *   - CLI 側(scripts/check-coaching-prompts.js)とロジック側(本ファイル)を分離
 *   - 純粋関数化により Vitest からのユニットテストが可能(tests/unit/coaching-scanner.test.ts)
 *   - tests/fixtures/coaching/outputs/ の NG/OK サンプルテキストで回帰テストを担保
 *
 * 由来:
 *   - Tさん v0.2 §7.2.3(既存3カテゴリ: 擬人化誤認 / キャラ演技を超えた擬人化 / 依存喚起)
 *   - Sさん コーチングMD §3.2 追加(新規6カテゴリ: 説教モード / 安易な褒め / ジャッジ /
 *     永続性断定 / 感情主張 / 過剰な気遣い)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// ─────────────────────────────────────────────────
// NG ワード辞書(計 9 カテゴリ)
// ─────────────────────────────────────────────────
export const NG_CATEGORIES = [
  // Tさん v0.2 §7.2.3(既存3)
  {
    category: '擬人化誤認(Tさん v0.2 §7.2.3)',
    patterns: [/君を見守ってる/, /いつも近くにいる/, /永遠に/, /絶対に[^安]/],
  },
  {
    category: 'キャラ演技を超えた擬人化(Tさん v0.2 §7.2.3)',
    patterns: [/実は感情がある/, /本当の友達/, /家族のように/],
  },
  {
    category: '依存喚起表現(Tさん v0.2 §7.2.3)',
    patterns: [/ここにいるよ/, /離れないよ/, /いつでも一緒/],
  },
  // Sさん コーチングMD §3.2 追加(新規6)
  {
    category: '説教モード(Sさん §3.2)',
    patterns: [/すべきです/, /しましょう(?![ねよ])/, /ちゃんとやらないと/],
  },
  {
    category: '安易な褒め(Sさん §3.2)',
    patterns: [/素晴らしいですね/, /さすがです[^が]/],
  },
  {
    category: 'ジャッジ(Sさん §3.2)',
    patterns: [/これは良くないですね/, /もっと頑張ろう/],
  },
  {
    category: '永続性の断定(Sさん §3.2)',
    patterns: [/これからもずっと/, /これからもサポートする/, /ずっとお仕えします/],
  },
  {
    category: '感情の主張(Sさん §3.2)',
    patterns: [/悲しい(?=$|。|\s)/, /心配だ(?=$|。|\s)/, /うれしい(?=$|。|\s)/, /心配しております/],
  },
  {
    category: '過剰な気遣い(Sさん §3.2)',
    patterns: [/無理しないでくださいね/, /お体に気をつけて/],
  },
];

// 検査対象ディレクトリ(coaching.md ファイル)— CLI 用デフォルト
export const DEFAULT_TARGET_DIRS = ['assets/characters', 'src/characters'];

// 説明・列挙行の除外パターン(coaching.md 内の「使わない」 リスト等)
export const DEFAULT_LINE_EXCLUDE = [
  /^\s*-\s+「.*」.*$/, // 引用形式の NG ワード列挙
  /NG ワード/,
  /避ける/,
];

/**
 * テキストをスキャンして NG ワード違反を抽出する純粋関数。
 *
 * @param {string} text - 対象テキスト
 * @param {object} [options] - オプション
 * @param {Array} [options.categories] - NG カテゴリ辞書(デフォルト: NG_CATEGORIES)
 * @param {Array<RegExp>} [options.lineExclude] - 行除外パターン(デフォルト: DEFAULT_LINE_EXCLUDE)
 * @returns {Array<{line: number, category: string, pattern: string, text: string}>}
 */
export function scanForNgWords(text, options = {}) {
  const categories = options.categories ?? NG_CATEGORIES;
  const lineExclude = options.lineExclude ?? DEFAULT_LINE_EXCLUDE;
  const lines = text.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, idx) => {
    if (lineExclude.some((rx) => rx.test(line))) return;
    for (const { category, patterns } of categories) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          violations.push({
            line: idx + 1,
            category,
            pattern: pattern.source,
            text: line.trim(),
          });
        }
      }
    }
  });

  return violations;
}

/**
 * 1ファイルを読み込んでスキャンする(ファイルパス情報付き violations を返す)。
 *
 * @param {string} filePath - 絶対パス
 * @param {object} [options] - scanForNgWords と同じ
 * @returns {Array<{file: string, line: number, category: string, pattern: string, text: string}>}
 */
export function checkFile(filePath, options = {}) {
  const text = readFileSync(filePath, 'utf-8');
  return scanForNgWords(text, options).map((v) => ({ ...v, file: filePath }));
}

/**
 * 指定ディレクトリ配下の *.coaching.md ファイルを再帰的に列挙する。
 *
 * @param {string} rootDir - リポジトリルート(絶対パス)
 * @param {string} subDir - rootDir からの相対サブディレクトリ
 * @returns {Array<string>} ファイル絶対パス配列
 */
export function listCoachingFiles(rootDir, subDir) {
  const full = join(rootDir, subDir);
  if (!existsSync(full)) return [];
  const stat = statSync(full);
  if (!stat.isDirectory()) return [];

  const out = [];
  for (const name of readdirSync(full)) {
    const child = join(full, name);
    const childStat = statSync(child);
    if (childStat.isDirectory()) {
      out.push(...listCoachingFiles(rootDir, join(subDir, name)));
    } else if (extname(child) === '.md' && name.endsWith('.coaching.md')) {
      out.push(child);
    }
  }
  return out;
}
