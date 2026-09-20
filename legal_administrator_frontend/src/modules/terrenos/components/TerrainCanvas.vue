<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bearingDegrees, distance, fitViewport, interiorAngleDegrees, snapPoint, toScreen, toWorld, vertexLabel } from '../domain/geometry.js'
import { formatSideMeasurements } from '../domain/units.js'

const props = defineProps({
  vertices: { type: Array, required: true },
  boundaries: { type: Array, required: true },
  closed: Boolean,
  calculated: Boolean,
  tool: { type: String, default: 'draw' },
  regions: { type: Array, default: () => [] },
  streetPoints: { type: Array, default: () => [] },
  selectedSideId: { type: Number, default: null },
  selectedVertexIndex: { type: Number, default: null },
  snapEnabled: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['point', 'select-side', 'select-vertex', 'move-vertex', 'insert-vertex', 'close', 'move-street-point'])
const canvas = ref(null)
const preview = ref(null)
const dragging = ref(false)
let view = fitViewport([], 800, 480)
let width = 800
const height = 480
let resizeObserver
let pointer = null
let themeObserver

function cssVar(name, fallback = '') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function visibleVertices() {
  return pointer?.kind === 'vertex' && pointer.moved
    ? props.vertices.map((point, index) => index === pointer.index ? pointer.point : point)
    : props.vertices
}

function visibleStreetPoints() {
  return pointer?.kind === 'street-point' && pointer.moved
    ? props.streetPoints.map((point, index) => index === pointer.index ? pointer.point : point)
    : props.streetPoints
}

function gridStep() {
  const target = 24 / view.scale
  const unit = 10 ** Math.floor(Math.log10(target))
  return [1, 2, 5, 10].find((step) => step * unit >= target) * unit
}

function path(ctx, points, close = true) {
  ctx.beginPath()
  points.map((p) => toScreen(p, view)).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
  if (close) ctx.closePath()
}

function label(ctx, text, point) {
  ctx.font = '12px system-ui, sans-serif'
  const size = ctx.measureText(text).width
  ctx.fillStyle = cssVar('--color-bg-elevated', '#FFFFFF')
  ctx.fillRect(point.x - size / 2 - 5, point.y - 10, size + 10, 20)
  ctx.fillStyle = cssVar('--color-teal-strong', '#44878F')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, point.x, point.y)
}

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  const vertices = visibleVertices()
  const streetPoints = visibleStreetPoints()
  const ratio = canvas.value.width / width
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = cssVar('--color-canvas-bg', '#F6FAF9')
  ctx.fillRect(0, 0, width, height)
  ctx.lineWidth = 1
  ctx.strokeStyle = cssVar('--color-divider', '#E5EBE9')
  ctx.setLineDash([])
  const spacing = gridStep() * view.scale
  const startX = ((view.offsetX % spacing) + spacing) % spacing
  const startY = ((view.offsetY % spacing) + spacing) % spacing
  for (let x = startX; x < width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
  for (let y = startY; y < height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }

  if (vertices.length) {
    path(ctx, vertices, props.closed)
    ctx.lineWidth = 2.5
    ctx.strokeStyle = props.calculated ? cssVar('--color-plan-line', '#326B72') : cssVar('--color-teal', '#5A9B95')
    ctx.setLineDash(props.calculated ? [] : [5, 4])
    ctx.stroke()
    ctx.setLineDash([])
    if (props.closed && !props.regions.length) { ctx.fillStyle = cssVar('--color-plan-fill', 'rgba(68, 135, 143, 0.12)'); ctx.fill() }
    const colors = [
      cssVar('--color-region-a', 'rgba(90, 155, 149, 0.34)'),
      cssVar('--color-region-b', 'rgba(140, 170, 162, 0.42)'),
      cssVar('--color-region-c', 'rgba(68, 135, 143, 0.25)'),
    ]
    props.regions.forEach((region, index) => {
      if (!region.points?.length) return
      path(ctx, region.points)
      ctx.fillStyle = colors[index % colors.length]
      ctx.fill()
      ctx.strokeStyle = cssVar('--color-teal-strong', '#44878F')
      ctx.lineWidth = 1
      ctx.stroke()
      const center = region.points.reduce((p, next) => ({ x: p.x + next.x / region.points.length, y: p.y + next.y / region.points.length }), { x: 0, y: 0 })
      label(ctx, `${region.cutName}: ${Number(region.area).toFixed(2)} m²`, toScreen(center, view))
    })
    vertices.forEach((point, i) => {
      const p = toScreen(point, view)
      const next = vertices[(i + 1) % vertices.length]
      if (props.closed || i < vertices.length - 1) {
        if (props.selectedSideId !== null && props.boundaries[i]?.id === props.selectedSideId) {
          path(ctx, [point, next], false)
          ctx.lineWidth = 5
          ctx.strokeStyle = cssVar('--color-selection', '#1F5961')
          ctx.stroke()
        }
        const text = formatSideMeasurements(props.boundaries[i]?.measurements ?? [])
        if (text) label(ctx, text, toScreen({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }, view))
      }
      const selected = props.selectedVertexIndex === i
      ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 8 : 5, 0, Math.PI * 2)
      ctx.fillStyle = selected ? cssVar('--color-selection', '#1F5961') : cssVar('--color-plan-line', '#326B72'); ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke()
      if (props.tool === 'draw' && !props.closed && i === 0 && vertices.length >= 3) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2)
        ctx.lineWidth = 1.5; ctx.strokeStyle = cssVar('--color-selection', '#1F5961'); ctx.stroke()
      }
      ctx.fillStyle = cssVar('--color-text-title', '#1C2725'); ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.textAlign = 'left'; ctx.fillText(vertexLabel(i), p.x + 9, p.y - 12)
      if (props.closed && vertices.length > 2) {
        const previous = vertices[(i + vertices.length - 1) % vertices.length]
        const angle = interiorAngleDegrees(previous, point, next)
        if (angle !== null) {
          ctx.fillStyle = cssVar('--color-teal', '#5A9B95'); ctx.font = '11px monospace'
          ctx.fillText(`${angle.toFixed(0)}°`, p.x + 9, p.y + 14)
        }
      }
    })
  }
  let guide = [...streetPoints]
  if (props.tool === 'draw' && !props.closed && vertices.length && preview.value && !pointer?.moved) {
    guide = [vertices.at(-1), adjustedPoint(preview.value, vertices.at(-1))]
  } else if (props.tool === 'street' || props.tool === 'divide') {
    if (guide.length === 1 && preview.value) guide.push(adjustedPoint(preview.value, guide[0]))
  }
  if (guide.length) {
    path(ctx, guide, false)
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeStyle = cssVar('--color-teal', '#5A9B95'); ctx.stroke(); ctx.setLineDash([])
    guide.forEach((point) => {
      const p = toScreen(point, view)
      ctx.beginPath(); ctx.arc(p.x, p.y, props.tool === 'select' ? 7 : 4, 0, 2 * Math.PI); ctx.fillStyle = cssVar('--color-teal-strong', '#44878F'); ctx.fill()
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke()
    })
    if (props.tool === 'draw' && guide.length === 2) {
      const p = toScreen(guide[1], view)
      ctx.fillStyle = cssVar('--color-teal-strong', '#44878F'); ctx.font = '12px monospace'; ctx.textAlign = 'left'
      ctx.fillText(`${Math.round(bearingDegrees(guide[0], guide[1])) % 360}°`, p.x + 8, p.y - 8)
    }
  }
  ctx.fillStyle = cssVar('--color-teal-strong', '#44878F'); ctx.textAlign = 'center'; ctx.font = 'bold 14px system-ui'
  ctx.fillText('N', width - 30, 22)
  ctx.beginPath(); ctx.moveTo(width - 30, 34); ctx.lineTo(width - 36, 50); ctx.lineTo(width - 24, 50); ctx.closePath(); ctx.fill()
  ctx.font = '12px system-ui'; ctx.textAlign = 'left'
  ctx.fillStyle = cssVar('--color-text-muted', '#5C6E6A')
  ctx.fillText(props.calculated ? 'Coordenadas en metros · vista previa local' : 'Croquis de direcciones · ingresa las medidas al cerrar', 14, height - 16)
}

