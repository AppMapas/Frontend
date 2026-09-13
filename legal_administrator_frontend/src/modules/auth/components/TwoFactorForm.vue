<script setup>
import { computed, nextTick, ref } from 'vue'

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
const digits = ref(['', '', '', '', '', ''])
const inputs = ref([])
const touched = ref(false)
const code = computed(() => digits.value.join(''))
const isComplete = computed(() => /^\d{6}$/.test(code.value))

const focusInput = (index) => {
  nextTick(() => inputs.value[index]?.focus())
}

const handleInput = (index, event) => {
  const value = event.target.value.replace(/\D/g, '')

  if (value.length > 1) {
    const pastedDigits = value.slice(0, 6).split('')
    pastedDigits.forEach((digit, offset) => {
      if (index + offset < 6) digits.value[index + offset] = digit
    })
    focusInput(Math.min(index + pastedDigits.length, 5))
    return
  }

  digits.value[index] = value
  if (value && index < 5) focusInput(index + 1)
}

const handleKeydown = (index, event) => {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    focusInput(index - 1)
  }

  if (event.key === 'ArrowLeft' && index > 0) focusInput(index - 1)
  if (event.key === 'ArrowRight' && index < 5) focusInput(index + 1)
}

const handlePaste = (event) => {
  const pastedCode = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
  if (!pastedCode) return

  event.preventDefault()
  digits.value = Array.from({ length: 6 }, (_, index) => pastedCode[index] || '')
  focusInput(Math.min(pastedCode.length, 5))
}

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
      <div class="otp-inputs" @paste="handlePaste">
        <input
          v-for="(_, index) in digits"
          :key="index"
          :ref="(element) => { if (element) inputs[index] = element }"
          :value="digits[index]"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="1"
          :aria-label="`Dígito ${index + 1} del código`"
          autocomplete="one-time-code"
          :disabled="loading"
          @input="handleInput(index, $event)"
          @keydown="handleKeydown(index, $event)"
        />
      </div>
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
.otp-inputs { display: grid; grid-template-columns: repeat(6, 1fr); gap: .65rem; }
.otp-inputs input { width: 100%; min-width: 0; height: 3.65rem; border: 1px solid rgba(68,135,143,.24); border-radius: .65rem; color: #173f46; background: #fff; font-family: 'IBM Plex Mono', monospace; font-size: 1.3rem; font-weight: 700; text-align: center; outline: 0; transition: border-color .18s, box-shadow .18s; }
.otp-inputs input:focus { border-color: #5a9b95; box-shadow: 0 0 0 3px rgba(90,155,149,.12); }
.otp-inputs input:disabled { color: #789092; cursor: wait; }
.field-error { display: block; margin-top: .55rem; color: #c85f69; font-size: .67rem; }
.form-error { display: flex; align-items: flex-start; gap: .65rem; border-left: 3px solid #ff8591; padding: .8rem .9rem; color: #8e454c; background: rgba(255,133,145,.1); font-size: .72rem; line-height: 1.45; }
.form-error svg { width: 1rem; flex: none; margin-top: .05rem; fill: none; stroke: currentColor; stroke-width: 1.8; }
.submit-button { display: flex; min-height: 3.25rem; align-items: center; justify-content: center; gap: .65rem; border: 0; border-radius: .65rem .65rem .65rem .18rem; color: #fff; background: #ff8591; box-shadow: 0 11px 24px rgba(255,133,145,.28); font-size: .78rem; font-weight: 700; cursor: pointer; transition: transform .18s, box-shadow .18s, opacity .18s; }
.submit-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 28px rgba(255,133,145,.36); }.submit-button:disabled { opacity: .68; cursor: wait; }.arrow { font-size: 1.05rem; }
.spinner { width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 420px) { .otp-inputs { gap: .35rem; }.otp-inputs input { height: 3.25rem; font-size: 1.05rem; } }
</style>
