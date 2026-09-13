<script setup>
defineProps({
  padding: {
    type: String,
    default: 'md',
    validator: (v) => ['none', 'sm', 'md', 'lg'].includes(v)
  },
  hoverable: {
    type: Boolean,
    default: false
  },
  bordered: {
    type: Boolean,
    default: true
  }
})
</script>

<template>
  <div
    :class="[
      'base-card',
      `p-${padding}`,
      { 'is-hoverable': hoverable, 'has-border': bordered }
    ]"
  >
    <div v-if="$slots.header" class="card-header">
      <slot name="header" />
    </div>
    <div class="card-body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.base-card {
  background-color: var(--color-bg-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-normal), transform var(--transition-normal), border-color var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.base-card.has-border {
  border: 1px solid var(--color-border-subtle);
}

.base-card.is-hoverable:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: rgba(90, 155, 149, 0.4);
}

/* Paddings */
.p-none .card-body { padding: 0; }
.p-sm .card-body { padding: 1rem; }
.p-md .card-body { padding: 1.5rem; }
.p-lg .card-body { padding: 2rem; }

.card-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border-subtle);
  background-color: var(--color-bg-subtle);
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}
</style>
