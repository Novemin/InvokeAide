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

  /**
   * メッセージ列を渡して応答を得る(基本会話 + function calling)。
   * request.tools を渡すと、応答が「テキスト」または「ツール呼び出し要求(toolCalls)」のいずれかになる。
   * ツール往復(実行→結果を履歴に積んで再 generate)は呼出側(chat.ts)が回す。
   */
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

// 'tool' は function calling の往復で使う(ツール実行結果を履歴に積むターン)。
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  /** テキスト本文。tool 往復メッセージ(toolCalls / toolResults を持つ)では省略可。 */
  content?: string;
  /**
   * assistant がツール呼び出しを要求したターン(モデルの functionCall)。
   * generate() が返した toolCalls をそのまま履歴に積み直して再 generate() するために使う。
   */
  toolCalls?: ToolCall[];
  /** role:'tool' のターン。アプリがツールを実行した結果(functionResponse 相当)。 */
  toolResults?: ToolResult[];
}

export interface ChatRequest {
  /** 時系列のメッセージ列(system は先頭にまとめて置く想定だが、実装側で集約する) */
  messages: ChatMessage[];
  /** function calling 用のツール定義。省略時は従来どおりツール無しのテキスト会話。 */
  tools?: ToolDeclaration[];
  /** 省略時は実装既定。0.0〜2.0 程度 */
  temperature?: number;
  /** 応答の最大出力トークン(概算) */
  maxOutputTokens?: number;
  /** 中断用(ユーザーが送信を取り消した等) */
  signal?: AbortSignal;
}

export type ChatResult =
  | { ok: true; text: string; finishReason: ChatFinishReason; usage?: ChatUsage }
  // モデルがツール呼び出しを要求した(text はまだ無い)。呼出側が実行→再 generate する。
  | { ok: true; toolCalls: ToolCall[]; usage?: ChatUsage }
  // reason='rate_limit' のとき rateLimitScope で分/日の上限を区別できる(判別不能時は省略)。
  | { ok: false; reason: AIErrorReason; rateLimitScope?: RateLimitScope };

/** 429(rate_limit)の上限種別。分の上限 / 日の上限。判別不能時は呼出側で minute を既定とする。 */
export type RateLimitScope = 'minute' | 'day';

// -- function calling(ツール) --------------------------------

/** モデルが要求したツール呼び出し(Gemini functionCall 相当)。 */
export interface ToolCall {
  /** 呼び出すツール名(ToolDeclaration.name と一致) */
  name: string;
  /** モデルが抽出した引数(functionCall.args)。スキーマ検証は呼出側の責務。 */
  args: Record<string, unknown>;
}

/** ツール実行結果(Gemini functionResponse 相当)。 */
export interface ToolResult {
  /** どのツールの結果か(name 一致でモデルが対応づける) */
  name: string;
  /** functionResponse.response へ入れる任意の JSON(エラー時は { error } 等) */
  response: unknown;
}

/**
 * ツール定義(Gemini functionDeclarations 相当)。
 * parameters は OpenAPI のサブセット(type/properties/description/enum/required/items のみ)。
 */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters?: ToolParameterSchema;
}

export interface ToolParameterSchema {
  type: 'object';
  properties?: Record<string, ToolPropertySchema>;
  required?: string[];
}

export interface ToolPropertySchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolPropertySchema;
}

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
