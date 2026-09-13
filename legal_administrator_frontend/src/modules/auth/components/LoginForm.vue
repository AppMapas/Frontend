<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['submit'])
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const touched = ref(false)

const normalizedEmail = computed(() => email.value.trim())
const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail.value))
const emailError = computed(() => touched.value && !isEmailValid.value)
const passwordError = computed(() => touched.value && password.value.length === 0)

const handleSubmit = () => {
  if (props.loading) return

  touched.value = true

  if (!isEmailValid.value || !password.value) return

  emit('submit', {
    email: normalizedEmail.value,
    password: password.value,
  })
}
</script>

<template>
  <form class="login-form" novalidate @submit.prevent="handleSubmit">
    <div class="field-group">
      <label for="login-email">Correo electrónico</label>
      <div class="input-shell" :class="{ invalid: emailError }">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/></svg>
        <input
          id="login-email"
          v-model="email"
          type="email"
          name="email"
          inputmode="email"
          autocomplete="username"
          placeholder="nombre@correo.com"
          :aria-invalid="emailError"
          :aria-describedby="emailError ? 'login-email-error' : undefined"
          :disabled="loading"
          required
        />
      </div>
      <small v-if="emailError" id="login-email-error" class="field-error">Ingresa un correo electrónico válido.</small>
    </div>

    <div class="field-group">
      <div class="label-row">
        <label for="login-password">Contraseña</label>
      </div>
      <div class="input-shell" :class="{ invalid: passwordError }">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        <input
          id="login-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          name="password"
          autocomplete="current-password"
          placeholder="Ingresa tu contraseña"
          :aria-invalid="passwordError"
          :aria-describedby="passwordError ? 'login-password-error' : undefined"
          :disabled="loading"
          required
        />
        <button
          class="password-toggle"
          type="button"
          :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          :aria-pressed="showPassword"
          :disabled="loading"
          @click="showPassword = !showPassword"
        >
          <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.5 10.5 0 0 1 12 4c5.5 0 9 6 9 6a16 16 0 0 1-2.1 2.8M6.6 6.6C4.3 8.1 3 10 3 10s3.5 6 9 6c1.2 0 2.3-.3 3.3-.7"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
        </button>
      </div>
      <small v-if="passwordError" id="login-password-error" class="field-error">Ingresa tu contraseña.</small>
    </div>

    <div v-if="error" class="form-error" role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg>
      <span>{{ error }}</span>
    </div>

    <button class="submit-button" type="submit" :disabled="loading">
      <span v-if="loading" class="spinner" aria-hidden="true"></span>
      <span>{{ loading ? 'Validando acceso…' : 'Iniciar sesión' }}</span>
      <span v-if="!loading" class="arrow" aria-hidden="true">→</span>
    </button>
  </form>
</template>

<style scoped>
.login-form { display: flex; flex-direction: column; gap: 1.25rem; }
.field-group { display: flex; flex-direction: column; gap: .48rem; }
.label-row { display: flex; align-items: center; justify-content: space-between; }
label { color: #244b50; font-size: .76rem; font-weight: 700; }
.input-shell { display: flex; min-height: 3.2rem; align-items: center; gap: .72rem; border: 1px solid rgba(68,135,143,.24); border-radius: .65rem; padding: 0 .9rem; background: #fff; transition: border-color .18s, box-shadow .18s; }
.input-shell:focus-within { border-color: #5a9b95; box-shadow: 0 0 0 3px rgba(90,155,149,.12); }
.input-shell.invalid { border-color: #ff8591; }
.input-shell > svg { width: 1.08rem; flex: none; fill: none; stroke: #789194; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
input { width: 100%; min-width: 0; border: 0; padding: .75rem 0; color: #173f46; outline: 0; background: transparent; font-size: .82rem; }
input::placeholder { color: #9ba9aa; }
input:disabled { color: #789092; cursor: wait; }
.password-toggle { display: grid; width: 2rem; height: 2rem; flex: none; place-items: center; border: 0; border-radius: .4rem; color: #6b8587; background: transparent; cursor: pointer; }
.password-toggle:hover:not(:disabled) { background: rgba(140,170,162,.12); }
.password-toggle:disabled { cursor: wait; opacity: .6; }
.password-toggle svg { width: 1.05rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
.field-error { color: #c85f69; font-size: .67rem; }
.form-error { display: flex; align-items: flex-start; gap: .65rem; border-left: 3px solid #ff8591; padding: .8rem .9rem; color: #8e454c; background: rgba(255,133,145,.1); font-size: .72rem; line-height: 1.45; }
.form-error svg { width: 1rem; flex: none; margin-top: .05rem; fill: none; stroke: currentColor; stroke-width: 1.8; }
.submit-button { display: flex; min-height: 3.25rem; align-items: center; justify-content: center; gap: .65rem; margin-top: .2rem; border: 0; border-radius: .65rem .65rem .65rem .18rem; color: #fff; background: #ff8591; box-shadow: 0 11px 24px rgba(255,133,145,.28); font-size: .78rem; font-weight: 700; cursor: pointer; transition: transform .18s, box-shadow .18s, opacity .18s; }
.submit-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 28px rgba(255,133,145,.36); }
.submit-button:disabled { opacity: .68; cursor: wait; }.arrow { font-size: 1.05rem; }
.spinner { width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
