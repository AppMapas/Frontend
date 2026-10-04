<script setup>
import BaseCard from './BaseCard.vue'
defineProps({ label: { type: String, default: 'Cargando información' }, count: { type: Number, default: 3 } })
</script>
<template>
  <div class="loading-grid" role="status" :aria-label="label">
    <span class="visually-hidden">{{ label }}</span>
    <BaseCard v-for="item in count" :key="item" aria-hidden="true">
      <div class="skeleton title"></div><div class="skeleton"></div><div class="skeleton short"></div>
    </BaseCard>
  </div>
</template>
<style scoped>
.loading-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.skeleton { height: .85rem; margin: .8rem 0; border-radius: var(--radius-xs); background: var(--color-bg-subtle); animation: breathe 1.3s ease-in-out infinite alternate; }
.title { height: 1.5rem; width: 75%; } .short { width: 60%; }
@media (min-width: 720px) { .loading-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .loading-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@keyframes breathe { to { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
