// secrets ストア(S2-1) — Pinia
// SecretStore(IndexedDb + AES-GCM)越しに Gemini APIキー(BYOK)を管理する。
//
// 方針:
//   - セキュリティ上、キーの実値はストアに保持しない。「保存済みか(hasGeminiKey)」だけを reactive に持つ。
//     実値の一時入力は呼出側コンポーネントのローカル状態に閉じる。
//   - SecretStore のキー名は契約既定の 'gemini.apiKey'(BYOK)を使用。
//   - 初期化失敗(WebCrypto 非対応等)は supported=false で UI に伝える。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getServices } from '@/app/composition'

const GEMINI_API_KEY = 'gemini.apiKey'

/** SecretOpResult の失敗理由を日本語に */
function mapSaveReason(reason: 'not_initialized' | 'crypto_error' | 'storage_quota' | 'unknown'): string {
  switch (reason) {
    case 'not_initialized':
      return 'セキュア保管が初期化されていません'
    case 'crypto_error':
      return '暗号化処理に失敗しました'
    case 'storage_quota':
      return '端末の保存容量が不足しています'
    default:
      return '保存に失敗しました'
  }
}

export const useSecretsStore = defineStore('secrets', () => {
  /** ensureLoaded が一度走ったか */
  const initialized = ref(false)
  /** SecretStore(WebCrypto/IndexedDB)が利用可能か */
  const supported = ref(true)
  /** Gemini APIキーが保存済みか */
  const hasGeminiKey = ref(false)
  /** 保存/削除の実行中フラグ */
  const busy = ref(false)
  /** 直近のエラーメッセージ(なければ null) */
  const error = ref<string | null>(null)

  /** 初回に SecretStore の状態とキーの有無を読み込む(冪等) */
  async function ensureLoaded(): Promise<void> {
    if (initialized.value) return
    const { secretStore, status } = await getServices()
    supported.value = status.secretStore.ok
    if (status.secretStore.ok) {
      const value = await secretStore.getSecret(GEMINI_API_KEY)
      hasGeminiKey.value = value !== null
    }
    initialized.value = true
  }

  /** Gemini APIキーを保存する。成功で true。 */
  async function saveGeminiKey(rawKey: string): Promise<boolean> {
    const key = rawKey.trim()
    if (!key) {
      error.value = 'APIキーを入力してください'
      return false
    }
    busy.value = true
    error.value = null
    try {
      const { secretStore, status } = await getServices()
      if (!status.secretStore.ok) {
        error.value = 'この環境ではセキュア保管が利用できません'
        return false
      }
      const result = await secretStore.putSecret(GEMINI_API_KEY, key)
      if (!result.ok) {
        error.value = mapSaveReason(result.reason)
        return false
      }
      hasGeminiKey.value = true
      return true
    } finally {
      busy.value = false
    }
  }

  /** 保存済みの Gemini APIキーを削除する。成功で true。 */
  async function clearGeminiKey(): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      const { secretStore, status } = await getServices()
      if (!status.secretStore.ok) {
        error.value = 'この環境ではセキュア保管が利用できません'
        return false
      }
      const result = await secretStore.removeSecret(GEMINI_API_KEY)
      if (!result.ok) {
        error.value = mapSaveReason(result.reason)
        return false
      }
      hasGeminiKey.value = false
      return true
    } finally {
      busy.value = false
    }
  }

  return {
    initialized,
    supported,
    hasGeminiKey,
    busy,
    error,
    ensureLoaded,
    saveGeminiKey,
    clearGeminiKey,
  }
})