function resize() {
  if (!canvas.value) return
  const previousWidth = width
  width = Math.max(1, canvas.value.getBoundingClientRect().width)
  const ratio = window.devicePixelRatio || 1
  canvas.value.width = Math.round(width * ratio)
  canvas.value.height = Math.round(height * ratio)
  view.offsetX += (width - previousWidth) / 2
  draw()
}

function eventScreen(event) {
  const rect = canvas.value.getBoundingClientRect()
  return { x: (event.clientX - rect.left) * width / rect.width, y: (event.clientY - rect.top) * height / rect.height }
}

function eventPoint(event) { return toWorld(eventScreen(event), view) }

function hitVertex(point, points = props.vertices, radius = 12, excludedIndex = -1) {
  let index = null
  let gap = radius / view.scale
  points.forEach((candidate, i) => {
    if (i === excludedIndex) return
    const candidateGap = distance(point, candidate)
    if (candidateGap <= gap) { gap = candidateGap; index = i }
  })
  return index
}

function hitSide(point) {
  let closest = null
  let minDistance = 12 / view.scale
  const sideCount = props.closed ? props.vertices.length : Math.max(0, props.vertices.length - 1)
  for (let i = 0; i < sideCount; i++) {
    const a = props.vertices[i], b = props.vertices[(i + 1) % props.vertices.length]
    const lengthSquared = distance(a, b) ** 2
    if (!lengthSquared) continue
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared))
    const projected = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    const gap = distance(point, projected)
    if (gap <= minDistance) { minDistance = gap; closest = { index: i, point: projected } }
  }
  return closest
}

