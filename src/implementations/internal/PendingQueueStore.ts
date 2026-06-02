// PendingQueueStore — オフライン中の Drive 書込み要求を溜める永続キュー(段階2e)
// 設計: docs/Phase2/Phase2_実装設計_v0.1_2026-05-25.md(オフライン書込みの保存待ち)
//       IndexedDbCache.ts §非責務 で「段階2e の internal/PendingQueueStore」として予告済
//
// 責務:
//   - オフライン検知時に発生した「Drive への書込み要求」を IndexedDB に enqueue する
//   - オンライン復帰時、DriveStorageProvider.flushPending() が getAll() で
//     enqueuedAt 昇順に読み出し、順番に Drive へ反映 → 成功分を remove() する
//   - LWW(version比較によるread-before-write楽観ロック)で使う knownVersion を
//     積んだ時点の etagMap の値として一緒に保存する
//
// 非責務(本ファイルのスコープ外):
//   - DriveStorageProvider 本体への配線(flushPending の実装)
//   - ConflictResolver(段階2e-3)
//
// DB は DriveStorageProvider の cache(invokeaide.cache)とは別 DB(invoke-aide-pending)に分離し、
// キャッシュのライフサイクル(サインアウト clear 等)とキューのライフサイクルを独立させる。

/** キューに積む1件分のエントリ。 */
export interface PendingEntry {
  /** crypto.randomUUID() で自動付与。keyPath かつ remove() の削除キー。 */
  id: string
  /** 例: 'profile', 'settings', 'history/2026-06-02'。 */
  logicalPath: string
  /** Drive に書き込む文字列(JSON or Markdown)。 */
  content: string
  /** Date.now() のタイムスタンプ。getAll の整列キー兼 LWW 比較に使う。 */
  enqueuedAt: number
  /** 積んだ時点で etagMap から取得した version 文字列(LWW の read-before-write 用)。 */
  knownVersion: string
}

export class PendingQueueStore {
  private readonly DB_NAME = 'invoke-aide-pending'
  private readonly STORE_NAME = 'pending-entries'
  private readonly DB_VERSION = 1

  // 遅延オープンした接続を保持(公開 API に initialize を持たせず内部で冪等確保)。
  private db: IDBDatabase | null = null

  /** エントリを1件追加する。id は crypto.randomUUID() で自動付与。 */
  async enqueue(entry: Omit<PendingEntry, 'id'>): Promise<void> {
    const full: PendingEntry = { ...entry, id: crypto.randomUUID() }
    const db = await this.getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite')
      const store = tx.objectStore(this.STORE_NAME)
      const req = store.put(full)
      req.onsuccess = () => resolve()
      req.onerror = () => {
        // キューの取りこぼし = オフライン書込みの消失に直結するため、
        // IndexedDbCache のように握りつぶさず、warn のうえ再throw して呼出側へ伝える。
        console.warn('PendingQueueStore.enqueue failed', this.serializeError(req.error))
        reject(req.error ?? new Error('PendingQueueStore.enqueue failed'))
      }
    })
  }

  /** 全エントリを enqueuedAt 昇順で返す。 */
  async getAll(): Promise<PendingEntry[]> {
    const db = await this.getDb()
    const entries = await new Promise<PendingEntry[]>((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly')
      const store = tx.objectStore(this.STORE_NAME)
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result as PendingEntry[]) ?? [])
      req.onerror = () => {
        console.warn('PendingQueueStore.getAll failed', this.serializeError(req.error))
        reject(req.error ?? new Error('PendingQueueStore.getAll failed'))
      }
    })
    // IndexedDB の getAll はキー(id=UUID)順で返るため、明示的に enqueuedAt で整列する。
    return entries.sort((a, b) => a.enqueuedAt - b.enqueuedAt)
  }

  /** 処理済みエントリを id で削除する。 */
  async remove(id: string): Promise<void> {
    const db = await this.getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite')
      const store = tx.objectStore(this.STORE_NAME)
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => {
        console.warn('PendingQueueStore.remove failed', { id, ...this.serializeError(req.error) })
        reject(req.error ?? new Error('PendingQueueStore.remove failed'))
      }
    })
  }

  /** キューを全件クリアする(デバッグ・テスト用)。 */
  async clear(): Promise<void> {
    const db = await this.getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite')
      const store = tx.objectStore(this.STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => {
        console.warn('PendingQueueStore.clear failed', this.serializeError(req.error))
        reject(req.error ?? new Error('PendingQueueStore.clear failed'))
      }
    })
  }

  // -- 内部ヘルパー: IndexedDB --------------------------------------

  /** 接続を冪等に確保する。利用不可環境では warn のうえ throw。 */
  private async getDb(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db
    }
    if (!globalThis.indexedDB) {
      const err = new Error('IndexedDB unavailable')
      console.warn('PendingQueueStore.getDb failed', this.serializeError(err))
      throw err
    }
    this.db = await this.openDb()
    return this.db
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = globalThis.indexedDB.open(this.DB_NAME, this.DB_VERSION)

      // onupgradeneeded は v1 → vN の migration を最初から構造化(IndexedDbCache と同方針)。
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion
        if (oldVersion < 1) {
          // keyPath は id(UUID)。remove(id) の削除キーと一致させる。
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' })
        }
        // 将来 v2 で field 追加時:
        //   if (oldVersion < 2) { ... }
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        console.warn('PendingQueueStore.openDb failed', this.serializeError(req.error))
        reject(req.error ?? new Error('IndexedDB open failed'))
      }
      req.onblocked = () => reject(new Error('IndexedDB open blocked by other tab'))
    })
  }

  private serializeError(err: unknown): { name: string; message: string } {
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { name: 'unknown', message: String(err) }
  }
}
