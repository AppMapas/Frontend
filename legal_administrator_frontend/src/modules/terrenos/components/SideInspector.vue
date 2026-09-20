<script setup>
import { ref, watch } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { bearingDegrees, distance, vertexLabel } from '../domain/geometry.js'
import { UNITS } from '../domain/units.js'
const props = defineProps({ vertices: Array, sideIndex: Number, busy: Boolean })
defineEmits(['edit'])
const value = ref(''), unit = ref('metros'), bearing = ref('')
watch(() => [props.vertices, props.sideIndex], () => {
  const a = props.vertices[props.sideIndex], b = props.vertices[(props.sideIndex + 1) % props.vertices.length]
  if (!a || !b) return
  value.value = Number(distance(a, b).toFixed(4)); bearing.value = Number(bearingDegrees(a, b).toFixed(2)); unit.value = 'metros'
}, { immediate: true, deep: true })
</script>

<template>
  <form class="inspector" @submit.prevent="$emit('edit', sideIndex, value, unit, bearing)">
    <strong>Lado {{ vertexLabel(sideIndex) }}–{{ vertexLabel((sideIndex + 1) % vertices.length) }}</strong>
    <fieldset :disabled="busy">
      <label>Longitud<input v-model="value" required type="number" min="0.001" step="any"></label>
      <label>Unidad<select v-model="unit"><option v-for="item in UNITS" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
      <label>Dirección (°)<input v-model="bearing" required type="number" min="0" max="360" step="any"></label>
      <BaseButton type="submit" size="sm">Aplicar</BaseButton>
    </fieldset>
    <p>Al mover su extremo se actualiza también la longitud del lado vecino.</p>
  </form>
</template>

<style scoped>
.inspector { margin-top: .8rem; padding: .8rem; border: 1px solid var(--color-border-subtle); background: var(--color-bg-subtle); border-radius: var(--radius-sm); }
.inspector strong { color: var(--color-teal-strong); }
fieldset { border: 0; padding: .6rem 0 0; display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: .5rem; align-items: end; }
label { display: grid; gap: .3rem; font-size: .75rem; min-width: 0; }
input, select { width: 100%; min-width: 0; padding: .4rem; }
p { color: var(--color-text-muted); font-size: .75rem; margin-bottom: 0; }
@media (max-width: 500px) { fieldset { grid-template-columns: 1fr 1fr; } }
</style>
