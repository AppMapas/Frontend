<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  titleId: {
    type: String,
    required: true,
  },
  descriptionId: {
    type: String,
    default: undefined,
  },
  dismissible: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['close'])
const dialog = ref(null)
let previousActiveElement = null
let previousBodyOverflow = ''

const requestClose = () => {
  if (props.dismissible) emit('close')
}

const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    requestClose()
    return
  }

  if (event.key !== 'Tab' || !dialog.value) return

  const focusableElements = Array.from(dialog.value.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
  ))

  if (!focusableElements.length) {
    event.preventDefault()
    dialog.value.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previousActiveElement = document.activeElement
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeydown)

      await nextTick()
      const initialFocus = dialog.value?.querySelector('[autofocus], button, input, [tabindex]:not([tabindex="-1"])')
      initialFocus?.focus()
      return
    }

    document.body.style.overflow = previousBodyOverflow
    document.removeEventListener('keydown', handleKeydown)
    previousActiveElement?.focus?.()
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-backdrop" @mousedown.self="requestClose">
        <section
          ref="dialog"
          class="modal-dialog"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="titleId"
          :aria-describedby="descriptionId"
        >
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 1.5rem;
  background: rgba(20, 39, 37, 0.58);
  backdrop-filter: blur(5px);
}

.modal-dialog {
  width: min(100%, 660px);
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
  border: 1px solid rgba(140, 170, 162, 0.32);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  box-shadow: 0 24px 64px rgba(23, 63, 70, 0.22);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--transition-normal);
}

.modal-fade-enter-active .modal-dialog,
.modal-fade-leave-active .modal-dialog {
  transition: transform var(--transition-normal), opacity var(--transition-normal);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-dialog,
.modal-fade-leave-to .modal-dialog {
  opacity: 0;
  transform: translateY(12px) scale(0.985);
}

@media (max-width: 640px) {
  .modal-backdrop {
    align-items: end;
    padding: 0;
  }

  .modal-dialog {
    width: 100%;
    max-height: calc(100vh - 1rem);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
}
</style>
