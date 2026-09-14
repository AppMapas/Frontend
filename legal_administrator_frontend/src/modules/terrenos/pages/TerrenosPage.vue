<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import TerrainCanvas from '../components/TerrainCanvas.vue'
import TerrainToolbar from '../components/TerrainToolbar.vue'
import TerrainDetails from '../components/TerrainDetails.vue'
import TerrainCreator from '../components/TerrainCreator.vue'
import SideInspector from '../components/SideInspector.vue'
import BoundaryEditor from '../components/BoundaryEditor.vue'
import TerrainResults from '../components/TerrainResults.vue'
import StreetEditor from '../components/StreetEditor.vue'
import { useTerrainStore } from '../stores/terrainStore.js'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import { VARA_TO_METERS } from '../domain/units.js'
import { createTerrainPdf } from '../domain/terrainPdf.js'

const terrain = useTerrainStore()
const auth = useAuthStore()
const canvas = ref(null)
const selectedSideIndex = computed(() => terrain.boundaries.findIndex((side) => side.id === terrain.selectedSideId))
const splitSaved = computed(() => terrain.savedSplitFingerprint === JSON.stringify([terrain.savedRecord?.id, terrain.subdivisions]))
const status = computed(() => {
  if (terrain.isSaving) return 'Guardando terreno…'
  if (terrain.isConverting) return 'Convirtiendo medidas…'
  if (terrain.activeTool === 'street') return 'Marca la entrada y salida de la calle'
  if (terrain.activeTool === 'divide') return 'Marca dos puntos para dividir'
  return { drawing: '1 · Dibuja las esquinas en orden', measuring: '2 · Ingresa las medidas', done: '3 · Revisa y guarda el terreno' }[terrain.stage]
})
function addPoint(point) {
  if (['street', 'divide'].includes(terrain.activeTool)) terrain.addStreetPoint(point)
  else terrain.addVertex(point)
}
async function selectSide(id) {
  terrain.selectedSideId = id
  if (id === null) return
  await nextTick()
  document.getElementById('terrain-side-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function serverPdf(id) {
  const blob = await terrain.downloadServerPdf(id)
  if (blob) download(blob, 'reporte-servidor-' + id + '.pdf')
}
function localPdf() {
  try {
    download(createTerrainPdf({
      terrain: terrain.terrain, vertices: terrain.result.vertices, boundaries: terrain.boundaries,
      regions: terrain.subdivisions, result: terrain.result,
      serverRecord: terrain.isCurrentSaved ? terrain.savedRecord : null,
    }), 'plano-terreno.pdf')
  } catch (error) { terrain.error = error.message }
}
function keyboard(event) {
  if (event.target.closest('input, textarea, select, [contenteditable="true"]') || terrain.busy) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) terrain.redo()
    else terrain.undo()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault(); terrain.redo()
  } else if (event.key === 'Escape') terrain.setTool('select')
  else if (event.key === 'Delete' && terrain.selectedVertexIndex !== null) {
    event.preventDefault(); terrain.deleteVertex()
  }
}
watch(() => auth.user?.email, (email) => { if (email) terrain.loadReferences(email) }, { immediate: true })
onMounted(() => window.addEventListener('keydown', keyboard))
onBeforeUnmount(() => window.removeEventListener('keydown', keyboard))
</script>

