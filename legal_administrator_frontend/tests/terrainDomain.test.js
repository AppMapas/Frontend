import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSideMeasurements, normalizeMeasurement, normalizeUnit, sumDraftMeasurements, sumMeasurements, toMeters, toSquareVaras } from '../src/modules/terrenos/domain/units.js'
import { bearingDegrees, distance, fitViewport, interiorAngleDegrees, polygonArea, reconstructPolygon, snapPoint, splitByStreet, toScreen, toWorld, validatePolygon } from '../src/modules/terrenos/domain/geometry.js'
import { buildCalculationRequest, buildSplitRequest } from '../src/modules/terrenos/domain/calculationContract.js'

const rectangle = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 0, y: 30 }]
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)
const terrain = { clientDpi: '0012345678901', userSystemId: '0098765432101', terrainName: 'Los Pinos', propertyType: 'RURAL' }
const boundaries = [20, 30, 20, 30].map((value) => ({ measurements: [{ value, unit: 'm' }] }))

test('usa la vara del backend y deriva su equivalencia cuadrada del mismo factor', () => {
  close(toMeters({ value: 10, unit: 'vara' }), 8.36)
  close(toSquareVaras(0.698896), 1)
})

test('normaliza alias a los nombres exactos del backend y suma medidas compuestas', () => {
  assert.equal(normalizeUnit(' CM '), 'centímetros')
  assert.deepEqual(normalizeMeasurement({ value: '12', unit: 'in' }), { value: 12, unit: 'pulgadas' })
  close(sumMeasurements([{ value: 25, unit: 'varas' }, { value: 12, unit: 'pulgadas' }]), 21.2048)
})

test('rechaza unidades desconocidas, incluso las que antes caían en factor 1', () => {
  for (const unit of ['ft', 'mm', 'manzana', 'hectarea', '', null, 'constructor', '__proto__']) {
    assert.throws(() => toMeters({ value: 2, unit }), /Unidad no admitida/)
  }
})

test('rechaza cada componente vacío, negativo, infinito o inválido', () => {
  for (const value of ['', 0, -1, NaN, Infinity, '12abc', true, null, []]) {
    assert.throws(() => sumMeasurements([{ value: 5, unit: 'metros' }, { value, unit: 'varas' }]), /mayor que cero/)
  }
  assert.throws(() => sumMeasurements([]), /al menos una medida/)
})

test('rechaza una suma de medidas que desborda el rango numérico', () => {
  assert.throws(() => sumMeasurements([{ value: Number.MAX_VALUE, unit: 'metros' }, { value: Number.MAX_VALUE, unit: 'metros' }]), /rango/)
})

test('reconstruye un rectángulo de 20 × 30 m con área 600 m²', () => {
  const result = reconstructPolygon(rectangle, [20, 30, 20, 30])
  close(result.area, 600)
  close(result.closureGap, 0)
  close(result.closingLength, 30)
})

test('un triángulo de lados 3, 4 y 5 tiene área 6 m²', () => {
  const sketch = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]
  close(reconstructPolygon(sketch, [3, 4, 5]).area, 6)
})

test('el área se conserva al cambiar el sentido y trasladar coordenadas', () => {
  close(polygonArea([...rectangle].reverse()), 600)
  close(polygonArea(rectangle.map((p) => ({ x: p.x + 1e9, y: p.y - 1e9 }))), 600)
})

test('la reconstrucción es independiente de la escala del croquis', () => {
  const sketch = rectangle.map((p) => ({ x: p.x * 50 + 12, y: p.y * 50 - 21 }))
  assert.deepEqual(reconstructPolygon(sketch, [20, 30, 20, 30]).vertices, rectangle)
})

test('una diferencia en el último lado no bloquea la estimación del croquis', () => {
  const result = reconstructPolygon(rectangle, [20, 30, 20, 29])
  close(result.area, 600)
  close(result.closureGap, 1)
  assert.ok(result.closureGap > result.closureWarningThreshold)
  const largeGap = reconstructPolygon(rectangle, [20, 30, 20, 80])
  close(largeGap.area, 600)
  close(largeGap.closureGap, 50)
})

test('informa el cierre residual y conserva la longitud geométrica efectiva', () => {
  const result = reconstructPolygon(rectangle, [20, 30, 20, 30.005])
  close(result.area, 600)
  close(result.closureGap, 0.005)
  close(result.closingLength, 30)
  assert.ok(result.closureGap < result.closureWarningThreshold)
})

test('el croquis aproximado calcula con los primeros tramos y avisa la brecha como antes', () => {
  const result = reconstructPolygon(rectangle, [21, 30, 20, 30])
  close(result.area, 615)
  close(result.closureGap, 1)
})

test('los problemas del croquis producen notas sin bloquear la vista previa', () => {
  const sketch = [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }]
  const result = reconstructPolygon(sketch, [3, 2, 3, 2])
  assert.ok(Number.isFinite(result.area))
  assert.ok(result.warnings.some((warning) => warning.includes('cruzarse')))
})

