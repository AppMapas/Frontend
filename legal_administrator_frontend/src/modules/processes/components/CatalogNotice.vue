<script setup>
import { computed } from 'vue'

const props = defineProps({
  tone: {
    type: String,
    default: 'info',
  },
})

const noticeRole = computed(() => {
  if (props.tone === 'error') return 'alert'
  return 'status'
})
</script>

<template>
  <div
    class="catalog-notice"
    :class="'tone-' + tone"
    :role="noticeRole"
  >
    <slot />
  </div>
</template>

<style scoped>
.catalog-notice {
  border: 1px solid var(--color-border-medium);
  border-left: 4px solid var(--color-info);
  border-radius: var(--radius-sm);
  padding: .8rem 1rem;
  background: var(--color-bg-subtle);
  color: var(--color-text-body);
  font-size: .9rem;
  line-height: 1.5;
}
.tone-success { border-left-color: var(--color-success); }
.tone-error { border-left-color: var(--color-danger); }
</style>
