<script setup>
import { computed, ref } from 'vue'
import OtpInput from './two-factor/OtpInput.vue'

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
const code = ref('')
const touched = ref(false)
const isComplete = computed(() => /^\d{6}$/.test(code.value))

const handleSubmit = () => {
  if (props.loading) return

  touched.value = true
  if (isComplete.value) emit('submit', code.value)
}
</script>

<template>
  <form class="two-factor-form" novalidate @submit.prevent="handleSubmit">
    <fieldset>
      <legend>Código de verificación</legend>
      <OtpInput v-model="code" id-prefix="login-otp" :disabled="loading" :invalid="touched && !isComplete" autofocus />
      <small v-if="touched && !isComplete" class="field-error">Ingresa los seis dígitos del código.</small>
    </fieldset>

    <div v-if="error" class="form-error" role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg>
      <span>{{ error }}</span>
    </div>

    <button class="submit-button" type="submit" :disabled="loading">
      <span v-if="loading" class="spinner" aria-hidden="true"></span>
      <span>{{ loading ? 'Verificando…' : 'Verificar y continuar' }}</span>
      <span v-if="!loading" class="arrow" aria-hidden="true">→</span>
    </button>
  </form>
</template>

<style scoped>
.two-factor-form { display: flex; flex-direction: column; gap: 1.35rem; }
fieldset { min-width: 0; margin: 0; border: 0; padding: 0; }
legend { margin-bottom: .7rem; color: #244b50; font-size: .76rem; font-weight: 700; }
.field-error { display: block; margin-top: .55rem; color: #c85f69; font-size: .67rem; }
.form-error { display: flex; align-items: flex-start; gap: .65rem; border-left: 3px solid #ff8591; padding: .8rem .9rem; color: #8e454c; background: rgba(255,133,145,.1); font-size: .72rem; line-height: 1.45; }
.form-error svg { width: 1rem; flex: none; margin-top: .05rem; fill: none; stroke: currentColor; stroke-width: 1.8; }
.submit-button { display: flex; min-height: 3.25rem; align-items: center; justify-content: center; gap: .65rem; border: 0; border-radius: .65rem .65rem .65rem .18rem; color: #fff; background: #ff8591; box-shadow: 0 11px 24px rgba(255,133,145,.28); font-size: .78rem; font-weight: 700; cursor: pointer; transition: transform .18s, box-shadow .18s, opacity .18s; }
.submit-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 28px rgba(255,133,145,.36); }.submit-button:disabled { opacity: .68; cursor: wait; }.arrow { font-size: 1.05rem; }
.spinner { width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
