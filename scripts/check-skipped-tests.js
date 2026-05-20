#!/usr/bin/env node
/**
 * check-skipped-tests.js
 * skip 忘却防止の静的検査(Tさん テスト戦略 v0.2 §10 既知 skip リスト 連動)。
 *
 * 検査対象:
 *   - tests/ 配下の *.ts / *.spec.ts / *.test.ts
 *   - test.skip / it.skip / describe.skip / test.describe.skip を grep
 *   - 直上 数行内に「TODO(誰→誰): 」コメントブロックがあるかを必須化
 *   - コメントブロック内に「解除条件:」「担当:」 のキーワードがあるかも合わせて確認
 *
 * 設計思想:
 *   - skip は「テストを消す」ではなく「実行時期を遅らせる」
 *   - 「永遠の skip」化を構造的に防ぐため、 すべての skip に解除条件と担当を必須化
 *   - case-by-case のレビュー無しに skip を増やすことを抑止
 *
 * Tさん テスト戦略 v0.2 段階1 補強(2026-05-20)。
 * CI 赤化対応として案A(skip + 三重ガード)の一翼を担う静的検査。
 *
 * 違反検出時は process.exit(1) で CI red、 違反なしで 0。
 *
 * NOTE: コメント形式の柔軟性を保つため、 「TODO(.+→.+):」 で誰→誰の引き継ぎが
 *       明示されていれば許容(例: `TODO(Tさん→Sさん):` / `TODO(Sさん→Uさん):` 等)。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ─────────────────────────────────────────────────
// 検査対象パス
// ─────────────────────────────────────────────────
const TARGET_DIRS = ['tests'];

// ─────────────────────────────────────────────────
// skip 検出パターン
//   ・test.skip( / it.skip( / describe.skip( / test.describe.skip(
//   ・前置きに spaces / tabs / 行頭 OK
//   ・通常の `.skip` プロパティアクセス(オブジェクトの property 名)は除外したいが、
//    テストフレームワークの API 名前空間と一致するため文字列マッチで十分
// ─────────────────────────────────────────────────
const SKIP_PATTERN = /\b(?:test|it|describe|test\.describe)\.skip\s*\(/;

// ─────────────────────────────────────────────────
// 解除条件コメントの判定
//   ・skip 行の直上 8行以内に「TODO(.+→.+):」 を含むコメント行があるか
//   ・併せて「解除条件:」「担当:」 のキーワードが範囲内にあれば望ましい
//    (必須は TODO(誰→誰): のみ、 他は警告レベル)
// ─────────────────────────────────────────────────
const TODO_PATTERN = /\/\/.*TODO\([^)]*→[^)]*\)\s*:/;
const RELEASE_CONDITION_PATTERN = /\/\/.*解除条件\s*:/;
const OWNER_PATTERN = /\/\/.*担当\s*:/;
const LOOKBACK_LINES = 8;

// ─────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────
function listFiles(target) {
  const full = join(ROOT, target);
  let stat;
  try {
    stat = statSync(full);
  } catch {
    return [];
  }
  if (stat.isFile()) {
    const ext = extname(full);
    return ext === '.ts' || ext === '.tsx' ? [full] : [];
  }
  if (stat.isDirectory()) {
    const out = [];
    for (const name of readdirSync(full)) {
      // node_modules や fixtures はスキャン対象外
      if (name === 'node_modules' || name === 'fixtures') continue;
      out.push(...listFiles(join(target, name)));
    }
    return out;
  }
  return [];
}

function checkFile(filePath) {
  const violations = [];
  const warnings = [];
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (!SKIP_PATTERN.test(line)) return;
    // コメント行(// で始まる)に書かれた skip は対象外
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    // 直上 LOOKBACK_LINES 行を検査
    const lookbackStart = Math.max(0, idx - LOOKBACK_LINES);
    const lookback = lines.slice(lookbackStart, idx);

    const hasTodo = lookback.some((l) => TODO_PATTERN.test(l));
    const hasReleaseCondition = lookback.some((l) => RELEASE_CONDITION_PATTERN.test(l));
    const hasOwner = lookback.some((l) => OWNER_PATTERN.test(l));

    if (!hasTodo) {
      violations.push({
        file: relative(ROOT, filePath),
        line: idx + 1,
        text: trimmed,
        reason: '直上 8行以内に「TODO(誰→誰): 」 形式の解除引き継ぎコメントが見つかりません',
      });
    } else if (!hasReleaseCondition || !hasOwner) {
      // TODO はあるが、 解除条件 or 担当 のいずれかが欠落 → 警告
      const missing = [];
      if (!hasReleaseCondition) missing.push('「解除条件:」');
      if (!hasOwner) missing.push('「担当:」');
      warnings.push({
        file: relative(ROOT, filePath),
        line: idx + 1,
        text: trimmed,
        reason: `TODO はあるが ${missing.join(' / ')} キーワードが見つかりません(推奨)`,
      });
    }
  });

  return { violations, warnings };
}

function main() {
  const allFiles = [];
  for (const target of TARGET_DIRS) {
    allFiles.push(...listFiles(target));
  }

  if (allFiles.length === 0) {
    console.log('[check-skipped-tests] 検査対象なし、 OK');
    process.exit(0);
  }

  const allViolations = [];
  const allWarnings = [];
  let skipCount = 0;

  for (const file of allFiles) {
    const { violations, warnings } = checkFile(file);
    allViolations.push(...violations);
    allWarnings.push(...warnings);
    // skip 件数の集計(violations + warnings + 適格 skip すべて含む)
    const text = readFileSync(file, 'utf-8');
    const matches = text.match(new RegExp(SKIP_PATTERN, 'g'));
    if (matches) skipCount += matches.length;
  }

  // 警告は警告として出力(終了コードには影響しない)
  if (allWarnings.length > 0) {
    console.warn(`[check-skipped-tests] 警告 ${allWarnings.length} 件 — TODO はあるが推奨キーワードが不足:\n`);
    for (const w of allWarnings) {
      console.warn(`  ${w.file}:${w.line}`);
      console.warn(`    ${w.text}`);
      console.warn(`    ${w.reason}\n`);
    }
  }

  if (allViolations.length === 0) {
    console.log(
      `[check-skipped-tests] OK — ${allFiles.length} ファイル検査、 skip ${skipCount} 件すべて適格(TODO コメント明示済み)`,
    );
    process.exit(0);
  }

  console.error(`[check-skipped-tests] NG — ${allViolations.length} 件の skip 忘却防止違反を検出:\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}`);
    console.error(`    ${v.reason}\n`);
  }
  console.error(
    'すべての .skip には直上 8行以内に「TODO(誰→誰): 」 形式のコメント(解除条件: / 担当: 含む)を付けること。',
  );
  console.error('これは「永遠の skip」を構造的に防ぐ仕組みです(Tさん テスト戦略 v0.2 §10 連動)。');
  process.exit(1);
}

main();
