// サンプル E2E テスト(基盤稼働確認用)
// 本テストは Tさん 基盤スケルトンが Playwright で緑になることのスモークテスト

import { test, expect } from '@playwright/test';

test.describe('基盤スモーク(E2E)', () => {
  test('ホーム画面が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('InvokeAide');
  });

  test('AI 明示宣言が表示される(法的書類 v0.3 §6.1 / Beta_v1 §10 #1)', async ({ page }) => {
    await page.goto('/');
    const disclosure = page.locator('footer.ai-disclosure');
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toContainText('AI');
    await expect(disclosure).toContainText('対話システム');
  });

  test('viewport-fit=cover が設定されている(iOS Safari §1)', async ({ page }) => {
    await page.goto('/');
    const viewportMeta = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(viewportMeta).toContain('viewport-fit=cover');
  });

  test('運営者ドメインへの POST が発生しない(H2 ネットワーク監視のスモーク)', async ({ page }) => {
    const operatorRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('novemintelligence.com') && req.method() === 'POST') {
        operatorRequests.push(url);
      }
    });
    await page.goto('/');
    // SPA 上で待ち時間を確保
    await page.waitForTimeout(500);
    expect(operatorRequests).toHaveLength(0);
  });
});
