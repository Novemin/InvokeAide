// src/implementations/index.ts
// 案2 (2026-05-26): スケルトン配置のみ。 実装本体は Q-U-j 解消後に順次着手。
// WebSpeechTTSProvider は B2 contract 引き継ぎメモ §6.2 案 X/Y/Z 確定後に追加。

export { IndexedDbSecretStore } from './IndexedDbSecretStore'
export type { SecretStoreDeps } from './IndexedDbSecretStore'

export { GoogleAuthProvider } from './GoogleAuthProvider'

export { DriveStorageProvider } from './DriveStorageProvider'

export { VoicevoxTTSProvider } from './VoicevoxTTSProvider'
export type { VoicevoxConfig, VoicevoxDeps } from './VoicevoxTTSProvider'