function adjustedPoint(raw, anchor = null, excludedIndex = -1) {
  if (!props.snapEnabled) return raw
  const hit = hitVertex(raw, props.vertices, 9, excludedIndex)
  if (hit !== null && (!anchor || distance(props.vertices[hit], anchor) > 1e-8)) return { ...props.vertices[hit] }
  const step = gridStep()
  const grid = { x: Math.round(raw.x / step) * step, y: Math.round(raw.y / step) * step }
  const point = distance(raw, grid) * view.scale <= 4 ? grid : raw
  return anchor ? snapPoint(anchor, point) : point
}

function pointerDown(event) {
  if (pointer || (event.button !== 0 && event.button !== 1)) return
  if (props.busy && props.tool !== 'pan' && event.button !== 1) return
  const point = eventPoint(event)
  const screen = eventScreen(event)
  pointer = { id: event.pointerId, kind: 'point', start: screen, point, moved: false }
  if (event.button === 1 || props.tool === 'pan') {
    pointer.kind = 'pan'
    pointer.initialView = { ...view }
  } else if (props.tool === 'select' || props.tool === 'none') {
    const streetIndex = hitVertex(point, props.streetPoints)
    const vertexIndex = hitVertex(point)
    if (streetIndex !== null) {
      pointer.kind = 'street-point'
      pointer.index = streetIndex
      emit('select-vertex', null)
      emit('select-side', null)
    } else if (vertexIndex !== null) {
      pointer.kind = 'vertex'
      pointer.index = vertexIndex
      emit('select-vertex', vertexIndex)
      emit('select-side', null)
    } else {
      pointer.kind = 'selection'
      const side = hitSide(point)
      emit('select-vertex', null)
      emit('select-side', side ? props.boundaries[side.index]?.id ?? null : null)
    }
  }
  canvas.value.setPointerCapture?.(event.pointerId)
  canvas.value.focus({ preventScroll: true })
  event.preventDefault()
}

function pointerMove(event) {
  const point = eventPoint(event)
  if (!pointer) { preview.value = point; return }
  if (event.pointerId !== pointer.id) return
  const screen = eventScreen(event)
  if (distance(screen, pointer.start) > 4) pointer.moved = true
  dragging.value = pointer.moved
  if (pointer.kind === 'pan') {
    view = { ...pointer.initialView, offsetX: pointer.initialView.offsetX + screen.x - pointer.start.x, offsetY: pointer.initialView.offsetY + screen.y - pointer.start.y }
  } else if (pointer.kind === 'vertex') {
    const previousIndex = (pointer.index + props.vertices.length - 1) % props.vertices.length
    const anchor = props.closed || pointer.index > 0 ? props.vertices[previousIndex] : null
    pointer.point = adjustedPoint(point, anchor, pointer.index)
  } else if (pointer.kind === 'street-point') {
    pointer.point = adjustedPoint(point, props.streetPoints[1 - pointer.index])
  }
  preview.value = point
  draw()
}

