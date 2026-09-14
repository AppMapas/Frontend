import test from 'node:test'
import assert from 'node:assert/strict'
import { createRectangle, polygonArea, splitByLine, splitByStreet, validateSubdivision, verticesFromCourses } from '../src/modules/terrenos/domain/geometry.js'

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`)
const rectangle = (width, height, x = 0, y = 0) => createRectangle(width, height).map((point) => ({ x: point.x + x, y: point.y + y }))
const region = (points) => ({ cutName: 'Lote', points })

test('la plantilla rectangular utiliza metros y produce 600 m² con 20 × 30', () => {
  const vertices = createRectangle(20, 30)
  assert.deepEqual(vertices, [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 0, y: 30 }])
  close(polygonArea(vertices), 600)
  assert.throws(() => createRectangle(0, 30), /mayores que cero/)
  assert.throws(() => createRectangle(20, Infinity), /mayores que cero/)
})

test('los azimuts construyen lados hacia este, norte, oeste y sur', () => {
  const result = verticesFromCourses([
    { lengthMeters: 20, bearingDegrees: 90 },
    { lengthMeters: 30, bearingDegrees: 0 },
    { lengthMeters: 20, bearingDegrees: 270 },
    { lengthMeters: 30, bearingDegrees: 180 },
  ])
  assert.equal(result.vertices.length, 4)
  createRectangle(20, 30).forEach((point, i) => {
    close(result.vertices[i].x, point.x)
    close(result.vertices[i].y, point.y)
  })
  close(result.closureGap, 0)
  close(polygonArea(result.vertices), 600)
})

test('la entrada por medidas conserva el croquis aunque el último tramo no cierre', () => {
  const result = verticesFromCourses([
    { lengthMeters: 20, bearingDegrees: 90 },
    { lengthMeters: 30, bearingDegrees: 0 },
    { lengthMeters: 20, bearingDegrees: -90 },
    { lengthMeters: 80, bearingDegrees: 180 },
  ])
  close(polygonArea(result.vertices), 600)
  close(result.closureGap, 50)
})

test('los tramos requieren medidas y direcciones finitas', () => {
  assert.throws(() => verticesFromCourses([]), /tres tramos/)
  const valid = { lengthMeters: 10, bearingDegrees: 45 }
  for (const invalid of [null, { lengthMeters: 0, bearingDegrees: 90 }, { lengthMeters: 10, bearingDegrees: NaN }]) {
    assert.throws(() => verticesFromCourses([valid, valid, invalid]), /tramo/)
  }
})

test('la división por línea entrega dos polígonos completos y conserva el área', () => {
  const parent = createRectangle(20, 30)
  const regions = splitByLine(parent, { x: -5, y: 10 }, { x: 25, y: 10 })
  assert.equal(regions.length, 2)
  assert.deepEqual(regions.map((entry) => entry.area).sort((a, b) => a - b), [200, 400])
  assert.ok(regions.every((entry) => entry.points.length === 4))
  assert.equal(validateSubdivision(parent, regions), true)
})

test('cortes por esquinas, oblicuos y con orden inverso producen regiones válidas', () => {
  const parent = createRectangle(20, 30)
  for (const points of [parent, [...parent].reverse()]) {
    for (const [start, end] of [[{ x: 0, y: 0 }, { x: 20, y: 30 }], [{ x: -10, y: 5 }, { x: 25, y: 25 }]]) {
      const regions = splitByLine(points, start, end)
      close(regions.reduce((area, entry) => area + entry.area, 0), 600)
      assert.equal(validateSubdivision(points, regions), true)
    }
  }
})

test('rechaza líneas externas, sobre un borde o sin dirección y calles excesivas', () => {
  const parent = createRectangle(20, 30)
  assert.throws(() => splitByLine(parent, { x: 0, y: 40 }, { x: 20, y: 40 }), /atravesar/)
  assert.throws(() => splitByLine(parent, { x: 0, y: 0 }, { x: 20, y: 0 }), /atravesar/)
  assert.throws(() => splitByLine(parent, { x: 0, y: 0 }, { x: 0, y: 0 }), /distintos/)
  assert.throws(() => splitByLine(parent, null, { x: 0, y: 0 }), /puntos válidos/)
  assert.throws(() => splitByStreet(parent, { x: 0, y: 15 }, { x: 20, y: 15 }, 40), /atravesar/)
})

test('detecta un solapamiento aunque la suma de áreas coincida con el padre', () => {
  const regions = [region(rectangle(6, 10)), region(rectangle(4, 10, 4, 0))]
  close(regions.reduce((sum, entry) => sum + polygonArea(entry.points), 0), 100)
  assert.throws(() => validateSubdivision(rectangle(10, 10), regions), /superponerse/)
})

test('detecta regiones externas aunque la suma de áreas coincida', () => {
  const regions = [region(rectangle(5, 10)), region(rectangle(5, 10, 5, 5))]
  close(regions.reduce((sum, entry) => sum + polygonArea(entry.points), 0), 100)
  assert.throws(() => validateSubdivision(rectangle(10, 10), regions), /fuera/)
})

test('detecta huecos sin superposición ni regiones externas', () => {
  assert.throws(() => validateSubdivision(rectangle(10, 10), [region(rectangle(4, 10)), region(rectangle(4, 10, 6, 0))]), /conservan el área/)
})

test('valida particiones con padre o regiones cóncavos y bordes compartidos', () => {
  const concave = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }]
  const children = [region(rectangle(4, 1)), region(rectangle(1, 3, 0, 1))]
  assert.equal(validateSubdivision(concave, children), true)
  assert.equal(validateSubdivision([...concave].reverse(), children), true)
  assert.equal(validateSubdivision(rectangle(4, 4), [region(concave), region(rectangle(3, 3, 1, 1))]), true)
  assert.throws(() => splitByLine(concave, { x: 0, y: 2 }, { x: 4, y: 2 }), /convexos/)
})

test('detecta lados fuera de un padre cóncavo incluso con todos los vértices dentro', () => {
  const parent = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }]
  const bridge = [{ x: 0, y: 4 }, { x: 4, y: 4 }, { x: 2, y: 0 }]
  assert.throws(() => validateSubdivision(parent, [region(bridge), region(rectangle(4, 1))]), /fuera/)
})

test('la validación usa geometría y no confía en el área declarada por cada región', () => {
  const regions = splitByLine(rectangle(20, 30), { x: 0, y: 10 }, { x: 20, y: 10 })
  regions.forEach((entry) => { entry.area = -1 })
  assert.equal(validateSubdivision(rectangle(20, 30), regions), true)
  assert.throws(() => validateSubdivision(rectangle(20, 30), []), /dos regiones/)
  assert.throws(() => validateSubdivision(rectangle(20, 30), [region([]), region(rectangle(20, 30))]), /tres vértices/)
})
