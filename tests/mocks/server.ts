// MSW server インスタンス(Node.js テスト環境用)
// Vitest セットアップ(tests/setup.ts) から listen / close される

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
