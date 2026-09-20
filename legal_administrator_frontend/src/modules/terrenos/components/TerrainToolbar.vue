<script setup>
import { ref } from 'vue'
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
defineEmits(['close', 'undo', 'resume', 'example', 'reset', 'export', 'tool', 'undo-history', 'redo', 'delete-vertex', 'zoom-in', 'zoom-out', 'fit', 'snap', 'pan-left', 'pan-right', 'pan-up', 'pan-down'])

const toolbar = ref(null)
function scrollToolbar(direction) {
  toolbar.value?.scrollBy({ left: direction * Math.min(360, toolbar.value.clientWidth * 0.72), behavior: 'smooth' })
}

const tools = [
  { value: 'draw', label: 'Dibujar', icon: '✎' },
  { value: 'select', label: 'Seleccionar', icon: '↖' },
  { value: 'pan', label: 'Mover vista', icon: '↔' },
  { value: 'street', label: 'Calle', icon: '╫' },
  { value: 'divide', label: 'Dividir', icon: '╱' },
]
</script>

<template>
  <div class="toolbar-shell">
    <button type="button" class="toolbar-nav" aria-label="Ver herramientas anteriores" title="Herramientas anteriores" @click="scrollToolbar(-1)">‹</button>
    <div ref="toolbar" class="toolbar" aria-label="Herramientas del plano">
      <div class="toolbar-group" role="group" aria-label="Elegir herramienta">
        <span class="group-label">Herramientas</span>
        <BaseButton v-for="item in tools" :key="item.value" size="sm"
          :variant="tool === item.value ? 'secondary' : 'outline'" :aria-pressed="tool === item.value"
          :disabled="busy || (['street', 'divide'].includes(item.value) && !canExport)"
          @click="$emit('tool', item.value)">
          <span aria-hidden="true">{{ item.icon }}</span> {{ item.label }}
        </BaseButton>
      </div>
      <div class="toolbar-group" role="group" aria-label="Editar plano">
        <span class="group-label">Edición</span>
        <BaseButton v-if="stage === 'drawing'" size="sm" :disabled="busy || vertexCount < 3" @click="$emit('close')">Cerrar polígono</BaseButton>
        <BaseButton v-else size="sm" variant="outline" :disabled="busy" @click="$emit('resume')">Volver al trazado</BaseButton>
        <BaseButton size="sm" variant="outline" :disabled="busy || !canUndo" title="Deshacer (Ctrl+Z)" @click="$emit('undo-history')">↶ Deshacer</BaseButton>
        <BaseButton size="sm" variant="outline" :disabled="busy || !canRedo" title="Rehacer (Ctrl+Mayús+Z)" @click="$emit('redo')">↷ Rehacer</BaseButton>
        <BaseButton size="sm" variant="outline" :disabled="busy || selectedVertexIndex === null" @click="$emit('delete-vertex')">Eliminar punto</BaseButton>
      </div>
      <div class="toolbar-group" role="group" aria-label="Vista y ajustes">
        <span class="group-label">Vista</span>
        <BaseButton size="sm" variant="outline" aria-label="Acercar" @click="$emit('zoom-in')">＋</BaseButton>
        <BaseButton size="sm" variant="outline" aria-label="Alejar" @click="$emit('zoom-out')">−</BaseButton>
        <BaseButton size="sm" variant="outline" @click="$emit('fit')">Ajustar vista</BaseButton>
        <div class="pan-pad" role="group" aria-label="Desplazar el plano">
          <BaseButton size="sm" variant="ghost" aria-label="Mover plano hacia arriba" title="Mover arriba" @click="$emit('pan-up')">↑</BaseButton>
          <BaseButton size="sm" variant="ghost" aria-label="Mover plano hacia la izquierda" title="Mover a la izquierda" @click="$emit('pan-left')">←</BaseButton>
          <BaseButton size="sm" variant="ghost" aria-label="Mover plano hacia abajo" title="Mover abajo" @click="$emit('pan-down')">↓</BaseButton>
          <BaseButton size="sm" variant="ghost" aria-label="Mover plano hacia la derecha" title="Mover a la derecha" @click="$emit('pan-right')">→</BaseButton>
        </div>
        <label class="snap-control"><input type="checkbox" :checked="snapEnabled" :disabled="busy" @change="$emit('snap', $event.target.checked)"> Ajustar a puntos, cuadrícula y ángulos</label>
      </div>
      <div class="toolbar-group" role="group" aria-label="Acciones del plano">
        <span class="group-label">Archivo</span>
        <BaseButton size="sm" variant="secondary" :disabled="busy" @click="$emit('example')">Cargar ejemplo</BaseButton>
        <BaseButton size="sm" variant="soft" :disabled="busy || !vertexCount" @click="$emit('reset')">Reiniciar</BaseButton>
        <BaseButton size="sm" variant="outline" :disabled="busy || !canExport" @click="$emit('export')">Exportar PNG</BaseButton>
      </div>
    </div>
    <button type="button" class="toolbar-nav" aria-label="Ver más herramientas" title="Más herramientas" @click="scrollToolbar(1)">›</button>
  </div>
</template>

<style scoped>
.toolbar-shell { display: grid; grid-template-columns: 2rem minmax(0, 1fr) 2rem; align-items: stretch; gap: .4rem; }
.toolbar { display: flex; align-items: stretch; gap: .55rem; overflow-x: auto; scroll-behavior: smooth; scrollbar-width: none; }
.toolbar::-webkit-scrollbar { display: none; }
.toolbar-nav { display: grid; min-height: 100%; place-items: center; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); color: var(--color-teal-strong); background: var(--color-bg-elevated); font-size: 1.35rem; font-weight: 700; transition: background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast); }
.toolbar-nav:hover { border-color: var(--color-teal); background: var(--color-primary-subtle); }
.toolbar-nav:active { transform: scale(.96); }
.toolbar-group { display: flex; flex: 0 0 auto; flex-wrap: wrap; align-items: center; gap: .35rem; padding: .45rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); background: var(--color-bg-subtle); }
.group-label { flex-basis: 100%; color: var(--color-text-muted); font-size: .6rem; font-weight: 800; letter-spacing: .08em; line-height: 1; text-transform: uppercase; }
.pan-pad { display: inline-flex; gap: .1rem; padding-left: .25rem; border-left: 1px solid var(--color-border-medium); }
.pan-pad :deep(.base-button) { width: 2rem; padding-inline: 0; }
.snap-control { display: inline-flex; align-items: center; gap: .45rem; color: var(--color-text-body); font-size: .8rem; cursor: pointer; }
.snap-control input { accent-color: var(--color-teal, #44878F); width: 1rem; height: 1rem; }
@media (max-width: 760px) {
  .toolbar-group { flex-wrap: nowrap; }
  .group-label { display: none; }
}
</style>
