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
import type { AIErrorReason, ChatMessage } from '@/interfaces/AIProvider'

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

  /** メッセージを送信して応答を得る */
  async function send(text: string): Promise<void> {
    const content = text.trim()
    if (!content || sending.value || !current.value) return

    error.value = null
    messages.value.push({ role: 'user', content })
    sending.value = true
    try {
      const { ai } = await getServices()
      const reqMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt.value },
        ...messages.value.map((m) => ({ role: m.role, content: m.content })),
      ]
      const result = await ai.generate({
        messages: reqMessages,
        temperature: 0.8,
        maxOutputTokens: 1024,
      })
      if (result.ok) {
        messages.value.push({ role: 'assistant', content: result.text })
      } else {
        error.value = mapAIError(result.reason)
      }
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
