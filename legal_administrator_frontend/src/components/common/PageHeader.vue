<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  eyebrow: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <header class="page-header">
    <div class="header-main">
      <p v-if="eyebrow" class="header-eyebrow">{{ eyebrow }}</p>
      <h1 class="header-title">{{ title }}</h1>
      <p v-if="subtitle" class="header-subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-border-subtle);
  flex-wrap: wrap;
  gap: 1rem;
}

.header-main {
  max-width: 720px;
}

.header-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-teal-strong);
  margin-bottom: 0.35rem;
}

.header-title {
  font-size: 1.75rem;
  color: var(--color-text-title);
  margin: 0 0 0.35rem 0;
  letter-spacing: -0.02em;
}

.header-subtitle {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .page-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
  }
  .header-title {
    font-size: 1.4rem;
  }
}
</style>
