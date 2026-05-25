// 4 検証を順次実行 + 結果集約 + 全体 exit code 決定
//
// 実行: node scripts/verify-tasks-api/run-all.js
// 終了コード: 全 4 検証が PASS なら 0、 1 つでも FAIL or エラーなら 1

import { verifyDueTimeStripped } from './01-verify-due-time-stripped.js';
import { verifyDeadlineNotSupported } from './02-verify-deadline-not-supported.js';
import { verifyTaskSeriesNotInCalendar } from './03-verify-taskseries-not-in-calendar.js';
import { verifyNotesStructuredReadWrite } from './04-verify-notes-structured-rw.js';

const VERIFICATIONS = [
  { id: '01', name: 'due 時刻破棄(Tasks API)', fn: verifyDueTimeStripped },
  { id: '02', name: 'deadline 不存在(Tasks API)', fn: verifyDeadlineNotSupported },
  {
    id: '03',
    name: 'taskSeries 不存在(Calendar API)',
    fn: verifyTaskSeriesNotInCalendar,
  },
  { id: '04', name: 'notes 構造化記法 R/W(Tasks API)', fn: verifyNotesStructuredReadWrite },
];

async function main() {
  const results = [];
  for (const { id, name, fn } of VERIFICATIONS) {
    console.log(`\n=== 検証 ${id}: ${name} ===`);
    try {
      const r = await fn();
      const status = r.verdict.startsWith('PASS') ? 'PASS' : 'FAIL';
      console.log(`${status === 'PASS' ? '✅' : '❌'} ${r.verdict}`);
      results.push({ id, name, status, ...r });
    } catch (err) {
      console.error(`❌ 検証 ${id} がエラーで停止: ${err.message}`);
      results.push({ id, name, status: 'ERROR', error: err.message });
    }
  }

  console.log('\n=== サマリ ===');
  for (const r of results) {
    console.log(`  [${r.status}] ${r.id} ${r.name}`);
  }

  console.log('\n=== JSON 全文 ===');
  console.log(JSON.stringify(results, null, 2));

  const allPassed = results.every((r) => r.status === 'PASS');
  return allPassed ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('❌ run-all 致命的エラー:', err);
    process.exit(1);
  });
