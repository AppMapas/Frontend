import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerrainEditor } from '../src/modules/terrenos/domain/terrainEditor.js'
import { toMeters } from '../src/modules/terrenos/domain/units.js'

const client = { dpi: '0012345678901', name: 'Cliente' }
const user = { dpi: '0098765432101', email: 'notario@example.test' }
const copy = (value) => structuredClone(value)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
const converted = (measures) => measures.map((item) => ({ originalValue: item.value, unit: item.unit, convertedValueMeters: toMeters(item) }))

function fixture(overrides = {}) {
  const calls = { convert: [], save: [], split: [], pdf: [] }
  let nextId = 41
  const api = {
    async getClients() { return [client] },
    async getCurrentUser() { return user },
    async convertUnits(measures) { calls.convert.push(copy(measures)); return converted(measures) },
    async calculateAndSavePolygon(terrain, boundaries) {
      calls.save.push(copy({ terrain, boundaries }))
      return { id: nextId++, totalAreaSquareMeters: 1200, warning: 'Área estimada' }
    },
    async splitPolygon(parentId, regions) {
      calls.split.push(copy({ parentId, regions }))
      return regions.map((entry) => ({ id: nextId++, terrainName: entry.cutName, totalAreaSquareMeters: entry.area }))
    },
    async downloadPdf(id) { calls.pdf.push(id); return new Blob(['%PDF-1.4'], { type: 'application/pdf' }) },
    ...overrides,
  }
  const editor = createTerrainEditor(api)
  editor.rectangle(20, 30, 'metros')
  return { editor, calls, api }
}

async function ready(overrides) {
  const result = fixture(overrides)
  await result.editor.loadReferences(user.email)
  result.editor.updateTerrain('clientDpi', client.dpi)
  result.editor.updateTerrain('terrainName', 'Los Pinos')
  return result
}

function cut(editor, kind = 'street') {
  editor.startCut(kind)
  editor.addStreetPoint({ x: -5, y: 15 })
  editor.addStreetPoint({ x: 25, y: 15 })
  if (kind === 'street') editor.updateStreet('width', 2)
}

test('la plantilla usa la vara del backend y los tramos conservan sus medidas originales', () => {
  const { editor } = fixture()
  close(editor.result.area, 600)
  editor.rectangle(10, 20, 'varas')
  close(editor.result.area, 200 * 0.836 ** 2)
  assert.equal(editor.boundaries[0].measurements[0].unit, 'varas')
  editor.fromCourses([
    { value: 20, unit: 'metros', bearing: 90 },
    { value: 30, unit: 'metros', bearing: 0 },
    { value: 20, unit: 'metros', bearing: 270 },
    { value: 80, unit: 'metros', bearing: 180 },
  ])
  close(editor.result.area, 600)
  close(editor.result.closureGap, 50)
  assert.equal(editor.error, '')
})

test('editar un lado conserva referencias y permite deshacer y rehacer la geometría completa', () => {
  const { editor } = fixture()
  const sideId = editor.boundaries[0].id
  editor.updateBoundary(sideId, 'referencePoint', 'Camino público')
  const previous = copy(editor.displayVertices)
  editor.editSide(0, 25, 'metros', 90)
  close(editor.result.lengths[0], 25)
  assert.equal(editor.boundaries[0].referencePoint, 'Camino público')
  const edited = copy(editor.displayVertices)
  editor.undo()
  assert.deepEqual(editor.displayVertices, previous)
  editor.redo()
  assert.deepEqual(editor.displayVertices, edited)
  assert.equal(editor.boundaries[0].referencePoint, 'Camino público')
})

test('las direcciones vacías no se interpretan silenciosamente como norte', () => {
  const { editor } = fixture()
  const initial = copy(editor.displayVertices)
  editor.editSide(0, 25, 'metros', '')
  assert.match(editor.error, /dirección/)
  assert.deepEqual(editor.displayVertices, initial)
  editor.fromCourses([
    { value: 20, unit: 'metros', bearing: 90 },
    { value: 30, unit: 'metros', bearing: '' },
    { value: 20, unit: 'metros', bearing: 270 },
  ])
  assert.match(editor.error, /azimut|dirección/)
  assert.deepEqual(editor.displayVertices, initial)
})

test('insertar, arrastrar y eliminar una esquina recalcula los lados vecinos', () => {
  const { editor } = fixture()
  editor.insertVertex(0, { x: 10, y: 0 })
  assert.equal(editor.vertices.length, 5)
  assert.deepEqual(editor.result.lengths.slice(0, 2), [10, 10])
  close(editor.result.area, 600)
  editor.moveVertex(1, { x: 10, y: -5 })
  close(editor.result.area, 650)
  close(editor.result.lengths[0], Math.hypot(10, 5))
  editor.selectedVertexIndex = 1
  editor.deleteVertex()
  assert.equal(editor.vertices.length, 4)
  close(editor.result.area, 600)
})

