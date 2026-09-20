<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ terrain: { type: Object, required: true }, clients: { type: Array, default: () => [] }, currentUser: { type: Object, default: null }, loading: Boolean })
const emit = defineEmits(['update'])
const search = ref('')
const searchFeedback = ref('')
const normalizedSearch = computed(() => search.value.trim().toLowerCase())
const filteredClients = computed(() => props.clients.filter((client) => client.dpi === props.terrain.clientDpi
  || `${client.dpi} ${client.firstName} ${client.lastName}`.toLowerCase().includes(normalizedSearch.value)))
const selectedClient = computed(() => props.clients.find((client) => client.dpi === props.terrain.clientDpi) || null)

function selectClient(dpi) {
  emit('update', 'clientDpi', dpi)
  searchFeedback.value = ''
  const client = props.clients.find((item) => item.dpi === dpi)
  if (client) search.value = `${client.firstName} ${client.lastName}`
}

function searchClient() {
  const matches = filteredClients.value.filter((client) => client.dpi !== props.terrain.clientDpi || normalizedSearch.value)
  if (!normalizedSearch.value) {
    searchFeedback.value = 'Ingresa un nombre o DPI para buscar un cliente.'
    return
  }
  if (matches.length === 1) {
    selectClient(matches[0].dpi)
    return
  }
  searchFeedback.value = matches.length
    ? 'Selecciona uno de los clientes encontrados para completar los datos del propietario.'
    : 'No se encontró un cliente con esos datos.'
}
</script>

<template>
  <div class="details-grid">
    <form class="client-search" @submit.prevent="searchClient">
      <label for="client-search">Buscar cliente
        <input id="client-search" v-model="search" placeholder="Nombre o DPI" type="search" :disabled="loading">
      </label>
      <button type="submit" :disabled="loading">Buscar cliente</button>
    </form>
    <p v-if="searchFeedback" class="search-feedback" role="status">{{ searchFeedback }}</p>
    <label>Cliente propietario
      <select :value="terrain.clientDpi" :disabled="loading" @change="selectClient($event.target.value)">
        <option value="">{{ loading ? 'Cargando clientes…' : 'Selecciona un cliente' }}</option>
        <option v-for="client in filteredClients" :key="client.dpi" :value="client.dpi">{{ client.firstName }} {{ client.lastName }} · {{ client.dpi }}</option>
      </select>
    </label>
    <section v-if="selectedClient" class="owner-data" aria-label="Datos autocompletados del propietario">
      <p>Datos del propietario</p>
      <label>DPI<input :value="selectedClient.dpi" readonly></label>
      <label>Nombres<input :value="selectedClient.firstName" readonly></label>
      <label>Apellidos<input :value="selectedClient.lastName" readonly></label>
      <label>Correo<input :value="selectedClient.email || 'No registrado'" readonly></label>
      <label>Teléfono<input :value="selectedClient.phone || 'No registrado'" readonly></label>
    </section>
    <p class="description responsible">Responsable: {{ currentUser ? `${currentUser.firstName} ${currentUser.lastName} · ${currentUser.dpi}` : 'Pendiente de cargar la sesión' }}</p>
    <label>Nombre del terreno
      <input :value="terrain.terrainName" placeholder="Ej. Terreno Los Pinos" @input="$emit('update', 'terrainName', $event.target.value)">
    </label>
    <label>Tipo de propiedad
      <select :value="terrain.propertyType" @change="$emit('update', 'propertyType', $event.target.value)">
        <option value="RURAL">Rural</option><option value="URBANA">Urbana</option>
      </select>
    </label>
    <label class="description">Descripción
      <textarea :value="terrain.generalDescription" rows="2" placeholder="Ubicación y referencias generales" @input="$emit('update', 'generalDescription', $event.target.value)" />
    </label>
  </div>
</template>

<style scoped>
.details-grid { display: grid; grid-template-columns: 1fr; gap: .75rem; }
label { display: grid; gap: .4rem; color: var(--color-text-muted); font-size: .85rem; }
input, select, textarea { width: 100%; min-width: 0; padding: .6rem .7rem; }
.client-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: .55rem; }
.client-search button { min-height: 2.55rem; border-radius: var(--radius-sm); padding: .6rem .85rem; color: var(--color-text-on-primary); background: var(--color-secondary); font-size: .8rem; font-weight: 700; }
.client-search button:disabled { cursor: wait; opacity: .65; }
.search-feedback { margin: -.3rem 0 0; color: var(--color-text-muted); font-size: .75rem; }
.owner-data { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); padding: .8rem; background: var(--color-bg-subtle); }
.owner-data > p { grid-column: 1 / -1; margin: 0; color: var(--color-teal-strong); font-size: .76rem; font-weight: 700; }
.owner-data input[readonly] { color: var(--color-text-body); background: var(--color-bg-card); cursor: default; }
.description { grid-column: auto; }
.responsible { align-self: center; min-height: 40px; padding: .6rem .75rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); color: var(--color-text-muted); background: var(--color-bg-subtle); font-size: .75rem; margin: 0; }
@media (max-width: 450px) { .client-search, .owner-data { grid-template-columns: 1fr; }.owner-data > p { grid-column: auto; } }
</style>
