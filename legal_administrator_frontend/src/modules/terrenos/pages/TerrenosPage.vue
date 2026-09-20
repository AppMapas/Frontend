<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
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
import { positiveDraftMeasurements, toMeters, VARA_TO_METERS } from '../domain/units.js'

const terrain = useTerrainStore()
const auth = useAuthStore()
const canvas = ref(null)
const pdfPreviewUrl = ref('')
const pdfPreviewBlob = ref(null)
const pdfPreviewId = ref(null)
const pdfRequestAction = ref('')
const selectedSideIndex = computed(() => terrain.boundaries.findIndex((side) => side.id === terrain.selectedSideId))
const splitSaved = computed(() => terrain.savedSplitFingerprint === JSON.stringify([terrain.savedRecord?.id, terrain.subdivisions]))
const status = computed(() => {
  if (terrain.isSaving) return 'Guardando terreno…'
  if (terrain.isConverting) return 'Convirtiendo, calculando y registrando…'
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
async function capturePlanImage() {
  terrain.calculate()
  if (!terrain.result) return ''
  await nextTick()
  return canvas.value?.toDataUrl() ?? ''
}
function buildFigureJson() {
  const round = (value) => Number(Number(value).toFixed(6))
  const orientationNames = { N: 'Norte', S: 'Sur', E: 'Oriente', O: 'Poniente' }
  const vertices = terrain.displayVertices.map(({ x, y }) => ({ x: round(x), y: round(y) }))

  return {
    meta: {
      unit: 'm',
      generatedAt: new Date().toISOString(),
      closed: terrain.stage !== 'drawing',
      calculated: Boolean(terrain.result),
    },
    vertices,
    boundaries: terrain.boundaries.map((side, sideIndex) => {
      const baseLabel = orientationNames[side.orientation]
        || String(side.referencePoint ?? '').trim()
        || `Lado ${sideIndex + 1}`
      const measurements = positiveDraftMeasurements(side.measurements)

      return {
        id: side.id,
        fromVertex: sideIndex,
        toVertex: (sideIndex + 1) % vertices.length,
        measurements: measurements.map((measurement, measurementIndex) => ({
          label: measurements.length > 1 ? `${baseLabel}, tramo ${measurementIndex + 1}` : baseLabel,
          value: round(toMeters(measurement)),
          unit: 'm',
        })),
      }
    }),
    regions: terrain.subdivisions.map((region) => ({
      cutName: region.cutName,
      area: round(region.area),
      points: region.points.map(({ x, y }) => ({ x: round(x), y: round(y) })),
    })),
    streetPoints: terrain.street.points.map(({ x, y }) => ({ x: round(x), y: round(y) })),
  }
}
async function convertAndCalculate() {
  const planImageBase64 = await capturePlanImage()
  if (!terrain.result) return
  console.log('[Terrenos] Estructura de la figura (JSON):\n' + JSON.stringify(buildFigureJson(), null, 2))
  await terrain.calculateRemote(planImageBase64)
}
async function saveTerrain() {
  const planImageBase64 = await capturePlanImage()
  await terrain.save(planImageBase64)
}
async function retrySave() {
  terrain.saveUncertain = false
  await saveTerrain()
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = name
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function serverPdf(id) {
  pdfRequestAction.value = 'download'
  try {
    const blob = await terrain.downloadServerPdf(id)
    if (blob) download(blob, 'reporte-servidor-' + id + '.pdf')
  } finally {
    pdfRequestAction.value = ''
  }
}
function closePdfPreview() {
  if (pdfPreviewUrl.value) URL.revokeObjectURL(pdfPreviewUrl.value)
  pdfPreviewUrl.value = ''
  pdfPreviewBlob.value = null
  pdfPreviewId.value = null
}
async function previewServerPdf(id) {
  pdfRequestAction.value = 'preview'
  try {
    const blob = await terrain.downloadServerPdf(id)
    if (!blob) return
    closePdfPreview()
    pdfPreviewBlob.value = blob
    pdfPreviewId.value = id
    pdfPreviewUrl.value = URL.createObjectURL(blob)
  } finally {
    pdfRequestAction.value = ''
  }
}
function downloadPreviewedPdf() {
  if (pdfPreviewBlob.value && pdfPreviewId.value) {
    download(pdfPreviewBlob.value, 'reporte-servidor-' + pdfPreviewId.value + '.pdf')
  }
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
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keyboard)
  closePdfPreview()
})
</script>

<template>
  <div class="terrenos-page">
    <PageHeader title="Cálculo de terrenos" eyebrow="Plano de trazo" subtitle="Dibuja libremente, usa una plantilla o ingresa los tramos de la escritura." />

    <!-- <aside class="legal-disclaimer" role="note" aria-label="Aviso sobre el valor legal del plano"> -->
      <!-- <span aria-hidden="true">!</span> -->
      <!-- <div> -->
        <!-- <strong>Aviso importante</strong> -->
        <!-- <p>Esta herramienta no posee valor legal. El polígono y las medidas generadas son datos preliminares de referencia y deben ser verificados por un profesional autorizado.</p> -->
      <!-- </div> -->
    <!-- </aside> -->

    <div class="context-strip" aria-label="Información de la sesión de dibujo">
      <span><strong>Conversión:</strong> 1 vara = {{ VARA_TO_METERS }} m</span>
      <span><strong>Cuerda:</strong> 1 cuerda = 26 varas</span>
      <span><strong>Borrador local:</strong> se conserva al navegar</span>
      <span>Descarga el plano antes de recargar la página.</span>
    </div>
    <p v-if="terrain.error" class="error" role="alert">{{ terrain.error }}</p>
    <p v-if="terrain.notice" class="notice" role="status">{{ terrain.notice }}</p>

    <div class="workspace-grid">
      <section class="canvas-column" aria-label="Área de trabajo del plano">
        <BaseCard class="drawing-card" padding="none">
          <template #header>
            <div class="panel-heading">
              <span class="panel-icon" aria-hidden="true">01</span>
              <div><p>Área de trabajo</p><h2>Plano de trazo</h2></div>
            </div>
            <span class="status" aria-live="polite">{{ status }}</span>
          </template>
          <div class="canvas-toolbar">
            <TerrainToolbar :stage="terrain.stage" :vertex-count="terrain.vertices.length" :can-export="Boolean(terrain.result)"
              :tool="terrain.activeTool" :snap-enabled="terrain.snapEnabled" :can-undo="terrain.canUndo" :can-redo="terrain.canRedo"
              :selected-vertex-index="terrain.selectedVertexIndex" :busy="terrain.busy"
              @close="terrain.closePolygon" @undo="terrain.undoVertex" @resume="terrain.resumeDrawing"
              @example="terrain.loadExample" @reset="terrain.resetEditor" @export="canvas?.exportPng()"
              @tool="terrain.setTool" @undo-history="terrain.undo" @redo="terrain.redo" @delete-vertex="terrain.deleteVertex"
              @snap="terrain.snapEnabled = $event" @zoom-in="canvas?.zoomIn()" @zoom-out="canvas?.zoomOut()" @fit="canvas?.fit()"
              @pan-left="canvas?.panLeft()" @pan-right="canvas?.panRight()" @pan-up="canvas?.panUp()" @pan-down="canvas?.panDown()" />
          </div>
          <div class="canvas-stage">
            <TerrainCanvas ref="canvas" :vertices="terrain.displayVertices" :boundaries="terrain.boundaries"
              :closed="terrain.stage !== 'drawing'" :calculated="Boolean(terrain.result)" :tool="terrain.activeTool" :busy="terrain.busy"
              :regions="terrain.subdivisions" :street-points="terrain.street.points" :selected-side-id="terrain.selectedSideId"
              :selected-vertex-index="terrain.selectedVertexIndex" :snap-enabled="terrain.snapEnabled"
              @point="addPoint" @select-side="selectSide" @select-vertex="terrain.selectedVertexIndex = $event"
              @move-vertex="terrain.moveVertex" @insert-vertex="terrain.insertVertex" @move-street-point="terrain.moveStreetPoint" @close="terrain.closePolygon" />
          </div>
          <div class="canvas-footer">
            <p class="hint">Selecciona un vértice para moverlo, o haz doble clic en un lado para insertar otro. Al mover una esquina se actualizan sus lados. Ctrl/Cmd + Z deshace; Mayús + Ctrl/Cmd + Z rehace.</p>
            <SideInspector v-if="selectedSideIndex >= 0 && terrain.stage !== 'drawing'" :vertices="terrain.displayVertices" :side-index="selectedSideIndex" :busy="terrain.busy" @edit="terrain.editSide" />
          </div>
        </BaseCard>
      </section>

      <aside class="workflow-sidebar" aria-label="Configuración y resultados del terreno">
        <BaseCard class="workflow-card creator-card" padding="sm">
          <template #header>
            <div class="panel-heading compact">
              <span class="panel-icon" aria-hidden="true">A</span>
              <div><p>Geometría</p><h2>Crear el plano</h2></div>
            </div>
          </template>
          <TerrainCreator :busy="terrain.busy" @rectangle="terrain.rectangle" @courses="terrain.fromCourses" @free="terrain.setTool('draw')" />
        </BaseCard>

        <BaseCard class="workflow-card measurements-card" padding="sm">
          <template #header>
            <div class="panel-heading compact">
              <span class="panel-icon" aria-hidden="true">B</span>
              <div><p>Medición</p><h2>Colindancias</h2></div>
            </div>
            <span v-if="terrain.stage !== 'drawing'" class="item-count">{{ terrain.boundaries.length }} lados</span>
          </template>
          <div class="side-content">
            <p v-if="terrain.stage === 'drawing'" class="hint">Marca las esquinas y cierra el polígono. Las medidas se conservan al volver al trazado.</p>
            <fieldset v-else class="unstyled" :disabled="terrain.busy">
              <BoundaryEditor :boundaries="terrain.boundaries" :selected-side-id="terrain.selectedSideId"
                @measurement="terrain.updateMeasurement" @add="terrain.addMeasurement" @remove="terrain.removeMeasurement"
                @boundary="terrain.updateBoundary" @select="terrain.selectedSideId = $event" />
              <div class="actions calculation-actions">
                <BaseButton variant="outline" :disabled="!terrain.canCalculate || terrain.busy" @click="terrain.calculate">Vista previa</BaseButton>
                <BaseButton :disabled="!terrain.canCalculate || terrain.busy" :loading="terrain.isConverting" @click="convertAndCalculate">Convertir y calcular</BaseButton>
              </div>
            </fieldset>
          </div>
        </BaseCard>

        <BaseCard v-if="terrain.result" class="workflow-card divisions-card" padding="sm">
          <StreetEditor v-if="terrain.result" :street="terrain.street" :regions="terrain.subdivisions" :active="['street', 'divide'].includes(terrain.activeTool)"
            :kind="terrain.cutKind" :busy="terrain.busy" :saving="terrain.isSavingSplit" :can-save="terrain.isCurrentSaved" :already-saved="splitSaved"
            :records="terrain.savedSubdivisions" :downloading-id="terrain.downloadingId" :uncertain="terrain.splitUncertain"
            @start="terrain.startStreet" @divide="terrain.startCut('divide')" @update="terrain.updateStreet" @calculate="terrain.calculateStreet" @cancel="terrain.cancelStreet"
            @rename="terrain.renameRegion" @save="terrain.saveSplit" @download="serverPdf" @retry="terrain.splitUncertain = false; terrain.saveSplit()" />
        </BaseCard>
      </aside>
    </div>

    <section class="completion-grid" :class="{ 'is-single': !terrain.result }" aria-label="Registro y finalización del terreno">
      <BaseCard class="workflow-card details-card" padding="sm">
        <template #header>
          <div class="panel-heading compact">
            <span class="panel-icon" aria-hidden="true">C</span>
            <div><p>Registro</p><h2>Cliente y datos del terreno</h2></div>
          </div>
          <span class="responsible-state">{{ terrain.currentUser ? 'Responsable listo' : 'Pendiente' }}</span>
        </template>
        <fieldset class="unstyled" :disabled="terrain.busy">
          <TerrainDetails :terrain="terrain.terrain" :clients="terrain.clients" :current-user="terrain.currentUser" :loading="terrain.isLoadingReferences" @update="terrain.updateTerrain" />
        </fieldset>
        <div v-if="terrain.referenceError || !terrain.clients.length" class="reference-feedback">
          <p v-if="terrain.referenceError" class="error" role="alert">{{ terrain.referenceError }}</p>
          <BaseButton variant="outline" size="sm" :loading="terrain.isLoadingReferences" :disabled="terrain.busy" @click="terrain.loadReferences(auth.user?.email)">Actualizar clientes y responsable</BaseButton>
        </div>
      </BaseCard>

      <BaseCard v-if="terrain.result" class="workflow-card result-card" padding="sm">
        <template #header>
          <div class="panel-heading compact">
            <span class="panel-icon" aria-hidden="true">D</span>
            <div><p>Finalización</p><h2>Resultado y guardado</h2></div>
          </div>
        </template>
        <TerrainResults :result="terrain.result" :record="terrain.savedRecord" :current="terrain.isCurrentSaved" :converted="terrain.convertedRevision === terrain.revision" />
        <div class="save-panel">
          <p v-if="terrain.savedRecord && !terrain.isCurrentSaved" class="hint">Los cambios se guardarán como un cálculo nuevo. El registro {{ terrain.savedRecord.id }} se conserva.</p>
          <p v-if="terrain.saveUncertain" class="error">No se pudo confirmar el guardado. Comprueba si el cálculo ya existe antes de reintentar.</p>
          <BaseButton v-if="terrain.saveUncertain" variant="outline" :disabled="terrain.busy" @click="retrySave">Ya revisé los registros: reintentar</BaseButton>
          <p v-if="terrain.error" class="error" role="alert">{{ terrain.error }}</p>
          <BaseButton v-else block :disabled="terrain.busy || terrain.isCurrentSaved" :loading="terrain.isSaving" @click="saveTerrain">
            {{ terrain.isCurrentSaved ? 'Terreno guardado' : terrain.savedRecord ? 'Guardar como nuevo cálculo' : 'Guardar terreno' }}
          </BaseButton>
          <div v-if="terrain.savedRecord" class="actions">
            <BaseButton variant="outline" :loading="terrain.downloadingId === terrain.savedRecord.id && pdfRequestAction === 'preview'" :disabled="terrain.downloadingId !== null" @click="previewServerPdf(terrain.savedRecord.id)">Previsualizar PDF</BaseButton>
            <BaseButton variant="outline" :loading="terrain.downloadingId === terrain.savedRecord.id && pdfRequestAction === 'download'" :disabled="terrain.downloadingId !== null" @click="serverPdf(terrain.savedRecord.id)">Descargar PDF</BaseButton>
          </div>
          <p class="hint">El PDF del plano conserva tu dibujo. El reporte del servidor contiene su cálculo registrado y un esquema de referencia.</p>
        </div>
      </BaseCard>
    </section>
  </div>

  <BaseModal :open="Boolean(pdfPreviewUrl)" title-id="pdf-preview-title" description-id="pdf-preview-description" wide @close="closePdfPreview">
    <div class="pdf-preview">
      <header>
        <div>
          <p>Reporte generado por el servidor</p>
          <h2 id="pdf-preview-title">Previsualización del plano</h2>
          <span id="pdf-preview-description">Cálculo registrado {{ pdfPreviewId }}</span>
        </div>
        <button type="button" aria-label="Cerrar previsualización" @click="closePdfPreview">×</button>
      </header>
      <iframe :src="pdfPreviewUrl" title="Vista previa del reporte PDF"></iframe>
      <footer>
        <BaseButton variant="outline" @click="closePdfPreview">Cerrar</BaseButton>
        <BaseButton @click="downloadPreviewedPdf">Descargar PDF</BaseButton>
      </footer>
    </div>
  </BaseModal>
</template>

<style scoped>
.terrenos-page { width: 100%; }
.terrenos-page :deep(.page-header) { position: relative; margin-bottom: 1.25rem; }
.terrenos-page :deep(.page-header)::after { content: ''; position: absolute; width: 4.5rem; height: 3px; left: 0; bottom: -2px; border-radius: var(--radius-full); background: var(--color-coral-decorative); }
.legal-disclaimer { display: flex; align-items: flex-start; gap: .8rem; margin: 0 0 1rem; padding: .85rem 1rem; border: 1px solid var(--color-coral-decorative-mid); border-left: 4px solid var(--color-coral-decorative-strong); border-radius: var(--radius-sm); color: var(--color-text-body); background: var(--color-coral-decorative-soft); }
.legal-disclaimer > span { display: grid; width: 1.8rem; height: 1.8rem; flex: 0 0 1.8rem; place-items: center; border-radius: 50%; color: var(--color-text-on-primary); background: var(--color-coral-decorative-strong); font-weight: 800; }
.legal-disclaimer strong { color: var(--color-text-title); font-size: .82rem; }
.legal-disclaimer p { margin: .2rem 0 0; color: var(--color-text-muted); font-size: .78rem; line-height: 1.5; }
.details-card { border-top: 3px solid var(--color-coral-decorative) !important; background: linear-gradient(135deg, var(--color-bg-elevated) 0%, var(--color-bg-elevated) 76%, var(--color-coral-decorative-pale) 160%); }
.details-card .panel-icon { border-color: var(--color-coral-decorative); color: var(--color-coral-decorative-strong); background: var(--color-coral-decorative-soft); }
.result-card { border-top: 3px solid var(--color-coral-decorative-mid) !important; background: linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-card) 72%, var(--color-coral-decorative-pale) 155%); }
.result-card .panel-icon { border-color: var(--color-coral-decorative-mid); color: var(--color-coral-decorative-strong); background: var(--color-coral-decorative-soft); }
.details-card :deep(.card-header), .workflow-card :deep(.card-header) { padding: .9rem 1rem; }
.details-card :deep(.card-body), .workflow-card :deep(.card-body) { padding: 1rem; }
.panel-heading { display: flex; align-items: center; gap: .75rem; min-width: 0; }
.panel-heading p { margin: 0 0 .1rem; color: var(--color-text-muted); font-size: .65rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.panel-heading h2 { margin: 0; font-size: 1rem; }
.panel-heading.compact h2 { font-size: .95rem; }
.panel-icon { display: inline-grid; width: 2rem; height: 2rem; flex: 0 0 2rem; place-items: center; border: 1px solid var(--color-border-medium); border-radius: .65rem; color: var(--color-teal-strong); background: var(--color-primary-subtle); font-family: var(--font-mono); font-size: .7rem; font-weight: 700; }
.responsible-state, .item-count { flex: 0 0 auto; border-radius: var(--radius-full); padding: .3rem .6rem; color: var(--color-teal-strong); background: var(--color-primary-subtle); font-size: .7rem; font-weight: 700; }
.reference-feedback { display: flex; align-items: center; gap: .75rem; margin-top: .75rem; flex-wrap: wrap; }
.context-strip { display: flex; align-items: center; gap: .5rem 1rem; margin: 0 0 1rem; padding: .65rem .85rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); color: var(--color-text-muted); background: var(--color-bg-subtle); font-size: .72rem; flex-wrap: wrap; }
.context-strip span:not(:last-child)::after { content: ''; display: inline-block; width: 5px; height: 5px; margin-left: 1rem; border-radius: 50%; vertical-align: middle; background: var(--color-coral-decorative); box-shadow: 0 0 0 3px var(--color-coral-decorative-soft); }
.context-strip strong { color: var(--color-text-title); }
.workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 390px); gap: 1rem; align-items: start; padding: 1rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: var(--color-bg-workspace); }
.canvas-column { min-width: 0; }
.drawing-card { position: sticky; top: calc(var(--navbar-height) + 1rem); overflow: hidden; box-shadow: var(--shadow-md); }
.drawing-card :deep(.card-header) { padding: .9rem 1rem; background: var(--color-bg-elevated); }
.drawing-card :deep(.card-body) { padding: 0; }
.canvas-toolbar { padding: .75rem; border-bottom: 1px solid var(--color-border-subtle); background: var(--color-bg-card); }
.canvas-stage { padding: .75rem; background: linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-card) 88%, var(--color-coral-decorative-pale) 145%); }
.canvas-footer { padding: 0 .9rem .9rem; background: var(--color-bg-card); }
.workflow-sidebar { display: grid; gap: .8rem; min-width: 0; }
.completion-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; margin-top: 1rem; padding: 1rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: linear-gradient(120deg, var(--color-bg-workspace) 0%, var(--color-bg-workspace) 68%, var(--color-coral-decorative-soft) 155%); }
.completion-grid.is-single { grid-template-columns: minmax(0, 1fr); }
.workflow-card { overflow: hidden; box-shadow: none; }
.status { max-width: 50%; margin-left: 1rem; padding: .35rem .65rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-full); color: var(--color-teal-strong); background: var(--color-primary-subtle); font-size: .72rem; font-weight: 700; text-align: right; }
.hint { color: var(--color-text-muted); font-size: .78rem; line-height: 1.55; }
.side-content { display: grid; gap: .9rem; }
.error { padding: .75rem .85rem; border-left: 4px solid var(--color-danger); border-radius: var(--radius-sm); background: rgba(217, 83, 79, .09); color: var(--color-text-title); font-size: .82rem; white-space: pre-line; }
.notice { margin-bottom: 1rem; padding: .75rem .85rem; border-left: 4px solid var(--color-teal); border-radius: var(--radius-sm); background: var(--color-primary-subtle); }
.actions { display: flex; flex-wrap: wrap; gap: .5rem; margin: .8rem 0; }
.unstyled { margin: 0; padding: 0; border: 0; min-width: 0; }
.calculation-actions { display: grid; grid-template-columns: 1fr 1.25fr; margin: .9rem 0 0; padding-top: .9rem; border-top: 1px solid var(--color-border-subtle); }
.calculation-actions :deep(.base-button) { width: 100%; }
.save-panel { display: grid; gap: .6rem; padding-top: .85rem; }
.save-panel .actions { display: grid; grid-template-columns: 1fr 1fr; margin: 0; }
.save-panel .actions :deep(.base-button) { width: 100%; white-space: normal; }
.divisions-card :deep(.card-body) { padding-top: .85rem; }
.pdf-preview { display: grid; grid-template-rows: auto minmax(420px, 72vh) auto; }
.pdf-preview header, .pdf-preview footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.2rem; }
.pdf-preview header { border-bottom: 1px solid var(--color-border-subtle); }
.pdf-preview header p, .pdf-preview header h2, .pdf-preview header span { margin: 0; }
.pdf-preview header p { color: var(--color-teal-strong); font-size: .68rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.pdf-preview header h2 { margin-top: .15rem; font-size: 1.1rem; }
.pdf-preview header span { color: var(--color-text-muted); font-size: .72rem; }
.pdf-preview header > button { display: grid; width: 2.25rem; height: 2.25rem; flex: none; place-items: center; border-radius: var(--radius-sm); color: var(--color-text-muted); font-size: 1.4rem; }
.pdf-preview header > button:hover { color: var(--color-text-title); background: var(--color-bg-subtle); }
.pdf-preview iframe { width: 100%; height: 100%; border: 0; background: var(--color-bg-subtle); }
.pdf-preview footer { justify-content: flex-end; border-top: 1px solid var(--color-border-subtle); }

@media (max-width: 1180px) {
  .workspace-grid { grid-template-columns: minmax(0, 1fr) 340px; }
}
@media (max-width: 1020px) {
  .workspace-grid { grid-template-columns: 1fr; }
  .drawing-card { position: static; }
  .workflow-sidebar { grid-template-columns: 1fr; }
  .completion-grid { grid-template-columns: 1fr; }
}
@media (max-width: 680px) {
  .workspace-grid { margin-inline: -.5rem; padding: .5rem; border-radius: var(--radius-md); }
  .workflow-sidebar { grid-template-columns: 1fr; }
  .completion-grid { margin-inline: -.5rem; padding: .5rem; border-radius: var(--radius-md); }
  .workflow-card { grid-column: auto; }
  .responsible-state { display: none; }
  .status { max-width: 58%; font-size: .65rem; }
  .context-strip { align-items: flex-start; flex-direction: column; }
  .context-strip span::after { display: none !important; }
  .calculation-actions, .save-panel .actions { grid-template-columns: 1fr; }
  .pdf-preview { grid-template-rows: auto minmax(360px, 65vh) auto; }
  .pdf-preview footer { align-items: stretch; flex-direction: column-reverse; }
  .pdf-preview footer :deep(.base-button) { width: 100%; }
}
</style>
