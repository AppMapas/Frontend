<script setup>
import { onBeforeUnmount, ref } from 'vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import TwoFactorDisableDialog from './TwoFactorDisableDialog.vue'
import TwoFactorSetupDialog from './TwoFactorSetupDialog.vue'

const authStore = useAuthStore()
const setupDialogOpen = ref(false)
const disableDialogOpen = ref(false)
const successMessage = ref('')

const beginSetup = async () => {
  successMessage.value = ''
  setupDialogOpen.value = true

  try {
    await authStore.beginTwoFactorSetup()
  } catch {
    // La store expone el mensaje y el diálogo permite reintentar.
  }
}

const closeSetup = () => {
  if (authStore.isTwoFactorLoading) return
  authStore.cancelTwoFactorSetup()
  setupDialogOpen.value = false
}

const confirmSetup = async (code) => {
  try {
    await authStore.confirmTwoFactorSetup(code)
    setupDialogOpen.value = false
    successMessage.value = 'La autenticación en dos pasos quedó activada correctamente.'
  } catch {
    // El error permanece en la store para permitir corregir el código.
  }
}

const openDisableDialog = () => {
  successMessage.value = ''
  authStore.cancelTwoFactorSetup()
  disableDialogOpen.value = true
}

const closeDisableDialog = () => {
  if (authStore.isTwoFactorLoading) return
  authStore.cancelTwoFactorSetup()
  disableDialogOpen.value = false
}

const confirmDisable = async (code) => {
  try {
    await authStore.disableTwoFactor(code)
    disableDialogOpen.value = false
    successMessage.value = 'La autenticación en dos pasos fue desactivada.'
  } catch {
    // El diálogo muestra el error proporcionado por la store.
  }
}

onBeforeUnmount(() => {
  authStore.cancelTwoFactorSetup()
})
</script>

<template>
  <BaseCard class="two-factor-card" padding="none">
    <div class="security-header">
      <div class="security-title">
        <span class="shield-icon" :class="{ active: authStore.twoFactorEnabled }" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8.3 7 10 4.2-1.7 7-5.4 7-10V6l-7-3Z"/><path v-if="authStore.twoFactorEnabled" d="m9.2 12 1.8 1.8 3.9-4.1"/><path v-else d="M12 8v5M12 16.5h.01"/></svg>
        </span>
        <div>
          <p class="section-eyebrow">Seguridad</p>
          <h3>Autenticación en dos pasos</h3>
          <p>Añade una verificación temporal además de tu contraseña.</p>
        </div>
      </div>
      <BaseBadge :variant="authStore.twoFactorEnabled ? 'teal' : 'neutral'">
        <span class="status-dot" :class="{ active: authStore.twoFactorEnabled }" aria-hidden="true"></span>
        {{ authStore.twoFactorEnabled ? 'Activada' : 'Desactivada' }}
      </BaseBadge>
    </div>

    <div class="security-body">
      <div class="security-summary">
        <strong>{{ authStore.twoFactorEnabled ? 'Tu cuenta tiene protección reforzada' : 'Refuerza la seguridad de tu cuenta' }}</strong>
        <p v-if="authStore.twoFactorEnabled">
          Al iniciar sesión se solicitará un código de seis dígitos generado por tu aplicación autenticadora.
        </p>
        <p v-else>
          Incluso si alguien obtiene tu contraseña, necesitará el código temporal de tu dispositivo para ingresar.
        </p>

        <ul class="benefit-list">
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg>
            Códigos temporales que cambian cada pocos segundos
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg>
            Compatible con aplicaciones estándar TOTP
          </li>
        </ul>
      </div>

      <div class="security-action-panel" :class="{ active: authStore.twoFactorEnabled }">
        <span class="action-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="7" y="9" width="10" height="11" rx="2"/><path d="M9 9V7a3 3 0 0 1 6 0v2M12 13v3"/></svg>
        </span>
        <p>{{ authStore.twoFactorEnabled ? 'La protección está funcionando.' : 'La configuración toma menos de dos minutos.' }}</p>
        <BaseButton
          v-if="!authStore.twoFactorEnabled"
          variant="secondary"
          :loading="authStore.isTwoFactorLoading && !setupDialogOpen"
          @click="beginSetup"
        >
          Configurar 2FA
        </BaseButton>
        <BaseButton v-else variant="outline" @click="openDisableDialog">Administrar protección</BaseButton>
      </div>
    </div>

    <div v-if="successMessage" class="success-message" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>
      <span>{{ successMessage }}</span>
      <button type="button" aria-label="Cerrar mensaje" @click="successMessage = ''">×</button>
    </div>
  </BaseCard>

  <TwoFactorSetupDialog
    :open="setupDialogOpen"
    :setup="authStore.twoFactorSetup"
    :loading="authStore.isTwoFactorLoading"
    :error="authStore.twoFactorError"
    @close="closeSetup"
    @retry="beginSetup"
    @confirm="confirmSetup"
  />

  <TwoFactorDisableDialog
    :open="disableDialogOpen"
    :loading="authStore.isTwoFactorLoading"
    :error="authStore.twoFactorError"
    @close="closeDisableDialog"
    @confirm="confirmDisable"
  />