function releasePointer() {
  const active = pointer
  pointer = null
  dragging.value = false
  if (active && canvas.value?.hasPointerCapture?.(active.id)) canvas.value.releasePointerCapture(active.id)
  return active
}

function pointerUp(event) {
  if (!pointer || pointer.id !== event.pointerId) return
  const point = eventPoint(event)
  const active = releasePointer()
  if (props.busy) { draw(); return }
  if (active.moved) {
    if (active.kind === 'vertex') emit('move-vertex', active.index, active.point)
    if (active.kind === 'street-point') emit('move-street-point', active.index, active.point)
  } else if (active.kind === 'point') {
    if (props.tool === 'draw' && !props.closed) {
      if (props.vertices.length >= 3 && distance(point, props.vertices[0]) * view.scale <= 12) emit('close')
      else emit('point', adjustedPoint(point, props.vertices.at(-1)))
    } else if (props.tool === 'street' || props.tool === 'divide') {
      emit('point', adjustedPoint(point, props.streetPoints.at(-1)))
    }
  }
  draw()
}

function cancelPointer() { releasePointer(); preview.value = null; draw() }

function doubleClick(event) {
  if (props.busy || !['select', 'none'].includes(props.tool)) return
  const point = eventPoint(event)
  if (hitVertex(point) !== null) return
  const side = hitSide(point)
  if (side) emit('insert-vertex', side.index, side.point)
}

function fit() {
  if (pointer) return
  view = fitViewport(props.vertices, width, height)
  preview.value = null
  draw()
}

function panView(deltaX, deltaY) {
  if (pointer) return
  view = { ...view, offsetX: view.offsetX + deltaX, offsetY: view.offsetY + deltaY }
  preview.value = null
  draw()
}

function panLeft() { panView(64, 0) }
function panRight() { panView(-64, 0) }
function panUp() { panView(0, 64) }
function panDown() { panView(0, -64) }

function keyDown(event) {
  if (event.key === 'Escape') { cancelPointer(); return }
  const navigation = {
    ArrowLeft: panLeft,
    ArrowRight: panRight,
    ArrowUp: panUp,
    ArrowDown: panDown,
  }[event.key]
  if (!navigation) return
  event.preventDefault()
  navigation()
}

function zoom(factor, screen = { x: width / 2, y: height / 2 }) {
  if (pointer) return
  const world = toWorld(screen, view)
  const scale = Math.max(0.000001, Math.min(1000000, view.scale * factor))
  view = { scale, offsetX: screen.x - world.x * scale, offsetY: screen.y + world.y * scale }
  preview.value = null
  draw()
}

function wheel(event) { zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.005), eventScreen(event)) }
function zoomIn() { zoom(1.25) }
function zoomOut() { zoom(0.8) }

function exportPng() {
  if (!props.calculated || !canvas.value) return
  preview.value = null
  draw()
  const link = document.createElement('a')
  link.download = 'plano_terreno.png'
  link.href = toDataUrl()
  link.click()
}
function toDataUrl() {
  if (!props.calculated || !canvas.value) return ''
  preview.value = null
  draw()
  return canvas.value.toDataURL('image/png')
}
defineExpose({ exportPng, toDataUrl, fit, zoomIn, zoomOut, panLeft, panRight, panUp, panDown })

watch(() => [props.vertices, props.closed, props.calculated], (_, previous) => {
  preview.value = null
  // Cerrar y editar no desplazan las marcas. El primer cálculo ajusta la escala.
  if ((props.calculated && !previous?.[2]) || !props.vertices.length) view = fitViewport(props.vertices, width, height)
  draw()
}, { deep: true })
watch(() => [props.regions, props.streetPoints, props.selectedSideId, props.selectedVertexIndex, props.snapEnabled, props.boundaries], draw, { deep: true })
watch(() => [props.tool, props.busy], cancelPointer)
watch(preview, draw)
onMounted(() => {
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  resize()
  fit()
  themeObserver = new MutationObserver(draw)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  releasePointer()
})
</script>

