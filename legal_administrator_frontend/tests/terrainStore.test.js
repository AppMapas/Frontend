import test from 'node:test'
import assert from 'node:assert/strict'

let createPinia, setActivePinia, useTerrainStore
let unavailable = false
try {
  ;({ createPinia, setActivePinia } = await import('pinia'))
  ;({ useTerrainStore } = await import('../src/modules/terrenos/stores/terrainStore.js'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes("'pinia'")) throw error
  unavailable = 'Requiere las dependencias del proyecto (npm ci).'
}
const options = { skip: unavailable }
function editor() {
  setActivePinia(createPinia())
  const store = useTerrainStore()
  store.loadExample()
  return store
}

test('editar medidas invalida área, calle e id guardado', options, () => {
  const store = editor()
  store.savedCalculationId = 4
  store.startStreet()
  store.addStreetPoint({ x: 0, y: 15 })
  store.addStreetPoint({ x: 20, y: 15 })
  store.updateStreet('width', 2)
  store.calculateStreet()
  assert.equal(store.subdivisions.length, 3)
  store.updateMeasurement(store.boundaries[0].id, 0, 'value', 21)
  assert.equal(store.result, null)
  assert.equal(store.savedCalculationId, null)
  assert.equal(store.stage, 'measuring')
  assert.deepEqual(store.subdivisions, [])
  store.calculate()
  assert.equal(store.result.area, 615)
  assert.equal(store.result.closureGap, 1)
  assert.equal(store.error, '')
})

test('volver al trazado y cerrarlo conserva las medidas y referencias', options, () => {
  const store = editor()
  store.updateBoundary(store.boundaries[0].id, 'referencePoint', 'Camino')
  const before = JSON.parse(JSON.stringify(store.boundaries))
  store.resumeDrawing()
  store.closePolygon()
  assert.deepEqual(JSON.parse(JSON.stringify(store.boundaries)), before)
  store.calculate()
  assert.equal(store.result.area, 600)
})

test('deshacer elimina solo el último punto y conserva los lados restantes', options, () => {
  const store = editor()
  const firstId = store.boundaries[0].id
  store.undoVertex()
  assert.equal(store.vertices.length, 3)
  assert.equal(store.boundaries.length, 3)
  assert.equal(store.boundaries[0].id, firstId)
  assert.equal(store.boundaries[0].measurements[0].value, 20)
  assert.equal(store.stage, 'drawing')
})

test('el borrador se mantiene entre instancias del mismo store y reiniciar lo limpia', options, () => {
  const store = editor()
  assert.equal(useTerrainStore().result.area, 600)
  store.$reset()
  assert.equal(store.stage, 'drawing')
  assert.equal(store.result, null)
  assert.deepEqual(store.vertices, [])
  assert.deepEqual(store.boundaries, [])
})

test('la calle no se calcula con un solo punto y puede cancelarse', options, () => {
  const store = editor()
  store.startStreet()
  store.addStreetPoint({ x: 0, y: 15 })
  store.updateStreet('width', 2)
  store.calculateStreet()
  assert.match(store.error, /entrada y la salida/)
  assert.deepEqual(store.subdivisions, [])
  store.cancelStreet()
  assert.equal(store.activeTool, 'none')
  assert.equal(store.result.area, 600)
})

test('cerrar un croquis no exige geometría exacta ni borra las medidas', options, () => {
  setActivePinia(createPinia())
  const store = useTerrainStore()
  for (const point of [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }]) store.addVertex(point)
  store.closePolygon()
  assert.equal(store.stage, 'measuring')
  assert.equal(store.error, '')
  store.boundaries.forEach((side) => store.updateMeasurement(side.id, 0, 'value', 10))
  store.addMeasurement(store.boundaries[0].id)
  store.calculate()
  assert.ok(store.result)
  assert.equal(store.error, '')
})
