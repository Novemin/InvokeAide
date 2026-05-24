<script setup lang="ts">
import { aiDisclosureText } from '@/config/disclosure-text';
import { useDisclosureStore } from '@/stores/disclosure';

const disclosure = useDisclosureStore();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="disclosure.needsAcknowledgement"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-disclosure-title"
    >
      <div class="modal-content">
        <h2 id="ai-disclosure-title">
          {{ aiDisclosureText.title }}
        </h2>
        <p>{{ aiDisclosureText.body }}</p>
        <p>{{ aiDisclosureText.body2 }}</p>
        <button
          type="button"
          class="acknowledge-button"
          @click="disclosure.acknowledge()"
        >
          {{ aiDisclosureText.acknowledgeButton }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}

.modal-content {
  background-color: #ffffff;
  color: #333333;
  border-radius: 12px;
  padding: 24px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  font-family: system-ui, -apple-system, 'Hiragino Sans', 'Yu Gothic', sans-serif;
}

h2 {
  margin: 0 0 16px 0;
  font-size: 1.25rem;
  color: #3f5f3f;
}

p {
  margin: 0 0 12px 0;
  line-height: 1.6;
  font-size: 0.95rem;
}

.acknowledge-button {
  display: block;
  width: 100%;
  margin-top: 16px;
  padding: 12px 24px;
  background-color: #3f5f3f;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.acknowledge-button:hover {
  background-color: #2f4f2f;
}

.acknowledge-button:focus-visible {
  outline: 3px solid #ffd700;
  outline-offset: 2px;
}
</style>
