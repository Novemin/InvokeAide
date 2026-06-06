import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

// ルーティング
// B1: / (home)
// S2-1: /settings(設定画面)、 /auth/callback(OAuth コールバック)
// B3 で /chat(対話 UI) が追加される想定
// 設定・コールバックは遅延ロード(home バンドルを小さく保つ)

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
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
