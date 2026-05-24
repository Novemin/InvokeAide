import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// AI 明示モーダルの「確認しました」 状態を管理
// B1 では LocalStorage 直叩き、 B2 で ConsentService 経由に置き換え予定

const STORAGE_KEY = 'invokeaide.disclosure.acknowledged';

export const useDisclosureStore = defineStore('disclosure', () => {
  const acknowledged = ref<boolean>(
    typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true',
  );

  const needsAcknowledgement = computed<boolean>(() => !acknowledged.value);

  function acknowledge(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    acknowledged.value = true;
  }

  return {
    acknowledged,
    needsAcknowledgement,
    acknowledge,
  };
});
