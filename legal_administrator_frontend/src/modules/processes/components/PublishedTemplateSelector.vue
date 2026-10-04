<script setup>
import { onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { legalProcessApi } from '../services/legalProcessApi.js'
import { processCatalogApi } from '../services/processCatalogApi.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'

const props = defineProps({ modelValue: { type: Object, default: null }, disabled: Boolean })
const emit = defineEmits(['update:modelValue', 'loading'])
const templates = ref([])
const selectedId = ref('')
const loading = ref(true)
const failed = ref(false)
let detailRequest = 0
let alive = true

async function load() {
  loading.value = true
  failed.value = false
  emit('loading', true)
  try {
    const response = await legalProcessApi.publishedTemplates()
    if (alive) templates.value = response
  } catch (error) {
    if (!alive) return
    failed.value = true
    notifyRequestError(error, 'No fue posible cargar los trámites publicados.', 'Reintentar', load)
  } finally {
    if (alive) {
      loading.value = false
      emit('loading', false)
    }
  }
}
async function select() {
  const request = ++detailRequest
  emit('update:modelValue', null)
  if (!selectedId.value) return
  loading.value = true
  emit('loading', true)
  try {
    const template = await processCatalogApi.getProcessType(selectedId.value)
    if (!alive || request !== detailRequest) return
    if (template.status !== 'PUBLISHED') throw new Error('Este trámite ya no está publicado. Actualiza la selección.')
    emit('update:modelValue', template)
  } catch (error) {
    if (!alive || request !== detailRequest) return
    notifyRequestError(error, 'No fue posible consultar los requisitos.', 'Actualizar trámites', refreshSelection)
  } finally {
    if (alive && request === detailRequest) {
      loading.value = false
      emit('loading', false)
    }
  }
}
async function refreshSelection() {
  detailRequest += 1
  selectedId.value = ''
  emit('update:modelValue', null)
  await load()
}
watch(() => props.modelValue, value => {
  if (value) selectedId.value = value.id
  else if (!loading.value) selectedId.value = ''
})
defineExpose({ refreshSelection })
onMounted(load)
onBeforeUnmount(() => { alive = false; detailRequest += 1 })
</script>
<template>
  <div class="template-selector">
    <label for="case-template">Trámite legal *
      <select id="case-template" v-model="selectedId" :disabled="disabled || loading || failed" required @change="select">
        <option value="">Selecciona un trámite publicado</option>
        <option v-for="template in templates" :key="template.id" :value="template.id">{{ template.name }}</option>
      </select>
    </label>
    <LoadingCards v-if="loading" :count="1" label="Cargando trámites y requisitos" />
    <BaseButton v-else-if="failed" variant="outline" :disabled="disabled" @click="load">Reintentar carga</BaseButton>
    <div v-else-if="!templates.length" class="empty-templates">
      <p>No hay trámites publicados para abrir un expediente.</p>
      <RouterLink to="/tramites">Configurar y publicar un trámite</RouterLink>
    </div>
    <div v-if="modelValue" class="template-details">
      <h3>{{ modelValue.name }}</h3><p v-if="modelValue.description">{{ modelValue.description }}</p>
      <h4>Requisitos del trámite</h4>
      <ol>
        <li v-for="requirement in modelValue.requirements" :key="requirement.requirementId">
          <div class="requirement-heading"><strong>{{ requirement.name }}</strong>
            <BaseBadge v-if="requirement.required" variant="teal">Obligatorio</BaseBadge>
            <BaseBadge v-else variant="neutral">Opcional</BaseBadge>
          </div>
          <p v-if="requirement.instructions">{{ requirement.instructions }}</p>
          <span v-if="requirement.requiresDocument" class="help">Requiere documentación</span>
        </li>
      </ol>
    </div>
  </div>
</template>
<style scoped>
.template-selector { display: grid; gap: 1rem; }
label { display: grid; gap: .4rem; font-size: .9rem; font-weight: 600; }
select { width: 100%; min-height: 46px; font-size: 1rem; border-color: var(--color-border-control); }
.template-details { display: grid; gap: .7rem; }
.template-details h3 { font-size: 1.1rem; }
.template-details h4 { font-size: .95rem; }
.template-details p { font-size: .9rem; white-space: pre-line; overflow-wrap: anywhere; }
ol { list-style: none; display: grid; gap: .75rem; }
li { border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); padding: .85rem; display: grid; gap: .4rem; }
.requirement-heading { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.requirement-heading strong { overflow-wrap: anywhere; font-size: .95rem; }
.help, .empty-templates p { color: var(--color-text-muted); font-size: .875rem; }
.empty-templates { display: grid; gap: .5rem; }
.empty-templates a { color: var(--color-teal-strong); text-decoration: underline; }
</style>
