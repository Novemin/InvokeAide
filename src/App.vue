<script setup lang="ts">
import AiDisclosureModal from '@/components/AiDisclosureModal.vue';

// App.vue は薄いシェル: h1 + subtitle + router-view + footer + AI 明示モーダル
// Tさん 既存テスト(h1 = "InvokeAide" / footer.ai-disclosure = "AI...対話システム")を維持
const greeting = 'InvokeAide';
const subtitle = '秘書召喚アプリ';
</script>

<template>
  <main
    class="app-shell"
    aria-labelledby="app-title"
  >
    <h1 id="app-title">
      {{ greeting }}
    </h1>
    <p class="subtitle">
      {{ subtitle }}
    </p>
    <router-view />
    <footer
      class="ai-disclosure"
      role="contentinfo"
    >
      本アプリは AI を用いた対話システムです
    </footer>
    <AiDisclosureModal />
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(48px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background-color: #3f5f3f;
  color: #ffffff;
  font-family: system-ui, -apple-system, 'Hiragino Sans', 'Yu Gothic', sans-serif;
  -webkit-font-smoothing: antialiased;
}

h1 {
  font-size: 2rem;
  margin: 1rem 0 0.25rem 0;
}

.subtitle {
  margin: 0 0 1rem 0;
  opacity: 0.85;
}

.ai-disclosure {
  position: fixed;
  bottom: max(8px, env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
