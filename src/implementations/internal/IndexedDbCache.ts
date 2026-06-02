// IndexedDbCache — DriveStorageProvider の端末内ローカルキャッシュ層(段階2a)
// 設計: docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md §3.3(private cache: IndexedDbCache)
//       docs/Phase2/Phase2_実装設計_v0.2反映メモ_2026-05-26.md §3(TTL 階層化)
//
// 責務:
//   - Drive から取得した値を論理パス単位で IndexedDB に保存(オフライン UX / API レート節約)
//   - TTL は cache-config.ts から注入(ttlResolver)。TTL=null の論理パスは保存も取得もしない
//   - 値の鮮度(fresh)判定は get 時に Clock 基準で算出して返す。TTL を超過しても
//     エントリは消さず、呼出側が allowStaleCache 時に古い値を使えるようにする
//
// 非責務(段階2a スコープ外):
//   - オフライン書込みの保存待ち(段階2e の internal/PendingQueueStore)
//   - LWW 競合解決(段階2e の internal/ConflictResolver)
//
// 暗号化は行わない。秘匿情報(API キー / refresh_token)は SecretStore 専用であり、
// 本キャッシュは Drive 上に既にあるアプリデータの写しのみを保持する。

import type { Clock, Logger, ResourceMeta } from '@/interfaces/types'

/** get が返すキャッシュ参照結果(鮮度判定込み)。 */
export interface CacheEntry<T> {
  value: T
  meta: ResourceMeta
  /** RFC3339 UTC。保存時の clock.now()。 */
  cachedAt: string
  /** TTL 内なら true。allowStaleCache の判断材料として呼出側へ渡す。 */
  fresh: boolean
}

export interface CacheDeps {
  clock: Clock
  logger?: Logger
  /** 論理パス → TTL(ms)。null はキャッシュ対象外。cache-config.ts から注入。 */
  ttlResolver: (logicalPath: string) => number | null
}

interface StoredRecord {
  logicalPath: string
  value: unknown
  meta: ResourceMeta
  cachedAt: string
}

export class IndexedDbCache {
  private static readonly DB_NAME = 'invokeaide.cache'
  private static readonly DB_VERSION = 1
  private static readonly STORE_NAME = 'resources'

  private db: IDBDatabase | null = null
  private deps: CacheDeps

  constructor(deps: CacheDeps) {
    this.deps = deps
  }

  /** IndexedDB を開く。利用不可環境では throw(呼出側でキャッシュ無し劣化運用に倒す)。 */
  async initialize(): Promise<void> {
    if (!globalThis.indexedDB) {
      throw new Error('IndexedDB unavailable')
    }
    this.db = await this.openDb()
  }

  /**
   * 論理パスのキャッシュを取得する。
   *   - 未初期化 / TTL 対象外 / レコード無し → null
   *   - レコードあり → 鮮度(fresh)を算出して返す(TTL 超過でも返す。判断は呼出側)
   */
  async get<T>(logicalPath: string): Promise<CacheEntry<T> | null> {
    if (!this.db) {
      return null
    }
    const ttlMs = this.deps.ttlResolver(logicalPath)
    if (ttlMs === null) {
      return null
    }
    const record = await this.read(logicalPath)
    if (!record) {
      return null
    }
    // 現在時刻は必ず Clock 抽象から(設計 §0.4)。new Date(arg) は保存値の parse のみ。
    const nowMs = this.deps.clock.now().getTime()
    const cachedMs = new Date(record.cachedAt).getTime()
    const ageMs = nowMs - cachedMs
    const fresh = Number.isFinite(cachedMs) && ageMs >= 0 && ageMs <= ttlMs
    return { value: record.value as T, meta: record.meta, cachedAt: record.cachedAt, fresh }
  }

