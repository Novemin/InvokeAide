// VoicevoxTTSProvider — TTSProvider contract の本実装(skeleton から昇格 2026-06-06 / Uさん)
// 設計: docs/Phase2 系 + contract v0.2、 GO「VoicevoxTTSProvider 本実装」(2026-06-06)
//
// 役割: VOICEVOX エンジン(既定 http://localhost:50021、 本番は Cloud Run/WIF endpoint)へ
//       audio_query → synthesis の2段リクエストで音声(WAV)を合成し ArrayBuffer で返す。
//       再生は呼出側責任(capabilities.synthesizeAndPlay=false、 C6 / Q-U-j-13)。
//
// 確定方針(契約・Q&A 由来):
//   - C5 (Q-U-j-10): speakerId 未指定時は TTSErrorReason='speaker_required' を返す(呼出側責任)。
//       GO の「話者IDはユーザー設定から取得(デフォルト0)」は呼出側(ChatService/B3)の責務であり、
//       Provider 自身は設定を持たず、 明示 speakerId を要求する。
//   - C6 (Q-U-j-13): readonly capabilities = { synthesize: true, synthesizeAndPlay: false }
//   - Q-U-j-11: Provider 内ではリトライしない。 タイムアウトは requestTimeoutMs(既定120秒=初回値)。
//       「初回120秒/2回目以降30秒」の attempt 別切替は B3 UI 側(リトライ判断もB3)。
//   - synthesize() は throw せず TTSResult を返す(contract 事後条件)。
//   - dispose() 後の synthesize/isAvailable は契約違反だが throw せず not_available を返す。
//
// 実装上の判断(要レビュー、 報告書に記載):
//   - 既存 VoicevoxConfig の endpoint/authToken を任意化(型の拡張=非破壊)。 endpoint 既定で
//     localhost:50021、 authToken は存在時のみ Authorization: Bearer を送出(localhost は不要)。
//   - durationMs は合成 WAV のヘッダ(byteRate × dataSize)から算出。 解析失敗時は 0(合成自体は成功扱い)。

import type { Clock, Logger } from '@/interfaces/types'
import type {
  TTSCapabilities,
  TTSErrorReason,
  TTSOptions,
  TTSProvider,
  TTSResult,
} from '@/interfaces/TTSProvider'

export interface VoicevoxConfig {
  /**
   * VOICEVOX エンジンのベースURL。 既定 'http://localhost:50021'(ローカルエンジン)。
   * 本番は Cloud Run / docker-compose の endpoint(例: 'https://voicevox-engine-xxx.a.run.app')。
   */
  endpoint?: string
  /**
   * Cloud Run / WIF 経由時の Bearer トークン(WIF 手順書 §8、 `openssl rand -hex 32` 生成)。
   * 指定時のみ Authorization: Bearer ヘッダを付与。 localhost 直結では不要。
   */
  authToken?: string
  /**
   * 1リクエストのタイムアウト(ms)。 既定 120_000(Q-U-j-11 初回値)。
   * Provider は内部リトライしないため、 attempt 別(120s/30s)切替は呼出側(B3)が config で渡す。
   */
  requestTimeoutMs?: number
}

export interface VoicevoxDeps {
  clock: Clock
  logger?: Logger
}

// VOICEVOX /audio_query が返すクエリ(必要分のみ。 残りは透過保持して /synthesis に渡す)
interface AudioQuery {
  speedScale: number
  pitchScale: number
  intonationScale: number
  volumeScale: number
  [key: string]: unknown
}

// HTTP 呼び出しの失敗種別を内部で運ぶ型付きエラー(GoogleAuthProvider と同様の方針)
class VoicevoxHttpError extends Error {
  readonly reason: TTSErrorReason
  readonly status?: number
  constructor(reason: TTSErrorReason, status?: number) {
    super(`VoicevoxHttpError:${reason}${status != null ? `:${status}` : ''}`)
    this.reason = reason
    this.status = status
  }
}

export class VoicevoxTTSProvider implements TTSProvider {
  readonly providerId = 'voicevox'
  readonly capabilities: TTSCapabilities = { synthesize: true, synthesizeAndPlay: false }

  private static readonly DEFAULT_ENDPOINT = 'http://localhost:50021'
  private static readonly DEFAULT_TIMEOUT_MS = 120_000
  // VOICEVOX エンジンは WAV のみ出力(OSS エンジン仕様)
  private static readonly OUTPUT_MIME = 'audio/wav'

  private readonly endpoint: string
  private readonly authToken?: string
  private readonly timeoutMs: number
  private readonly deps: VoicevoxDeps
  private disposed = false

  constructor(config: VoicevoxConfig, deps: VoicevoxDeps) {
    this.endpoint = this.normalizeEndpoint(config.endpoint ?? VoicevoxTTSProvider.DEFAULT_ENDPOINT)
    this.authToken = config.authToken
    this.timeoutMs = config.requestTimeoutMs ?? VoicevoxTTSProvider.DEFAULT_TIMEOUT_MS
    this.deps = deps
  }

  // -- 合成 ---------------------------------------------------

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (this.disposed) {
      // dispose 後の操作は契約違反だが throw せず明示(contract: synthesize は throw しない)
      return { ok: false, reason: 'not_available' }
    }

    // 入力検証: 空テキストは合成しない(invalid_text)
    if (!text || text.trim().length === 0) {
      return { ok: false, reason: 'invalid_text' }
    }
    // C5 (Q-U-j-10): speakerId 未指定は呼出側責任を明示(ChatService/B3 が必ず渡す pattern を強制)
    if (options.speakerId == null) {
      return { ok: false, reason: 'speaker_required' }
    }