test('el historial restaura calle, ancho y nombres, y una nueva edición descarta rehacer', () => {
  const { editor } = fixture()
  cut(editor)
  assert.deepEqual(editor.subdivisions.map((entry) => entry.area), [280, 40, 280])
  editor.renameRegion(0, 'Lote norte')
  editor.updateStreet('width', 4)
  assert.deepEqual(editor.subdivisions.map((entry) => entry.area), [260, 80, 260])
  editor.undo()
  assert.equal(editor.street.width, 2)
  assert.equal(editor.subdivisions[0].cutName, 'Lote norte')
  assert.equal(editor.canRedo, true)
  editor.updateStreet('width', 3)
  assert.equal(editor.canRedo, false)
})

test('ediciones de medidas invalidan resultado y calle sin imponer un cierre exacto', () => {
  const { editor } = fixture()
  cut(editor)
  editor.updateMeasurement(editor.boundaries[0].id, 0, 'value', 21)
  assert.equal(editor.result, null)
  assert.deepEqual(editor.subdivisions, [])
  editor.calculate()
  close(editor.result.area, 615)
  close(editor.result.closureGap, 1)
  assert.equal(editor.error, '')
})

test('carga clientes y DPI del responsable manteniendo sus ceros iniciales', async () => {
  const { editor } = await ready()
  assert.equal(editor.terrain.userSystemId, user.dpi)
  assert.equal(editor.terrain.clientDpi, client.dpi)
  assert.equal(editor.currentUser.email, user.email)
  assert.equal(editor.isLoadingReferences, false)
  editor.updateTerrain('userSystemId', 'otro')
  assert.equal(editor.terrain.userSystemId, user.dpi)
})

test('una consulta de referencias anterior no reemplaza la identidad más reciente', async () => {
  const first = deferred(), second = deferred()
  const newerUser = { dpi: '0022222222222', email: 'nuevo@example.test' }
  const { editor } = fixture({ getCurrentUser: (email) => email === user.email ? first.promise : second.promise })
  const pendingFirst = editor.loadReferences(user.email)
  const pendingSecond = editor.loadReferences(newerUser.email)
  second.resolve(newerUser)
  await pendingSecond
  first.resolve(user)
  await pendingFirst
  assert.equal(editor.terrain.userSystemId, newerUser.dpi)
  assert.equal(editor.currentUser.email, newerUser.email)
  assert.equal(editor.isLoadingReferences, false)
})

test('una consulta de referencias pendiente impide guardar y el envío congela al responsable', async () => {
  const { editor, calls, api } = await ready()
  const references = deferred()
  api.getCurrentUser = () => references.promise
  const loading = editor.loadReferences(user.email)
  await editor.save()
  assert.equal(calls.save.length, 0)
  assert.equal(calls.convert.length, 0)
  references.resolve(user)
  await loading
  const conversion = deferred()
  api.convertUnits = () => conversion.promise
  const saving = editor.save()
  await editor.loadReferences('otro@example.test')
  assert.equal(editor.currentUser.dpi, user.dpi)
  assert.equal(editor.terrain.userSystemId, user.dpi)
  conversion.resolve(converted(editor.boundaries.flatMap((side) => side.measurements)))
  await saving
  assert.equal(calls.save.length, 1)
  assert.equal(calls.save[0].terrain.userSystemId, user.dpi)
})

test('un error de referencias se informa y evita guardar sin identidad válida', async () => {
  const { editor, calls } = fixture({ async getCurrentUser() { throw new Error('Sesión vencida') } })
  await editor.loadReferences(user.email)
  assert.equal(editor.referenceError, 'Sesión vencida')
  assert.equal(editor.isLoadingReferences, false)
  await editor.save()
  assert.equal(calls.save.length, 0)
  assert.match(editor.error, /responsable/)
})

test('la conversión remota agrupa componentes por lado y omite filas vacías', async () => {
  const { editor, calls } = fixture()
  const firstId = editor.boundaries[0].id
  editor.updateMeasurement(firstId, 0, 'value', 10)
  editor.updateMeasurement(firstId, 0, 'unit', 'varas')
  editor.addMeasurement(firstId)
  editor.updateMeasurement(firstId, 1, 'value', 100)
  editor.updateMeasurement(firstId, 1, 'unit', 'centímetros')
  editor.addMeasurement(firstId)
  assert.equal(await editor.calculateRemote(), true)
  assert.deepEqual(calls.convert[0].slice(0, 2), [{ value: 10, unit: 'varas' }, { value: 100, unit: 'centímetros' }])
  assert.equal(calls.convert[0].length, 5)
  close(editor.result.lengths[0], 9.36)
  assert.deepEqual(editor.result.lengths.slice(1), [30, 20, 30])
})

