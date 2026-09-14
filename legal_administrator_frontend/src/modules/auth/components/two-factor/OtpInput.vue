<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  idPrefix: {
    type: String,
    default: 'otp',
  },
})

const emit = defineEmits(['update:modelValue', 'complete'])
const inputs = ref([])
const digits = ref(Array(6).fill(''))
const normalizedValue = computed(() => digits.value.join(''))

watch(
  () => props.modelValue,
  (value) => {
    const nextDigits = String(value ?? '').replace(/\D/g, '').slice(0, 6).split('')
    digits.value = Array.from({ length: 6 }, (_, index) => nextDigits[index] || '')
  },
  { immediate: true },
)

const focusInput = (index) => {
  nextTick(() => inputs.value[index]?.focus())
}

const updateValue = () => {
  const value = normalizedValue.value
  emit('update:modelValue', value)
  if (/^\d{6}$/.test(value)) emit('complete', value)
}

const distributeDigits = (value, startIndex = 0) => {
  const incomingDigits = value.replace(/\D/g, '').slice(0, 6 - startIndex).split('')

  incomingDigits.forEach((digit, offset) => {
    digits.value[startIndex + offset] = digit
  })

  updateValue()
  focusInput(Math.min(startIndex + incomingDigits.length, 5))
}

const handleInput = (index, event) => {
  const value = event.target.value.replace(/\D/g, '')

  if (value.length > 1) {
    distributeDigits(value, index)
    return
  }

  digits.value[index] = value
  updateValue()
  if (value && index < 5) focusInput(index + 1)
}

const handleKeydown = (index, event) => {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    digits.value[index - 1] = ''
    updateValue()
    focusInput(index - 1)
  }

  if (event.key === 'ArrowLeft' && index > 0) focusInput(index - 1)
  if (event.key === 'ArrowRight' && index < 5) focusInput(index + 1)
}

const handlePaste = (event) => {
  const pastedCode = event.clipboardData?.getData('text') || ''
  if (!/\d/.test(pastedCode)) return

  event.preventDefault()
  digits.value = Array(6).fill('')
  distributeDigits(pastedCode)
}
</script>

<template>
  <div class="otp-inputs" role="group" aria-label="Código de seis dígitos" @paste="handlePaste">
    <input
      v-for="(_, index) in digits"
      :id="`${idPrefix}-${index}`"
      :key="index"
      :ref="(element) => { if (element) inputs[index] = element }"
      :value="digits[index]"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="1"
      autocomplete="one-time-code"
      :aria-label="`Dígito ${index + 1} de 6`"
      :aria-invalid="invalid"
      :disabled="disabled"
      @input="handleInput(index, $event)"
      @keydown="handleKeydown(index, $event)"
    />
  </div>
</template>

<style scoped>
.otp-inputs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.65rem;
}

.otp-inputs input {
  width: 100%;
  min-width: 0;
  height: 3.5rem;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
  padding: 0;
  color: var(--color-text-title);
  background: var(--color-bg-subtle);
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
}

.otp-inputs input:focus {
  border-color: var(--color-teal);
  box-shadow: 0 0 0 3px rgba(90, 155, 149, 0.14);
}

.otp-inputs input[aria-invalid="true"] {
  border-color: var(--color-danger);
}

.otp-inputs input:disabled {
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  cursor: wait;
}

@media (max-width: 480px) {
  .otp-inputs {
    gap: 0.35rem;
  }

  .otp-inputs input {
    height: 3rem;
    font-size: 1rem;
  }
}
</style>
