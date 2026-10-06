<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { legalProcessApi } from '../../processes/services/legalProcessApi.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import BaseButton from '@/components/common/BaseButton.vue'
const props = defineProps({ modelValue: [String, Number], disabled: Boolean, invalid: Boolean })
const emit = defineEmits(['update:modelValue', 'selected'])
const query = ref('')
const selected = ref(null)
const matches = ref([])
const loading = ref(false)
let timer = null
let controller = null
let generation = 0
async function search() {
  if (props.disabled) return
  controller?.abort()
  controller = new AbortController()
  const current = ++generation
  loading.value = true
  try {
    const result = await legalProcessApi.search({ q: query.value, active: true, page: 0, size: 6 }, { signal: controller.signal })
    if (current === generation) matches.value = result.content
  } catch (error) {
    if (current === generation && !controller.signal.aborted) notifyRequestError(error, 'No fue posible buscar expedientes.')
  } finally { if (current === generation) loading.value = false }
}
function choose(item) { selected.value = item; emit('update:modelValue', item.id); emit('selected', item); matches.value = [] }
function clear() { selected.value = null; emit('update:modelValue', ''); query.value = ''; search() }
watch(query, () => { window.clearTimeout(timer); timer = window.setTimeout(search, 300) })
watch(() => props.modelValue, async id => {
  if (!id) { selected.value = null; return }
  if (selected.value?.id === Number(id)) return
  const current = ++generation
  try {
    const detail = await legalProcessApi.get(Number(id))
    if (current === generation) { selected.value = detail.caseData; emit('selected', detail.caseData) }
  } catch (error) { if (current === generation) notifyRequestError(error, 'No fue posible consultar el expediente seleccionado.') }
}, { immediate: true })
onBeforeUnmount(() => { generation += 1; controller?.abort(); window.clearTimeout(timer) })
</script>
<template>
  <div class="case-picker">
    <div v-if="selected" class="selected-case">
      <div><strong>{{ selected.caseCode }}</strong><p>{{ selected.clientName }} · {{ selected.processTypeName }}</p></div>
      <BaseButton variant="outline" :disabled="disabled" @click="clear">Cambiar</BaseButton>
    </div>
    <div v-else>
      <label for="cash-case-query">Buscar expediente activo
        <input id="cash-case-query" v-model="query" type="search" maxlength="100" :disabled="disabled"
          :aria-invalid="invalid" placeholder="Código, nombre del cliente o DPI" @focus="search" />
      </label>
      <p v-if="loading" role="status" class="help">Buscando expedientes…</p>
      <ul v-else-if="matches.length" class="match-list" aria-label="Expedientes encontrados">
        <li v-for="item in matches" :key="item.id"><button type="button" @click="choose(item)">
          <strong>{{ item.caseCode }} · {{ item.clientName }}</strong><span>{{ item.processTypeName }}</span>
        </button></li>
      </ul>
      <p v-else-if="query" class="help">No hay coincidencias. Prueba otro nombre o código.</p>
    </div>
  </div>
</template>
<style scoped>
.case-picker { min-width: 0; } .selected-case { display: flex; flex-wrap: wrap; gap: .7rem; align-items: center; justify-content: space-between; padding: .85rem; border: 1px solid var(--color-border-control); border-radius: var(--radius-sm); background: var(--color-primary-subtle); }
.selected-case div { min-width: 0; } .selected-case p { overflow-wrap: anywhere; font-size: .9rem; }
label { display: grid; gap: .4rem; font-weight: 600; font-size: .9rem; } input { width: 100%; min-height: 46px; font-size: 1rem; }
.match-list { list-style: none; display: grid; gap: .35rem; margin-top: .5rem; padding: 0; }
.match-list button { display: grid; gap: .25rem; width: 100%; min-height: 48px; text-align: left; padding: .7rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border-control); color: var(--color-text-body); background: var(--color-bg-card); overflow-wrap: anywhere; }
.match-list button:hover { background: var(--color-primary-subtle); } .match-list span, .help { color: var(--color-text-muted); font-size: .85rem; }
</style>
