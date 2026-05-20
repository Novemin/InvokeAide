#!/usr/bin/env node
/**
 * check-legal-expressions.js
 * 法的書類 v0.3 §1.2「未来の自分を縛らない」 原則の静的検査。
 *
 * 検査対象:
 *   - docs/ 配下の法的書類関連 Markdown / src/legal/*.html(将来)
 *   - 規約・プライバシーポリシー本文に NG ワード(断定表現)が混ざっていないかチェック
 *
 * 違反検出時は process.exit(1) で CI red、 違反なしで 0。
 *
 * H1 + H7(Tさん テスト戦略 v0.2 §7.1.1)対応。
 *
 * NOTE: 本スクリプトは Phase 2 Sprint 1 段階の **叩き台** 。
 *       規約 HTML が実装され次第、 対象ファイルパス・辞書を拡張する想定。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ─────────────────────────────────────────────────
// NG ワード辞書(法的書類 v0.3 §1.2 / §8.9 の置換ルールから)
// ─────────────────────────────────────────────────
const NG_PATTERNS = [
  { pattern: /サーバーは存在しない/g, recommend: '専用サーバーを運用していない', category: '断定:存在否定' },
  { pattern: /データを一切受信しない/g, recommend: '通常運用において収集・保存しない', category: '断定:一切〜しない' },
  { pattern: /データを一切保存しない/g, recommend: '通常運用において収集・保存しない', category: '断定:一切〜しない' },
  { pattern: /アクセスできない/g, recommend: 'アクセスする手段を持たない', category: '断定:能力否定' },
  { pattern: /100%\s*安全/g, recommend: '合理的なセキュリティ対策を講じる', category: '断定:100%' },
  { pattern: /絶対に[^安]/g, recommend: '通常運用において 〜しない', category: '断定:絶対に' },
  { pattern: /永久に/g, recommend: '現時点では', category: '断定:永続性' },
  { pattern: /いかなる場合も/g, recommend: '原則として', category: '断定:全称' },
];

// 検査対象のファイルパターン(ベータ v1.0 段階の叩き台)
// 将来、 src/legal/*.html / public/legal/ 配下を追加予定
//
// NOTE: 法的書類起草指示書(docs/秘書召喚アプリ_法的書類起草指示書_*.md)は
//       「置換ルールを書く文書」 であって「規約本体」 ではないため検査対象から
//       除外。 規約本体・利用規約 HTML が src/legal/ 等に配置され次第追加する。
const TARGET_PATHS = [
  // 'src/legal/terms.html',          // 将来配置予定
  // 'src/legal/privacy.html',        // 将来配置予定
];

// 検査対象から除外するパターン(本スクリプトの説明・置換ルール表など)
const SCAN_EXCLUDE_BLOCKS = [
  // テーブルで「避ける表現 | 推奨表現」 を並べる行は除外
  /\|\s*(?:サーバーは存在しない|データを一切受信しない|アクセスできない|100%\s*安全|永久に[^な]).*\|/g,
];

function listFiles(target) {
  const full = join(ROOT, target);
  let stat;
  try {
    stat = statSync(full);
  } catch {
    return [];
  }
  if (stat.isFile()) return [full];
  if (stat.isDirectory()) {
    const out = [];
    for (const name of readdirSync(full)) {
      out.push(...listFiles(join(target, name)));
    }
    return out.filter((p) => extname(p) === '.md' || extname(p) === '.html');
  }
  return [];
}

function checkFile(filePath) {
  const violations = [];
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    // 除外ブロック(置換ルール表)に該当する行はスキップ
    if (SCAN_EXCLUDE_BLOCKS.some((rx) => rx.test(line))) {
      return;
    }
    for (const { pattern, recommend, category } of NG_PATTERNS) {
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        violations.push({
          file: relative(ROOT, filePath),
          line: idx + 1,
          category,
          text: line.trim(),
          recommend,
        });
      }
    }
  });

  return violations;
}

function main() {
  const allFiles = [];
  for (const target of TARGET_PATHS) {
    allFiles.push(...listFiles(target));
  }

  if (allFiles.length === 0) {
    console.log('[check-legal-expressions] 検査対象なし(規約 HTML 未実装段階、 OK)');
    process.exit(0);
  }

  const allViolations = [];
  for (const file of allFiles) {
    allViolations.push(...checkFile(file));
  }

  if (allViolations.length === 0) {
    console.log(`[check-legal-expressions] OK — ${allFiles.length} ファイル検査、 違反なし`);
    process.exit(0);
  }

  console.error(`[check-legal-expressions] NG — ${allViolations.length} 件の違反を検出:\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  [${v.category}]`);
    console.error(`    ${v.text}`);
    console.error(`    推奨: ${v.recommend}\n`);
  }
  process.exit(1);
}

main();
