// cache-config — DriveStorageProvider のローカルキャッシュ TTL 設定(段階2a)
// 設計: docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md §3.5(loadSettings 等)
//       docs/Phase2/Phase2_実装設計_v0.2反映メモ_2026-05-26.md §3(Q-U-j-9 確定)
//
// リソース種別ごとに TTL を階層化する(Q-U-j-9 確定値)。
//   - 操作後の即時反映が要る設定系(settings / index / profile)= 60 秒
//   - 更新頻度が低く bundled fallback もある読み物系(manual / characters / coaching)= 1 時間
//   - 追記専用(errors / conversations)= キャッシュなし(常に Drive を見る)
//
// ベータ v1.0 用の暫定値。運用後にたかしさんの体感で再調整しやすいよう、
// 値はここに定数集約する(v0.2反映メモ §3.3)。「未来縛らない」原則。

/** 設定 settings.json(F3): 操作後の即時反映が要る */
export const CACHE_TTL_SETTINGS_MS = 60_000
/** キャラ一覧 index.json(F2): 追加/削除/切替の即時反映が要る */
export const CACHE_TTL_INDEX_MS = 60_000
/** プロファイル profile.md(F4): ユーザー編集後の即時反映が要る */
export const CACHE_TTL_PROFILE_MS = 60_000
/** マニュアル manual.md(F5): 更新頻度低、bundled fallback あり */
export const CACHE_TTL_MANUAL_MS = 3_600_000
/** キャラ MD characters/<id>.md(F6): 更新頻度低、bundled fallback あり */
export const CACHE_TTL_CHARACTER_MS = 3_600_000
/** コーチング MD characters/<id>.coaching.md(F7): 更新頻度低、bundled fallback あり */
export const CACHE_TTL_COACHING_MS = 3_600_000

/**
 * 論理パスからキャッシュ TTL(ミリ秒)を解決する。
 * `null` を返す論理パスはキャッシュ対象外(追記専用 / 未知パス)。
 *
 * 判定順は曖昧さを避けるため固定:
 *   `.coaching.md`(F7)は `.md` で終わるため、キャラ MD(F6)判定より前に置く。
 *   未知パスは安全側で `null`(= キャッシュしない)に倒す。
 */
export function resolveCacheTtlMs(logicalPath: string): number | null {
  if (logicalPath.endsWith('/settings.json')) {
    return CACHE_TTL_SETTINGS_MS
  }
  if (logicalPath.endsWith('/index.json')) {
    return CACHE_TTL_INDEX_MS
  }
  if (logicalPath.endsWith('/profile.md')) {
    return CACHE_TTL_PROFILE_MS
  }
  if (logicalPath.endsWith('/manual.md')) {
    return CACHE_TTL_MANUAL_MS
  }
  if (logicalPath.endsWith('.coaching.md')) {
    return CACHE_TTL_COACHING_MS
  }
  // F8 errors.md / F9 logs/conversations/*.md は追記専用 → キャッシュなし
  if (logicalPath.endsWith('/errors.md')) {
    return null
  }
  if (logicalPath.includes('/logs/conversations/')) {
    return null
  }
  // F6 キャラ MD(config/characters/<id>.md、上で .coaching.md は除外済)
  if (logicalPath.includes('/config/characters/') && logicalPath.endsWith('.md')) {
    return CACHE_TTL_CHARACTER_MS
  }
  // 既定: 未知パスはキャッシュしない(安全側)
  return null
}
