import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import SummonView from '@/views/SummonView.vue';

// ルーティング
// S2-3: / (召喚UI)、 /chat(対話UI)
// S2-1: /settings(設定画面)、 /auth/callback(OAuth コールバック)
// 設定・対話・コールバックは遅延ロード(初期バンドルを小さく保つ)

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'summon',
    component: SummonView,
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/AuthCallbackView.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
