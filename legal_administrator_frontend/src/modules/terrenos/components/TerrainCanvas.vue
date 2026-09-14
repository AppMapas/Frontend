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
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(point.x - size / 2 - 5, point.y - 10, size + 10, 20)
  ctx.fillStyle = '#44878F'
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
  ctx.fillStyle = '#F0F4F3'
  ctx.fillRect(0, 0, width, height)
  ctx.lineWidth = 1
  ctx.strokeStyle = '#E5EBE9'
  ctx.setLineDash([])
  const spacing = gridStep() * view.scale
  const startX = ((view.offsetX % spacing) + spacing) % spacing
  const startY = ((view.offsetY % spacing) + spacing) % spacing
  for (let x = startX; x < width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
  for (let y = startY; y < height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }

  if (vertices.length) {
    path(ctx, vertices, props.closed)
    ctx.lineWidth = 2.5
    ctx.strokeStyle = props.calculated ? '#44878F' : '#FF8591'
    ctx.setLineDash(props.calculated ? [] : [5, 4])
    ctx.stroke()
    ctx.setLineDash([])
    if (props.closed && !props.regions.length) { ctx.fillStyle = '#FF859130'; ctx.fill() }
    const colors = ['#5A9B9566', '#8CAAA280', '#EFAAA373']
    props.regions.forEach((region, index) => {
      if (!region.points?.length) return
      path(ctx, region.points)
      ctx.fillStyle = colors[index % colors.length]
      ctx.fill()
      ctx.strokeStyle = '#44878F'
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
          ctx.strokeStyle = '#FF8591'
          ctx.stroke()
        }
        const text = formatSideMeasurements(props.boundaries[i]?.measurements ?? [])
        if (text) label(ctx, text, toScreen({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }, view))
      }
      const selected = props.selectedVertexIndex === i
      ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 8 : 5, 0, Math.PI * 2)
      ctx.fillStyle = selected ? '#44878F' : '#FF8591'; ctx.fill()
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke()
      if (props.tool === 'draw' && !props.closed && i === 0 && vertices.length >= 3) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2)
        ctx.lineWidth = 1; ctx.strokeStyle = '#FF8591'; ctx.stroke()
      }
      ctx.fillStyle = '#1C2725'; ctx.font = 'bold 12px system-ui, sans-serif'
      ctx.textAlign = 'left'; ctx.fillText(vertexLabel(i), p.x + 9, p.y - 12)
      if (props.closed && vertices.length > 2) {
        const previous = vertices[(i + vertices.length - 1) % vertices.length]
        const angle = interiorAngleDegrees(previous, point, next)
        if (angle !== null) {
          ctx.fillStyle = '#5A9B95'; ctx.font = '11px monospace'
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
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeStyle = '#5A9B95'; ctx.stroke(); ctx.setLineDash([])
    guide.forEach((point) => {
      const p = toScreen(point, view)
      ctx.beginPath(); ctx.arc(p.x, p.y, props.tool === 'select' ? 7 : 4, 0, 2 * Math.PI); ctx.fillStyle = '#44878F'; ctx.fill()
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke()
    })
    if (props.tool === 'draw' && guide.length === 2) {
      const p = toScreen(guide[1], view)
      ctx.fillStyle = '#44878F'; ctx.font = '12px monospace'; ctx.textAlign = 'left'
      ctx.fillText(`${Math.round(bearingDegrees(guide[0], guide[1])) % 360}°`, p.x + 8, p.y - 8)
    }
  }
  ctx.fillStyle = '#44878F'; ctx.textAlign = 'center'; ctx.font = 'bold 14px system-ui'
  ctx.fillText('N', width - 30, 22)
  ctx.beginPath(); ctx.moveTo(width - 30, 34); ctx.lineTo(width - 36, 50); ctx.lineTo(width - 24, 50); ctx.closePath(); ctx.fill()
  ctx.font = '12px system-ui'; ctx.textAlign = 'left'
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
  link.href = canvas.value.toDataURL('image/png')
  link.click()
}
defineExpose({ exportPng, fit, zoomIn, zoomOut })

watch(() => [props.vertices, props.closed, props.calculated], (_, previous) => {
  preview.value = null
  // Cerrar y editar no desplazan las marcas. El primer cálculo ajusta la escala.
  if ((props.calculated && !previous?.[2]) || !props.vertices.length) view = fitViewport(props.vertices, width, height)
  draw()
}, { deep: true })
watch(() => [props.regions, props.streetPoints, props.selectedSideId, props.selectedVertexIndex, props.snapEnabled, props.boundaries], draw, { deep: true })
watch(() => [props.tool, props.busy], cancelPointer)
watch(preview, draw)
onMounted(() => { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas.value); resize(); fit() })
onBeforeUnmount(() => { resizeObserver?.disconnect(); releasePointer() })
</script>

<template>
  <div class="canvas-panel">
    <canvas ref="canvas" class="terrain-canvas"
      :class="{ drawing: ['draw', 'street', 'divide'].includes(tool), selecting: tool === 'select', panning: tool === 'pan', dragging }"
      tabindex="0" role="img"
      aria-label="Plano del terreno. Dibuja las esquinas y toca la primera para cerrar. Con Seleccionar, arrastra vértices o haz doble clic en un lado para añadir un punto."
      @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp"
      @pointercancel="cancelPointer" @lostpointercapture="cancelPointer" @pointerleave="!pointer && (preview = null)"
      @dblclick.prevent="doubleClick" @wheel.prevent="wheel" @keydown.esc="cancelPointer">
      Plano del terreno; las colindancias y sus medidas están disponibles en el panel contiguo.
    </canvas>
    <p class="canvas-help">
      <template v-if="tool === 'draw'">Marca las esquinas en orden. Toca el primer punto o usa Cerrar polígono.</template>
      <template v-else-if="tool === 'select'">Arrastra un vértice para moverlo. Haz doble clic en un lado para añadir un punto.</template>
      <template v-else-if="tool === 'pan'">Arrastra para mover la vista.</template>
      <template v-else-if="tool === 'street' || tool === 'divide'">Marca los dos extremos del trazo. Después puedes moverlos con Seleccionar.</template>
      <span> Usa la rueda para acercar o alejar.</span>
    </p>
  </div>
</template>

<style scoped>
.canvas-panel { min-width: 0; }
.terrain-canvas { display: block; width: 100%; height: 480px; border-radius: var(--radius-sm); touch-action: none; }
.terrain-canvas:focus-visible { outline: 2px solid var(--color-teal, #44878F); outline-offset: 3px; }
.drawing { cursor: crosshair; }
.selecting { cursor: default; }
.panning { cursor: grab; }
.dragging { cursor: grabbing; }
.canvas-help { margin: .65rem 0 0; color: var(--color-text-muted); font-size: .8rem; line-height: 1.5; }
</style>
