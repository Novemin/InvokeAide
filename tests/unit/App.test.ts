// App.vue のマウントテスト(Vue 3 + @vue/test-utils 稼働確認用)
// Sさん が本格実装に置き換える前提、 本テストはスケルトン段階の検証
//
// 2026-05-24 改訂(B1 領域境界対応):
//   - Sさん B1(Pinia / Vue Router / AI明示モーダル)導入により App.vue が
//     Pinia と Vue Router 必須に。 mount(App) で getActivePinia() エラーが
//     発生していたため、 テストハーネスに Pinia + Router セットアップを追加。
//   - 検証内容(h1 / footer.ai-disclosure 文言)は不変、 マウント環境のみ拡張。
//   - router は createMemoryHistory + 最小ダミー routes でテスト隔離。

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import App from '@/App.vue';

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
  });
}

async function mountApp() {
  const router = createTestRouter();
  await router.push('/');
  await router.isReady();
  return mount(App, {
    global: {
      plugins: [createPinia(), router],
    },
  });
}

describe('App.vue(スケルトン)', () => {
  it('マウントできる', async () => {
    const wrapper = await mountApp();
    expect(wrapper.exists()).toBe(true);
  });

  it('タイトルが表示される', async () => {
    const wrapper = await mountApp();
    expect(wrapper.find('h1').text()).toBe('InvokeAide');
  });

  it('AI 明示宣言が表示される(法的書類 v0.3 §6.1 / Beta_v1 §10 #1)', async () => {
    const wrapper = await mountApp();
    const disclosure = wrapper.find('footer.ai-disclosure');
    expect(disclosure.exists()).toBe(true);
    expect(disclosure.text()).toContain('AI');
    expect(disclosure.text()).toContain('対話システム');
  });
});
