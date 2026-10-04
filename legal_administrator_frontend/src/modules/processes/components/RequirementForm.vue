<script setup>
import { computed, reactive } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import CatalogNotice from './CatalogNotice.vue'

const props = defineProps({
  requirement: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['submit', 'cancel'])
const formTitle = computed(() => {
  if (props.requirement) return 'Editar requisito'
  return 'Nuevo requisito'
})

const form = reactive({
  name: props.requirement?.name || '',
  description: props.requirement?.description || '',
})

function submit() {
  const name = form.name.trim()
  if (!name) return
  emit('submit', {
    name,
    description: form.description.trim(),
  })
}
</script>

<template>
  <form class="requirement-form" @submit.prevent="submit">
    <header class="form-heading">
      <p class="eyebrow">Catálogo reutilizable</p>
      <h2 id="requirement-dialog-title">{{ formTitle }}</h2>
      <p>Podrás asociarlo a uno o varios trámites.</p>
    </header>

    <CatalogNotice v-if="error" tone="error">{{ error }}</CatalogNotice>

    <label for="requirement-name">Nombre del requisito <span aria-hidden="true">*</span></label>
    <input
      id="requirement-name"
      v-model="form.name"
      autofocus
      required
      maxlength="150"
      autocomplete="off"
      :disabled="busy"
      placeholder="Ej. Copia legible de DPI"
    >

    <label for="requirement-description">Descripción general</label>
    <textarea
      id="requirement-description"
      v-model="form.description"
      rows="4"
      :disabled="busy"
      placeholder="Explica qué debe presentar o cumplir el cliente"
    ></textarea>

    <div class="form-actions">
      <BaseButton variant="outline" :disabled="busy" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="busy">Guardar requisito</BaseButton>
    </div>
  </form>
</template>

<style scoped>
.requirement-form { display: grid; gap: .55rem; padding: clamp(1.2rem, 4vw, 2rem); }
.form-heading { margin-bottom: .7rem; }
.eyebrow {
  color: var(--color-teal-strong);
  font-family: var(--font-mono);
  font-size: .75rem;
  font-weight: 700;
  letter-spacing: .07em;
  text-transform: uppercase;
}
.form-heading h2 { margin: .3rem 0; font-size: 1.4rem; }
.form-heading p:last-child { color: var(--color-text-muted); font-size: .9rem; }
label { color: var(--color-text-title); font-size: .88rem; font-weight: 650; margin-top: .65rem; }
label span { color: var(--color-danger-strong); }
input, textarea { width: 100%; min-height: 46px; font-size: 1rem; }
textarea { resize: vertical; }
.form-actions { display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: .65rem; margin-top: 1.2rem; }
.form-actions :deep(button) { width: 100%; min-height: 46px; }
@media (min-width: 501px) {
  .form-actions { flex-direction: row; }
  .form-actions :deep(button) { width: auto; }
}
</style>
