// 検証 04: `notes` 欄に `[キー:値]` 形式の構造化記法を書き込み・読み取り可能か
//
// 採用された「notes 構造化記法方式」 の土台確認。
// 「ハイブリッド (ID 連携) 方式」 不採用の代替案として、 Tasks の notes に時刻・期限などを
// 構造化記法で埋め込む方式が採用された。 本検証はその方式の最も基本的な前提
// (notes が書いた通り保存され、 取り出せること)を実機で確認する。
//
// 期待挙動:
//   - encode した構造化記法 + 自由記述を含む notes でタスクを作成
//   - get した notes が元のまま保持されている
//   - decode で構造化部分が正しく取り出せ、 自由記述部分も保持されている

import { getTasksClient } from './lib/auth.js';
import { withCleanup } from './lib/cleanup.js';
import { encode, decode } from './lib/notes-codec.js';

const STRUCTURED_INPUT = {
  予定時刻: '07:30',
  期限: '2026-06-15',
};
const FREE_TEXT_INPUT = 'お店メモ: スーパーA 駅前店、 牛乳と卵を忘れずに';
const ENCODED_NOTES = encode(STRUCTURED_INPUT, FREE_TEXT_INPUT);

export async function verifyNotesStructuredReadWrite() {
  const tasks = await getTasksClient();
  return withCleanup(
    async () => {
      const { data } = await tasks.tasks.insert({
        tasklist: '@default',
        requestBody: {
          title: '[検証04] notes 構造化記法 R/W',
          notes: ENCODED_NOTES,
        },
      });
      return data;
    },
    async (task) => {
      const { data: fetched } = await tasks.tasks.get({
        tasklist: '@default',
        task: task.id,
      });
      const decoded = decode(fetched.notes);
      const structuredMatch =
        JSON.stringify(decoded.structured) === JSON.stringify(STRUCTURED_INPUT);
      const freeTextMatch = decoded.freeText === FREE_TEXT_INPUT;
      const observation = {
        sent_notes: ENCODED_NOTES,
        received_notes: fetched.notes,
        notes_byte_for_byte_preserved: fetched.notes === ENCODED_NOTES,
        decoded_structured: decoded.structured,
        decoded_freeText: decoded.freeText,
        structured_round_trip_match: structuredMatch,
        freeText_round_trip_match: freeTextMatch,
      };
      const passed =
        observation.notes_byte_for_byte_preserved && structuredMatch && freeTextMatch;
      const verdict = passed
        ? 'PASS: notes 構造化記法が想定通り R/W 可能、 「notes 構造化記法方式」 の土台が成立'
        : 'FAIL: notes 構造化記法に想定外挙動あり、 詳細は observation を確認';
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
  verifyNotesStructuredReadWrite()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.verdict.startsWith('PASS') ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ 04 検証エラー:', err.message);
      process.exit(1);
    });
}
