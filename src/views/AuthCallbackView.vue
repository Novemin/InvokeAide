<script setup lang="ts">
// OAuth コールバック画面(S2-1)
//   Google 同意後に redirect_uri(/auth/callback?code=... または ?error=...)へ戻ってくる。
//   クエリから code / error を抽出し、auth ストア経由で handleAuthCallback() を呼んで Stage を確定。
//   成功時は設定画面へ自動で戻す(履歴に callback を残さないよう replace)。
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

type Phase = 'processing' | 'success' | 'partial' | 'error'
const phase = ref<Phase>('processing')
const message = ref('接続を完了しています…')

function mapError(reason: 'denied' | 'partial' | 'network' | 'unknown'): string {
  switch (reason) {
    case 'denied':
      return '接続がキャンセルされました。'
    case 'network':
      return 'ネットワークエラーのため接続できませんでした。'
    default:
      return '接続に失敗しました。お手数ですがもう一度お試しください。'
  }
}

onMounted(async () => {
  await auth.ensureLoaded()

  const params = new URLSearchParams(globalThis.location.search)
  const code = params.get('code') ?? undefined
  const errorParam = params.get('error') ?? undefined

  const result = await auth.handleCallback({ code, error: errorParam })

  if (result.ok) {
    phase.value = 'success'
    message.value = '接続が完了しました。設定画面に戻ります…'
    setTimeout(() => router.replace('/settings'), 1200)
  } else if (result.reason === 'partial') {
    // 接続自体は成立(Stage は進む)が、一部スコープが拒否された
    phase.value = 'partial'
    message.value = '接続しましたが、一部の権限が許可されませんでした。設定画面に戻ります…'
    setTimeout(() => router.replace('/settings'), 1800)
  } else {
    phase.value = 'error'
    message.value = mapError(result.reason)
  }
})
</script>

<template>
  <section
    class="callback-view"
    aria-labelledby="callback-heading"
  >
    <h2
      id="callback-heading"
      class="callback-heading"
    >
      Google 接続
    </h2>

    <p
      class="message"
      :class="phase"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>

    <router-link
      v-if="phase === 'error'"
      class="back-link"
      to="/settings"
    >
      設定画面に戻る
    </router-link>
  </section>
</template>

<style scoped>
.callback-view {
  flex: 1;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.callback-heading {
  margin: 0;
  font-size: 1.25rem;
  opacity: 0.9;
}

.message {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.message.success,
.message.partial {
  color: #b6f0b6;
}

.message.error {
  color: #f0b0b0;
}

.back-link {
  color: #cfe8cf;
  font-size: 0.9rem;
}
</style>
