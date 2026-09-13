<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoginForm from '../components/LoginForm.vue'
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

const handleLogin = async (credentials) => {
  loading.value = true
  error.value = ''

  try {
    const result = await authStore.login(credentials)

    if (result.requiresTwoFactor) {
      await router.push({
        name: 'two-factor',
        query: { redirect: getRedirect() },
      })
      return
    }

    await router.replace(getRedirect())
  } catch (requestError) {
    error.value = requestError.message || 'No fue posible iniciar sesión.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="login-page" aria-labelledby="login-title">
    <header>
      <span class="auth-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
      </span>
      <p>Bienvenido de nuevo</p>
      <h2 id="login-title">Iniciar sesión</h2>
      <span>Ingresa tus credenciales para acceder a la plataforma.</span>
    </header>

    <LoginForm :loading="loading" :error="error" @submit="handleLogin" />

    <p class="support-copy">¿Tienes problemas para ingresar? Comunícate con el administrador del sistema.</p>
  </section>
</template>

<style scoped>
.login-page { width: min(100%, 28rem); padding: 2.25rem 0; }
header { margin-bottom: 2rem; text-align: center; }
.auth-icon { display: grid; width: 3.25rem; height: 3.25rem; margin: 0 auto 1.25rem; place-items: center; border-radius: .85rem .85rem .85rem .2rem; color: #fff; background: #44878f; box-shadow: 6px 6px 0 rgba(255,133,145,.28); }
.auth-icon svg { width: 1.4rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
header p { margin: 0 0 .55rem; color: #ff8591; font-size: .65rem; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
header h2 { margin: 0 0 .65rem; color: #173f46; font-family: Georgia, serif; font-size: 2.25rem; letter-spacing: -.035em; }
header > span:last-child { color: #718789; font-size: .78rem; }
.support-copy { margin: 1.6rem 0 0; color: #829496; font-size: .7rem; text-align: center; }
</style>
