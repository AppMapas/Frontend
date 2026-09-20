<script setup>
import BaseCard from './BaseCard.vue'

defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
})
</script>

<template>
  <BaseCard class="coming-soon" padding="lg">
    <div class="decorative-orbit" aria-hidden="true"><span></span></div>
    <div class="state-content">
      <span class="state-badge">En desarrollo</span>
      <div class="state-icon" aria-hidden="true">⌁</div>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <div class="progress-note" role="status">
        <span aria-hidden="true"></span>
        Estamos trabajando en esta sección
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.coming-soon { position: relative; min-height: 360px; overflow: hidden; }
.coming-soon :deep(.card-body) { display: grid; min-height: 360px; place-items: center; }
.state-content { position: relative; z-index: 1; display: grid; max-width: 560px; justify-items: center; text-align: center; }
.state-badge { margin-bottom: 1rem; padding: .35rem .75rem; border: 1px solid var(--color-coral-decorative); border-radius: var(--radius-full); color: var(--color-coral-decorative-strong); background: var(--color-coral-decorative-soft); font-size: .7rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.state-icon { display: grid; width: 4.25rem; height: 4.25rem; margin-bottom: 1rem; place-items: center; border: 1px solid var(--color-border-medium); border-radius: 1.35rem; color: var(--color-teal-strong); background: var(--color-primary-subtle); font-size: 2rem; }
h2 { margin: 0 0 .6rem; font-size: 1.35rem; }
p { max-width: 48ch; margin: 0; color: var(--color-text-muted); font-size: .9rem; line-height: 1.7; }
.progress-note { display: inline-flex; align-items: center; gap: .5rem; margin-top: 1.5rem; color: var(--color-text-body); font-size: .78rem; font-weight: 700; }
.progress-note span { width: .55rem; height: .55rem; border-radius: 50%; background: var(--color-teal); box-shadow: 0 0 0 5px var(--color-primary-subtle); }
.decorative-orbit { position: absolute; width: 260px; height: 260px; top: -110px; right: -70px; border: 34px solid var(--color-coral-decorative-soft); border-radius: 50%; }
.decorative-orbit span { position: absolute; width: 80px; height: 80px; left: -55px; bottom: -30px; border: 14px solid var(--color-primary-subtle); border-radius: 50%; }
</style>
