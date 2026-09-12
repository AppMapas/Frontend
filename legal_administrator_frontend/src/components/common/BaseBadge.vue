<script setup>
defineProps({
  variant: {
    type: String,
    default: 'sage',
    validator: (v) => ['coral', 'soft-coral', 'sage', 'teal', 'deep-teal', 'neutral'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (s) => ['sm', 'md'].includes(s)
  }
})
</script>

<template>
  <span :class="['base-badge', `badge-${variant}`, `badge-${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-mono);
  font-weight: 500;
  border-radius: var(--radius-full);
  line-height: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.badge-sm {
  padding: 0.2rem 0.5rem;
  font-size: 0.6875rem;
}

.badge-md {
  padding: 0.3rem 0.7rem;
  font-size: 0.75rem;
}

.badge-coral {
  background-color: var(--color-primary-subtle);
  color: var(--color-coral);
  border: 1px solid rgba(255, 133, 145, 0.35);
}

.badge-soft-coral {
  background-color: var(--color-accent-soft-bg);
  color: #B54E59;
  border: 1px solid rgba(239, 170, 163, 0.45);
}

.badge-sage {
  background-color: rgba(140, 170, 162, 0.18);
  color: #435E58;
  border: 1px solid rgba(140, 170, 162, 0.4);
}

.badge-teal {
  background-color: rgba(90, 155, 149, 0.15);
  color: var(--color-deep-teal);
  border: 1px solid rgba(90, 155, 149, 0.35);
}

.badge-deep-teal {
  background-color: rgba(68, 135, 143, 0.15);
  color: var(--color-deep-teal);
  border: 1px solid rgba(68, 135, 143, 0.35);
}

.badge-neutral {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-subtle);
}
</style>
