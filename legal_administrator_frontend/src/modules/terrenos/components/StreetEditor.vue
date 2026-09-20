<script setup>
import BaseButton from '@/components/common/BaseButton.vue'
import { UNITS } from '../domain/units.js'
defineProps({ street: Object, regions: Array, active: Boolean, kind: String, busy: Boolean, saving: Boolean, canSave: Boolean, alreadySaved: Boolean, records: Array, downloadingId: Number, uncertain: Boolean })
defineEmits(['start', 'divide', 'update', 'calculate', 'cancel', 'rename', 'save', 'download', 'retry'])
</script>

<template>
  <section class="street-editor" aria-label="Calle y subdivisiones">
    <h3>Calles y subdivisiones</h3>
    <div v-if="!active && !regions.length" class="actions">
      <BaseButton variant="outline" :disabled="busy" @click="$emit('start')">Trazar calle</BaseButton>
      <BaseButton variant="outline" :disabled="busy" @click="$emit('divide')">Dividir por línea</BaseButton>
    </div>
    <template v-if="active || regions.length">
      <p v-if="street.points.length < 2" class="hint" aria-live="polite">Marca dos puntos en el plano para definir la dirección ({{ street.points.length }}/2).</p>
      <fieldset v-if="kind === 'street' && street.points.length === 2" :disabled="busy" class="width-inputs">
        <label>Ancho de calle<input type="number" min="0" step="any" :value="street.width" @input="$emit('update', 'width', $event.target.value)"></label>
        <label>Unidad<select :value="street.unit" @change="$emit('update', 'unit', $event.target.value)"><option v-for="unit in UNITS" :key="unit.value" :value="unit.value">{{ unit.label }}</option></select></label>
      </fieldset>
      <p v-if="regions.length" class="hint">Selecciona y arrastra los extremos del corte para ajustarlo.</p>
      <label v-for="(region, i) in regions" :key="i" class="region">
        Nombre de {{ kind === 'street' && i === 1 ? 'la calle' : 'lote' }}
        <input :disabled="busy" :value="region.cutName" @input="$emit('rename', i, $event.target.value)">
        <span>{{ region.area.toFixed(2) }} m²</span>
      </label>
      <p v-if="regions.length" class="hint">Total: {{ regions.reduce((sum, region) => sum + region.area, 0).toFixed(2) }} m²</p>
      <div class="actions">
        <BaseButton v-if="!regions.length" :disabled="street.points.length !== 2 || busy" @click="$emit('calculate')">Calcular división</BaseButton>
        <BaseButton v-if="regions.length" :disabled="!canSave || alreadySaved || busy || uncertain" :loading="saving" @click="$emit('save')">{{ alreadySaved ? 'Subdivisiones guardadas' : records.length ? 'Guardar como nuevas subdivisiones' : 'Guardar subdivisiones' }}</BaseButton>
        <BaseButton variant="outline" :disabled="busy" @click="$emit('cancel')">Quitar división</BaseButton>
      </div>
      <p v-if="regions.length && !canSave" class="hint">Guarda primero la versión actual del terreno para registrar estos lotes.</p>
    </template>
    <p v-if="uncertain" role="alert" class="hint">No se pudo confirmar el guardado. Revisa si los lotes ya existen antes de reintentar.</p>
    <BaseButton v-if="uncertain" variant="outline" :disabled="busy" @click="$emit('retry')">Ya revisé los registros: reintentar</BaseButton>
    <div v-if="records.length" class="saved">
      <h4>Últimos lotes registrados</h4>
      <div v-for="record in records" :key="record.id">
        <p>{{ record.terrainName }} · {{ record.totalAreaSquareMeters.toFixed(2) }} m²</p>
        <BaseButton size="sm" variant="outline" :loading="downloadingId === record.id" :disabled="downloadingId !== null" @click="$emit('download', record.id)">Reporte del lote {{ record.id }}</BaseButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.street-editor { padding: 0; }
h3 { font-size: 1rem; margin: 0 0 .75rem; }
h4 { font-size: .85rem; margin-bottom: .5rem; }
.hint { font-size: .8rem; color: var(--color-text-muted); line-height: 1.5; }
.width-inputs { border: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; margin-bottom: 1rem; }
label { display: grid; gap: .3rem; font-size: .8rem; min-width: 0; }
.region { margin: .8rem 0; }
input, select { width: 100%; min-width: 0; padding: .5rem; }
.actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.saved { display: grid; gap: .6rem; padding-top: .85rem; font-size: .8rem; margin-top: 1rem; border-top: 1px solid var(--color-border-medium); }
.saved > div { padding: .7rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); background: var(--color-bg-subtle); }
</style>
