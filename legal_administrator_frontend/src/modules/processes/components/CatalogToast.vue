<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  message: { type: String, required: true },
  tone: { type: String, default: 'info' },
  actionLabel: { type: String, default: '' },
  duration: { type: Number, default: 5000 },
})

const emit = defineEmits(['close', 'action'])
let closeTimer = null

const toastRole = computed(() => {
  if (props.tone === 'error') return 'alert'
  return 'status'
})

const toastLive = computed(() => {
  if (props.tone === 'error') return 'assertive'
  return 'polite'
})

const toastTitle = computed(() => {
  if (props.tone === 'success') return 'Acción completada'
  if (props.tone === 'error') return 'No se pudo completar la acción'
  return 'Aviso'
})

const toastIcon = computed(() => {
  if (props.tone === 'success') return '✓'
  if (props.tone === 'error') return '!'
  return 'i'
})

function close() {
  emit('close')
}

onMounted(() => {
  if (props.tone !== 'success' || props.duration <= 0) return
  closeTimer = window.setTimeout(close, props.duration)
})

onBeforeUnmount(() => {
  if (closeTimer !== null) window.clearTimeout(closeTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <section
        class="catalog-toast"
        :class="'tone-' + tone"
        :role="toastRole"
        :aria-live="toastLive"
        aria-atomic="true"
      >
        <span class="toast-icon" aria-hidden="true">{{ toastIcon }}</span>
        <div class="toast-content">
          <strong>{{ toastTitle }}</strong>
          <p>{{ message }}</p>
          <button v-if="actionLabel" type="button" class="toast-action" @click="emit('action')">
            {{ actionLabel }}
          </button>
        </div>
        <button type="button" class="toast-close" aria-label="Cerrar notificación" @click="close">×</button>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.catalog-toast {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 1200;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: .75rem;
  align-items: start;
  width: min(calc(100vw - 2rem), 390px);
  padding: 1rem;
  border: 1px solid var(--color-border-medium);
  border-left: 5px solid var(--color-info);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  color: var(--color-text-body);
  box-shadow: var(--shadow-lg);
}

.tone-success { border-left-color: var(--color-success); }
.tone-error { border-left-color: var(--color-danger); }
.toast-icon { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: var(--radius-full); background: var(--color-primary-subtle); color: var(--color-info); font-weight: 800; }
.tone-success .toast-icon { color: var(--color-success-strong); }
.tone-error .toast-icon { color: var(--color-danger-strong); }
.toast-content { min-width: 0; }
.toast-content strong { display: block; color: var(--color-text-title); font-size: .9rem; }
.toast-content p { margin-top: .2rem; color: var(--color-text-body); font-size: .86rem; line-height: 1.45; overflow-wrap: anywhere; }
.toast-action { margin-top: .55rem; color: var(--color-primary); font-weight: 700; text-decoration: underline; }
.toast-close { width: 2rem; height: 2rem; border-radius: var(--radius-full); color: var(--color-text-muted); font-size: 1.35rem; line-height: 1; }
.toast-close:hover { background: var(--color-bg-subtle); color: var(--color-text-title); }
.toast-enter-active, .toast-leave-active { transition: opacity var(--transition-normal), transform var(--transition-normal); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }

@media (min-width: 641px) {
  .catalog-toast { top: calc(var(--navbar-height) + 1rem); bottom: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active, .toast-leave-active { transition: none; }
}
</style>
