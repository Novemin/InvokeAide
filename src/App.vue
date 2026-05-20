<script setup lang="ts">
// InvokeAide 最小ダミーコンポーネント(Tさん 基盤スケルトン用)
// Sさん が本格実装を被せる土台。 機能ロジックは追加せず、 CI 緑化のみが目的。
const greeting = 'InvokeAide';
const subtitle = '秘書召喚アプリ — テスト基盤スケルトン稼働中';
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
    <!--
      本アプリは AI を用いた対話システムです(法的書類 v0.3 §6.1 / Beta_v1 §10 #1)
      画面下の AI 明示宣言は Sさん の本格実装で組み込まれる予定。
    -->
    <footer
      class="ai-disclosure"
      role="contentinfo"
    >
      本アプリは AI を用いた対話システムです
    </footer>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background-color: #3f5f3f;
  color: #ffffff;
  font-family: system-ui, -apple-system, 'Hiragino Sans', 'Yu Gothic', sans-serif;
  -webkit-font-smoothing: antialiased;
}

h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  margin: 0;
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
