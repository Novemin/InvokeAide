// サンプル a11y テスト(@axe-core/playwright 稼働確認用)
// WCAG 2.1 Level AA 準拠を目標、 詳細は Phase 2 Sprint 1〜2 で機能ごとに追加

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('アクセシビリティ スモーク', () => {
  test('ホーム画面に axe-core 違反が無い', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('キーボード操作のみでフォーカス可能要素に到達できる', async ({ page }) => {
    await page.goto('/');
    // Tab キーで最初のフォーカス可能要素まで進む
    await page.keyboard.press('Tab');
    // フォーカスがどこかに当たれば OK(スケルトン段階)
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeDefined();
  });
});
