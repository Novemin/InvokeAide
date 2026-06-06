<script setup lang="ts">
// 対話UI(S2-3): チャット形式の会話画面(送信/受信)
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'

const router = useRouter()
const chat = useChatStore()

const input = ref('')
const listEl = ref<HTMLElement | null>(null)

onMounted(() => {
  // 未召喚で直接 /chat に来た場合は召喚画面へ戻す
  if (!chat.current) {
    router.replace('/')
  }
})

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = listEl.value
  if (el) el.scrollTop = el.scrollHeight
}

// 新着メッセージ / 送信状態の変化で末尾へスクロール
watch(
  () => [chat.messages.length, chat.sending],
  () => {
    void scrollToBottom()
  },
)

async function onSend(): Promise<void> {
  const text = input.value
  if (!text.trim() || chat.sending) return
  input.value = ''
  await chat.send(text)
}

function onDismiss(): void {
  chat.dismiss()
  router.push('/')
}
</script>

<template>
  <section
    class="chat-view"
    aria-labelledby="chat-heading"
  >
    <header class="chat-header">
      <h2
        id="chat-heading"
        class="chat-title"
      >
        {{ chat.current?.displayName ?? '対話' }}
      </h2>
      <button
        type="button"
        class="dismiss-button"
        @click="onDismiss"
      >
        別の秘書を召喚
      </button>
    </header>

    <div
      ref="listEl"
      class="message-list"
      aria-live="polite"
    >
      <p
        v-if="chat.messages.length === 0"
        class="empty-note"
      >
        メッセージを送って会話を始めましょう。
      </p>
      <div
        v-for="(msg, i) in chat.messages"
        :key="i"
        class="message-row"
        :class="msg.role"
      >
        <div class="bubble">
          {{ msg.content }}
        </div>
      </div>
      <div
        v-if="chat.sending"
        class="message-row assistant"
      >
        <div class="bubble typing">
          …
        </div>
      </div>
    </div>

    <p
      v-if="chat.error"
      class="error"
      role="alert"
    >
      {{ chat.error }}
    </p>

    <form
      class="input-row"
      @submit.prevent="onSend"
    >
      <label
        class="visually-hidden"
        for="chat-input"
      >メッセージ</label>
      <textarea
        id="chat-input"
        v-model="input"
        class="chat-input"
        rows="1"
        placeholder="メッセージを入力…"
        :disabled="chat.sending"
        @keydown.enter.exact.prevent="onSend"
      />
      <button
        type="submit"
        class="send-button"
        :disabled="chat.sending || !input.trim()"
      >
        送信
      </button>
    </form>
  </section>
</template>

<style scoped>
.chat-view {
  flex: 1;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-title {
  margin: 0;
  font-size: 1.05rem;
}

.dismiss-button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #cfe8cf;
  font-size: 0.8rem;
  cursor: pointer;
}

.message-list {
  flex: 1;
  min-height: 220px;
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.12);
}

.empty-note {
  margin: auto;
  opacity: 0.6;
  font-size: 0.85rem;
}

.message-row {
  display: flex;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.92rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-row.user .bubble {
  background: #6fae6f;
  color: #10210f;
  border-bottom-right-radius: 4px;
}

.message-row.assistant .bubble {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-bottom-left-radius: 4px;
}

.bubble.typing {
  opacity: 0.7;
  letter-spacing: 2px;
}

.error {
  margin: 0;
  font-size: 0.85rem;
  color: #f0b0b0;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  min-width: 0;
  resize: none;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.15);
  color: #fff;
  font-size: 0.95rem;
  font-family: inherit;
}

.send-button {
  padding: 9px 18px;
  border-radius: 6px;
  border: none;
  background: #6fae6f;
  color: #10210f;
  font-weight: 600;
  cursor: pointer;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