test('las filas adicionales vacías no impiden sumar las medidas del borrador', () => {
  const measurements = [{ value: 25, unit: 'varas' }, { value: '', unit: 'varas' }, { value: 12, unit: 'pulgadas' }]
  close(sumDraftMeasurements(measurements), 21.2048)
  assert.equal(formatSideMeasurements(measurements), '25 varas + 12 pulg')
  assert.throws(() => sumDraftMeasurements([{ value: '', unit: 'varas' }]), /al menos una medida/)
  assert.throws(() => sumMeasurements(measurements), /mayor que cero/)
})

test('las etiquetas angulares conservan el rumbo y los ángulos de las esquinas', () => {
  close(bearingDegrees({ x: 0, y: 0 }, { x: 10, y: 0 }), 90)
  close(interiorAngleDegrees(rectangle[0], rectangle[1], rectangle[2]), 90)
})

test('rechaza lados cruzados, vértices repetidos, superposiciones y área nula', () => {
  const invalid = [
    [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }],
    [rectangle[0], rectangle[0], rectangle[1], rectangle[2]],
    [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 2 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
  ]
  invalid.forEach((points) => assert.throws(() => validatePolygon(points)))
})

test('admite polígonos cóncavos simples para el cálculo de área', () => {
  const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }]
  validatePolygon(points)
  close(polygonArea(points), 7)
})

test('el ajuste de direcciones conserva la longitud y orienta hacia el norte', () => {
  const origin = { x: 0, y: 0 }, raw = { x: 0.1, y: 10 }
  const point = snapPoint(origin, raw)
  close(point.x, 0)
  close(distance(origin, point), distance(origin, raw))
  assert.ok(point.y > 0)
})

test('una calle de 2 m produce tres polígonos que conservan los 600 m²', () => {
  const regions = splitByStreet(rectangle, { x: -5, y: 15 }, { x: 25, y: 15 }, 2)
  assert.deepEqual(regions.map((region) => region.area), [280, 40, 280])
  close(regions.reduce((sum, region) => sum + region.area, 0), 600)
  regions.forEach((region) => validatePolygon(region.points))
})

test('la calle funciona con orden inverso y conserva el área al girar su dirección', () => {
  const regions = splitByStreet([...rectangle].reverse(), { x: -5, y: 5 }, { x: 25, y: 25 }, 2)
  close(regions.reduce((sum, region) => sum + region.area, 0), 600)
})

test('rechaza calles externas, de ancho excesivo o con extremos iguales', () => {
  assert.throws(() => splitByStreet(rectangle, { x: 0, y: 50 }, { x: 20, y: 50 }, 2), /atravesar/)
  assert.throws(() => splitByStreet(rectangle, { x: 0, y: 15 }, { x: 20, y: 15 }, 40), /atravesar/)
  assert.throws(() => splitByStreet(rectangle, { x: 1, y: 1 }, { x: 1, y: 1 }, 2), /distintos/)
})

test('rechaza recortes cóncavos que podrían producir regiones desconectadas', () => {
  const points = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }]
  assert.throws(() => splitByStreet(points, { x: 0, y: 2 }, { x: 4, y: 2 }, 0.2), /convexos/)
})

test('las coordenadas métricas sobreviven al cambio de tamaño y densidad del lienzo', () => {
  for (const width of [250, 800, 1600]) {
    const view = fitViewport(rectangle, width, 480)
    rectangle.forEach((point) => {
      const recovered = toWorld(toScreen(point, view), view)
      close(recovered.x, point.x)
      close(recovered.y, point.y)
    })
  }
})

test('DTO conserva DPI como texto, ordena lados y omite estado local y vértices', () => {
  const request = buildCalculationRequest({ ...terrain, vertices: rectangle }, boundaries)
  assert.equal(request.clientDpi, '0012345678901')
  assert.equal(request.userSystemId, '0098765432101')
  assert.equal('vertices' in request, false)
  assert.deepEqual(request.boundaries.map((b) => b.sideNumber), [1, 2, 3, 4])
  assert.deepEqual(request.boundaries[0].measurements, [{ value: 20, unit: 'metros' }])
})

test('el contrato rechaza datos incompletos y normaliza oeste', () => {
  assert.throws(() => buildCalculationRequest({ ...terrain, clientDpi: 123 }, boundaries), /DPI/)
  assert.throws(() => buildCalculationRequest(terrain, boundaries.slice(0, 2)), /tres/)
  const sides = boundaries.map((b) => ({ ...b, orientation: 'W' }))
  assert.equal(buildCalculationRequest(terrain, sides).boundaries[0].orientation, 'O')
  assert.throws(() => buildCalculationRequest(terrain, [{ measurements: [] }, ...boundaries]), /incluir medidas/)
})

test('split envía los polígonos métricos completos con el id del padre', () => {
  const regions = splitByStreet(rectangle, { x: -5, y: 15 }, { x: 25, y: 15 }, 2)
  const request = buildSplitRequest(8, regions)
  assert.equal(request.parentCalculationId, 8)
  assert.equal(request.splitLines.length, 3)
  assert.ok(request.splitLines.every((region) => region.points.length >= 3))
  assert.equal('area' in request.splitLines[0], false)
  assert.throws(() => buildSplitRequest(null, regions), /padre/)
  assert.throws(() => buildSplitRequest(8, [{ cutName: 'Calle', points: rectangle.slice(0, 2) }]), /tres/)
})
