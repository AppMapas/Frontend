<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'outline', 'ghost', 'soft'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (s) => ['sm', 'md', 'lg'].includes(s)
  },
  type: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  block: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="['base-button', `btn-${variant}`, `btn-${size}`, { 'btn-block': block, 'is-loading': loading }]"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>
    <slot name="icon-left" />
    <span class="btn-content">
      <slot />
    </span>
    <slot name="icon-right" />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-sans);
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
}

.base-button:focus-visible {
  outline: 2px solid var(--color-teal);
  outline-offset: 2px;
}

.base-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

/* Tamaños */
.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.8125rem;
  height: 32px;
}

.btn-md {
  padding: 0.55rem 1.15rem;
  font-size: 0.875rem;
  height: 40px;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  height: 48px;
}

.btn-block {
  width: 100%;
}

/* Variantes según docs/ui.md */
.btn-primary {
  background-color: var(--color-coral);
  color: #FFFFFF;
  box-shadow: 0 2px 4px rgba(255, 133, 145, 0.25);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  box-shadow: 0 4px 10px rgba(255, 133, 145, 0.35);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  background-color: var(--color-primary-active);
  transform: translateY(0);
}

.btn-secondary {
  background-color: var(--color-teal);
  color: #FFFFFF;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-deep-teal);
  box-shadow: 0 4px 10px rgba(90, 155, 149, 0.25);
  transform: translateY(-1px);
}

.btn-outline {
  background-color: transparent;
  border-color: var(--color-border-medium);
  color: var(--color-text-body);
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--color-teal);
  color: var(--color-teal);
  background-color: rgba(90, 155, 149, 0.05);
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-text-muted);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-body);
}

.btn-soft {
  background-color: var(--color-accent-soft-bg);
  color: var(--color-text-title);
  border-color: rgba(239, 170, 163, 0.4);
}

.btn-soft:hover:not(:disabled) {
  background-color: var(--color-soft-coral);
  color: var(--color-text-on-primary);
}

.btn-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
