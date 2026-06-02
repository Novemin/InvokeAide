// bundled キャラクター MD レジストリ(段階2c)
// 設計: docs/Phase2/Phase2_Drive_ファイルレイアウト設計_v0.1_2026-05-19.md §4.6(F6/F7 同梱)
//
// ビルド同梱の *.md / *.coaching.md を import.meta.glob で生文字列として取り込み、
// id 単位でアクセスできるようにする。DriveStorageProvider の 404 fallback と
// diffBundledVsDrive(version 比較)が参照する。
//
// 注意:
//   - import.meta.glob のパターンに `@/` エイリアスは使えないため相対パスで指定する。
//   - 本モジュールを src/assets/characters/ 配下に置くことで './*.md' で同梱 MD を拾える。
//   - `.coaching.md` も `*.md` にマッチするため、判定は coaching を先に行う。

// eager + ?raw で各 MD を string として同期取得(6ファイル・各数 KB と小さいため eager で可)
const rawMds = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const characterMds: Record<string, string> = {}
const coachingMds: Record<string, string> = {}

for (const [path, content] of Object.entries(rawMds)) {
  const file = path.replace(/^\.\//, '') // './miyu.coaching.md' → 'miyu.coaching.md'
  if (file.endsWith('.coaching.md')) {
    coachingMds[file.slice(0, -'.coaching.md'.length)] = content
  } else if (file.endsWith('.md')) {
    characterMds[file.slice(0, -'.md'.length)] = content
  }
}

/** 同梱キャラ MD(F6 <id>.md)。無ければ null。 */
export function getBundledCharacterMd(id: string): string | null {
  return characterMds[id] ?? null
}

/** 同梱コーチング MD(F7 <id>.coaching.md)。無ければ null。 */
export function getBundledCoachingMd(id: string): string | null {
  return coachingMds[id] ?? null
}

/** 同梱キャラ MD を持つ id 一覧。 */
export function listBundledCharacterIds(): string[] {
  return Object.keys(characterMds)
}
