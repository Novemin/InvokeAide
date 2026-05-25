// 検証 03: Google Calendar API のイベントレスポンスに `taskSeries` 項目は存在しない
//
// 公式ドキュメント: Event resource のプロパティ列挙に taskSeries は存在しない
//   https://developers.google.com/calendar/api/v3/reference/events
//
// 期待挙動:
//   - test event を作成
//   - get で取り出した event のキーを列挙、 taskSeries が含まれないことを確認

import { getCalendarClient } from './lib/auth.js';
import { withCleanup } from './lib/cleanup.js';

const TEST_CALENDAR_ID = 'primary';

export async function verifyTaskSeriesNotInCalendar() {
  const calendar = await getCalendarClient();
  return withCleanup(
    async () => {
      const { data } = await calendar.events.insert({
        calendarId: TEST_CALENDAR_ID,
        requestBody: {
          summary: '[検証03] taskSeries フィールド確認',
          description: 'Google Calendar API のレスポンスに taskSeries が含まれないことの裏取り',
          start: { dateTime: '2026-06-15T07:00:00+09:00', timeZone: 'Asia/Tokyo' },
          end: { dateTime: '2026-06-15T08:00:00+09:00', timeZone: 'Asia/Tokyo' },
        },
      });
      return data;
    },
    async (event) => {
      const { data: fetched } = await calendar.events.get({
        calendarId: TEST_CALENDAR_ID,
        eventId: event.id,
      });
      const observation = {
        fetched_keys: Object.keys(fetched).sort(),
        taskSeries_present: 'taskSeries' in fetched,
        taskSeries_value: fetched.taskSeries ?? null,
        recurrence_present: 'recurrence' in fetched,
        recurringEventId_present: 'recurringEventId' in fetched,
      };
      const passed = !observation.taskSeries_present;
      const verdict = passed
        ? 'PASS: taskSeries は Calendar イベントレスポンスに含まれない(公式ドキュメント通り、 反復系は recurrence / recurringEventId が標準)'
        : 'FAIL: 想定外、 taskSeries が含まれている、 公式ドキュメントの記述と乖離';
      return { observation, verdict };
    },
    async (event) => {
      await calendar.events.delete({
        calendarId: TEST_CALENDAR_ID,
        eventId: event.id,
      });
    },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyTaskSeriesNotInCalendar()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.verdict.startsWith('PASS') ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ 03 検証エラー:', err.message);
      process.exit(1);
    });
}
