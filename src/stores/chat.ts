// chat ストア(S2-3) — Pinia
// 召喚したキャラクターとの基本テキスト会話を管理する。
//
// 方針(S2-3「シンプルで動けばよい」):
//   - キャラは bundled registry(BUNDLED_CHARACTERS、3体)から。Drive 接続に依存しない。
//   - system prompt は各キャラの bundled MD(persona)。無ければ最小プロンプトにフォール。
//   - 会話履歴を AIProvider.generate() に渡して応答を得る。履歴はメモリ上のみ(Drive 保存は S2-5)。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getServices } from '@/app/composition'
import { BUNDLED_CHARACTERS } from '@/assets/characters'
import { getBundledCharacterMd } from '@/assets/characters/registry'
import type { CharacterEntry } from '@/interfaces/domain'
import type {
  AIErrorReason,
  ChatMessage,
  ToolCall,
  ToolDeclaration,
  ToolResult,
} from '@/interfaces/AIProvider'
import type {
  GetTasksErrorReason,
  TasksScope,
  TasksService,
} from '@/services/tasksService'

export interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
}

/** AIErrorReason を会話画面向けの日本語に */
function mapAIError(reason: AIErrorReason): string {
  switch (reason) {
    case 'no_api_key':
      return 'Gemini API キーが未設定です。設定画面で入力してください。'
    case 'auth':
      return 'API キーが無効です。設定画面で再設定してください。'
    case 'rate_limit':
      return '混み合っています。少し待って再度お試しください。'
    case 'network':
      return 'ネットワークエラーが発生しました。'
    case 'safety':
      return '安全性の都合で応答できませんでした。表現を変えてお試しください。'
    case 'invalid_request':
      return 'リクエストが不正でした。'
    case 'empty_response':
      return '応答が空でした。もう一度お試しください。'
    case 'aborted':
      return '送信を取り消しました。'
    default:
      return '応答の取得に失敗しました。'
  }
}

// -- function calling: ツール定義 ---------------------------------

// ツール往復の上限(無限ループ防止)。1 ラウンド = generate→tool 実行→再 generate。
const MAX_TOOL_ROUNDS = 4

// 登録ツールは getTasks(読み取り)1本のみ(S2-4①)。
// 破壊系(追加・編集・削除)は今回登録しない。
const TOOLS: ToolDeclaration[] = [
  {
    name: 'getTasks',
    description:
      'ユーザーの Google ToDo リストから未完了タスクを取得する。' +
      '「今日のタスクは?」「あと何件残ってる?」などタスクの予定や残件数を聞かれたら呼ぶ。',
    parameters: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['today', 'all'],
          description:
            "取得範囲。期限が今日のものは 'today'、未完了すべては 'all'。既定は 'today'。",
        },
      },
      required: [],
    },
  },
]

/** Tasks 取得失敗の reason を、モデルがユーザーへ伝えられる日本語メッセージへ出し分ける。 */
function mapTasksError(reason: GetTasksErrorReason): string {
  switch (reason) {
    case 'no_refresh_token':
      return 'Google アカウントに未接続です。設定画面から接続してください。'
    case 'refresh_failed':
      return 'Google の認証が切れました。設定画面から再接続してください。'
    case 'auth':
      return 'Google タスクへのアクセス権限がありません。設定画面で接続し直してください。'
    case 'network':
      return 'ネットワークエラーでタスクを取得できませんでした。'
    default:
      return 'タスクの取得に失敗しました。'
  }
}

/** モデルのツール呼び出しを実行し、functionResponse として返す内容を組み立てる。 */
async function runTool(tc: ToolCall, tasks: TasksService): Promise<ToolResult> {
  if (tc.name === 'getTasks') {
    const scope: TasksScope = tc.args.scope === 'all' ? 'all' : 'today'
    const r = await tasks.getTasks(scope)
    if (r.ok) {
      return {
        name: 'getTasks',
        response: { scope: r.scope, remaining: r.remaining, tasks: r.tasks },
      }
    }
    // 失敗は { error } としてモデルに返す(モデルがこの文言をユーザーへ伝える)。
    return { name: 'getTasks', response: { error: mapTasksError(r.reason) } }
  }
  return { name: tc.name, response: { error: `未対応のツールです: ${tc.name}` } }
}

export const useChatStore = defineStore('chat', () => {
  /** 選択可能なキャラ(bundled) */
  const characters = ref<CharacterEntry[]>(BUNDLED_CHARACTERS)
  /** 召喚中のキャラ(null = 未召喚) */
  const current = ref<CharacterEntry | null>(null)
  /** 召喚中キャラの system prompt(persona MD) */
  const systemPrompt = ref<string>('')
  /** 画面表示用の会話履歴(system は含めない) */
  const messages = ref<DisplayMessage[]>([])
  /** 応答待ちフラグ */
  const sending = ref(false)
  /** 直近のエラー */
  const error = ref<string | null>(null)

  /** キャラを召喚する(会話をリセットして persona を設定) */
  function summon(character: CharacterEntry): void {
    current.value = character
    systemPrompt.value =
      getBundledCharacterMd(character.id) ?? `あなたは「${character.displayName}」です。`
    messages.value = []
    error.value = null
  }

  /** 召喚を解除する(別キャラ選択へ戻る) */
  function dismiss(): void {
    current.value = null
    systemPrompt.value = ''
    messages.value = []
    error.value = null
  }

  /**
   * メッセージを送信して応答を得る。
   * function calling 対応: モデルがツールを要求したら実行→結果を履歴に積んで再生成し、
   * 最終テキストが返るまで往復する(MAX_TOOL_ROUNDS で打ち切り)。
   */
  async function send(text: string): Promise<void> {
    const content = text.trim()
    if (!content || sending.value || !current.value) return

    error.value = null
    messages.value.push({ role: 'user', content })
    sending.value = true
    try {
      const { ai, tasks } = await getServices()
      // convo は generate に渡す作業用履歴。tool 往復ぶん(functionCall / functionResponse)を
      // ここに追記していく。画面表示用の messages には tool 往復は積まない(最終テキストのみ)。
      const convo: ChatMessage[] = [
        { role: 'system', content: systemPrompt.value },
        ...messages.value.map((m) => ({ role: m.role, content: m.content })),
      ]

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const result = await ai.generate({
          messages: convo,
          tools: TOOLS,
          temperature: 0.8,
          maxOutputTokens: 1024,
        })
        if (!result.ok) {
          error.value = mapAIError(result.reason)
          return
        }
        // モデルがツール呼び出しを要求 → 実行して結果を履歴に積み、再生成へ。
        if ('toolCalls' in result) {
          convo.push({ role: 'assistant', toolCalls: result.toolCalls })
          const toolResults = await Promise.all(
            result.toolCalls.map((tc) => runTool(tc, tasks)),
          )
          convo.push({ role: 'tool', toolResults })
          continue
        }
        // 最終テキスト応答。
        messages.value.push({ role: 'assistant', content: result.text })
        return
      }
      // ツール往復が上限を超えた(設計上は到達しない想定の保険)。
      error.value = '応答の取得に失敗しました（ツール呼び出しが完了しませんでした）。'
    } finally {
      sending.value = false
    }
  }

  return {
    characters,
    current,
    systemPrompt,
    messages,
    sending,
    error,
    summon,
    dismiss,
    send,
  }
})
