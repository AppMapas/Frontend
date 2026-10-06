<script setup>
import { RouterLink } from 'vue-router'
import BaseCard from '@/components/common/BaseCard.vue'
defineProps({
  label: String,
  value: Number,
  hint: String,
  tone: String,
  symbol: String,
  to: [Object, String],
})
</script>
<template>
  <RouterLink :to="to" class="stat-link">
    <BaseCard padding="sm" class="stat-card" :class="`tone-${tone}`">
      <div class="stat-top">
        <span class="stat-symbol" aria-hidden="true">{{ symbol }}</span
        ><span class="stat-arrow" aria-hidden="true">↗</span>
      </div>
      <strong class="stat-value">{{ value }}</strong>
      <h2>{{ label }}</h2>
      <p>{{ hint }}</p>
    </BaseCard>
  </RouterLink>
</template>
<style scoped>
.stat-link {
  display: block;
  min-width: 0;
  color: var(--color-text-title);
  text-decoration: none;
  border-radius: var(--radius-lg);
}
.stat-link:focus-visible {
  outline: 3px solid var(--color-border-focus);
  outline-offset: 3px;
}
.stat-card {
  height: 100%;
  background: var(--tile-bg);
  border-radius: var(--radius-lg);
  border-top: 4px solid var(--tile-accent);
  transition: box-shadow var(--transition-fast);
}
.stat-card:hover {
  box-shadow: var(--shadow-md);
}
.tone-blue {
  --tile-bg: var(--color-calendar-blue-bg);
  --tile-accent: var(--color-calendar-blue-accent);
}
.tone-violet {
  --tile-bg: var(--color-calendar-violet-bg);
  --tile-accent: var(--color-calendar-violet-accent);
}
.tone-amber {
  --tile-bg: var(--color-calendar-amber-bg);
  --tile-accent: var(--color-calendar-amber-accent);
}
.tone-coral {
  --tile-bg: var(--color-coral-decorative-pale);
  --tile-accent: var(--color-coral-decorative-strong);
}
.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}
.stat-symbol {
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  width: 36px;
  height: 36px;
  font-size: 1.2rem;
  color: var(--color-text-title);
}
.stat-arrow {
  color: var(--color-text-body);
}
.stat-value {
  display: block;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  letter-spacing: -0.05em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
h2 {
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0.55rem 0 0.35rem;
  color: var(--color-text-title);
}
p {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--color-text-body);
}
@media (prefers-reduced-motion: reduce) {
  .stat-card {
    transition: none;
  }
}
</style>
