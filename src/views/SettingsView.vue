<script setup lang="ts">
// 設定画面(S2-1)
//   - Gemini API キー(BYOK): IndexedDbSecretStore で暗号化保存
//   - Google アカウント接続: GoogleAuthProvider 経由、接続状態の表示
import { onMounted, ref } from 'vue'
import { useSecretsStore } from '@/stores/secrets'
import { useAuthStore } from '@/stores/auth'

const secrets = useSecretsStore()
const auth = useAuthStore()

// キー実値は画面ローカルに閉じる(ストアには保存しない)
const keyInput = ref('')
const showKey = ref(false)
const keySaved = ref(false)

onMounted(async () => {
  await Promise.all([secrets.ensureLoaded(), auth.ensureLoaded()])
})

async function onSaveKey(): Promise<void> {
  keySaved.value = false
  const ok = await secrets.saveGeminiKey(keyInput.value)
  if (ok) {
    keyInput.value = ''
    showKey.value = false
    keySaved.value = true
  }
}

async function onClearKey(): Promise<void> {
  keySaved.value = false
  await secrets.clearGeminiKey()
}

async function onConnect(): Promise<void> {
  // 成功時はフルページ遷移するため、この後の行には基本到達しない
  await auth.connect()
}

async function onSignOut(): Promise<void> {
  await auth.signOut()
}
</script>

<template>
  <section
    class="settings-view"
    aria-labelledby="settings-heading"
  >
    <h2
      id="settings-heading"
      class="settings-heading"
    >
      設定
    </h2>

    <!-- Gemini API キー -->
    <fieldset class="card">
      <legend>Gemini API キー</legend>
      <p class="desc">
        ご自身の Gemini API キーを入力してください。キーは端末内で暗号化して保存され、運営者には送信されません。
      </p>

      <p
        v-if="!secrets.supported"
        class="warn"
        role="alert"
      >
        この環境ではセキュア保管(暗号化保存)が利用できません。
      </p>

      <p class="status-line">
        状態:
        <strong :class="secrets.hasGeminiKey ? 'on' : 'off'">
          {{ secrets.hasGeminiKey ? '保存済み' : '未保存' }}
        </strong>
      </p>

      <div class="key-row">
        <label
          class="visually-hidden"
          for="gemini-key-input"
        >Gemini API キー</label>
        <input
          id="gemini-key-input"
          v-model="keyInput"
          :type="showKey ? 'text' : 'password'"
          class="key-input"
          autocomplete="off"
          spellcheck="false"
          placeholder="AIza..."
          :disabled="secrets.busy || !secrets.supported"
        >
        <button
          type="button"
          class="ghost"
          :disabled="!keyInput"
          @click="showKey = !showKey"
        >
          {{ showKey ? '隠す' : '表示' }}
        </button>
      </div>

      <div class="actions">
        <button
          type="button"
          class="primary"
          :disabled="secrets.busy || !secrets.supported || !keyInput"
          @click="onSaveKey"
        >
          保存
        </button>
        <button
          v-if="secrets.hasGeminiKey"
          type="button"
          class="danger"
          :disabled="secrets.busy"
          @click="onClearKey"
        >
          削除
        </button>
      </div>

      <p
        v-if="secrets.error"
        class="error"
        role="alert"
      >
        {{ secrets.error }}
      </p>
      <p
        v-else-if="keySaved"
        class="ok"
        role="status"
      >
        保存しました。
      </p>
    </fieldset>

    <!-- Google アカウント接続 -->
    <fieldset class="card">
      <legend>Google アカウント接続</legend>
      <p class="desc">
        カレンダー・ToDo・Drive 連携のため、Google アカウントと接続します。
      </p>

      <p class="status-line">
        状態:
        <span
          class="badge"
          :class="auth.connected ? 'badge-on' : 'badge-off'"
        >
          {{ auth.connected ? '接続済み' : '未接続' }}
        </span>
      </p>

      <p
        v-if="!auth.configured"
        class="warn"
        role="alert"
      >
        {{ auth.configReason }}
      </p>

      <div class="actions">
        <button
          v-if="!auth.connected"
          type="button"
          class="primary"
          :disabled="auth.busy || !auth.configured"
          @click="onConnect"
        >
          Google と接続
        </button>
        <button
          v-else
          type="button"
          class="danger"
          :disabled="auth.busy"
          @click="onSignOut"
        >
          接続を解除
        </button>
      </div>

      <p
        v-if="auth.error"
        class="error"
        role="alert"
      >
        {{ auth.error }}
      </p>
    </fieldset>

    <router-link
      class="back-link"
      to="/"
    >
      ← ホームへ戻る
    </router-link>
  </section>
</template>

<style scoped>
.settings-view {
  flex: 1;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-heading {
  margin: 0;
  font-size: 1.25rem;
  opacity: 0.9;
}

.card {
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  padding: 12px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card legend {
  padding: 0 6px;
  font-weight: 600;
}

.desc {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.8;
  line-height: 1.5;
}

.status-line {
  margin: 0;
  font-size: 0.9rem;
}

.status-line strong.on,
.badge-on {
  color: #b6f0b6;
}

.status-line strong.off {
  color: #f0d6a0;
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid currentColor;
}

.badge-off {
  color: #f0d6a0;
}

.key-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.key-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(0, 0, 0, 0.15);
  color: #fff;
  font-size: 0.95rem;
}

.actions {
  display: flex;
  gap: 8px;
}

button {
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 0.9rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary {
  background: #6fae6f;
  color: #10210f;
}

.danger {
  background: transparent;
  border-color: #e0a0a0;
  color: #f0c0c0;
}

.ghost {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}

.warn {
  margin: 0;
  font-size: 0.85rem;
  color: #f0d6a0;
}

.error {
  margin: 0;
  font-size: 0.85rem;
  color: #f0b0b0;
}

.ok {
  margin: 0;
  font-size: 0.85rem;
  color: #b6f0b6;
}

.back-link {
  color: #cfe8cf;
  font-size: 0.9rem;
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
