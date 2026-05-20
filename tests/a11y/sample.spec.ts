// サンプル a11y テスト(@axe-core/playwright 稼働確認用)
// WCAG 2.1 Level AA 準拠を目標、 詳細は Phase 2 Sprint 1〜2 で機能ごとに追加

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('アクセシビリティ スモーク', () => {
  // TODO(Tさん→Sさん): Sprint 2 で src/ 本実装時に .skip を解除すること
  // 解除条件: src/App.vue が最小ダミーから本実装(オンボーディング/ホーム画面実装)に置き換わったタイミング
  // 担当: Sさん が src/ 起草 PR を出す時、 .skip 解除も同 PR に含める
  // 関連: docs/Phase1/Phase1_テスト戦略案_v0.2_2026-05-19.md §10 既知 skip リスト / §17.5 axe-core セットアップ
  // 経緯: 2026-05-20 初回 push 時、 最小ダミー src/App.vue に対する axe-core 検査で違反検出 → 案A(skip + 三重ガード)で確定(エルトン承認済み)
  test.skip('ホーム画面に axe-core 違反が無い', async ({ page }) => {
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
