// App.vue のマウントテスト(Vue 3 + @vue/test-utils 稼働確認用)
// Sさん が本格実装に置き換える前提、 本テストはスケルトン段階の検証

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '@/App.vue';

describe('App.vue(スケルトン)', () => {
  it('マウントできる', () => {
    const wrapper = mount(App);
    expect(wrapper.exists()).toBe(true);
  });

  it('タイトルが表示される', () => {
    const wrapper = mount(App);
    expect(wrapper.find('h1').text()).toBe('InvokeAide');
  });

  it('AI 明示宣言が表示される(法的書類 v0.3 §6.1 / Beta_v1 §10 #1)', () => {
    const wrapper = mount(App);
    const disclosure = wrapper.find('footer.ai-disclosure');
    expect(disclosure.exists()).toBe(true);
    expect(disclosure.text()).toContain('AI');
    expect(disclosure.text()).toContain('対話システム');
  });
});
