// IndexedDbSecretStore (2026-05-26 実装、 contract v0.2 適用後)
//
// SecretStore contract の本番実装。
//   - IndexedDB (`invokeaide.secrets`, v1) に AES-GCM 256bit 暗号文を保管
//   - 端末派生鍵 (master key) は localStorage の deviceSeed (UUID) を PBKDF2 で 256bit に伸ばす
//   - 復号失敗時は呼出側に投げず、 該当レコードを削除して null を返す (引き継ぎメモ §3)
//   - Drive 側には絶対に置かない (contract コメント §1)
//
// 確定事項:
//   - Q-U-j-1 (C1): SecretStoreDeps を contract から import (v0.2)
//   - Q-U-j-2: deviceSeed キー名は SecretStore 内 private static 定数として閉じる

import type {
  SecretKey,
  SecretOpResult,
  SecretStore,
  SecretStoreDeps,
  SecretStoreInitResult,
} from '@/interfaces/SecretStore'

interface SecretRecord {
  key: SecretKey
  // iv は ArrayBuffer-backed の Uint8Array (SharedArrayBuffer ではない)
  // IndexedDB structured clone は ArrayBuffer 経由で復元するため安全
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
  createdAt: string
  updatedAt: string
}

export class IndexedDbSecretStore implements SecretStore {
  // Q-U-j-2: deviceSeed キー名は private static class 定数として閉じる
  private static readonly DEVICE_SEED_KEY = 'invokeaide.deviceSeed'

  private static readonly DB_NAME = 'invokeaide.secrets'
  private static readonly DB_VERSION = 1
  private static readonly STORE_NAME = 'secrets'

  // PBKDF2 パラメータ (固定 salt + 100k iterations、 SHA-256)
  private static readonly PBKDF2_ITERATIONS = 100_000
  private static readonly PBKDF2_SALT = new TextEncoder().encode('invokeaide.salt.v1')

  // AES-GCM IV 長 (推奨 12 バイト)
  private static readonly AES_GCM_IV_LENGTH = 12

  private db: IDBDatabase | null = null
  private masterKey: CryptoKey | null = null
  private deps: SecretStoreDeps | null = null

  async initialize(deps: SecretStoreDeps): Promise<SecretStoreInitResult> {
    this.deps = deps

    if (!globalThis.crypto?.subtle) {
      return { ok: false, reason: 'unsupported' }
    }
    if (!globalThis.indexedDB) {
      return { ok: false, reason: 'unsupported' }
    }

    try {
      this.db = await this.openDb()
      const { key, firstTime } = await this.deriveOrLoadMasterKey()
      this.masterKey = key
      return { ok: true, firstTime }
    } catch (err) {
      if (this.isQuotaError(err)) {
        return { ok: false, reason: 'storage_quota' }
      }
      this.deps.logger?.error?.('SecretStore.initialize failed', { err: this.serializeError(err) })
      return { ok: false, reason: 'unknown' }
    }
  }

  async putSecret(key: SecretKey, value: string): Promise<SecretOpResult> {
    if (!this.db || !this.masterKey || !this.deps) {
      return { ok: false, reason: 'not_initialized' }
    }

    let iv: Uint8Array<ArrayBuffer>
    let ciphertext: ArrayBuffer
    try {
      const encrypted = await this.encrypt(value)
      iv = encrypted.iv
      ciphertext = encrypted.ciphertext
    } catch (err) {
      this.deps.logger?.error?.('SecretStore.putSecret encrypt failed', { key, err: this.serializeError(err) })
      return { ok: false, reason: 'crypto_error' }
    }

    const now = this.deps.clock.now().toISOString()

    return new Promise<SecretOpResult>((resolve) => {
      const tx = this.db!.transaction(IndexedDbSecretStore.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbSecretStore.STORE_NAME)

      const getReq = store.get(key)
      getReq.onsuccess = () => {
        const existing = getReq.result as SecretRecord | undefined
        const createdAt = existing?.createdAt ?? now
        const record: SecretRecord = { key, iv, ciphertext, createdAt, updatedAt: now }
        const putReq = store.put(record)
        putReq.onsuccess = () => resolve({ ok: true })
        putReq.onerror = () => {
          const err = putReq.error
          if (this.isQuotaError(err)) {
            resolve({ ok: false, reason: 'storage_quota' })
            return
          }
          this.deps?.logger?.error?.('SecretStore.putSecret put failed', { key, err: this.serializeError(err) })
          resolve({ ok: false, reason: 'unknown' })
        }
      }
      getReq.onerror = () => {
        this.deps?.logger?.error?.('SecretStore.putSecret get failed', { key, err: this.serializeError(getReq.error) })
        resolve({ ok: false, reason: 'unknown' })
      }
    })
  }

  async getSecret(key: SecretKey): Promise<string | null> {
    if (!this.db || !this.masterKey) {
      // 未初期化 = 「保存されていない」 と区別不能、 contract は null を返す
      return null
    }

    const record = await this.readRecord(key)
    if (!record) return null

    const plaintext = await this.decrypt(record.iv, record.ciphertext)
    if (plaintext === null) {
      // 復号失敗: 該当レコードを削除して null (引き継ぎメモ §3 「呼出側を巻き込まない」)
      this.deps?.logger?.warn('SecretStore.getSecret decrypt failed, removing corrupt record', { key })
      await this.removeSecret(key)
      return null
    }
    return plaintext
  }

