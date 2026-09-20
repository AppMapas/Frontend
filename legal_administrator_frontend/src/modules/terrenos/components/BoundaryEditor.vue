<script setup>
import BaseButton from '@/components/common/BaseButton.vue'
import { UNITS, sumDraftMeasurements } from '../domain/units.js'
import { vertexLabel } from '../domain/geometry.js'
defineProps({ boundaries: { type: Array, required: true }, selectedSideId: { type: Number, default: null } })
defineEmits(['measurement', 'add', 'remove', 'boundary', 'select'])
function total(measurements) {
  try { return `${sumDraftMeasurements(measurements).toFixed(3)} m` } catch { return 'Completa las medidas' }
}
</script>

<template>
  <div class="boundaries">
    <fieldset v-for="(side, i) in boundaries" :id="`terrain-side-${side.id}`" :key="side.id" :class="{ selected: selectedSideId === side.id }" @focusin="$emit('select', side.id)">
      <legend>Lado {{ vertexLabel(i) }}–{{ vertexLabel((i + 1) % boundaries.length) }}</legend>
      <div v-for="(measurement, index) in side.measurements" :key="index" class="measurement-row">
        <label>Medida {{ index + 1 }}
          <input type="number" min="0" step="any" inputmode="decimal" :value="measurement.value" placeholder="0.00"
            @input="$emit('measurement', side.id, index, 'value', $event.target.value)">
        </label>
        <label>Unidad
          <select :value="measurement.unit" @change="$emit('measurement', side.id, index, 'unit', $event.target.value)">
            <option v-for="unit in UNITS" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
          </select>
        </label>
        <BaseButton variant="ghost" :disabled="side.measurements.length === 1" :aria-label="`Quitar medida ${index + 1} del lado ${i + 1}`" @click="$emit('remove', side.id, index)">×</BaseButton>
      </div>
      <div class="sum-row"><BaseButton size="sm" variant="outline" @click="$emit('add', side.id)">+ Añadir medida</BaseButton><output>{{ total(side.measurements) }}</output></div>
      <div class="reference-row">
        <label>Orientación
          <select :value="side.orientation" @change="$emit('boundary', side.id, 'orientation', $event.target.value)">
            <option value="">Sin indicar</option><option value="N">Norte</option><option value="S">Sur</option><option value="E">Este</option><option value="O">Oeste</option>
          </select>
        </label>
        <label>Colinda con
          <input :value="side.referencePoint" placeholder="Calle, vecino, río…" @input="$emit('boundary', side.id, 'referencePoint', $event.target.value)">
        </label>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.boundaries { display: grid; gap: .7rem; max-height: 620px; padding: .1rem .25rem .1rem .1rem; overflow-y: auto; scrollbar-width: thin; }
fieldset { border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); padding: .75rem; min-width: 0; background: var(--color-bg-card); transition: border-color var(--transition-fast), background-color var(--transition-fast), box-shadow var(--transition-fast); }
fieldset.selected { border-color: var(--color-teal-strong); background: var(--color-primary-subtle); box-shadow: 0 0 0 2px var(--color-primary-subtle); }
legend { color: var(--color-teal-strong); font-weight: 700; padding: 0 .3rem; }
.measurement-row { display: grid; grid-template-columns: 1fr 1fr auto; align-items: end; gap: .4rem; margin-bottom: .6rem; }
label { display: grid; gap: .3rem; min-width: 0; font-size: .75rem; color: var(--color-text-muted); }
input, select { width: 100%; min-width: 0; padding: .5rem; }
.sum-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .5rem; margin: .75rem 0; }
output { color: var(--color-teal-strong); font-size: .8rem; font-weight: 700; }
.reference-row { display: grid; grid-template-columns: 1fr 2fr; gap: .6rem; }
@media (max-width: 1020px) { .boundaries { max-height: none; } }
@media (max-width: 520px) { .measurement-row, .reference-row { grid-template-columns: 1fr; } }
</style>
