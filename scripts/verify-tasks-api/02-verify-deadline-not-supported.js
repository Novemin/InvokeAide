// 検証 02: Google Tasks API の Task resource に `deadline` フィールドは存在しない
//
// 公式ドキュメント: Task resource のプロパティ列挙に deadline は存在しない
//   https://developers.google.com/tasks/reference/rest/v1/tasks
//
// 期待挙動:
//   - deadline を含めて create を試行
//   - API は deadline を無視する(エラーにせず、 ただし fetched に deadline 含まれない)
//     もしくは
//   - API がエラーを返す(unknown field)
//
// どちらの挙動でも「deadline フィールドは API に存在しない」 ことの裏取りになる。

import { getTasksClient } from './lib/auth.js';
import { withCleanup } from './lib/cleanup.js';

const TEST_DEADLINE = '2026-06-15T18:00:00.000Z';

export async function verifyDeadlineNotSupported() {
  const tasks = await getTasksClient();
  let createFailedError = null;

  return withCleanup(
    async () => {
      try {
        const { data } = await tasks.tasks.insert({
          tasklist: '@default',
          requestBody: {
            title: '[検証02] deadline フィールド試行',
            deadline: TEST_DEADLINE,
          },
        });
        return data;
      } catch (err) {
        // create がエラーになる挙動なら、 それも「deadline 不存在」 の裏取りになる
        createFailedError = err;
        return null;
      }
    },
    async (task) => {
      if (createFailedError) {
        return {
          observation: {
            createFailed: true,
            error: createFailedError.message,
          },
          verdict: `PASS: deadline 指定で API エラー、 フィールド不存在を裏取り(${createFailedError.message})`,
        };
      }
      const { data: fetched } = await tasks.tasks.get({
        tasklist: '@default',
        task: task.id,
      });
      const observation = {
        fetched_keys: Object.keys(fetched).sort(),
        deadline_present_in_response: 'deadline' in fetched,
        deadline_value: fetched.deadline ?? null,
      };
      const passed = !observation.deadline_present_in_response;
      const verdict = passed
        ? 'PASS: deadline は無視され、 fetched レスポンスに含まれない(フィールド非存在を裏取り)'
        : 'FAIL: 想定外、 deadline が保持されている、 公式ドキュメントの記述と乖離';
      return { observation, verdict };
    },
    async (task) => {
      if (!task) return; // create 失敗時は削除不要
      await tasks.tasks.delete({
        tasklist: '@default',
        task: task.id,
      });
    },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDeadlineNotSupported()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.verdict.startsWith('PASS') ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ 02 検証エラー:', err.message);
      process.exit(1);
    });
}
