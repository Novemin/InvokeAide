// 検証 01: Google Tasks API の `due` は日付のみで、 時刻情報は破棄される
//
// 公式ドキュメント: https://developers.google.com/tasks/reference/rest/v1/tasks
//   "Due date of the task ... The due date only records date information; the time portion ... is ignored."
//
// 期待挙動:
//   - due に '2026-06-15T07:30:00.000Z' を指定して create
//   - get で取り出した due は時刻が破棄されている(時刻が '00:00:00' に丸まる or 日付のみ)
//   - 元の '07:30:00' は保持されない

import { getTasksClient } from './lib/auth.js';
import { withCleanup } from './lib/cleanup.js';

const TEST_DUE_WITH_TIME = '2026-06-15T07:30:00.000Z';
const EXPECTED_DATE_PART = '2026-06-15';

export async function verifyDueTimeStripped() {
  const tasks = await getTasksClient();
  return withCleanup(
    async () => {
      const { data } = await tasks.tasks.insert({
        tasklist: '@default',
        requestBody: {
          title: '[検証01] due 時刻破棄テスト',
          due: TEST_DUE_WITH_TIME,
        },
      });
      return data;
    },
    async (task) => {
      const { data: fetched } = await tasks.tasks.get({
        tasklist: '@default',
        task: task.id,
      });
      const observation = {
        sent_due: TEST_DUE_WITH_TIME,
        received_due: fetched.due,
        time_component_preserved: fetched.due === TEST_DUE_WITH_TIME,
        date_component_correct: !!fetched.due && fetched.due.startsWith(EXPECTED_DATE_PART),
        time_part_of_received: fetched.due ? fetched.due.slice(EXPECTED_DATE_PART.length) : null,
      };
      const passed =
        !observation.time_component_preserved && observation.date_component_correct;
      const verdict = passed
        ? 'PASS: 時刻部分が破棄され、 日付のみ保持されている(公式ドキュメント通り)'
        : 'FAIL: 想定挙動と異なる、 詳細は observation を確認';
      return { observation, verdict };
    },
    async (task) => {
      await tasks.tasks.delete({
        tasklist: '@default',
        task: task.id,
      });
    },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDueTimeStripped()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.verdict.startsWith('PASS') ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ 01 検証エラー:', err.message);
      process.exit(1);
    });
}
