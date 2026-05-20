#!/usr/bin/env node
/**
 * check-coaching-prompts.js
 * H8 NG ワード辞書(9カテゴリ)による coaching.md 静的検査。
 *
 * 由来:
 *   - Tさん v0.2 §7.2.3(既存3カテゴリ: 擬人化誤認 / キャラ演技を超えた擬人化 / 依存喚起)
 *   - Sさん コーチングMD §3.2 追加(新規6カテゴリ: 説教モード / 安易な褒め / ジャッジ /
 *     永続性断定 / 感情主張 / 過剰な気遣い)
 *
 * 検査対象:
 *   - assets/characters/*.coaching.md(ビルド同梱、 Sさん 起草)
 *   - src/characters/*.coaching.md(将来)
 *
 * 違反検出時は process.exit(1)。 違反なしで 0。
 *
 * NOTE: 本スクリプトは Phase 2 Sprint 1 段階の **叩き台** 。
 *       Sさん が coaching.md を assets/ に配置次第、 検査が走るようになる。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ─────────────────────────────────────────────────
// NG ワード辞書(計 9 カテゴリ)
// 由来カラムで Tさん v0.2 §7.2.3 / Sさん コーチングMD §3.2 を区別
// ─────────────────────────────────────────────────
const NG_CATEGORIES = [
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

// 検査対象ディレクトリ(coaching.md ファイル)
const TARGET_DIRS = ['assets/characters', 'src/characters'];

// ファイル内で除外する行(これらの NG ワードを「説明」 として書いてある行)
// 本スクリプト自体の説明や辞書定義の行は対象外
const LINE_EXCLUDE = [
  /^\s*-\s+「.*」.*$/, // 引用形式の NG ワード列挙(coaching.md 内の「使わない」 リスト)
  /NG ワード/,
  /避ける/,
];

function listMarkdownFiles(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  const stat = statSync(full);
  if (!stat.isDirectory()) return [];

  const out = [];
  for (const name of readdirSync(full)) {
    const child = join(full, name);
    const childStat = statSync(child);
    if (childStat.isDirectory()) {
      out.push(...listMarkdownFiles(join(dir, name)));
    } else if (extname(child) === '.md' && name.endsWith('.coaching.md')) {
      out.push(child);
    }
  }
  return out;
}

function checkFile(filePath) {
  const violations = [];
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (LINE_EXCLUDE.some((rx) => rx.test(line))) return;

    for (const { category, patterns } of NG_CATEGORIES) {
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          violations.push({
            file: relative(ROOT, filePath),
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

function main() {
  const allFiles = [];
  for (const dir of TARGET_DIRS) {
    allFiles.push(...listMarkdownFiles(dir));
  }

  if (allFiles.length === 0) {
    console.log(
      '[check-coaching-prompts] 検査対象なし(coaching.md 未配置段階、 OK)',
    );
    console.log(
      '  対象: assets/characters/*.coaching.md / src/characters/*.coaching.md',
    );
    process.exit(0);
  }

  const allViolations = [];
  for (const file of allFiles) {
    allViolations.push(...checkFile(file));
  }

  if (allViolations.length === 0) {
    console.log(
      `[check-coaching-prompts] OK — ${allFiles.length} ファイル検査、 9 カテゴリ NG ワード違反なし`,
    );
    process.exit(0);
  }

  console.error(
    `[check-coaching-prompts] NG — ${allViolations.length} 件の違反を検出:\n`,
  );
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  [${v.category}]`);
    console.error(`    パターン: /${v.pattern}/`);
    console.error(`    該当行: ${v.text}\n`);
  }
  process.exit(1);
}

main();
