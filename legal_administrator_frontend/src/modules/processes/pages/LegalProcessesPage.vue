<script setup>
import { reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useLegalProcessStore } from '../stores/legalProcessStore.js'
import { statusLabel, formatTimestamp } from '../domain/caseRegistration.js'
import { useDirectorySearch } from '@/shared/lists/useDirectorySearch.js'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import ListPagination from '@/components/common/ListPagination.vue'

const route = useRoute()
const cases = useLegalProcessStore()
const filters = reactive({ q: '', active: true, status: '', clientDpi: '', page: 0, size: 12 })
const selection = ref('active')
watch(selection, value => {
  filters.active = value === 'completed' ? null : value === 'active'
  filters.status = value === 'completed' ? 'COMPLETED' : ''
})
watch(() => route.query.clientDpi, dpi => {
  filters.clientDpi = ''
  if (typeof dpi === 'string') filters.clientDpi = dpi
}, { immediate: true })
const { refresh } = useDirectorySearch(filters, cases)
</script>
<template>
  <div class="office-page">
    <PageHeader eyebrow="Gestión jurídica" title="Expedientes"
      subtitle="Consulta los trámites abiertos para cada cliente y sus requisitos.">
      <template #actions><BaseButton variant="outline" :loading="cases.loading" @click="refresh">Actualizar</BaseButton>
        <RouterLink class="link-button primary" :to="{ name: 'legal-process-new' }">Crear expediente</RouterLink></template>
    </PageHeader>
    <div class="toolbar">
      <label for="cases-query">Buscar expediente
        <input id="cases-query" v-model="filters.q" maxlength="100" type="search" placeholder="Código, nombre o DPI">
      </label>
      <label for="cases-active">Mostrar
        <select id="cases-active" v-model="selection">
          <option value="active">Expedientes activos</option>
          <option value="inactive">Expedientes inactivos</option>
          <option value="completed">Expedientes completados</option>
        </select>
      </label>
      <div v-if="filters.clientDpi" class="actions"><span class="meta">Cliente: DPI {{ filters.clientDpi }}</span>
        <RouterLink class="link-button" :to="{ name: 'legal-processes' }">Ver todos</RouterLink></div>
    </div>
    <LoadingCards v-if="cases.loading" label="Cargando expedientes" />
    <BaseCard v-else-if="cases.failed" class="empty-state"><h2>Información pendiente de cargar</h2><BaseButton @click="refresh">Reintentar carga</BaseButton></BaseCard>
    <BaseCard v-else-if="!cases.items.length" class="empty-state">
      <h2>No hay expedientes en esta selección</h2><p class="muted">Prueba otra búsqueda o abre un expediente con un trámite publicado.</p>
      <RouterLink class="link-button primary" :to="{ name: 'legal-process-new', query: { clientDpi: filters.clientDpi } }">Crear expediente</RouterLink>
    </BaseCard>
    <div v-else class="card-grid">
      <BaseCard v-for="item in cases.items" :key="item.id" class="record-card">
        <div class="record-heading"><div><p class="mono">{{ item.caseCode }}</p><h2>{{ item.clientName }}</h2></div>
          <BaseBadge variant="teal">{{ statusLabel(item.currentStatus) }}</BaseBadge></div>
        <dl class="record-data">
          <div><dt>Trámite</dt><dd>{{ item.processTypeName }}</dd></div>
          <div><dt>DPI del cliente</dt><dd class="mono">{{ item.clientDpi }}</dd></div>
          <div><dt>Fecha de apertura</dt><dd>{{ formatTimestamp(item.openedAt) }}</dd></div>
        </dl>
        <div class="actions"><RouterLink class="link-button primary"
          :to="{ name: 'legal-process-detail', params: { id: item.id } }">Ver expediente</RouterLink></div>
      </BaseCard>
    </div>
    <ListPagination :page="filters.page" :total-pages="cases.totalPages" :total-elements="cases.totalElements"
      :loading="cases.loading" @change="filters.page = $event" />
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