  async removeSecret(key: SecretKey): Promise<SecretOpResult> {
    if (!this.db) {
      return { ok: false, reason: 'not_initialized' }
    }

    return new Promise<SecretOpResult>((resolve) => {
      const tx = this.db!.transaction(IndexedDbSecretStore.STORE_NAME, 'readwrite')
      const store = tx.objectStore(IndexedDbSecretStore.STORE_NAME)
      const req = store.delete(key)
      req.onsuccess = () => resolve({ ok: true })
      req.onerror = () => {
        this.deps?.logger?.warn('SecretStore.removeSecret failed', { key, err: this.serializeError(req.error) })
        resolve({ ok: false, reason: 'unknown' })
      }
    })
  }

  async clearAll(): Promise<SecretOpResult> {
    if (!this.db) {
      return { ok: false, reason: 'not_initialized' }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction(IndexedDbSecretStore.STORE_NAME, 'readwrite')
        const store = tx.objectStore(IndexedDbSecretStore.STORE_NAME)
        const req = store.clear()
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })

      // deviceSeed も消す → 次回起動で firstTime: true 扱いに戻る
      // (OAuth refresh_token も実質失効、 再ログイン UI は呼出側責任)
      try {
        globalThis.localStorage?.removeItem(IndexedDbSecretStore.DEVICE_SEED_KEY)
      } catch (err) {
        this.deps?.logger?.warn('SecretStore.clearAll: localStorage removeItem failed', { err: this.serializeError(err) })
      }
      this.masterKey = null

      return { ok: true }
    } catch (err) {
      this.deps?.logger?.warn('SecretStore.clearAll failed', { err: this.serializeError(err) })
      return { ok: false, reason: 'unknown' }
    }
  }

  async hasMasterKey(): Promise<boolean> {
    try {
      return globalThis.localStorage?.getItem(IndexedDbSecretStore.DEVICE_SEED_KEY) !== null
    } catch {
      // localStorage アクセス失敗 (Private Browsing 等) = master key も使えない扱い
      return false
    }
  }

  // -- 内部ヘルパー: IndexedDB --------------------------------------

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = globalThis.indexedDB.open(
        IndexedDbSecretStore.DB_NAME,
        IndexedDbSecretStore.DB_VERSION,
      )

      // onupgradeneeded は v1 → vN の migration を最初から構造化して書く
      // (引き継ぎメモ §3: 「初期からバージョン管理を組む、 後付けは破壊変更」)
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion
        if (oldVersion < 1) {
          db.createObjectStore(IndexedDbSecretStore.STORE_NAME, { keyPath: 'key' })
        }
        // 将来 v2 で field 追加時:
        //   if (oldVersion < 2) { ... }
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
      req.onblocked = () => reject(new Error('IndexedDB open blocked by other tab'))
    })
  }

  private readRecord(key: SecretKey): Promise<SecretRecord | null> {
    return new Promise<SecretRecord | null>((resolve) => {
      const tx = this.db!.transaction(IndexedDbSecretStore.STORE_NAME, 'readonly')
      const store = tx.objectStore(IndexedDbSecretStore.STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => {
        const record = req.result as SecretRecord | undefined
        resolve(record ?? null)
      }
      req.onerror = () => {
        this.deps?.logger?.warn('SecretStore.readRecord failed', { key, err: this.serializeError(req.error) })
        resolve(null)
      }
    })
  }

  // -- 内部ヘルパー: 端末派生鍵 -------------------------------------

  private async deriveOrLoadMasterKey(): Promise<{ key: CryptoKey; firstTime: boolean }> {
    let seed: string | null = null
    let firstTime = false

    try {
      seed = globalThis.localStorage?.getItem(IndexedDbSecretStore.DEVICE_SEED_KEY) ?? null
    } catch (err) {
      this.deps?.logger?.warn('SecretStore.deriveOrLoadMasterKey: localStorage getItem failed', {
        err: this.serializeError(err),
      })
    }

    if (!seed) {
      seed = globalThis.crypto.randomUUID()
      globalThis.localStorage?.setItem(IndexedDbSecretStore.DEVICE_SEED_KEY, seed)
      firstTime = true
    }

    const baseKey = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(seed),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    )

    const derivedKey = await globalThis.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: IndexedDbSecretStore.PBKDF2_SALT,
        iterations: IndexedDbSecretStore.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )

    return { key: derivedKey, firstTime }
  }

  // -- 内部ヘルパー: 暗号化 / 復号 ----------------------------------

  private async encrypt(plaintext: string): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer }> {
    if (!this.masterKey) throw new Error('masterKey not initialized')
    const iv: Uint8Array<ArrayBuffer> = new Uint8Array(IndexedDbSecretStore.AES_GCM_IV_LENGTH)
    globalThis.crypto.getRandomValues(iv)
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      new TextEncoder().encode(plaintext),
    )
    return { iv, ciphertext }
  }

  private async decrypt(iv: Uint8Array<ArrayBuffer>, ciphertext: ArrayBuffer): Promise<string | null> {
    if (!this.masterKey) return null
    try {
      const plaintext = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.masterKey,
        ciphertext,
      )
      return new TextDecoder().decode(plaintext)
    } catch {
      // 復号失敗 (タグ検証 NG / IV 不正 / 鍵不一致) はすべて null に集約
      return null
    }
  }

  // -- 内部ヘルパー: エラー判定 -------------------------------------

  private isQuotaError(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'QuotaExceededError'
  }

  private serializeError(err: unknown): { name: string; message: string } {
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { name: 'unknown', message: String(err) }
  }
}
