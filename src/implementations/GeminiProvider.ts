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
  ChatMessage,
  ChatRequest,
  ChatResult,
  ChatUsage,
  RateLimitScope,
  ToolCall,
} from '@/interfaces/AIProvider'

// Gemini generateContent レスポンス(必要分のみ)
interface GeminiFunctionCall {
  name?: string
  args?: Record<string, unknown>
}
interface GeminiPart {
  text?: string
  functionCall?: GeminiFunctionCall
}

// Gemini リクエストの parts(text / functionCall / functionResponse のいずれか)
type GeminiReqPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } }
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
  // 一時的サーバーエラー時の自動リトライ上限(初回 + 最大2回 = 計3回試行)。
  private static readonly MAX_RETRIES = 2
  // バックオフ基準: attempt 0 → 500ms, 1 → 1000ms(指数)。これに jitter を足す。
  private static readonly BACKOFF_BASE_MS = 500
  private static readonly BACKOFF_JITTER_MS = 250

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

    // 一時的サーバーエラー(503 等)は短い指数バックオフで自動再送する(最大 MAX_RETRIES 回)。
    // 恒久エラー(4xx)・abort は即返す。function calling の往復でも各 generate に効く。
    for (let attempt = 0; attempt <= GeminiProvider.MAX_RETRIES; attempt++) {
      if (request.signal?.aborted) {
        return { ok: false, reason: 'aborted' }
      }

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
        // 一時的サーバーエラー(5xx)かつリトライ余地があれば待機して再送。
        // 429 はリトライ対象外(BYOK 無料枠を食い潰さないため。分の上限は数秒では空かない)。
        if (this.isTransientStatus(res.status) && attempt < GeminiProvider.MAX_RETRIES) {
          this.deps.logger?.warn('GeminiProvider.generate: transient error, retrying', {
            status: res.status,
            attempt: attempt + 1,
          })
          await this.backoffDelay(attempt, request.signal)
          continue
        }
        // 429 は本文から上限種別(分/日)を判定して返す(リトライしない)。
        if (res.status === 429) {
          const rateLimitScope = await this.classifyRateLimitScope(res)
          return { ok: false, reason: 'rate_limit', rateLimitScope }
        }
        // 恒久エラー、またはリトライ上限超過(5xx)→ 従来どおりのエラーへフォールバック。
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

    // ループは上限で必ず return 済み(到達しない保険)。
    return { ok: false, reason: 'unknown' }
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
    const contents: Array<{ role: 'user' | 'model'; parts: GeminiReqPart[] }> = []

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        if (msg.content) systemTexts.push(msg.content)
        continue
      }
      const parts = this.toGeminiParts(msg)
      if (parts.length === 0) continue
      // 'assistant' は Gemini では 'model'。tool 結果ターンは user ロールで返す(公式仕様)。
      const role = msg.role === 'assistant' ? 'model' : 'user'
      contents.push({ role, parts })
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
    // function calling: ツール定義はそのまま functionDeclarations に渡す(契約型 = Gemini サブセット)。
    // toolConfig は省略 = AUTO(モデルが呼ぶか自然応答かを判断)。
    if (request.tools && request.tools.length > 0) {
      body.tools = [{ functionDeclarations: request.tools }]
    }
    return body
  }

  /**
   * 1 メッセージを Gemini の parts[] へ変換する。
   *   - toolResults を持つ(role:'tool') → functionResponse part 群
   *   - toolCalls を持つ(assistant) → functionCall part 群
   *   - それ以外 → text part(本文があれば)
   */
  private toGeminiParts(msg: ChatMessage): GeminiReqPart[] {
    if (msg.toolResults && msg.toolResults.length > 0) {
      return msg.toolResults.map((tr) => ({
        functionResponse: { name: tr.name, response: tr.response },
      }))
    }
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      return msg.toolCalls.map((tc) => ({
        functionCall: { name: tc.name, args: tc.args ?? {} },
      }))
    }
    return msg.content ? [{ text: msg.content }] : []
  }

  private parseResponse(json: GeminiResponse): ChatResult {
    // プロンプト段階でブロックされたケース
    if (json.promptFeedback?.blockReason) {
      return { ok: false, reason: 'safety' }
    }

    const candidate = json.candidates?.[0]
    const finishReason = this.mapFinishReason(candidate?.finishReason)
    const parts = candidate?.content?.parts ?? []

    // function calling: モデルがツール呼び出しを要求した場合は text より優先して返す。
    // 呼出側(chat.ts)が実行→結果を履歴に積んで再 generate する。
    const toolCalls: ToolCall[] = parts
      .map((p) => p.functionCall)
      .filter((fc): fc is GeminiFunctionCall => !!fc && typeof fc.name === 'string')
      .map((fc) => ({ name: fc.name as string, args: fc.args ?? {} }))
    if (toolCalls.length > 0) {
      const usage = this.mapUsage(json.usageMetadata)
      return usage ? { ok: true, toolCalls, usage } : { ok: true, toolCalls }
    }

    const text = parts
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
    // 5xx は「通信が一時的に不調」カテゴリに寄せる(リトライ尽き後もここへ)。
    if (status >= 500) return 'network'
    return 'unknown'
  }

  private isAbortError(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError'
  }

  /**
   * 一時的(リトライ可能)なサーバーエラーか。
   * 429 は含めない(BYOK 無料枠を食い潰さないため。日/分の上限は数秒では空かない)。
   * 4xx 恒久エラーも含めない。
   */
  private isTransientStatus(status: number): boolean {
    return (
      status === 500 ||
      status === 502 ||
      status === 503 || // Service Unavailable(本件の主対象)
      status === 504
    )
  }

  /**
   * 429 の上限種別(分/日)を本文から判定する。
   * 無料枠の 429 本文 error.details[].QuotaFailure.violations[].quotaId 等に
   * 'PerDay' / 'PerMinute' を含む文字列が現れる。日を分と誤認しないよう PerDay を優先。
   * 判定材料が無い場合は暫定で 'minute' 扱い(フォールバック)。
   */
  private async classifyRateLimitScope(res: Response): Promise<RateLimitScope> {
    let text = ''
    try {
      text = await res.text()
    } catch {
      return 'minute'
    }
    if (/PerDay/i.test(text)) return 'day'
    if (/PerMinute/i.test(text)) return 'minute'
    return 'minute'
  }

  /**
   * 指数バックオフ + jitter で待機する。
   * abort された場合は待たずに解決する(直後の aborted チェックで抜ける)。
   */
  private backoffDelay(attempt: number, signal?: AbortSignal): Promise<void> {
    const base = GeminiProvider.BACKOFF_BASE_MS * Math.pow(2, attempt)
    const jitter = Math.floor(Math.random() * GeminiProvider.BACKOFF_JITTER_MS)
    const ms = base + jitter
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms)
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
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
