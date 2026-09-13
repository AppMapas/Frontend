<script setup>
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import IconClose from '@/assets/icons/IconClose.vue'
import OtpInput from './OtpInput.vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  setup: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'confirm', 'retry'])
const code = ref('')
const touched = ref(false)
const manualKeyVisible = ref(false)
const copyStatus = ref('idle')
const hasSetup = computed(() => Boolean(props.setup?.qrCodeUri && props.setup?.manualEntryKey))
const isCodeValid = computed(() => /^\d{6}$/.test(code.value))

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    code.value = ''
    touched.value = false
    manualKeyVisible.value = false
    copyStatus.value = 'idle'
  },
)

watch(
  () => props.setup?.qrCodeUri,
  (qrCodeUri, previousQrCodeUri) => {
    if (!qrCodeUri || qrCodeUri === previousQrCodeUri) return
    code.value = ''
    touched.value = false
    manualKeyVisible.value = false
    copyStatus.value = 'idle'
  },
)

const handleSubmit = () => {
  touched.value = true
  if (!isCodeValid.value || props.loading) return
  emit('confirm', code.value)
}

const copyManualKey = async () => {
  if (!props.setup?.manualEntryKey) return

  try {
    await navigator.clipboard.writeText(props.setup.manualEntryKey)
    copyStatus.value = 'copied'
  } catch {
    copyStatus.value = 'error'
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title-id="setup-2fa-title"
    description-id="setup-2fa-description"
    :dismissible="!loading"
    @close="emit('close')"
  >
    <header class="dialog-header">
      <div class="dialog-heading">
        <span class="security-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8.3 7 10 4.2-1.7 7-5.4 7-10V6l-7-3Z"/><path d="m9.2 12 1.8 1.8 3.9-4.1"/></svg>
        </span>
        <div>
          <p class="dialog-eyebrow">Seguridad de la cuenta</p>
          <h2 id="setup-2fa-title">Configurar autenticación en dos pasos</h2>
          <p id="setup-2fa-description">Vincula una aplicación autenticadora y confirma el código generado.</p>
        </div>
      </div>
      <button class="close-button" type="button" aria-label="Cerrar configuración" :disabled="loading" @click="emit('close')">
        <IconClose :size="20" />
      </button>
    </header>

    <div class="dialog-content">
      <div v-if="loading && !hasSetup" class="setup-loading" role="status">
        <span class="large-spinner" aria-hidden="true"></span>
        <strong>Generando configuración segura…</strong>
        <p>Estamos preparando un código exclusivo para tu cuenta.</p>
      </div>

      <div v-else-if="!hasSetup" class="setup-unavailable">
        <span class="notice-icon" aria-hidden="true">!</span>
        <h3>No fue posible generar el código</h3>
        <p>{{ error || 'Inténtalo nuevamente. Tu configuración anterior no será reutilizada.' }}</p>
        <BaseButton variant="secondary" :loading="loading" @click="emit('retry')">Intentar nuevamente</BaseButton>
      </div>

      <form v-else class="setup-form" novalidate @submit.prevent="handleSubmit">
        <section class="setup-step" aria-labelledby="setup-step-one">
          <div class="step-heading">
            <span>1</span>
            <div>
              <h3 id="setup-step-one">Escanea el código QR</h3>
              <p>Abre Google Authenticator, Microsoft Authenticator o una aplicación compatible con TOTP.</p>
            </div>
          </div>

          <div class="qr-section">
            <div class="qr-frame">
              <img :src="setup.qrCodeUri" alt="Código QR para vincular la aplicación autenticadora" />
            </div>
            <div class="manual-key-panel">
              <p class="manual-label">¿No puedes escanearlo?</p>
              <p>Introduce esta clave manualmente en tu aplicación.</p>
              <div class="manual-key-row">
                <code>{{ manualKeyVisible ? setup.manualEntryKey : '•••• •••• •••• ••••' }}</code>
                <button
                  type="button"
                  class="key-action"
                  :aria-label="manualKeyVisible ? 'Ocultar clave manual' : 'Mostrar clave manual'"
                  :aria-pressed="manualKeyVisible"
                  @click="manualKeyVisible = !manualKeyVisible"
                >
                  {{ manualKeyVisible ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
              <button type="button" class="copy-button" @click="copyManualKey">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
                {{ copyStatus === 'copied' ? 'Clave copiada' : 'Copiar clave' }}
              </button>
              <small v-if="copyStatus === 'error'" class="copy-error" role="status">No se pudo copiar. Muestra la clave y cópiala manualmente.</small>
            </div>
          </div>
        </section>

        <section class="setup-step" aria-labelledby="setup-step-two">
          <div class="step-heading">
            <span>2</span>
            <div>
              <h3 id="setup-step-two">Confirma el código</h3>
              <p>Ingresa el código vigente de seis dígitos. Esta configuración caduca en 15 minutos.</p>
            </div>
          </div>

          <div class="otp-field">
            <OtpInput v-model="code" id-prefix="setup-otp" :disabled="loading" :invalid="touched && !isCodeValid" />
            <small v-if="touched && !isCodeValid" class="field-error">Ingresa los seis dígitos antes de continuar.</small>
          </div>
        </section>

        <div v-if="error" class="error-notice" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>
          <div>
            <strong>No se pudo activar 2FA</strong>
            <p>{{ error }}</p>
            <button type="button" :disabled="loading" @click="emit('retry')">Generar un QR nuevo</button>
            <small>El nuevo QR reemplazará al anterior.</small>
          </div>
        </div>

        <footer class="dialog-actions">
          <BaseButton variant="ghost" :disabled="loading" @click="emit('close')">Cancelar</BaseButton>
          <BaseButton type="submit" variant="secondary" :loading="loading" :disabled="!isCodeValid">
            Activar protección 2FA
          </BaseButton>
        </footer>
      </form>
    </div>
  </BaseModal>
</template>

<style scoped>
.dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--color-border-subtle); padding: 1.4rem 1.5rem; }
.dialog-heading { display: flex; align-items: flex-start; gap: 1rem; }
.dialog-heading h2 { margin: 0.1rem 0 0.35rem; font-size: 1.25rem; }
.dialog-heading p { margin: 0; color: var(--color-text-muted); font-size: 0.82rem; line-height: 1.5; }
.dialog-eyebrow { color: var(--color-teal) !important; font-family: var(--font-mono); font-size: 0.68rem !important; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.security-icon { display: grid; width: 2.75rem; height: 2.75rem; flex: none; place-items: center; border-radius: var(--radius-md); color: var(--color-deep-teal); background: rgba(90, 155, 149, 0.14); }
.security-icon svg { width: 1.45rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.close-button { display: grid; width: 2.25rem; height: 2.25rem; flex: none; place-items: center; border-radius: var(--radius-sm); color: var(--color-text-muted); }
.close-button:hover:not(:disabled) { color: var(--color-text-title); background: var(--color-bg-subtle); }
.close-button:disabled { opacity: 0.45; cursor: wait; }
.dialog-content { padding: 1.5rem; }
.setup-form, .setup-step { display: flex; flex-direction: column; }
.setup-form { gap: 1.5rem; }
.setup-step { gap: 1rem; }
.setup-step + .setup-step { border-top: 1px solid var(--color-border-subtle); padding-top: 1.5rem; }
.step-heading { display: flex; align-items: flex-start; gap: 0.8rem; }
.step-heading > span { display: grid; width: 1.75rem; height: 1.75rem; flex: none; place-items: center; border-radius: 50%; color: #fff; background: var(--color-deep-teal); font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; }
.step-heading h3 { margin: 0 0 0.18rem; font-size: 0.95rem; }
.step-heading p { margin: 0; color: var(--color-text-muted); font-size: 0.78rem; line-height: 1.5; }
.qr-section { display: grid; grid-template-columns: 180px 1fr; align-items: center; gap: 1.2rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); padding: 1rem; background: var(--color-bg-subtle); }
.qr-frame { display: grid; aspect-ratio: 1; place-items: center; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); padding: 0.65rem; background: #fff; }
.qr-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.manual-key-panel > p { margin: 0; color: var(--color-text-muted); font-size: 0.76rem; line-height: 1.5; }
.manual-label { margin-bottom: 0.15rem !important; color: var(--color-text-title) !important; font-weight: 700; }
.manual-key-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.75rem 0 0.55rem; }
.manual-key-row code { min-width: 0; flex: 1; overflow: hidden; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-xs); padding: 0.55rem 0.65rem; color: var(--color-deep-teal); background: #fff; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-overflow: ellipsis; white-space: nowrap; }
.key-action, .copy-button { color: var(--color-deep-teal); font-size: 0.72rem; font-weight: 700; }
.key-action:hover, .copy-button:hover { color: var(--color-coral); }
.copy-button { display: inline-flex; align-items: center; gap: 0.4rem; }
.copy-button svg { width: 0.95rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
.copy-error { display: block; margin-top: 0.35rem; color: var(--color-danger); font-size: 0.68rem; }
.otp-field { padding-left: 2.55rem; }
.field-error { display: block; margin-top: 0.5rem; color: var(--color-danger); font-size: 0.7rem; }
.error-notice { display: flex; align-items: flex-start; gap: 0.7rem; border-left: 3px solid var(--color-danger); padding: 0.85rem 1rem; color: #8e454c; background: rgba(217, 83, 79, 0.08); }
.error-notice > svg { width: 1.1rem; flex: none; margin-top: 0.08rem; fill: none; stroke: currentColor; stroke-width: 1.8; }
.error-notice strong { font-size: 0.78rem; }
.error-notice p { margin: 0.12rem 0 0.35rem; color: inherit; font-size: 0.73rem; line-height: 1.45; }
.error-notice button { color: var(--color-deep-teal); font-size: 0.72rem; font-weight: 700; text-decoration: underline; }
.error-notice button:disabled { opacity: 0.55; cursor: wait; }
.error-notice small { display: block; margin-top: 0.15rem; font-size: 0.65rem; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 0.65rem; border-top: 1px solid var(--color-border-subtle); padding-top: 1.25rem; }
.setup-loading, .setup-unavailable { display: flex; min-height: 260px; align-items: center; justify-content: center; flex-direction: column; text-align: center; }
.setup-loading strong, .setup-unavailable h3 { margin: 0.85rem 0 0.25rem; font-size: 1rem; }
.setup-loading p, .setup-unavailable p { max-width: 380px; margin: 0 0 1rem; color: var(--color-text-muted); font-size: 0.78rem; }
.large-spinner { width: 2.3rem; height: 2.3rem; border: 3px solid rgba(90, 155, 149, 0.2); border-top-color: var(--color-teal); border-radius: 50%; animation: spin 0.75s linear infinite; }
.notice-icon { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border-radius: 50%; color: #fff; background: var(--color-danger); font-family: var(--font-mono); font-weight: 700; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 600px) { .dialog-header, .dialog-content { padding: 1.1rem; }.security-icon { display: none; }.qr-section { grid-template-columns: 1fr; }.qr-frame { width: 180px; margin: 0 auto; }.otp-field { padding-left: 0; }.dialog-actions { flex-direction: column-reverse; }.dialog-actions :deep(.base-button) { width: 100%; } }
</style>
