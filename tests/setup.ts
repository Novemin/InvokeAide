// Vitest セットアップファイル
// 全テストファイルで共通の前処理(MSW server 起動 / 終了、 グローバルモック等)

import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => {
  // MSW server を起動(API モック)
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  // 各テスト後に handler 状態をリセット
  server.resetHandlers();
});

afterAll(() => {
  // 全テスト完了後に server を閉じる
  server.close();
});
