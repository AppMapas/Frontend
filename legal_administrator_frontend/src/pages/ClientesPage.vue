<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import { clientsApi } from '@/modules/users/services/clientsApi'
import { formatDate } from '@/utils/formatters'

const clients = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')

const filteredClients = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return clients.value
  return clients.value.filter((client) => [client.dpi, client.firstName, client.lastName, client.email, client.phone]
    .some((value) => String(value ?? '').toLowerCase().includes(term)))
})

async function loadClients() {
  loading.value = true
  error.value = ''
  try {
    clients.value = await clientsApi.getAll()
  } catch (requestError) {
    error.value = requestError?.message || 'No fue posible cargar los clientes.'
  } finally {
    loading.value = false
  }
}

onMounted(loadClients)
</script>

<template>
  <div class="clientes-page">
    <PageHeader
      title="Directorio de Clientes y Propietarios"
      eyebrow="Gestión de Partes Interesadas"
      subtitle="Personas registradas en el sistema y vinculadas a terrenos y trámites."
    >
      <template #actions>
        <BaseButton variant="outline" :loading="loading" @click="loadClients">Actualizar</BaseButton>
      </template>
    </PageHeader>

    <div class="directory-toolbar">
      <label for="client-directory-search">Buscar cliente</label>
      <input id="client-directory-search" v-model="search" type="search" placeholder="Nombre, DPI, correo o teléfono" :disabled="loading">
      <span>{{ filteredClients.length }} de {{ clients.length }} clientes</span>
    </div>

    <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !clients.length" class="feedback" role="status">Cargando clientes registrados…</p>
    <BaseCard v-else-if="!filteredClients.length" class="empty-state">
      <h2>{{ clients.length ? 'No hay coincidencias' : 'No hay clientes registrados' }}</h2>
      <p>{{ clients.length ? 'Prueba con otro nombre, DPI, correo o teléfono.' : 'El endpoint no devolvió clientes para mostrar.' }}</p>
    </BaseCard>

    <div v-else class="client-grid">
      <BaseCard v-for="client in filteredClients" :key="client.dpi" class="client-card" hoverable>
        <div class="client-heading">
          <span class="client-avatar" aria-hidden="true">{{ (client.firstName?.[0] || '') + (client.lastName?.[0] || '') }}</span>
          <div>
            <h2>{{ client.firstName }} {{ client.lastName }}</h2>
            <p>DPI {{ client.dpi }}</p>
          </div>
        </div>
        <dl>
          <div><dt>Correo</dt><dd><a :href="`mailto:${client.email}`">{{ client.email }}</a></dd></div>
          <div><dt>Teléfono</dt><dd><a :href="`tel:${client.phone}`">{{ client.phone }}</a></dd></div>
          <div><dt>Registrado</dt><dd>{{ formatDate(client.createdAt) }}</dd></div>
        </dl>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.clientes-page { width: 100%; }
.directory-toolbar { display: grid; grid-template-columns: auto minmax(240px, 1fr) auto; align-items: center; gap: .7rem; margin-bottom: 1.25rem; padding: .8rem 1rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: var(--color-bg-subtle); }
.directory-toolbar label { color: var(--color-text-title); font-size: .78rem; font-weight: 700; }
.directory-toolbar input { width: 100%; min-width: 0; }
.directory-toolbar span { color: var(--color-text-muted); font-size: .72rem; white-space: nowrap; }
.client-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.client-card { min-width: 0; }
.client-heading { display: flex; align-items: center; gap: .8rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border-subtle); }
.client-avatar { display: grid; width: 2.8rem; height: 2.8rem; flex: none; place-items: center; border-radius: 50%; color: var(--color-text-on-primary); background: var(--color-deep-teal); font-size: .78rem; font-weight: 800; text-transform: uppercase; }
.client-heading h2 { margin: 0 0 .15rem; font-size: 1rem; overflow-wrap: anywhere; }
.client-heading p { margin: 0; color: var(--color-text-muted); font-family: var(--font-mono); font-size: .7rem; }
dl { display: grid; gap: .7rem; margin: 1rem 0 0; }
dl div { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: .6rem; }
dt { color: var(--color-text-muted); font-size: .72rem; }
dd { min-width: 0; margin: 0; color: var(--color-text-body); font-size: .78rem; font-weight: 600; overflow-wrap: anywhere; }
.feedback { margin: 0; border-left: 4px solid var(--color-teal); border-radius: var(--radius-sm); padding: .8rem 1rem; background: var(--color-primary-subtle); }
.feedback.error { border-color: var(--color-danger); background: rgba(217,83,79,.09); }
.empty-state { text-align: center; }.empty-state h2 { margin: 0 0 .4rem; font-size: 1.1rem; }.empty-state p { margin: 0; color: var(--color-text-muted); }
@media (max-width: 1050px) { .client-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 660px) { .directory-toolbar { grid-template-columns: 1fr; }.directory-toolbar span { white-space: normal; }.client-grid { grid-template-columns: 1fr; } }
</style>
