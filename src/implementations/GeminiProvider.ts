// GeminiProvider — AIProvider contract の本番実装(S2-2)
//
// 役割: Google Generative Language API(Gemini)で基本テキスト会話を行う。
//   - BYOK: APIキーは SecretStore('gemini.apiKey')から取得。無ければ config.fallbackApiKey(開発用 env)。
//   - 既定モデル: gemini-2.5-flash(config.model で上書き可)。
//   - generate() は throw せず ChatResult を返す(契約 §事後条件)。
//
// 確定方針:
//   - キーは毎 generate() 時に取得する(設定画面で保存直後にも即反映、キャッシュしない)。
//   - キーはログに出さない。auth ヘッダ(x-goog-api-key)で送り、URL クエリには載せない。
//   - 第三者AIサービス抽象化(法的書類 §、CLAUDE.md §5.2)の最初の実装。

import type { AiProviderId } from '@/interfaces/domain'
import type {
  AIErrorReason,
  AIInitResult,
  AIProvider,
  AIProviderDeps,
  ChatFinishReason,
  ChatRequest,
  ChatResult,
  ChatUsage,
} from '@/interfaces/AIProvider'

// Gemini generateContent レスポンス(必要分のみ)
interface GeminiPart {
  text?: string
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[]; role?: string }
  finishReason?: string
}
interface GeminiUsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}
interface GeminiResponse {
  candidates?: GeminiCandidate[]
  usageMetadata?: GeminiUsageMetadata
  promptFeedback?: { blockReason?: string }
}

export class GeminiProvider implements AIProvider {
  readonly providerId: AiProviderId = 'gemini'

  private static readonly API_BASE =
    'https://generativelanguage.googleapis.com/v1beta/models'
  private static readonly DEFAULT_MODEL = 'gemini-2.5-flash'
  private static readonly SECRET_KEY = 'gemini.apiKey'

  private deps: AIProviderDeps | null = null
  private disposed = false

  async initialize(deps: AIProviderDeps): Promise<AIInitResult> {
    this.deps = deps
    // config 自体は任意項目のみ。model が空文字なら不正扱い(null/未指定は既定にフォール)
    if (deps.config.model === '') {
      return { ok: false, reason: 'config_invalid' }
    }
    return { ok: true }
  }

  async generate(request: ChatRequest): Promise<ChatResult> {
    if (!this.deps || this.disposed) {
      return { ok: false, reason: 'unknown' }
    }
    if (!request.messages || request.messages.length === 0) {
      return { ok: false, reason: 'invalid_request' }
    }
    if (request.signal?.aborted) {
      return { ok: false, reason: 'aborted' }
    }

    const apiKey = await this.resolveApiKey()
    if (!apiKey) {
      return { ok: false, reason: 'no_api_key' }
    }

    const body = this.buildRequestBody(request)
    const model = this.deps.config.model || GeminiProvider.DEFAULT_MODEL
    const url = `${GeminiProvider.API_BASE}/${encodeURIComponent(model)}:generateContent`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: request.signal,
      })
    } catch (err) {
      if (this.isAbortError(err)) {
        return { ok: false, reason: 'aborted' }
      }
      // fetch 自体の失敗(オフライン / DNS 等)
      return { ok: false, reason: 'network' }
    }

    if (!res.ok) {
      return { ok: false, reason: this.mapHttpStatus(res.status) }
    }

    let json: GeminiResponse
    try {
      json = (await res.json()) as GeminiResponse
    } catch (err) {
      this.deps.logger?.error?.('GeminiProvider.generate: JSON parse failed', {
        err: this.serializeError(err),
      })
      return { ok: false, reason: 'unknown' }
    }

    return this.parseResponse(json)
  }

  async isAvailable(): Promise<boolean> {
    if (!this.deps || this.disposed) {
      return false
    }
    return (await this.resolveApiKey()) !== null
  }

  async dispose(): Promise<void> {
    this.disposed = true
    this.deps = null
  }

  // -- 内部ヘルパー -------------------------------------------

  /** SecretStore の BYOK 鍵 → fallback(env)→ null の順で解決する */
  private async resolveApiKey(): Promise<string | null> {
    const deps = this.deps
    if (!deps) return null
    let stored: string | null = null
    try {
      stored = await deps.secretStore.getSecret(GeminiProvider.SECRET_KEY)
    } catch (err) {
      deps.logger?.warn('GeminiProvider.resolveApiKey: getSecret failed', {
        err: this.serializeError(err),
      })
    }
    const key = (stored ?? deps.config.fallbackApiKey ?? '').trim()
    return key.length > 0 ? key : null
  }

  /** ChatMessage[] を Gemini の systemInstruction + contents に変換する */
  private buildRequestBody(request: ChatRequest): Record<string, unknown> {
    const systemTexts: string[] = []
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        if (msg.content) systemTexts.push(msg.content)
        continue
      }
      // 'assistant' は Gemini では 'model'
      const role = msg.role === 'assistant' ? 'model' : 'user'
      contents.push({ role, parts: [{ text: msg.content }] })
    }

    const generationConfig: Record<string, number> = {}
    if (typeof request.temperature === 'number') {
      generationConfig.temperature = request.temperature
    }
    if (typeof request.maxOutputTokens === 'number') {
      generationConfig.maxOutputTokens = request.maxOutputTokens
    }

    const body: Record<string, unknown> = { contents }
    if (systemTexts.length > 0) {
      body.systemInstruction = { parts: [{ text: systemTexts.join('\n\n') }] }
    }
    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig
    }
    return body
  }

  private parseResponse(json: GeminiResponse): ChatResult {
    // プロンプト段階でブロックされたケース
    if (json.promptFeedback?.blockReason) {
      return { ok: false, reason: 'safety' }
    }

    const candidate = json.candidates?.[0]
    const finishReason = this.mapFinishReason(candidate?.finishReason)

    const text = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!text) {
      // 本文が無い: safety 由来なら safety、それ以外は empty_response
      if (finishReason === 'safety') {
        return { ok: false, reason: 'safety' }
      }
      return { ok: false, reason: 'empty_response' }
    }

    const usage = this.mapUsage(json.usageMetadata)
    return usage
      ? { ok: true, text, finishReason, usage }
      : { ok: true, text, finishReason }
  }

  private mapFinishReason(reason: string | undefined): ChatFinishReason {
    switch (reason) {
      case 'STOP':
        return 'stop'
      case 'MAX_TOKENS':
        return 'length'
      case 'SAFETY':
      case 'BLOCKLIST':
      case 'PROHIBITED_CONTENT':
        return 'safety'
      default:
        return reason ? 'unknown' : 'stop'
    }
  }

  private mapUsage(meta: GeminiUsageMetadata | undefined): ChatUsage | undefined {
    if (!meta) return undefined
    return {
      promptTokens: meta.promptTokenCount,
      completionTokens: meta.candidatesTokenCount,
      totalTokens: meta.totalTokenCount,
    }
  }

  private mapHttpStatus(status: number): AIErrorReason {
    if (status === 400) return 'invalid_request'
    if (status === 401 || status === 403) return 'auth'
    if (status === 429) return 'rate_limit'
    return 'unknown'
  }

  private isAbortError(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError'
  }

  private serializeError(err: unknown): { name: string; message: string } {
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { name: 'unknown', message: String(err) }
  }
}