    try {
      const query = await this.requestAudioQuery(text, options.speakerId)
      this.applyOptionsToQuery(query, options)
      const audioBuffer = await this.requestSynthesis(query, options.speakerId)
      const durationMs = this.estimateDurationMs(audioBuffer)
      return {
        ok: true,
        audioBuffer,
        mimeType: VoicevoxTTSProvider.OUTPUT_MIME,
        durationMs,
      }
    } catch (err) {
      if (err instanceof VoicevoxHttpError) {
        return { ok: false, reason: err.reason }
      }
      this.deps.logger?.error?.('VoicevoxTTSProvider.synthesize failed', {
        err: this.serializeError(err),
      })
      return { ok: false, reason: 'unknown' }
    }
  }

  // -- 可用性チェック(副作用なし、 throw しない) --------------

  async isAvailable(): Promise<boolean> {
    if (this.disposed) {
      return false
    }
    try {
      const res = await this.fetchWithTimeout(`${this.endpoint}/version`, { method: 'GET' })
      return res.ok
    } catch {
      // ネットワーク不達 / エンジン未起動 / タイムアウト等はすべて「使えない」
      return false
    }
  }

  // -- 破棄(冪等、 throw しない) ------------------------------

  async dispose(): Promise<void> {
    // fetch ベースで永続リソースを保持しないため、 フラグを倒すのみ。
    this.disposed = true
  }

  // -- 内部: VOICEVOX エンドポイント呼び出し ------------------

  private async requestAudioQuery(text: string, speakerId: number): Promise<AudioQuery> {
    const url = `${this.endpoint}/audio_query?${new URLSearchParams({
      text,
      speaker: String(speakerId),
    }).toString()}`
    const res = await this.fetchOrThrow(url, { method: 'POST' })
    return (await res.json()) as AudioQuery
  }

  private async requestSynthesis(query: AudioQuery, speakerId: number): Promise<ArrayBuffer> {
    const url = `${this.endpoint}/synthesis?${new URLSearchParams({
      speaker: String(speakerId),
    }).toString()}`
    const res = await this.fetchOrThrow(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    })
    return res.arrayBuffer()
  }

  /**
   * options で指定された合成パラメータのみ audio_query に上書き反映する。
   * 未指定の項目は VOICEVOX 既定値(audio_query が返した値)を温存する。
   */
  private applyOptionsToQuery(query: AudioQuery, options: TTSOptions): void {
    if (options.speedScale != null) {
      query.speedScale = options.speedScale
    }
    if (options.pitchScale != null) {
      query.pitchScale = options.pitchScale
    }
    if (options.intonationScale != null) {
      query.intonationScale = options.intonationScale
    }
    if (options.volumeScale != null) {
      query.volumeScale = options.volumeScale
    }
  }

  // -- 内部: fetch + タイムアウト + エラー写像 ----------------

  /** fetch + ステータス判定。 失敗は VoicevoxHttpError(reason 付き)で throw。 */
  private async fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
    let res: Response
    try {
      res = await this.fetchWithTimeout(url, init)
    } catch {
      // AbortError(タイムアウト)/ fetch 失敗(オフライン・エンジン未起動)はネットワーク扱い
      throw new VoicevoxHttpError('network')
    }
    if (!res.ok) {
      throw new VoicevoxHttpError(this.mapStatusToReason(res.status), res.status)
    }
    return res
  }

  /** AbortController でタイムアウトを課した fetch。 Authorization は authToken 指定時のみ付与。 */
  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = globalThis.setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const headers = new Headers(init.headers)
      if (this.authToken) {
        headers.set('Authorization', `Bearer ${this.authToken}`)
      }
      return await fetch(url, { ...init, headers, signal: controller.signal })
    } finally {
      globalThis.clearTimeout(timer)
    }
  }

  private mapStatusToReason(status: number): TTSErrorReason {
    // 422/404: VOICEVOX は不正な speaker 等で 422 を返す(存在しない話者 → unsupported_speaker)
    if (status === 422 || status === 404) {
      return 'unsupported_speaker'
    }
    if (status === 429) {
      return 'rate_limit'
    }
    if (status === 401 || status === 403) {
      return 'auth'
    }
    return 'unknown'
  }

  // -- 内部: ユーティリティ -----------------------------------

  private normalizeEndpoint(endpoint: string): string {
    return endpoint.replace(/\/+$/, '')
  }

  /**
   * 合成 WAV のヘッダから再生時間(ms)を算出。 fmt の byteRate と data チャンクサイズを用いる。
   * 解析できない場合は 0 を返す(合成自体は成功として扱い、 duration 不明を 0 で表現)。
   */
  private estimateDurationMs(buffer: ArrayBuffer): number {
    try {
      const view = new DataView(buffer)
      if (buffer.byteLength < 12 || view.getUint32(0, false) !== 0x52494646 /* 'RIFF' */) {
        return 0
      }
      let offset = 12
      let byteRate = 0
      let dataSize = 0
      while (offset + 8 <= buffer.byteLength) {
        const chunkId = view.getUint32(offset, false)
        const chunkSize = view.getUint32(offset + 4, true)
        if (chunkId === 0x666d7420 /* 'fmt ' */) {
          // fmt: audioFormat(2) numChannels(2) sampleRate(4) byteRate(4) ...
          byteRate = view.getUint32(offset + 8 + 8, true)
        } else if (chunkId === 0x64617461 /* 'data' */) {
          dataSize = chunkSize
          break
        }
        // チャンクは偶数境界にパディングされ得る
        offset += 8 + chunkSize + (chunkSize % 2)
      }
      if (byteRate <= 0 || dataSize <= 0) {
        return 0
      }
      return Math.round((dataSize / byteRate) * 1000)
    } catch {
      return 0
    }
  }

  private serializeError(err: unknown): { name: string; message: string } {
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { name: 'unknown', message: String(err) }
  }
}
