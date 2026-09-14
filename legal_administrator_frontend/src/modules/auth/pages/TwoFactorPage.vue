<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TwoFactorForm from '../components/TwoFactorForm.vue'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')

const getRedirect = () => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/terrenos'
}

const handleVerification = async (code) => {
  loading.value = true
  error.value = ''

  try {
    await authStore.verifyTwoFactor(code)
    await router.replace(getRedirect())
  } catch (requestError) {
    error.value = requestError.message || 'No fue posible verificar el código.'
  } finally {
    loading.value = false
  }
}

const returnToLogin = async () => {
  authStore.cancelTwoFactor()
  await router.replace({
    name: 'login',
    query: { redirect: getRedirect() },
  })
}
</script>

<template>
  <section class="two-factor-page" aria-labelledby="two-factor-title">
    <header>
      <span class="auth-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>
      </span>
      <p>Verificación de seguridad</p>
      <h2 id="two-factor-title">Confirma tu identidad</h2>
      <span>Ingresa el código de seis dígitos generado por tu aplicación autenticadora.</span>
    </header>

    <div class="account-hint">
      <span>Enviado para</span>
      <strong>{{ authStore.pendingEmail }}</strong>
    </div>

    <TwoFactorForm :loading="loading" :error="error" @submit="handleVerification" />

    <button class="back-to-login" type="button" @click="returnToLogin">
      <span>←</span> Volver al inicio de sesión
    </button>
  </section>
</template>

<style scoped>
.two-factor-page { width: min(100%, 29rem); padding: 2.25rem 0; }
header { margin-bottom: 1.4rem; text-align: center; }
.auth-icon { display: grid; width: 3.25rem; height: 3.25rem; margin: 0 auto 1.25rem; place-items: center; border-radius: .85rem .85rem .85rem .2rem; color: #fff; background: #44878f; box-shadow: 6px 6px 0 rgba(255,133,145,.28); }
.auth-icon svg { width: 1.4rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
header p { margin: 0 0 .55rem; color: #ff8591; font-size: .65rem; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
header h2 { margin: 0 0 .65rem; color: #173f46; font-family: Georgia, serif; font-size: 2.1rem; letter-spacing: -.035em; }
header > span:last-child { display: block; max-width: 25rem; margin: 0 auto; color: #718789; font-size: .76rem; line-height: 1.6; }
.account-hint { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.35rem; border: 1px solid rgba(68,135,143,.15); padding: .75rem .9rem; background: rgba(140,170,162,.08); font-size: .68rem; }
.account-hint span { color: #7f9293; }.account-hint strong { overflow: hidden; max-width: 70%; color: #44878f; text-overflow: ellipsis; white-space: nowrap; }
.back-to-login { display: flex; align-items: center; gap: .45rem; margin: 1.5rem auto 0; border: 0; color: #627b7e; background: transparent; font-size: .7rem; font-weight: 600; cursor: pointer; }.back-to-login span { color: #ff8591; font-size: .95rem; }
</style>
