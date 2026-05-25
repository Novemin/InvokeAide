// notes 構造化記法の encode/decode
// 形式: [キー:値] の繰り返し(構造化部分) + 自由記述
// 例: [予定時刻:07:30][期限:2026-06-15] お店メモ: スーパーA 駅前店
//
// 「notes 構造化記法方式」 の InvokeAide における基本実装。 本ファイルは検証用の参考実装、
// ベータ本体での実装は B2 / B3 で Uさん が組み込み(本記法を踏襲)。

/**
 * @param {Record<string, string>} structured  構造化フィールド(キー・値の文字列マップ)
 * @param {string} [freeText]  自由記述部分(任意)
 * @returns {string}  notes 欄に書き込む文字列
 */
export function encode(structured, freeText = '') {
  const tags = Object.entries(structured)
    .map(([key, value]) => `[${key}:${value}]`)
    .join('');
  if (!freeText) return tags;
  if (!tags) return freeText;
  return `${tags}\n${freeText}`;
}

const TAG_PATTERN = /\[([^\]:]+):([^\]]+)\]/g;

/**
 * @param {string | null | undefined} notes  notes 欄の生文字列
 * @returns {{ structured: Record<string, string>, freeText: string }}
 */
export function decode(notes) {
  if (!notes) return { structured: {}, freeText: '' };
  const structured = {};
  let m;
  TAG_PATTERN.lastIndex = 0;
  while ((m = TAG_PATTERN.exec(notes)) !== null) {
    structured[m[1]] = m[2];
  }
  const freeText = notes.replace(TAG_PATTERN, '').trim();
  return { structured, freeText };
}