test('rechaza conversiones incompletas, reordenadas o sin valores numéricos', async () => {
  for (const response of [
    (measures) => converted(measures).slice(1),
    (measures) => converted(measures).reverse(),
    (measures) => converted(measures).map((item) => ({ ...item, convertedValueMeters: NaN })),
  ]) {
    const { editor } = fixture({ async convertUnits(measures) { return response(measures) } })
    assert.equal(await editor.calculateRemote(), false)
    assert.match(editor.error, /conversión/)
    assert.equal(editor.isConverting, false)
    assert.equal(editor.convertedRevision, null)
  }
})

test('una respuesta de conversión vencida no reemplaza el resultado actual', async () => {
  const pending = deferred()
  const { editor } = fixture({ convertUnits: () => pending.promise })
  const initialResult = editor.result
  const request = editor.calculateRemote()
  editor.revision++
  pending.resolve(converted(editor.boundaries.flatMap((side) => side.measurements)))
  assert.equal(await request, false)
  assert.equal(editor.result, initialResult)
  assert.equal(editor.convertedRevision, null)
})

test('el guardado valida datos antes de llamar servicios y conserva resultado local y remoto separados', async () => {
  const { editor, calls } = await ready()
  editor.updateTerrain('terrainName', '')
  await editor.save()
  assert.equal(calls.convert.length, 0)
  assert.equal(calls.save.length, 0)
  assert.match(editor.error, /nombre/)
  editor.updateTerrain('terrainName', 'Los Pinos')
  await editor.save()
  assert.equal(calls.convert.length, 1)
  assert.equal(calls.save.length, 1)
  assert.equal(calls.save[0].terrain.userSystemId, user.dpi)
  assert.equal(editor.savedRecord.id, 41)
  assert.equal(editor.savedRecord.totalAreaSquareMeters, 1200)
  close(editor.result.area, 600)
  assert.equal(editor.isCurrentSaved, true)
  assert.equal(editor.hasPendingChanges, false)
})

test('doble clic durante conversión y guardado genera un solo registro y bloquea ediciones pendientes', async () => {
  const conversion = deferred(), saving = deferred()
  const { editor, calls, api } = await ready()
  const convertUnits = api.convertUnits, savePolygon = api.calculateAndSavePolygon
  api.convertUnits = async (measures) => { await conversion.promise; return convertUnits(measures) }
  api.calculateAndSavePolygon = async (...args) => { await saving.promise; return savePolygon(...args) }
  const first = editor.save()
  assert.equal(editor.busy, true)
  await editor.save()
  editor.updateTerrain('terrainName', 'Cambio durante envío')
  assert.equal(editor.terrain.terrainName, 'Los Pinos')
  conversion.resolve()
  while (!editor.isSaving) await Promise.resolve()
  await editor.save()
  saving.resolve()
  await first
  await editor.save()
  assert.equal(calls.save.length, 1)
  assert.equal(calls.convert.length, 1)
  assert.equal(editor.busy, false)
})

test('editar un terreno guardado no escribe automáticamente y el guardado explícito crea otro registro', async () => {
  const { editor, calls } = await ready()
  await editor.save()
  editor.updateTerrain('terrainName', 'Versión revisada')
  assert.equal(editor.isCurrentSaved, false)
  assert.equal(editor.savedCalculationId, null)
  assert.equal(calls.save.length, 1)
  editor.undo()
  assert.equal(editor.isCurrentSaved, true)
  assert.equal(editor.savedCalculationId, 41)
  editor.redo()
  await editor.save()
  assert.equal(calls.save.length, 2)
  assert.equal(editor.savedRecord.id, 42)
  assert.equal(editor.isCurrentSaved, true)
})

test('la división necesita la versión guardada y transmite polígonos métricos completos', async () => {
  const { editor, calls } = await ready()
  cut(editor)
  await editor.saveSplit()
  assert.equal(calls.split.length, 0)
  assert.match(editor.error, /Guarda primero/)
  await editor.save()
  await editor.saveSplit()
  assert.equal(calls.split.length, 1)
  assert.equal(calls.split[0].parentId, 41)
  assert.equal(calls.split[0].regions.length, 3)
  assert.ok(calls.split[0].regions.every((entry) => entry.points.length >= 3))
  close(calls.split[0].regions.reduce((sum, entry) => sum + entry.area, 0), 600)
  assert.deepEqual(editor.savedSubdivisionIds, [42, 43, 44])
})

