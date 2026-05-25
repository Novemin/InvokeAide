// Skeleton for IndexedDbSecretStore (案2 配置, 2026-05-26)
// 実装本体は Q-U-j-1 (Sさん 回答待ち) 解決後に着手
// Q-U-j-2 確定済: deviceSeed キー名は 'invokeaide.deviceSeed', SecretStore 内 private const として閉じる

import type { Clock, Logger } from '@/interfaces/types'
import type {
  SecretKey,
  SecretOpResult,
  SecretStore,
  SecretStoreInitResult,
} from '@/interfaces/SecretStore'

export interface SecretStoreDeps {
  clock: Clock
  logger?: Logger
}

export class IndexedDbSecretStore implements SecretStore {
  private readonly deps: SecretStoreDeps

  constructor(deps: SecretStoreDeps) {
    this.deps = deps
  }

  async initialize(): Promise<SecretStoreInitResult> {
    void this.deps
    throw new Error('IndexedDbSecretStore.initialize() not implemented yet')
  }

  async putSecret(_key: SecretKey, _value: string): Promise<SecretOpResult> {
    throw new Error('IndexedDbSecretStore.putSecret() not implemented yet')
  }

  async getSecret(_key: SecretKey): Promise<string | null> {
    throw new Error('IndexedDbSecretStore.getSecret() not implemented yet')
  }

  async removeSecret(_key: SecretKey): Promise<SecretOpResult> {
    throw new Error('IndexedDbSecretStore.removeSecret() not implemented yet')
  }

  async clearAll(): Promise<SecretOpResult> {
    throw new Error('IndexedDbSecretStore.clearAll() not implemented yet')
  }

  async hasMasterKey(): Promise<boolean> {
    throw new Error('IndexedDbSecretStore.hasMasterKey() not implemented yet')
  }
}
