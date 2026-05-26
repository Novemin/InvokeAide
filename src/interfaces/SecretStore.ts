// SecretStore contract(Phase 2 Interface契約 v0.1 §3)
// 端末内の秘密情報保管。 Drive には絶対に置かない。
// 実装(Uさん 担当): IndexedDB + Web Crypto AES-GCM(端末派生鍵、 ベータ v1.0)
//
// 前提:
//   - WebCrypto がサポートされていない環境(古い iOS Safari < 11 等)では
//     initialize() が { ok: false; reason: 'unsupported' } を返す
//   - 暗号鍵は端末固有(localStorage に保存された crypto.randomUUID() ベース)
//     → 端末を変えると復号できなくなる(設計通り、 マルチデバイス時は再認証)
//
// 事後条件:
//   - getSecret() で取得した値はメモリ上では平文だが、 永続化層では暗号化
//   - clearAll() 後に getSecret() は必ず null を返す

import type { Clock, Logger } from './types';

export interface SecretStore {
  initialize(deps: SecretStoreDeps): Promise<SecretStoreInitResult>;
  putSecret(key: SecretKey, value: string): Promise<SecretOpResult>;
  getSecret(key: SecretKey): Promise<string | null>;
  removeSecret(key: SecretKey): Promise<SecretOpResult>;
  clearAll(): Promise<SecretOpResult>;
  /** 端末派生鍵の有無確認(初回起動判定に使う) */
  hasMasterKey(): Promise<boolean>;
}

export type SecretKey =
  | 'oauth.refreshToken'
  | 'oauth.accessToken' // 短命キャッシュ、 永続化は任意
  | 'gemini.apiKey' // BYOK
  | 'voicevox.apiKey' // 将来用、 現状は未使用
  | string; // 「未来縛らない」 原則で拡張余地

export type SecretStoreInitResult =
  | { ok: true; firstTime: boolean } // firstTime=true なら端末派生鍵を新規生成済み
  | { ok: false; reason: 'unsupported' | 'storage_quota' | 'unknown' };

export type SecretOpResult =
  | { ok: true }
  | { ok: false; reason: 'not_initialized' | 'crypto_error' | 'storage_quota' | 'unknown' };

/**
 * SecretStore.initialize() に注入する依存。
 * Clock 抽象遵守(直接 new Date() しない、 テスト容易性のため deps 経由で差し替え可)。
 * 引き継ぎメモ §1 / Q-U-j-1 (C1) で contract 側に追記確定。
 */
export interface SecretStoreDeps {
  clock: Clock;
  logger?: Logger;
}
