// src/implementations/index.ts
// 2026-05-26 (contract v0.2 適用後):
//   - IndexedDbSecretStore: 本実装完了 (Q-U-j-1/2 解消)
//   - GoogleAuthProvider / DriveStorageProvider / VoicevoxTTSProvider: skeleton (依存順で順次本実装)
//   - WebSpeechTTSProvider: ベータでは未実装、 v1.1 以降 (Q-U-j-13 案 Z 確定)

export { IndexedDbSecretStore } from './IndexedDbSecretStore'
// SecretStoreDeps は contract v0.2 で @/interfaces/SecretStore に移管 (C1)

export { GoogleAuthProvider } from './GoogleAuthProvider'

export { DriveStorageProvider } from './DriveStorageProvider'

export { VoicevoxTTSProvider } from './VoicevoxTTSProvider'
export type { VoicevoxConfig, VoicevoxDeps } from './VoicevoxTTSProvider'
