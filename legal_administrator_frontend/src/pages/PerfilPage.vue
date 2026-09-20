<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import IconUser from '@/assets/icons/IconUser.vue'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import OtpInput from '@/modules/auth/components/two-factor/OtpInput.vue'
import TwoFactorSettings from '@/modules/auth/components/two-factor/TwoFactorSettings.vue'
import { formatDate } from '@/utils/formatters'

const authStore = useAuthStore()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const twoFactorCode = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')
const profileReady = ref(false)
const displayedUser = computed(() => profileReady.value ? authStore.user : null)
const passwordValid = computed(() => currentPassword.value.length > 0
  && newPassword.value.length >= 6
  && newPassword.value === confirmPassword.value
  && newPassword.value !== currentPassword.value
  && (!authStore.twoFactorEnabled || /^\d{6}$/.test(twoFactorCode.value)))

async function loadProfile() {
  profileReady.value = false
  try {
    await authStore.loadCurrentUser()
    profileReady.value = true
  } catch {
    // La store expone el error para mostrarlo en la vista.
  }
}

async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''
  if (!currentPassword.value) {
    passwordError.value = 'Ingresa tu contraseña actual.'
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = 'La nueva contraseña debe tener al menos 6 caracteres.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Las contraseñas no coinciden.'
    return
  }
  if (newPassword.value === currentPassword.value) {
    passwordError.value = 'La nueva contraseña debe ser diferente de la contraseña actual.'
    return
  }
  if (authStore.twoFactorEnabled && !/^\d{6}$/.test(twoFactorCode.value)) {
    passwordError.value = 'Ingresa el código de autenticación de 6 dígitos.'
    return
  }

  passwordLoading.value = true
  try {
    await authStore.updatePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      twoFactorCode: twoFactorCode.value,
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    twoFactorCode.value = ''
    passwordSuccess.value = 'La contraseña fue actualizada correctamente.'
  } catch (error) {
    passwordError.value = error?.message || 'No fue posible actualizar la contraseña.'
  } finally {
    passwordLoading.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <div class="perfil-page">
    <PageHeader
      title="Perfil de Usuario"
      eyebrow="Configuración de Cuenta"
      subtitle="Datos del operador, rol asignado en el sistema y parámetros de sesión."
    />

    <p v-if="authStore.profileError" class="profile-feedback error" role="alert">
      {{ authStore.profileError }}
      <button type="button" @click="loadProfile">Reintentar</button>
    </p>
    <p v-else-if="authStore.isProfileLoading" class="profile-feedback" role="status">Cargando información del perfil…</p>

    <div class="profile-grid">
      <BaseCard>
        <div class="profile-hero">
          <div class="profile-avatar-large">
            <IconUser :size="42" color="#FFFFFF" />
          </div>
          <div class="profile-title-info">
            <h2>{{ displayedUser?.name || '—' }}</h2>
            <p class="role-tag">{{ displayedUser?.role || '—' }}</p>
          </div>
        </div>

        <div class="profile-details-list">
          <div class="detail-item">
            <span class="detail-name">Correo Electrónico:</span>
            <span class="detail-value">{{ displayedUser?.email || '—' }}</span>
          </div>
          <div class="detail-item"><span class="detail-name">DPI:</span><span class="detail-value">{{ displayedUser?.dpi || '—' }}</span></div>
          <div class="detail-item"><span class="detail-name">Edad:</span><span class="detail-value">{{ displayedUser?.age ?? '—' }}</span></div>
          <div class="detail-item"><span class="detail-name">Estado civil:</span><span class="detail-value">{{ displayedUser?.maritalStatusName || '—' }}</span></div>
          <div class="detail-item"><span class="detail-name">Nacionalidad:</span><span class="detail-value">{{ displayedUser?.nationalityName || '—' }}</span></div>
          <div class="detail-item"><span class="detail-name">Usuario desde:</span><span class="detail-value">{{ formatDate(displayedUser?.createdAt) }}</span></div>
        </div>
      </BaseCard>

      <BaseCard class="password-card">
        <template #header><div><p class="section-eyebrow">Seguridad</p><h3>Cambiar contraseña</h3></div></template>
        <form class="password-form" novalidate @submit.prevent="changePassword">
          <p>Confirma tu identidad antes de definir una contraseña nueva de al menos seis caracteres.</p>
          <label>Contraseña actual
            <input v-model="currentPassword" type="password" autocomplete="current-password" :disabled="passwordLoading" required>
          </label>
          <label>Nueva contraseña
            <input v-model="newPassword" type="password" autocomplete="new-password" minlength="6" :disabled="passwordLoading" required>
          </label>
          <label>Confirmar nueva contraseña
            <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="6" :disabled="passwordLoading" required>
          </label>
          <div v-if="authStore.twoFactorEnabled" class="password-otp">
            <div>
              <strong>Verificación en dos pasos</strong>
              <p>Ingresa el código temporal de tu aplicación autenticadora.</p>
            </div>
            <OtpInput v-model="twoFactorCode" id-prefix="password-otp" :disabled="passwordLoading" :invalid="twoFactorCode.length > 0 && twoFactorCode.length < 6" />
          </div>
          <p v-if="passwordError" class="form-message error" role="alert">{{ passwordError }}</p>
          <p v-if="passwordSuccess" class="form-message success" role="status">{{ passwordSuccess }}</p>
          <BaseButton type="submit" :loading="passwordLoading" :disabled="!passwordValid || authStore.isProfileLoading || !displayedUser?.dpi">Actualizar contraseña</BaseButton>
        </form>
      </BaseCard>

      <TwoFactorSettings />
    </div>
  </div>
</template>

<style scoped>
.perfil-page {
  display: flex;
  flex-direction: column;
}

.profile-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 1.5rem;
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  margin-bottom: 1.5rem;
}

