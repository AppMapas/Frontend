<script setup>
import { reactive } from 'vue'
import { RouterLink } from 'vue-router'
import { clientsApi } from '../services/clientsApi.js'
import { completeClient } from '../domain/clientForm.js'
import { usePagedResource } from '@/shared/lists/usePagedResource.js'
import { useDirectorySearch } from '@/shared/lists/useDirectorySearch.js'
import BaseButton from '@/components/common/BaseButton.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import ListPagination from '@/components/common/ListPagination.vue'

defineProps({ modelValue: { type: Object, default: null }, disabled: Boolean })
defineEmits(['update:modelValue'])
const resource = reactive(usePagedResource(clientsApi.search))
const filters = reactive({ q: '', active: true, page: 0, size: 5 })
const { refresh } = useDirectorySearch(filters, resource)
function buttonVariant(client, selected) {
  if (selected?.dpi === client.dpi) return 'primary'
  return 'outline'
}
</script>
<template>
  <div class="client-selector">
    <label for="case-client-query">Buscar un cliente activo
      <input id="case-client-query" v-model="filters.q" type="search" maxlength="100"
        placeholder="Nombre o DPI" :disabled="disabled">
    </label>
    <div v-if="modelValue" class="selected-client">
      <strong>Cliente seleccionado: {{ modelValue.firstName }} {{ modelValue.lastName }}</strong>
      <span>DPI {{ modelValue.dpi }}</span>
      <RouterLink v-if="!completeClient(modelValue)" :to="{ name: 'client-edit', params: { dpi: modelValue.dpi } }">
        Completar nacionalidad, estado civil y dirección
      </RouterLink>
    </div>
    <LoadingCards v-if="resource.loading" :count="1" label="Buscando clientes" />
    <BaseButton v-else-if="resource.failed" variant="outline" :disabled="disabled" @click="refresh">Reintentar búsqueda</BaseButton>
    <p v-else-if="!resource.items.length" class="help">No hay coincidencias. Puedes registrar un cliente nuevo en este formulario.</p>
    <ul v-else class="client-results" aria-label="Clientes disponibles">
      <li v-for="client in resource.items" :key="client.dpi">
        <div><strong>{{ client.firstName }} {{ client.lastName }}</strong><span>DPI {{ client.dpi }}</span></div>
        <BaseButton :variant="buttonVariant(client, modelValue)" :disabled="disabled"
          :aria-pressed="modelValue?.dpi === client.dpi" @click="$emit('update:modelValue', client)">
          <span v-if="modelValue?.dpi === client.dpi">Seleccionado</span><span v-else>Seleccionar</span>
        </BaseButton>
      </li>
    </ul>
    <ListPagination :page="filters.page" :total-pages="resource.totalPages" :total-elements="resource.totalElements"
      :loading="resource.loading || disabled" @change="filters.page = $event" />
  </div>
</template>
<style scoped>
.client-selector { display: grid; gap: 1rem; }
label { display: grid; gap: .4rem; font-size: .9rem; font-weight: 600; }
input { width: 100%; min-height: 46px; font-size: 1rem; border-color: var(--color-border-control); }
.client-results { list-style: none; display: grid; gap: .5rem; }
.client-results li { display: flex; flex-direction: column; gap: .8rem; padding: .9rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); }
.client-results li div, .selected-client { display: grid; gap: .2rem; }
.client-results strong, .selected-client strong { overflow-wrap: anywhere; font-size: .95rem; }
.client-results span, .selected-client span, .help { font-size: .875rem; color: var(--color-text-muted); }
.selected-client { padding: 1rem; border-left: 3px solid var(--color-primary); background: var(--color-primary-subtle); border-radius: var(--radius-sm); }
.selected-client a { color: var(--color-teal-strong); font-size: .875rem; text-decoration: underline; }
:deep(.base-button) { min-height: 44px; }
@media (min-width: 640px) { .client-results li { flex-direction: row; align-items: center; justify-content: space-between; } }
</style>