</template>

<style scoped>
.two-factor-card { grid-column: 1 / -1; overflow: hidden; }
.security-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--color-border-subtle); padding: 1.4rem 1.5rem; }
.security-title { display: flex; align-items: flex-start; gap: 1rem; }
.security-title h3 { margin: 0.1rem 0 0.25rem; font-size: 1.1rem; }
.security-title p:last-child { margin: 0; color: var(--color-text-muted); font-size: 0.8rem; }
.section-eyebrow { margin: 0; color: var(--color-teal); font-family: var(--font-mono); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; }
.shield-icon { display: grid; width: 2.75rem; height: 2.75rem; flex: none; place-items: center; border-radius: var(--radius-md); color: var(--color-text-muted); background: var(--color-bg-subtle); transition: color var(--transition-normal), background var(--transition-normal); }
.shield-icon.active { color: var(--color-deep-teal); background: rgba(90, 155, 149, 0.15); }
.shield-icon svg { width: 1.5rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.status-dot { width: 0.42rem; height: 0.42rem; border-radius: 50%; background: var(--color-text-subtle); }
.status-dot.active { background: var(--color-success); box-shadow: 0 0 0 3px rgba(78, 159, 118, 0.12); }
.security-body { display: grid; grid-template-columns: 1fr minmax(260px, 0.42fr); gap: 1.5rem; padding: 1.5rem; }
.security-summary strong { color: var(--color-text-title); font-size: 0.92rem; }
.security-summary > p { max-width: 670px; margin: 0.35rem 0 1rem; color: var(--color-text-muted); font-size: 0.82rem; }
.benefit-list { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; margin: 0; padding: 0; list-style: none; }
.benefit-list li { display: flex; align-items: center; gap: 0.4rem; color: var(--color-text-body); font-size: 0.74rem; }
.benefit-list svg { width: 1rem; fill: none; stroke: var(--color-success); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2; }
.security-action-panel { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 0.65rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); padding: 1rem; text-align: center; background: var(--color-bg-subtle); }
.security-action-panel.active { border-color: rgba(90, 155, 149, 0.25); background: rgba(90, 155, 149, 0.07); }
.security-action-panel p { margin: 0; color: var(--color-text-muted); font-size: 0.72rem; }
.action-icon { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: 50%; color: var(--color-deep-teal); background: #fff; }
.action-icon svg { width: 1rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
.success-message { display: flex; align-items: center; gap: 0.6rem; border-top: 1px solid rgba(78, 159, 118, 0.2); padding: 0.8rem 1.5rem; color: #367454; background: rgba(78, 159, 118, 0.08); font-size: 0.76rem; font-weight: 600; }
.success-message svg { width: 1.1rem; flex: none; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.9; }
.success-message button { margin-left: auto; color: currentColor; font-size: 1.2rem; line-height: 1; }
@media (max-width: 760px) { .security-body { grid-template-columns: 1fr; }.security-header { align-items: stretch; flex-direction: column; }.security-header :deep(.base-badge) { align-self: flex-start; } }
@media (max-width: 480px) { .security-header, .security-body { padding: 1.1rem; }.shield-icon { display: none; }.benefit-list { flex-direction: column; }.success-message { padding: 0.8rem 1.1rem; } }
</style>
