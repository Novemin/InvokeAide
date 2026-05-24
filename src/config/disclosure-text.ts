// AI 明示モーダル文言(B1 仮文言、 B2 で法的書類 v0.4 確定文言へ差し替え)
// 文言を差し替える時は本ファイルの値のみ変更、 コンポーネント側は触らない
// 根拠: 法的書類起草指示書 v0.3 §6.1 / EU AI Act 第50条 / CLAUDE.md §4.1

export const aiDisclosureText = {
  title: 'はじめにご確認ください',
  body: '本アプリは、 AI(人工知能)を用いた対話システムです。',
  body2:
    '応答にはキャラクター演技が含まれますが、 すべて AI が生成しています。 表示内容の正確性・適切性についてはご自身でご判断ください。',
  acknowledgeButton: '確認しました',
} as const;

export type AiDisclosureText = typeof aiDisclosureText;
