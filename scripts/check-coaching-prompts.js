#!/usr/bin/env node
/**
 * check-coaching-prompts.js
 * H8 NG ワード辞書(9カテゴリ)による coaching.md 静的検査 — CLI エントリポイント。
 *
 * 2026-05-21 週末タスクA-4 でモジュール化:
 *   - ロジック層は scripts/lib/coaching-scanner.js に分離
 *   - 本ファイルは CLI 出力フォーマットと exit code 制御のみ
 *   - ユニットテストは tests/unit/coaching-scanner.test.ts(Vitest)
 *
 * 由来:
 *   - Tさん v0.2 §7.2.3 / Sさん コーチングMD §3.2
 *
 * 検査対象:
 *   - assets/characters/*.coaching.md(ビルド同梱、 Sさん 起草)
 *   - src/characters/*.coaching.md(将来)
 *
 * 違反検出時は process.exit(1)。 違反なしで 0。
 */

import { relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import {
  checkFile,
  listCoachingFiles,
  DEFAULT_TARGET_DIRS,
} from './lib/coaching-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

function main() {
  const allFiles = [];
  for (const dir of DEFAULT_TARGET_DIRS) {
    allFiles.push(...listCoachingFiles(ROOT, dir));
  }

  if (allFiles.length === 0) {
    console.log('[check-coaching-prompts] 検査対象なし(coaching.md 未配置段階、 OK)');
    console.log('  対象: assets/characters/*.coaching.md / src/characters/*.coaching.md');
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

  console.error(`[check-coaching-prompts] NG — ${allViolations.length} 件の違反を検出:\n`);
  for (const v of allViolations) {
    console.error(`  ${relative(ROOT, v.file)}:${v.line}  [${v.category}]`);
    console.error(`    パターン: /${v.pattern}/`);
    console.error(`    該当行: ${v.text}\n`);
  }
  process.exit(1);
}

main();
