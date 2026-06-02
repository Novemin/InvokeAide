// bundled キャラクター 同梱 index(段階2c)
// 設計: docs/Phase2/Phase2_Drive_ファイルレイアウト設計_v0.1_2026-05-19.md §4.6 / index.json 例(F2)
//
// ベータ v1.0 同梱の 3 キャラの CharacterEntry メタ情報。
// 用途:
//   - 初回起動時の Drive seeding(config/index.json の初期値) ※seeding 本体は別段階
//   - loadCharacterIndex の bundled fallback ※wiring は別段階(本段階2c では未接続)
// MD 本文は registry.ts(import.meta.glob)側が保持し、本ファイルはメタのみを持つ。
//
// ★ voicevoxSpeakerId は VOICEVOX の style ID(数値)。たかしさん指定の話者名からの対応:
//     miyu      = 春日部つむぎ
//     bro       = 雀松朱司
//     sebastian = 剣崎雌雄
//   下記の数値は一般的な VOICEVOX style ID だが、エンジンのバージョンで変わり得るため
//   実機(/speakers エンドポイント)での確定が必要(Sさん 実機検証領域)。確定後に修正する。

import type { CharacterEntry, CharacterIndex } from '@/interfaces/domain'

// 同梱 index の初期 lastUpdated(静的データのため固定。Drive へ seed する際は再スタンプ想定)
const BUNDLED_INDEX_STAMP = '2026-06-02T00:00:00.000Z'

export const BUNDLED_CHARACTERS: CharacterEntry[] = [
  {
    id: 'miyu',
    displayName: 'ギャル秘書 MIYU',
    characterMdPath: 'config/characters/miyu.md',
    coachingMdPath: 'config/characters/miyu.coaching.md',
    voicevoxSpeakerId: 8, // 春日部つむぎ(要実機確認)
    voicevoxCreditLine: 'VOICEVOX:春日部つむぎ',
    description:
      'みゆだよ、明るく軽やかなノリで、予定もタスクも人間関係もまとめて先読みするギャル系天才秘書です。',
    bundledInBeta: true,
  },
  {
    id: 'bro',
    displayName: 'コーチング秘書 兄ちゃん',
    characterMdPath: 'config/characters/bro.md',
    coachingMdPath: 'config/characters/bro.coaching.md',
    voicevoxSpeakerId: 52, // 雀松朱司(要実機確認)
    voicevoxCreditLine: 'VOICEVOX:雀松朱司',
    description:
      '兄ちゃんだ、あなたの可能性を信じ、行動力と自信に火をつける情熱型のコーチング秘書だ。',
    bundledInBeta: true,
  },
  {
    id: 'sebastian',
    displayName: '熟練コンシェルジュ秘書 セバスチャン',
    characterMdPath: 'config/characters/sebastian.md',
    coachingMdPath: 'config/characters/sebastian.coaching.md',
    voicevoxSpeakerId: 21, // 剣崎雌雄(要実機確認)
    voicevoxCreditLine: 'VOICEVOX:剣崎雌雄',
    description:
      'セバスチャンでございます、長年の経験と冷静な判断で、あなたが進むべき道を静かに整えるベテランコンシェルジュです。',
    bundledInBeta: true,
  },
]

export const BUNDLED_CHARACTER_INDEX: CharacterIndex = {
  schemaVersion: '1',
  lastUpdated: BUNDLED_INDEX_STAMP,
  characters: BUNDLED_CHARACTERS,
}