.profile-avatar-large {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: var(--color-avatar-bg);
  box-shadow: var(--shadow-md);
  flex-shrink: 0;
}

.profile-title-info h2 {
  font-size: 1.35rem;
  margin: 0 0 0.25rem 0;
}

.role-tag {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0 0 0.5rem 0;
}

.profile-details-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  padding: 0.4rem 0;
  border-bottom: 1px dashed var(--color-border-subtle);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-name {
  color: var(--color-text-muted);
  font-weight: 500;
}

.detail-value {
  color: var(--color-text-body);
  font-weight: 600;
}

.profile-feedback { display: flex; align-items: center; gap: .6rem; margin: 0 0 1rem; border-left: 4px solid var(--color-teal); border-radius: var(--radius-sm); padding: .75rem .9rem; background: var(--color-primary-subtle); font-size: .8rem; }
.profile-feedback.error { border-color: var(--color-danger); background: rgba(217,83,79,.09); }.profile-feedback button { color: var(--color-teal-strong); font-weight: 700; text-decoration: underline; }
.password-card h3 { margin: .1rem 0 0; font-size: 1rem; }.section-eyebrow { margin: 0; color: var(--color-teal); font-family: var(--font-mono); font-size: .66rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.password-form { display: grid; gap: .9rem; }.password-form > p:first-child { margin: 0; color: var(--color-text-muted); font-size: .8rem; }.password-form label { display: grid; gap: .35rem; color: var(--color-text-body); font-size: .78rem; font-weight: 700; }.password-form input { width: 100%; }.password-form :deep(.base-button) { justify-self: end; }
.password-otp { display: grid; gap: .7rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); padding: .8rem; background: var(--color-bg-subtle); }.password-otp strong { color: var(--color-text-title); font-size: .8rem; }.password-otp p { margin: .15rem 0 0; color: var(--color-text-muted); font-size: .74rem; line-height: 1.45; }.password-otp :deep(.otp-inputs) { gap: .35rem; }.password-otp :deep(.otp-inputs input) { height: 2.8rem; font-size: 1rem; background: var(--color-bg-card); }
.form-message { margin: 0; border-radius: var(--radius-sm); padding: .65rem .75rem; font-size: .76rem; }.form-message.error { color: var(--color-danger-strong); background: rgba(217,83,79,.09); }.form-message.success { color: var(--color-success-strong); background: rgba(78,159,118,.1); }

@media (max-width: 860px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) { .profile-hero { align-items: flex-start; }.profile-avatar-large { width: 64px; height: 64px; }.detail-item { align-items: flex-start; flex-direction: column; gap: .2rem; }.password-form :deep(.base-button) { width: 100%; } }
</style>
