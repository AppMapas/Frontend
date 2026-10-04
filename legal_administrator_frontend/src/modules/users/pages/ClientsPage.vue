<script setup>
import { reactive, ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useClientStore } from '../stores/clientStore.js'
import { completeClient } from '../domain/clientForm.js'
import { useDirectorySearch } from '@/shared/lists/useDirectorySearch.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import ListPagination from '@/components/common/ListPagination.vue'

const clients = useClientStore()
const notifications = useNotificationStore()
const filters = reactive({ q: '', active: true, page: 0, size: 12 })
const { refresh } = useDirectorySearch(filters, clients)
const confirmTarget = ref(null)
const busy = ref(false)
const emptyTitle = computed(() => {
  if (filters.q) return 'No encontramos coincidencias'
  return 'Aún no hay clientes en esta selección'
})
function badgeVariant(client) {
  if (client.active) return 'teal'
  return 'neutral'
}
async function deactivate() {
  if (!confirmTarget.value || busy.value) return
  const target = confirmTarget.value
  busy.value = true
  try {
    await clients.deactivate(target.dpi, target.version)
    confirmTarget.value = null
    notifications.show('Cliente desactivado. Sus expedientes se conservan.', 'success')
    await refresh()
  } catch (error) {
    notifyRequestError(error, 'No fue posible desactivar el cliente.', 'Actualizar lista', async () => {
      confirmTarget.value = null
      await refresh()
    })
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="office-page">
    <PageHeader eyebrow="Gestión jurídica" title="Clientes"
      subtitle="Datos personales y expedientes del despacho en un solo lugar.">
      <template #actions>
        <BaseButton variant="outline" :loading="clients.loading" @click="refresh">Actualizar</BaseButton>
        <RouterLink class="link-button primary" :to="{ name: 'client-new' }">Nuevo cliente</RouterLink>
      </template>
    </PageHeader>
    <div class="toolbar">
      <label for="clients-query">Buscar cliente
        <input id="clients-query" v-model="filters.q" type="search" maxlength="100" placeholder="Nombre, apellido o DPI">
      </label>
      <label for="clients-active">Mostrar
        <select id="clients-active" v-model="filters.active">
          <option :value="true">Clientes activos</option><option :value="false">Clientes inactivos</option>
          <option :value="null">Todos los clientes</option>
        </select>
      </label>
    </div>
    <LoadingCards v-if="clients.loading" label="Cargando clientes" />
    <BaseCard v-else-if="clients.failed" class="empty-state">
      <h2>Información pendiente de cargar</h2><BaseButton variant="outline" @click="refresh">Reintentar carga</BaseButton>
    </BaseCard>
    <BaseCard v-else-if="!clients.items.length" class="empty-state">
      <h2>{{ emptyTitle }}</h2><p class="muted">Puedes cambiar la búsqueda o registrar un cliente.</p>
      <RouterLink class="link-button primary" :to="{ name: 'client-new' }">Registrar cliente</RouterLink>
    </BaseCard>
    <div v-else class="card-grid" :aria-busy="clients.loading">
      <BaseCard v-for="client in clients.items" :key="client.dpi" class="record-card">
        <div class="record-heading"><div><h2>{{ client.firstName }} {{ client.lastName }}</h2><p class="mono">DPI {{ client.dpi }}</p></div>
          <BaseBadge :variant="badgeVariant(client)"><span v-if="client.active">Activo</span><span v-else>Inactivo</span></BaseBadge>
        </div>
        <dl class="record-data">
          <div><dt>Correo</dt><dd><a :href="'mailto:' + client.email">{{ client.email }}</a></dd></div>
          <div><dt>Teléfono</dt><dd><a :href="'tel:' + client.phone">{{ client.phone }}</a></dd></div>
          <div><dt>Dirección</dt><dd>{{ client.exactAddress || 'Pendiente de completar' }}</dd></div>
        </dl>
        <div class="actions">
          <RouterLink class="link-button" :to="{ name: 'client-edit', params: { dpi: client.dpi } }">
            <span v-if="client.active">Ver y editar</span><span v-else>Ver cliente</span>
          </RouterLink>
          <RouterLink class="link-button" :to="{ name: 'legal-processes', query: { clientDpi: client.dpi } }">Expedientes</RouterLink>
          <RouterLink v-if="client.active && completeClient(client)" class="link-button primary"
            :to="{ name: 'legal-process-new', query: { clientDpi: client.dpi } }">Abrir expediente</RouterLink>
          <RouterLink v-else-if="client.active" class="link-button" :to="{ name: 'client-edit', params: { dpi: client.dpi } }">Completar datos</RouterLink>
          <BaseButton v-if="client.active" variant="ghost" :disabled="busy" @click="confirmTarget = client">Desactivar</BaseButton>
        </div>
      </BaseCard>
    </div>
    <ListPagination :page="filters.page" :total-pages="clients.totalPages" :total-elements="clients.totalElements"
      :loading="clients.loading" @change="filters.page = $event" />
    <BaseModal :open="Boolean(confirmTarget)" :dismissible="!busy" title-id="deactivate-client-title" @close="confirmTarget = null">
      <div class="confirm-content">
        <h2 id="deactivate-client-title">Desactivar cliente</h2>
        <p>{{ confirmTarget?.firstName }} {{ confirmTarget?.lastName }} dejará de estar disponible para nuevos expedientes. Sus registros actuales se conservarán.</p>
        <div class="actions"><BaseButton variant="outline" :disabled="busy" @click="confirmTarget = null">Cancelar</BaseButton>
          <BaseButton :loading="busy" @click="deactivate">Desactivar cliente</BaseButton></div>
      </div>
    </BaseModal>
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
