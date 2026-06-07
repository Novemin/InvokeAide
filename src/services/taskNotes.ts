// taskNotes — Google Tasks の notes に埋め込む時刻/期限表記の読み書き共用ヘルパ(S2-4)
//
// 背景: Tasks API の `due` は日付のみ(時刻を持てない)ため、既存方針では
//   notes 内に [予定時刻:HH:MM] / [期限:YYYY-MM-DD] を埋めて時刻・期限を表現する。
//
// このファイルは「読み(parse)」と「書き(format)」の両方を1組にまとめる。
//   - 今回(S2-4①)の Tasks 読み取りで parseTaskNotes を使う。
//   - 将来の追加・編集(書き込み)で formatTaskNotes を再利用する(後続指示)。

export interface TaskNoteFields {
  /** [予定時刻:HH:MM] から抽出した時刻。無ければ undefined。 */
  time?: string
  /** [期限:YYYY-MM-DD] から抽出した期限日。無ければ undefined。 */
  due?: string
  /** ブラケット記法を取り除いた本文。 */
  body: string
}

const TIME_RE = /\[予定時刻:(\d{2}:\d{2})\]/
const DUE_RE = /\[期限:(\d{4}-\d{2}-\d{2})\]/

/**
 * notes 文字列から [予定時刻:HH:MM] / [期限:YYYY-MM-DD] を抽出し、
 * 残りを本文として構造化する。タグが無ければ time/due は undefined。
 */
export function parseTaskNotes(notes: string | null | undefined): TaskNoteFields {
  const raw = notes ?? ''
  const time = TIME_RE.exec(raw)?.[1]
  const due = DUE_RE.exec(raw)?.[1]
  const body = raw
    .replace(TIME_RE, '')
    .replace(DUE_RE, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { time, due, body }
}

/**
 * 構造化フィールドを notes 文字列へ戻す(書き込み用、parseTaskNotes の逆)。
 * 本文の後ろにタグを付与する。time/due が無ければそのタグは省く。
 */
export function formatTaskNotes(fields: TaskNoteFields): string {
  const tags: string[] = []
  if (fields.time) tags.push(`[予定時刻:${fields.time}]`)
  if (fields.due) tags.push(`[期限:${fields.due}]`)
  const body = (fields.body ?? '').trim()
  return [body, tags.join(' ')].filter((s) => s.length > 0).join('\n').trim()
}