<template>
  <div class="terrenos-page">
    <PageHeader title="Cálculo de terrenos" eyebrow="Plano de trazo" subtitle="Dibuja libremente, usa una plantilla o ingresa los tramos de la escritura." />
    <BaseCard>
      <fieldset class="unstyled" :disabled="terrain.busy">
        <TerrainDetails :terrain="terrain.terrain" :clients="terrain.clients" :current-user="terrain.currentUser" :loading="terrain.isLoadingReferences" @update="terrain.updateTerrain" />
      </fieldset>
      <p v-if="terrain.referenceError" class="error" role="alert">{{ terrain.referenceError }}</p>
      <BaseButton v-if="terrain.referenceError || !terrain.clients.length" variant="outline" size="sm" :loading="terrain.isLoadingReferences" :disabled="terrain.busy" @click="terrain.loadReferences(auth.user?.email)">Actualizar clientes y responsable</BaseButton>
    </BaseCard>
    <p class="local-note">1 vara = {{ VARA_TO_METERS }} m · El dibujo se conserva al navegar. Descarga el plano antes de recargar la página para conservarlo.</p>
    <p v-if="terrain.error" class="error" role="alert">{{ terrain.error }}</p>
    <p v-if="terrain.notice" class="notice" role="status">{{ terrain.notice }}</p>
    <div class="editor-grid">
      <BaseCard class="drawing-card">
        <template #header><h2>Plano de trazo</h2><span class="status" aria-live="polite">{{ status }}</span></template>
        <TerrainCreator :busy="terrain.busy" @rectangle="terrain.rectangle" @courses="terrain.fromCourses" @free="terrain.setTool('draw')" />
        <TerrainCanvas ref="canvas" :vertices="terrain.displayVertices" :boundaries="terrain.boundaries"
          :closed="terrain.stage !== 'drawing'" :calculated="Boolean(terrain.result)" :tool="terrain.activeTool" :busy="terrain.busy"
          :regions="terrain.subdivisions" :street-points="terrain.street.points" :selected-side-id="terrain.selectedSideId"
          :selected-vertex-index="terrain.selectedVertexIndex" :snap-enabled="terrain.snapEnabled"
          @point="addPoint" @select-side="selectSide" @select-vertex="terrain.selectedVertexIndex = $event"
          @move-vertex="terrain.moveVertex" @insert-vertex="terrain.insertVertex" @move-street-point="terrain.moveStreetPoint" @close="terrain.closePolygon" />
        <TerrainToolbar :stage="terrain.stage" :vertex-count="terrain.vertices.length" :can-export="Boolean(terrain.result)"
          :tool="terrain.activeTool" :snap-enabled="terrain.snapEnabled" :can-undo="terrain.canUndo" :can-redo="terrain.canRedo"
          :selected-vertex-index="terrain.selectedVertexIndex" :busy="terrain.busy"
          @close="terrain.closePolygon" @undo="terrain.undoVertex" @resume="terrain.resumeDrawing"
          @example="terrain.loadExample" @reset="terrain.resetEditor" @export="canvas?.exportPng()"
          @tool="terrain.setTool" @undo-history="terrain.undo" @redo="terrain.redo" @delete-vertex="terrain.deleteVertex"
          @snap="terrain.snapEnabled = $event" @zoom-in="canvas?.zoomIn()" @zoom-out="canvas?.zoomOut()" @fit="canvas?.fit()" />
        <p class="hint">Selecciona un vértice para moverlo, o haz doble clic en un lado para insertar otro. Al mover una esquina se actualizan sus lados. Ctrl/Cmd + Z deshace; Mayús + Ctrl/Cmd + Z rehace.</p>
        <SideInspector v-if="selectedSideIndex >= 0 && terrain.stage !== 'drawing'" :vertices="terrain.displayVertices" :side-index="selectedSideIndex" :busy="terrain.busy" @edit="terrain.editSide" />
      </BaseCard>
      <BaseCard>
        <template #header><h2>Colindancias y resultados</h2></template>
        <div class="side-content">
          <p v-if="terrain.stage === 'drawing'" class="hint">Marca las esquinas y cierra el polígono. Las medidas se conservan al volver al trazado.</p>
          <fieldset v-else class="unstyled" :disabled="terrain.busy">
            <BoundaryEditor :boundaries="terrain.boundaries" :selected-side-id="terrain.selectedSideId"
              @measurement="terrain.updateMeasurement" @add="terrain.addMeasurement" @remove="terrain.removeMeasurement"
              @boundary="terrain.updateBoundary" @select="terrain.selectedSideId = $event" />
            <div class="actions calculation-actions">
              <BaseButton variant="outline" :disabled="!terrain.canCalculate || terrain.busy" @click="terrain.calculate">Vista previa</BaseButton>
              <BaseButton :disabled="!terrain.canCalculate || terrain.busy" :loading="terrain.isConverting" @click="terrain.calculateRemote">Convertir y calcular</BaseButton>
            </div>
          </fieldset>
          <TerrainResults v-if="terrain.result" :result="terrain.result" :record="terrain.savedRecord" :current="terrain.isCurrentSaved" :converted="terrain.convertedRevision === terrain.revision" />
          <div v-if="terrain.result" class="save-panel">
            <p v-if="terrain.savedRecord && !terrain.isCurrentSaved" class="hint">Los cambios se guardarán como un cálculo nuevo. El registro {{ terrain.savedRecord.id }} se conserva.</p>
            <p v-if="terrain.saveUncertain" class="error">No se pudo confirmar el guardado. Comprueba si el cálculo ya existe antes de reintentar.</p>
            <BaseButton v-if="terrain.saveUncertain" variant="outline" :disabled="terrain.busy" @click="terrain.saveUncertain = false; terrain.save()">Ya revisé los registros: reintentar</BaseButton>
            <BaseButton v-else block :disabled="terrain.busy || terrain.isCurrentSaved || terrain.isLoadingReferences || !terrain.currentUser || !terrain.terrain.clientDpi" :loading="terrain.isSaving" @click="terrain.save">
              {{ terrain.isCurrentSaved ? 'Terreno guardado' : terrain.savedRecord ? 'Guardar como nuevo cálculo' : 'Guardar terreno' }}
            </BaseButton>
            <div class="actions">
              <BaseButton variant="outline" @click="localPdf">Descargar PDF del plano</BaseButton>
              <BaseButton v-if="terrain.savedRecord" variant="outline" :loading="terrain.downloadingId === terrain.savedRecord.id" :disabled="terrain.downloadingId !== null" @click="serverPdf(terrain.savedRecord.id)">Reporte del servidor</BaseButton>
            </div>
            <p class="hint">El PDF del plano conserva tu dibujo. El reporte del servidor contiene su cálculo registrado y un esquema de referencia.</p>
          </div>
          <StreetEditor v-if="terrain.result" :street="terrain.street" :regions="terrain.subdivisions" :active="['street', 'divide'].includes(terrain.activeTool)"
            :kind="terrain.cutKind" :busy="terrain.busy" :saving="terrain.isSavingSplit" :can-save="terrain.isCurrentSaved" :already-saved="splitSaved"
            :records="terrain.savedSubdivisions" :downloading-id="terrain.downloadingId" :uncertain="terrain.splitUncertain"
            @start="terrain.startStreet" @divide="terrain.startCut('divide')" @update="terrain.updateStreet" @calculate="terrain.calculateStreet" @cancel="terrain.cancelStreet"
            @rename="terrain.renameRegion" @save="terrain.saveSplit" @download="serverPdf" @retry="terrain.splitUncertain = false; terrain.saveSplit()" />
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.terrenos-page { width: 100%; }
.editor-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(340px, 1fr); gap: 1.25rem; align-items: start; }
.drawing-card { position: sticky; top: calc(var(--navbar-height) + 1rem); }
h2 { font-size: 1rem; margin: 0; }
.status { font-size: .75rem; color: var(--color-teal-strong); margin-left: 1rem; text-align: right; }
.hint, .local-note { font-size: .8rem; color: var(--color-text-muted); line-height: 1.6; }
.local-note { margin: 1rem 0; }
.side-content { display: grid; gap: 1.2rem; }
.error { padding: .8rem; border-left: 4px solid var(--color-coral); border-radius: var(--radius-sm); background: var(--color-primary-subtle); color: var(--color-text-title); font-size: .85rem; }
.notice { padding: .8rem; background: var(--color-bg-subtle); border-left: 4px solid var(--color-teal); }
.actions { display: flex; flex-wrap: wrap; gap: .5rem; margin: .8rem 0; }
.unstyled { margin: 0; padding: 0; border: 0; min-width: 0; }
.calculation-actions { margin-top: 1rem; }
.save-panel { padding-top: .5rem; }
@media (max-width: 1150px) { .editor-grid { grid-template-columns: 1fr; } .drawing-card { position: static; } }
</style>
