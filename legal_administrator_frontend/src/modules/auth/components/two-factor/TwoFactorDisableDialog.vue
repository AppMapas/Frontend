<script setup>
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import IconClose from '@/assets/icons/IconClose.vue'
import OtpInput from './OtpInput.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close', 'confirm'])
const code = ref('')
const touched = ref(false)
const isCodeValid = computed(() => /^\d{6}$/.test(code.value))

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    code.value = ''
    touched.value = false
  },
)

const handleSubmit = () => {
  touched.value = true
  if (!isCodeValid.value || props.loading) return
  emit('confirm', code.value)
}
</script>

<template>
  <BaseModal
    :open="open"
    title-id="disable-2fa-title"
    description-id="disable-2fa-description"
    :dismissible="!loading"
    @close="emit('close')"
  >
    <header class="dialog-header">
      <div class="warning-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8.3 7 10 4.2-1.7 7-5.4 7-10V6l-7-3Z"/><path d="M12 8v5M12 16.5h.01"/></svg>
      </div>
      <div class="dialog-heading">
        <p class="dialog-eyebrow">Confirmación de seguridad</p>
        <h2 id="disable-2fa-title">Desactivar autenticación en dos pasos</h2>
        <p id="disable-2fa-description">Tu cuenta quedará protegida únicamente por la contraseña.</p>
      </div>
      <button class="close-button" type="button" aria-label="Cerrar confirmación" :disabled="loading" @click="emit('close')">
        <IconClose :size="20" />
      </button>
    </header>

    <form class="disable-form" novalidate @submit.prevent="handleSubmit">
      <div class="warning-notice">
        <strong>Esta acción reduce la seguridad de tu cuenta.</strong>
        <p>Para confirmar que eres tú, ingresa el código vigente de tu aplicación autenticadora.</p>
      </div>

      <fieldset>
        <legend>Código de autenticación</legend>
        <OtpInput v-model="code" id-prefix="disable-otp" :disabled="loading" :invalid="touched && !isCodeValid" />
        <small v-if="touched && !isCodeValid" class="field-error">Ingresa los seis dígitos antes de continuar.</small>
      </fieldset>

      <div v-if="error" class="error-notice" role="alert">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>
        <span>{{ error }}</span>
      </div>

      <footer class="dialog-actions">
        <BaseButton variant="ghost" :disabled="loading" @click="emit('close')">Mantener protección</BaseButton>
        <button class="danger-button" type="submit" :disabled="loading || !isCodeValid">
          <span v-if="loading" class="spinner" aria-hidden="true"></span>
          {{ loading ? 'Desactivando…' : 'Desactivar 2FA' }}
        </button>
      </footer>
    </form>
  </BaseModal>
</template>

<style scoped>
.dialog-header { display: grid; grid-template-columns: auto 1fr auto; align-items: flex-start; gap: 1rem; border-bottom: 1px solid var(--color-border-subtle); padding: 1.4rem 1.5rem; }
.warning-icon { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; border-radius: var(--radius-md); color: var(--color-danger); background: rgba(217, 83, 79, 0.1); }
.warning-icon svg { width: 1.45rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.dialog-heading h2 { margin: 0.1rem 0 0.35rem; font-size: 1.2rem; }
.dialog-heading > p:last-child { margin: 0; color: var(--color-text-muted); font-size: 0.8rem; }
.dialog-eyebrow { margin: 0; color: var(--color-danger); font-family: var(--font-mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.close-button { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border-radius: var(--radius-sm); color: var(--color-text-muted); }
.close-button:hover:not(:disabled) { color: var(--color-text-title); background: var(--color-bg-subtle); }
.close-button:disabled { opacity: 0.45; cursor: wait; }
.disable-form { display: flex; flex-direction: column; gap: 1.3rem; padding: 1.5rem; }
.warning-notice { border: 1px solid rgba(224, 159, 62, 0.3); border-radius: var(--radius-sm); padding: 0.85rem 1rem; background: rgba(224, 159, 62, 0.08); }
.warning-notice strong { color: var(--color-warning-strong); font-size: 0.8rem; }
.warning-notice p { margin: 0.2rem 0 0; color: var(--color-text-muted); font-size: 0.74rem; }
fieldset { min-width: 0; margin: 0; border: 0; padding: 0; }
legend { margin-bottom: 0.65rem; color: var(--color-text-title); font-size: 0.76rem; font-weight: 700; }
.field-error { display: block; margin-top: 0.5rem; color: var(--color-danger); font-size: 0.7rem; }
.error-notice { display: flex; align-items: flex-start; gap: 0.6rem; border-left: 3px solid var(--color-danger); padding: 0.8rem 0.9rem; color: var(--color-danger-strong); background: rgba(217, 83, 79, 0.08); font-size: 0.74rem; }
.error-notice svg { width: 1rem; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 0.65rem; border-top: 1px solid var(--color-border-subtle); padding-top: 1.2rem; }
.danger-button { display: inline-flex; height: 40px; align-items: center; justify-content: center; gap: 0.5rem; border-radius: var(--radius-sm); padding: 0.55rem 1.15rem; color: #fff; background: var(--color-danger); font-size: 0.875rem; font-weight: 700; transition: opacity var(--transition-fast), transform var(--transition-fast); }
.danger-button:hover:not(:disabled) { transform: translateY(-1px); background: #c94642; }
.danger-button:disabled { opacity: 0.55; cursor: not-allowed; }
.spinner { width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 600px) { .dialog-header { grid-template-columns: 1fr auto; padding: 1.1rem; }.warning-icon { display: none; }.disable-form { padding: 1.1rem; }.dialog-actions { flex-direction: column-reverse; }.dialog-actions :deep(.base-button), .danger-button { width: 100%; } }
</style>