  /** 論理パスに値を保存する。TTL 対象外 / 未初期化なら no-op。 */
  async set<T>(logicalPath: string, value: T, meta: ResourceMeta): Promise<void> {
    if (!this.db) {
      return
    }
    if (this.deps.ttlResolver(logicalPath) === null) {
      return
    }
    const record: StoredRecord = {
      logicalPath,
      value,
      meta,
      cachedAt: this.deps.clock.now().toISOString(),
    }
    await this.write(record)
  }

  /** 単一論理パスのキャッシュを削除する。 */
  async delete(logicalPath: string): Promise<void> {
    if (!this.db) {
      return
    }
    await new Promise<void>((resolve) => {
      const tx = this.db!.transaction(IndexedDbCache.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbCache.STORE_NAME)
      const req = store.delete(logicalPath)
      req.onsuccess = () => resolve()
      req.onerror = () => {
        this.deps.logger?.warn('IndexedDbCache.delete failed', {
          logicalPath,
          err: this.serializeError(req.error),
        })
        resolve()
      }
    })
  }

  /** 全キャッシュを破棄する(サインアウト / リセット時に呼出側が使用)。 */
  async clear(): Promise<void> {
    if (!this.db) {
      return
    }
    await new Promise<void>((resolve) => {
      const tx = this.db!.transaction(IndexedDbCache.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbCache.STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => {
        this.deps.logger?.warn('IndexedDbCache.clear failed', {
          err: this.serializeError(req.error),
        })
        resolve()
      }
    })
  }

  /**
   * 保留中の書込みを確実に永続化する。
   * 現状は write-through(set/delete を毎回 await)のため実質 no-op だが、
   * 将来 write-coalescing を入れる際のフックとして dispose から呼ぶ口を用意しておく。
   */
  async flush(): Promise<void> {
    // write-through のため保留書込みは無い。将来の拡張点。
  }

  /** DB 接続を閉じる(dispose の最終段で呼ぶ)。 */
  close(): void {
    this.db?.close()
    this.db = null
  }

  // -- 内部ヘルパー: IndexedDB --------------------------------------

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = globalThis.indexedDB.open(IndexedDbCache.DB_NAME, IndexedDbCache.DB_VERSION)

      // onupgradeneeded は v1 → vN の migration を最初から構造化(SecretStore と同方針)
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion
        if (oldVersion < 1) {
          db.createObjectStore(IndexedDbCache.STORE_NAME, { keyPath: 'logicalPath' })
        }
        // 将来 v2 で field 追加時:
        //   if (oldVersion < 2) { ... }
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
      req.onblocked = () => reject(new Error('IndexedDB open blocked by other tab'))
    })
  }

  private read(logicalPath: string): Promise<StoredRecord | null> {
    return new Promise<StoredRecord | null>((resolve) => {
      const tx = this.db!.transaction(IndexedDbCache.STORE_NAME, 'readonly')
      const store = tx.objectStore(IndexedDbCache.STORE_NAME)
      const req = store.get(logicalPath)
      req.onsuccess = () => {
        const record = req.result as StoredRecord | undefined
        resolve(record ?? null)
      }
      req.onerror = () => {
        this.deps.logger?.warn('IndexedDbCache.read failed', {
          logicalPath,
          err: this.serializeError(req.error),
        })
        resolve(null)
      }
    })
  }

  private write(record: StoredRecord): Promise<void> {
    return new Promise<void>((resolve) => {
      const tx = this.db!.transaction(IndexedDbCache.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbCache.STORE_NAME)
      const req = store.put(record)
      req.onsuccess = () => resolve()
      req.onerror = () => {
        // キャッシュ書込み失敗は致命ではない(次回 Drive 取得で回復)。warn に留める。
        this.deps.logger?.warn('IndexedDbCache.write failed', {
          logicalPath: record.logicalPath,
          err: this.serializeError(req.error),
        })
        resolve()
      }
    })
  }

  private serializeError(err: unknown): { name: string; message: string } {
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { name: 'unknown', message: String(err) }
  }
}
