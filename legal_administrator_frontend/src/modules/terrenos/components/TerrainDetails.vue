<script setup>
import { computed, ref } from 'vue'
const props = defineProps({ terrain: { type: Object, required: true }, clients: { type: Array, default: () => [] }, currentUser: { type: Object, default: null }, loading: Boolean })
defineEmits(['update'])
const search = ref('')
const filteredClients = computed(() => props.clients.filter((client) => client.dpi === props.terrain.clientDpi || `${client.dpi} ${client.firstName} ${client.lastName}`.toLowerCase().includes(search.value.toLowerCase())))
</script>

<template>
  <div class="details-grid">
    <label>Buscar cliente<input v-model="search" placeholder="Nombre o DPI" type="search" :disabled="loading"></label>
    <label>Cliente propietario
      <select :value="terrain.clientDpi" :disabled="loading" @change="$emit('update', 'clientDpi', $event.target.value)">
        <option value="">{{ loading ? 'Cargando clientes…' : 'Selecciona un cliente' }}</option>
        <option v-for="client in filteredClients" :key="client.dpi" :value="client.dpi">{{ client.firstName }} {{ client.lastName }} · {{ client.dpi }}</option>
      </select>
    </label>
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
.description { grid-column: auto; }
.responsible { align-self: center; min-height: 40px; padding: .6rem .75rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); color: var(--color-text-muted); background: var(--color-bg-subtle); font-size: .75rem; margin: 0; }
</style>
