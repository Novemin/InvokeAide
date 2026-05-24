import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

// B1 段階の最小ルーティング
// B2 で /settings(設定画面)、 B3 で /chat(対話 UI) が追加される想定

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