<template>
  <div class="canvas-panel">
    <canvas ref="canvas" class="terrain-canvas"
      :class="{ drawing: ['draw', 'street', 'divide'].includes(tool), selecting: tool === 'select', panning: tool === 'pan', dragging }"
      tabindex="0" role="img"
      aria-label="Plano del terreno. Usa las flechas del teclado para desplazarte. Dibuja las esquinas y toca la primera para cerrar. Con Seleccionar, arrastra vértices o haz doble clic en un lado para añadir un punto."
      @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp"
      @pointercancel="cancelPointer" @lostpointercapture="cancelPointer" @pointerleave="!pointer && (preview = null)"
      @dblclick.prevent="doubleClick" @wheel.prevent="wheel" @keydown="keyDown">
      Plano del terreno; las colindancias y sus medidas están disponibles en el panel contiguo.
    </canvas>
    <div class="canvas-navigation" role="group" aria-label="Navegar por el plano">
      <button type="button" class="nav-up" aria-label="Mover vista hacia arriba" title="Mover arriba" @click="panUp">↑</button>
      <button type="button" class="nav-left" aria-label="Mover vista hacia la izquierda" title="Mover a la izquierda" @click="panLeft">←</button>
      <button type="button" class="nav-down" aria-label="Mover vista hacia abajo" title="Mover abajo" @click="panDown">↓</button>
      <button type="button" class="nav-right" aria-label="Mover vista hacia la derecha" title="Mover a la derecha" @click="panRight">→</button>
    </div>
    <p class="canvas-help">
      <template v-if="tool === 'draw'">Marca las esquinas en orden. Toca el primer punto o usa Cerrar polígono.</template>
      <template v-else-if="tool === 'select'">Arrastra un vértice para moverlo. Haz doble clic en un lado para añadir un punto.</template>
      <template v-else-if="tool === 'pan'">Arrastra para mover la vista.</template>
      <template v-else-if="tool === 'street' || tool === 'divide'">Marca los dos extremos del trazo. Después puedes moverlos con Seleccionar.</template>
      <span> Usa la rueda para acercar o alejar y las flechas del teclado para desplazarte.</span>
    </p>
  </div>
</template>

<style scoped>
.canvas-panel { position: relative; min-width: 0; }
.terrain-canvas { display: block; width: 100%; height: 480px; border: 1px solid var(--color-border-medium); border-radius: var(--radius-md); box-shadow: inset 0 0 0 1px var(--color-border-subtle); touch-action: none; }
.terrain-canvas:focus-visible { outline: 2px solid var(--color-teal, #44878F); outline-offset: 3px; }
.drawing { cursor: crosshair; }
.selecting { cursor: default; }
.panning { cursor: grab; }
.dragging { cursor: grabbing; }
.canvas-navigation { position: absolute; right: 1rem; bottom: 2.9rem; display: grid; grid-template-columns: repeat(3, 2rem); grid-template-rows: repeat(2, 2rem); gap: .2rem; padding: .35rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); background: var(--color-bg-elevated); box-shadow: var(--shadow-md); opacity: .92; }
.canvas-navigation button { display: grid; width: 2rem; height: 2rem; place-items: center; border: 0; border-radius: var(--radius-xs); color: var(--color-teal-strong); background: var(--color-bg-subtle); font-weight: 800; transition: color var(--transition-fast), background-color var(--transition-fast), transform var(--transition-fast); }
.canvas-navigation button:hover { color: var(--color-text-on-primary); background: var(--color-primary); }
.canvas-navigation button:active { transform: scale(.94); }
.nav-up { grid-column: 2; grid-row: 1; }
.nav-left { grid-column: 1; grid-row: 2; }
.nav-down { grid-column: 2; grid-row: 2; }
.nav-right { grid-column: 3; grid-row: 2; }
.canvas-help { margin: .65rem .15rem 0; color: var(--color-text-muted); font-size: .76rem; line-height: 1.5; }
</style>
