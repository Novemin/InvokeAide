// サンプルユニットテスト(基盤稼働確認用)
// 本テストは Tさん 基盤スケルトンが緑になることのスモークテストで、
// 実際の機能テストは Sさん の本格実装後に追加される

import { describe, it, expect } from 'vitest';

describe('基盤スモークテスト', () => {
  it('Vitest が動作する', () => {
    expect(1 + 1).toBe(2);
  });

  it('TypeScript 型システムが動作する', () => {
    const value: string = 'InvokeAide';
    expect(value).toBe('InvokeAide');
  });

  it('非同期テストが動作する', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
