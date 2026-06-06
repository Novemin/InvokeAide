// AIProvider contract(S2-2、新規起草)
// LLM 抽象。Gemini / Claude / OpenAI を切替可能にする(法的書類 §第三者AI抽象化、CLAUDE.md §5.2)。
// 実装(Sさん 担当): GeminiProvider(本番、BYOK)。将来 ClaudeProvider / OpenAIProvider を追加可能。
//
// 命名: 既存契約(AuthProvider / TTSProvider / StorageProvider / SecretStore)に合わせ I 接頭辞なし。
//
// 前提:
//   - initialize(deps) を呼ぶ前に generate() を呼ぶことは契約違反
//   - dispose() 後の呼び出しは契約違反
//   - APIキーは BYOK。SecretStore('gemini.apiKey')から取得し、無ければ config.fallbackApiKey(開発用)
//
// 事後条件:
//   - generate() は throw せず Promise.resolve で ChatResult を返す
//   - isAvailable() は副作用なし(鍵の有無を検査するのみ)
//   - 「未来縛らない」原則: ErrorReason / FinishReason に 'unknown' を含む

import type { Clock, Logger } from './types';
import type { SecretStore } from './SecretStore';
import type { AiProviderId } from './domain';

export interface AIProvider {
  /** 'gemini' | 'claude' | 'openai' | string(将来拡張) */
  readonly providerId: AiProviderId;

  initialize(deps: AIProviderDeps): Promise<AIInitResult>;

  /** メッセージ列を渡して応答テキストを得る(基本会話) */
  generate(request: ChatRequest): Promise<ChatResult>;

  /** 現環境で使えるか(鍵の有無)の軽量チェック。副作用なし。 */
  isAvailable(): Promise<boolean>;

  dispose(): Promise<void>;
}

export interface AIProviderDeps {
  /** BYOK 鍵の取得元(キー名は 'gemini.apiKey' 等、実装が知る) */
  secretStore: SecretStore;
  clock: Clock;
  logger?: Logger;
  config: AIProviderConfig;
}

export interface AIProviderConfig {
  /** モデル指定。null なら実装の既定(GeminiProvider は gemini-2.5-flash) */
  model?: string | null;
  /**
   * 開発フォールバック鍵(BYOK 未設定時に使う、env 由来)。
   * 本番ユーザーは設定画面から SecretStore に保存するため通常 null。
   */
  fallbackApiKey?: string | null;
}

// -- 会話の入出力 -------------------------------------------

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  /** 時系列のメッセージ列(system は先頭にまとめて置く想定だが、実装側で集約する) */
  messages: ChatMessage[];
  /** 省略時は実装既定。0.0〜2.0 程度 */
  temperature?: number;
  /** 応答の最大出力トークン(概算) */
  maxOutputTokens?: number;
  /** 中断用(ユーザーが送信を取り消した等) */
  signal?: AbortSignal;
}

export type ChatResult =
  | { ok: true; text: string; finishReason: ChatFinishReason; usage?: ChatUsage }
  | { ok: false; reason: AIErrorReason };

export type ChatFinishReason =
  | 'stop' // 正常終了
  | 'length' // 最大トークン到達で打ち切り
  | 'safety' // セーフティでブロック
  | 'unknown';

export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type AIInitResult =
  | { ok: true }
  | { ok: false; reason: 'config_invalid' | 'unknown' };

/**
 * 会話エラー理由列挙。
 * 'unknown' を含めることで「未来縛らない」原則を型に適用。
 */
export type AIErrorReason =
  | 'no_api_key' // BYOK 鍵が未設定(SecretStore にも fallback にも無い)
  | 'auth' // 鍵が無効・権限不足(401 / 403)
  | 'rate_limit' // レート制限(429)
  | 'network' // ネットワーク障害 / fetch 失敗
  | 'safety' // セーフティでブロックされ応答が得られない
  | 'invalid_request' // リクエスト不正(400)
  | 'empty_response' // 応答に本文が無い
  | 'aborted' // signal による中断
  | 'unknown';
