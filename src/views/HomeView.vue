<script setup lang="ts">
// B1 段階の最小 HomeView
// 起動 → AI 明示モーダル確認 → ここに到達 が Sprint 1 B1 完了条件
// B2 で OAuth + 設定画面、 B3 で対話 UI が入る
</script>

<template>
  <section
    class="home-view"
    aria-labelledby="home-heading"
  >
    <h2
      id="home-heading"
      class="home-heading"
    >
      ホーム
    </h2>
    <p class="placeholder-note">
      ここに、 後の Step で召喚 UI と対話 UI が入ります。
    </p>
    <router-link
      class="settings-link"
      to="/settings"
    >
      設定(API キー / Google 接続)
    </router-link>
  </section>
</template>

<style scoped>
.home-view {
  flex: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.home-heading {
  margin: 0 0 12px 0;
  font-size: 1.25rem;
  opacity: 0.9;
}

.placeholder-note {
  margin: 0;
  opacity: 0.75;
  font-size: 0.9rem;
}

.settings-link {
  margin-top: 20px;
  color: #cfe8cf;
  font-size: 0.9rem;
}
</style>
