<script setup lang="ts">
// 召喚UI(S2-3): キャラクター選択 + 起動(召喚)ボタン
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import type { CharacterEntry } from '@/interfaces/domain'

const router = useRouter()
const chat = useChatStore()

const selectedId = ref<string | null>(chat.characters[0]?.id ?? null)

function select(character: CharacterEntry): void {
  selectedId.value = character.id
}

function summon(): void {
  const character = chat.characters.find((c) => c.id === selectedId.value)
  if (!character) return
  chat.summon(character)
  router.push('/chat')
}
</script>

<template>
  <section
    class="summon-view"
    aria-labelledby="summon-heading"
  >
    <h2
      id="summon-heading"
      class="summon-heading"
    >
      秘書を召喚する
    </h2>
    <p class="lead">
      付き合う相手を選んで、召喚してください。
    </p>

    <ul
      class="character-list"
      role="radiogroup"
      aria-label="秘書キャラクター"
    >
      <li
        v-for="character in chat.characters"
        :key="character.id"
      >
        <button
          type="button"
          class="character-card"
          role="radio"
          :aria-checked="selectedId === character.id"
          :class="{ selected: selectedId === character.id }"
          @click="select(character)"
        >
          <span class="character-name">{{ character.displayName }}</span>
          <span class="character-desc">{{ character.description }}</span>
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="summon-button"
      :disabled="!selectedId"
      @click="summon"
    >
      召喚する
    </button>

    <router-link
      class="settings-link"
      to="/settings"
    >
      設定(API キー / Google 接続)
    </router-link>
  </section>
</template>

<style scoped>
.summon-view {
  flex: 1;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.summon-heading {
  margin: 0;
  font-size: 1.25rem;
  opacity: 0.9;
}

.lead {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.8;
}

.character-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.character-card {
  width: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.12);
  color: #fff;
  cursor: pointer;
}

.character-card.selected {
  border-color: #8fd08f;
  background: rgba(143, 208, 143, 0.18);
}

.character-name {
  font-weight: 600;
  font-size: 1rem;
}

.character-desc {
  font-size: 0.82rem;
  opacity: 0.82;
  line-height: 1.5;
}

.summon-button {
  margin-top: 4px;
  padding: 10px 28px;
  border-radius: 8px;
  border: none;
  background: #6fae6f;
  color: #10210f;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.summon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-link {
  margin-top: 8px;
  color: #cfe8cf;
  font-size: 0.9rem;
}
</style>
