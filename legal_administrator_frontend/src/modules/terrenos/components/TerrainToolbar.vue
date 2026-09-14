<script setup>
import BaseButton from '@/components/common/BaseButton.vue'
defineProps({
  stage: String,
  vertexCount: { type: Number, default: 0 },
  canExport: Boolean,
  canUndo: Boolean,
  canRedo: Boolean,
  tool: { type: String, default: 'draw' },
  snapEnabled: { type: Boolean, default: true },
  selectedVertexIndex: { type: Number, default: null },
  busy: Boolean,
})
defineEmits(['close', 'undo', 'resume', 'example', 'reset', 'export', 'tool', 'undo-history', 'redo', 'delete-vertex', 'zoom-in', 'zoom-out', 'fit', 'snap'])

const tools = [
  { value: 'draw', label: 'Dibujar', icon: '✎' },
  { value: 'select', label: 'Seleccionar', icon: '↖' },
  { value: 'pan', label: 'Mover vista', icon: '↔' },
  { value: 'street', label: 'Calle', icon: '╫' },
  { value: 'divide', label: 'Dividir', icon: '╱' },
]
</script>

<template>
  <div class="toolbar" aria-label="Herramientas del plano">
    <div class="toolbar-group" role="group" aria-label="Elegir herramienta">
      <BaseButton v-for="item in tools" :key="item.value" size="sm"
        :variant="tool === item.value ? 'secondary' : 'outline'" :aria-pressed="tool === item.value"
        :disabled="busy || (['street', 'divide'].includes(item.value) && !canExport)"
        @click="$emit('tool', item.value)">
        <span aria-hidden="true">{{ item.icon }}</span> {{ item.label }}
      </BaseButton>
    </div>
    <div class="toolbar-group" role="group" aria-label="Editar plano">
      <BaseButton v-if="stage === 'drawing'" size="sm" :disabled="busy || vertexCount < 3" @click="$emit('close')">Cerrar polígono</BaseButton>
      <BaseButton v-else size="sm" variant="outline" :disabled="busy" @click="$emit('resume')">Volver al trazado</BaseButton>
      <BaseButton size="sm" variant="outline" :disabled="busy || !canUndo" title="Deshacer (Ctrl+Z)" @click="$emit('undo-history')">↶ Deshacer</BaseButton>
      <BaseButton size="sm" variant="outline" :disabled="busy || !canRedo" title="Rehacer (Ctrl+Mayús+Z)" @click="$emit('redo')">↷ Rehacer</BaseButton>
      <BaseButton size="sm" variant="outline" :disabled="busy || selectedVertexIndex === null" @click="$emit('delete-vertex')">Eliminar punto</BaseButton>
    </div>
    <div class="toolbar-group" role="group" aria-label="Vista y ajustes">
      <BaseButton size="sm" variant="outline" aria-label="Acercar" @click="$emit('zoom-in')">＋</BaseButton>
      <BaseButton size="sm" variant="outline" aria-label="Alejar" @click="$emit('zoom-out')">−</BaseButton>
      <BaseButton size="sm" variant="outline" @click="$emit('fit')">Ajustar vista</BaseButton>
      <label class="snap-control"><input type="checkbox" :checked="snapEnabled" :disabled="busy" @change="$emit('snap', $event.target.checked)"> Ajustar a puntos, cuadrícula y ángulos</label>
    </div>
    <div class="toolbar-group" role="group" aria-label="Acciones del plano">
      <BaseButton size="sm" variant="secondary" :disabled="busy" @click="$emit('example')">Cargar ejemplo</BaseButton>
      <BaseButton size="sm" variant="soft" :disabled="busy || !vertexCount" @click="$emit('reset')">Reiniciar</BaseButton>
      <BaseButton size="sm" variant="outline" :disabled="busy || !canExport" @click="$emit('export')">Exportar PNG</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; flex-direction: column; align-items: flex-start; gap: .65rem; margin-top: 1rem; }
.toolbar-group { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; }
.snap-control { display: inline-flex; align-items: center; gap: .45rem; color: var(--color-text-body); font-size: .8rem; cursor: pointer; }
.snap-control input { accent-color: var(--color-teal, #44878F); width: 1rem; height: 1rem; }
</style>
