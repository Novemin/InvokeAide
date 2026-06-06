// auth ストア(S2-1) — Pinia
// GoogleAuthProvider の Stage 機械を reactive 化し、設定画面の「接続済み/未接続」表示と
// 接続ボタン・/auth/callback 完了をつなぐ。
//
// 方針:
//   - stage は onStageChange で購読し続ける(ストアはアプリ生存期間 = 解除しない)。
//   - connect() は requestStage1Consent() を呼ぶ。これはフルページ遷移を開始するだけで
//     Promise は解決しない(戻りは /auth/callback → handleCallback() 経由で surface)。
//   - OAuth 未設定(clientId 空 → config_invalid)は configured=false で UI に伝え、接続ボタンを無効化。

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getServices } from '@/app/composition'
import type { AuthResult, AuthStage, StageChangeCause } from '@/interfaces/AuthProvider'

/** AuthProvider 初期化失敗理由を日本語に */
function mapAuthInitReason(
  reason: 'secret_store_unavailable' | 'config_invalid' | 'unknown' | 'skipped_secret_store',
): string {
  switch (reason) {
    case 'config_invalid':
      return 'OAuth クライアント設定が未構成です(.env.local を確認)'
    case 'secret_store_unavailable':
    case 'skipped_secret_store':
      return 'セキュア保管が利用できないため OAuth を初期化できません'
    default:
      return 'OAuth の初期化に失敗しました'
  }
}

export const useAuthStore = defineStore('auth', () => {
  /** ensureLoaded が一度走ったか */
  const initialized = ref(false)
  /** OAuth クライアント設定が有効で、AuthProvider 初期化済みか */
  const configured = ref(false)
  /** 未構成時の理由(configured=false のとき) */
  const configReason = ref<string | null>(null)
  /** 現在の Stage(unauth / stage1 / stage2) */
  const stage = ref<AuthStage>('unauth')
  /** 直近の Stage 変化要因(refresh_failed 等を UI で区別) */
  const lastCause = ref<StageChangeCause | null>(null)
  /** 接続/サインアウトの実行中 */
  const busy = ref(false)
  /** 直近のエラーメッセージ */
  const error = ref<string | null>(null)

  /** 接続済みか(unauth 以外なら接続済みとみなす) */
  const connected = computed(() => stage.value !== 'unauth')

  /** 初回に AuthProvider の状態を読み込み、Stage 変化を購読する(冪等) */
  async function ensureLoaded(): Promise<void> {
    if (initialized.value) return
    const { auth, status } = await getServices()
    if (status.auth.ok) {
      configured.value = true
      stage.value = auth.currentStage()
    } else {
      configured.value = false
      configReason.value = mapAuthInitReason(status.auth.reason)
    }
    // Stage 変化を購読(以降の接続/失効/復元を reactive に反映)
    auth.onStageChange((s, cause) => {
      stage.value = s
      lastCause.value = cause
    })
    initialized.value = true
  }

  /**
   * Google 接続(Stage1)を開始する。フルページ遷移するため、成功時はこの関数から制御が戻らない。
   * 設定未構成のときだけ即座にエラーを立てて戻る。
   */
  async function connect(): Promise<void> {
    error.value = null
    const { auth, status } = await getServices()
    if (!status.auth.ok) {
      error.value = mapAuthInitReason(status.auth.reason)
      return
    }
    busy.value = true
    // 遷移開始(この Promise は解決しない)
    await auth.requestStage1Consent()
  }

  /** サインアウト(refresh_token 等を破棄し unauth へ) */
  async function signOut(): Promise<void> {
    busy.value = true
    error.value = null
    try {
      const { auth } = await getServices()
      await auth.signOut()
    } finally {
      busy.value = false
    }
  }

  /**
   * /auth/callback から呼ぶ完了ハンドラ。code/error を AuthProvider に渡して Stage 遷移を確定する。
   * Stage 変化は onStageChange 経由で stage に反映される。
   */
  async function handleCallback(params: { code?: string; error?: string }): Promise<AuthResult> {
    const { auth } = await getServices()
    return auth.handleAuthCallback(params)
  }

  return {
    initialized,
    configured,
    configReason,
    stage,
    lastCause,
    busy,
    error,
    connected,
    ensureLoaded,
    connect,
    signOut,
    handleCallback,
  }
})
