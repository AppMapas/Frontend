<script setup>
import { ref } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { UNITS } from '../domain/units.js'
defineProps({ busy: Boolean })
const emit = defineEmits(['rectangle', 'courses', 'free'])
const mode = ref('free')
const width = ref(20), height = ref(30), unit = ref('metros')
const courses = ref([
  { value: 20, unit: 'metros', bearing: 90 }, { value: 30, unit: 'metros', bearing: 0 },
  { value: 20, unit: 'metros', bearing: 270 }, { value: 30, unit: 'metros', bearing: 180 },
])
function choose(value) { mode.value = value; if (value === 'free') emit('free') }
</script>

<template>
  <fieldset class="creator" :disabled="busy">
    <legend>Método de creación</legend>
    <div class="modes" role="group" aria-label="Forma de crear el plano">
      <BaseButton v-for="option in [{ id: 'free', label: 'Dibujo libre' }, { id: 'rectangle', label: 'Rectángulo' }, { id: 'courses', label: 'Por medidas y dirección' }]"
        :key="option.id" :variant="mode === option.id ? 'secondary' : 'outline'" :aria-pressed="mode === option.id" @click="choose(option.id)">{{ option.label }}</BaseButton>
    </div>
    <p v-if="mode === 'free'" class="hint">Marca las esquinas como antes. Puedes cerrar con el botón o haciendo clic en el primer punto.</p>
    <form v-else-if="mode === 'rectangle'" class="rectangle" @submit.prevent="$emit('rectangle', width, height, unit)">
      <label>Ancho<input v-model="width" required type="number" min="0.001" step="any"></label>
      <label>Largo<input v-model="height" required type="number" min="0.001" step="any"></label>
      <label>Unidad<select v-model="unit"><option v-for="item in UNITS" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
      <BaseButton type="submit">Crear rectángulo</BaseButton>
    </form>
    <form v-else @submit.prevent="$emit('courses', courses)">
      <p class="hint">Ingresa los tramos en orden. Dirección desde el norte: 0° norte, 90° este, 180° sur, 270° oeste. El último tramo cierra el croquis.</p>
      <div v-for="(course, i) in courses" :key="i" class="course-row">
        <span>{{ i + 1 }}</span>
        <label>Longitud<input v-model="course.value" required type="number" min="0.001" step="any"></label>
        <label>Unidad<select v-model="course.unit"><option v-for="item in UNITS" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
        <label>Dirección (°)<input v-model="course.bearing" required type="number" min="0" max="360" step="any"></label>
        <BaseButton variant="ghost" :disabled="courses.length <= 3" :aria-label="`Quitar tramo ${i + 1}`" @click="courses.splice(i, 1)">×</BaseButton>
      </div>
      <div class="modes">
        <BaseButton variant="outline" @click="courses.push({ value: '', unit, bearing: '' })">+ Añadir tramo</BaseButton>
        <BaseButton type="submit">Crear desde medidas</BaseButton>
      </div>
    </form>
    <p v-if="mode !== 'free'" class="hint">Crear reemplaza el croquis actual; puedes recuperarlo con Deshacer.</p>
  </fieldset>
</template>

<style scoped>
.creator { border: 0; padding: 0; min-width: 0; }
legend { color: var(--color-text-muted); font-size: .72rem; font-weight: 700; }
.modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .4rem; margin: .6rem 0; }
.modes :deep(.base-button) { width: 100%; height: auto; min-height: 34px; padding-inline: .45rem; white-space: normal; }
.rectangle { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .6rem; align-items: end; }
.rectangle :deep(.base-button) { grid-column: 1 / -1; width: 100%; }
.course-row { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr); gap: .5rem; align-items: end; margin-bottom: .6rem; }
.course-row label:last-of-type { grid-column: 2; }
label { display: grid; gap: .3rem; font-size: .8rem; min-width: 0; }
input, select { padding: .5rem; width: 100%; min-width: 0; }
.hint { margin: .55rem 0; font-size: .76rem; color: var(--color-text-muted); line-height: 1.5; }
@media (max-width: 500px) { .modes { grid-template-columns: 1fr; } }
</style>
