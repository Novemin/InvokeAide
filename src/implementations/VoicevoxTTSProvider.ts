// Skeleton for VoicevoxTTSProvider (案2 配置, 2026-05-26 / contract v0.2 適用後)
// 実装本体は Q-U-j-10, Q-U-j-12 (Sさん 回答済、 contract v0.2 反映済) + Cloud Run デプロイ完了後に着手
// Q-U-j-11 確定済: VoicevoxTTSProvider 内ではリトライしない、初回タイムアウト 120秒 / 2回目以降 30秒、
//                  リトライ判断は B3 UI 側
// C5 (Q-U-j-10): speakerId 未指定時は TTSErrorReason='speaker_required' を返す (呼出側責任)
// C6 (Q-U-j-13): readonly capabilities = { synthesize: true, synthesizeAndPlay: false }

import type { Clock, Logger } from '@/interfaces/types'
import type {
  TTSCapabilities,
  TTSOptions,
  TTSProvider,
  TTSResult,
} from '@/interfaces/TTSProvider'

export interface VoicevoxConfig {
  /** 例: 'https://voicevox-engine-xxx.a.run.app' or 'http://localhost:8080' (docker-compose) */
  endpoint: string
  /** WIF 手順書 §8 で `openssl rand -hex 32` で生成された token */
  authToken: string
}

export interface VoicevoxDeps {
  clock: Clock
  logger?: Logger
}

export class VoicevoxTTSProvider implements TTSProvider {
  readonly providerId = 'voicevox'
  readonly capabilities: TTSCapabilities = { synthesize: true, synthesizeAndPlay: false }

  private readonly config: VoicevoxConfig
  private readonly deps: VoicevoxDeps

  constructor(config: VoicevoxConfig, deps: VoicevoxDeps) {
    this.config = config
    this.deps = deps
  }

  async synthesize(_text: string, _options: TTSOptions): Promise<TTSResult> {
    void this.config
    void this.deps
    throw new Error('VoicevoxTTSProvider.synthesize() not implemented yet')
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('VoicevoxTTSProvider.isAvailable() not implemented yet')
  }

  async dispose(): Promise<void> {
    throw new Error('VoicevoxTTSProvider.dispose() not implemented yet')
  }
}