test('doble clic al guardar una división no duplica lotes', async () => {
  const pending = deferred()
  const { editor, calls, api } = await ready()
  await editor.save()
  cut(editor, 'divide')
  const splitPolygon = api.splitPolygon
  api.splitPolygon = async (...args) => { await pending.promise; return splitPolygon(...args) }
  const first = editor.saveSplit()
  assert.equal(editor.isSavingSplit, true)
  await editor.saveSplit()
  editor.renameRegion(0, 'Cambio durante envío')
  assert.equal(editor.subdivisions[0].cutName, 'Lote A')
  pending.resolve()
  await first
  await editor.saveSplit()
  assert.equal(calls.split.length, 1)
  assert.equal(editor.isSavingSplit, false)
})

test('una edición del padre o una división superpuesta no se envían al backend', async () => {
  const { editor, calls } = await ready()
  await editor.save()
  cut(editor, 'divide')
  editor.subdivisions[1].points = copy(editor.subdivisions[0].points)
  await editor.saveSplit()
  assert.match(editor.error, /superponerse/)
  assert.equal(calls.split.length, 0)
  cut(editor)
  editor.updateBoundary(editor.boundaries[0].id, 'referencePoint', 'Vecino actualizado')
  await editor.saveSplit()
  assert.match(editor.error, /Guarda primero/)
  assert.equal(calls.split.length, 0)
})

test('un rechazo conocido permite corregir y reintentar; un error de conversión no crea incertidumbre de guardado', async () => {
  const { editor, api } = await ready({ async calculateAndSavePolygon() { throw Object.assign(new Error('Datos inválidos'), { status: 400 }) } })
  await editor.save()
  assert.equal(editor.error, 'Datos inválidos')
  assert.equal(editor.saveUncertain, false)
  api.calculateAndSavePolygon = async () => ({ id: 99, totalAreaSquareMeters: 1200 })
  await editor.save()
  assert.equal(editor.savedRecord.id, 99)
  const second = await ready({ async convertUnits() { throw new Error('Sin conexión') } })
  await second.editor.save()
  assert.equal(second.editor.saveUncertain, false)
  assert.equal(second.calls.save.length, 0)
  assert.equal(second.editor.busy, false)
})

test('un guardado ambiguo bloquea el reenvío automático del mismo terreno', async () => {
  for (const outcome of [new Error('Conexión interrumpida'), Object.assign(new Error('Error interno'), { status: 500 }), { id: null }]) {
    let writes = 0
    const { editor } = await ready({ async calculateAndSavePolygon() { writes++; if (outcome instanceof Error) throw outcome; return outcome } })
    await editor.save()
    assert.equal(editor.saveUncertain, true)
    assert.equal(editor.isSaving, false)
    await editor.save()
    assert.equal(writes, 1)
  }
})

test('iniciar un terreno nuevo libera los bloqueos ambiguos para ese nuevo registro', async () => {
  const { editor, api } = await ready({ async calculateAndSavePolygon() { throw new Error('Conexión interrumpida') } })
  await editor.save()
  assert.equal(editor.saveUncertain, true)
  editor.splitUncertain = true
  editor.resetEditor()
  assert.equal(editor.saveUncertain, false)
  assert.equal(editor.splitUncertain, false)
  assert.equal(editor.terrain.terrainName, '')
  assert.equal(editor.terrain.userSystemId, user.dpi)
  editor.rectangle(10, 20, 'metros')
  editor.updateTerrain('terrainName', 'Nuevo terreno')
  editor.updateTerrain('clientDpi', client.dpi)
  api.calculateAndSavePolygon = async () => ({ id: 99, totalAreaSquareMeters: 400 })
  await editor.save()
  assert.equal(editor.savedRecord.id, 99)
})

test('una respuesta parcial de subdivisiones bloquea reenvíos que podrían duplicar lotes', async () => {
  let writes = 0
  const { editor } = await ready({ async splitPolygon() { writes++; return [{ id: 70, totalAreaSquareMeters: 300 }] } })
  await editor.save()
  cut(editor, 'divide')
  await editor.saveSplit()
  assert.equal(editor.splitUncertain, true)
  assert.equal(editor.isSavingSplit, false)
  await editor.saveSplit()
  assert.equal(writes, 1)
  assert.deepEqual(editor.savedSubdivisionIds, [])
})

test('descarga el PDF como Blob y evita solicitudes duplicadas mientras está pendiente', async () => {
  const pending = deferred()
  const { editor } = fixture({ downloadPdf: () => pending.promise })
  const first = editor.downloadServerPdf(41)
  assert.equal(editor.downloadingId, 41)
  assert.equal(await editor.downloadServerPdf(41), null)
  const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
  pending.resolve(blob)
  assert.equal(await first, blob)
  assert.equal(editor.downloadingId, null)
})

test('errores de PDF liberan el estado para permitir otra descarga', async () => {
  const { editor } = fixture({ async downloadPdf() { throw new Error('No se encontró el reporte') } })
  assert.equal(await editor.downloadServerPdf(41), null)
  assert.equal(editor.error, 'No se encontró el reporte')
  assert.equal(editor.downloadingId, null)
})
