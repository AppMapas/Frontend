import { bearingDegrees, createRectangle, distance, reconstructPolygon, snapPoint, splitByLine, splitByStreet, validateSubdivision, verticesFromCourses } from './geometry.js'
import { normalizeMeasurement, positiveDraftMeasurements, sumDraftMeasurements, toMeters } from './units.js'
import { buildCalculationRequest } from './calculationContract.js'

const clone = (value) => JSON.parse(JSON.stringify(value))
const boundary = (id) => ({ id, referencePoint: '', orientation: '', measurements: [{ value: '', unit: 'varas' }] })
const street = () => ({ points: [], width: '', unit: 'metros' })
const snapshotKeys = ['terrain', 'vertices', 'boundaries', 'nextBoundaryId', 'stage', 'activeTool', 'selectedSideId', 'selectedVertexIndex', 'result', 'street', 'subdivisions', 'cutKind']
const snapshot = (state) => clone(Object.fromEntries(snapshotKeys.map((key) => [key, state[key]])))
const fingerprint = (state) => JSON.stringify([state.terrain, state.vertices, state.boundaries])
const cleanBoundaries = (boundaries) => boundaries.map((side) => ({ ...side, measurements: positiveDraftMeasurements(side.measurements).map(normalizeMeasurement) }))

export function terrainState() {
  return {
    terrain: { clientDpi: '', userSystemId: '', terrainName: '', generalDescription: '', propertyType: 'RURAL' },
    vertices: [], boundaries: [], nextBoundaryId: 1, stage: 'drawing', activeTool: 'draw',
    selectedSideId: null, selectedVertexIndex: null, snapEnabled: true, result: null,
    street: street(), subdivisions: [], cutKind: 'street',
    past: [], future: [], revision: 0,
    clients: [], currentUser: null, referenceEmail: '', referenceRequestId: 0,
    isLoadingReferences: false, referenceError: '',
    isConverting: false, isSaving: false, isSavingSplit: false, downloadingId: null,
    savedRecord: null, savedFingerprint: '', savedCalculationId: null,
    savedSubdivisionIds: [], savedSubdivisions: [], savedSplitFingerprint: '',
    convertedRevision: null, savedRevision: null, saveUncertain: false, splitUncertain: false,
    error: '', notice: '',
  }
}

export function createTerrainDefinition(api) {
  return {
    state: terrainState,
    getters: {
      displayVertices: (state) => state.result?.vertices ?? state.vertices,
      canCalculate: (state) => state.stage !== 'drawing' && state.vertices.length >= 3,
      canUndo: (state) => state.past.length > 0,
      canRedo: (state) => state.future.length > 0,
      busy: (state) => state.isConverting || state.isSaving || state.isSavingSplit,
      hasPendingChanges: (state) => state.savedFingerprint !== fingerprint(state),
      isCurrentSaved: (state) => Boolean(state.savedRecord && state.savedFingerprint === fingerprint(state)),
    },
    actions: {
      run(action) {
        if (this.busy) return false
        this.error = ''
        try { action(); return true } catch (error) { this.error = error.message; return false }
      },
      checkpoint() {
        this.past.push(snapshot(this))
        if (this.past.length > 100) this.past.shift()
        this.future = []
        this.notice = ''
      },
      changed(geometry = true) {
        this.revision++
        this.savedCalculationId = null
        this.convertedRevision = null
        this.error = ''
        if (geometry) {
          this.result = null
          this.street = street()
          this.subdivisions = []
          if (this.stage === 'done') this.stage = 'measuring'
          this.activeTool = this.stage === 'drawing' ? 'draw' : 'select'
        }
      },
      undo() {
        if (this.busy || !this.past.length) return
        this.future.push(snapshot(this))
        Object.assign(this, this.past.pop())
        this.revision++
        this.convertedRevision = null
        this.savedCalculationId = this.isCurrentSaved ? this.savedRecord.id : null
        this.error = ''
      },
      redo() {
        if (this.busy || !this.future.length) return
        this.past.push(snapshot(this))
        Object.assign(this, this.future.pop())
        this.revision++
        this.convertedRevision = null
        this.savedCalculationId = this.isCurrentSaved ? this.savedRecord.id : null
        this.error = ''
      },
      resetEditor() {
        if (this.busy) return
        this.checkpoint()
        const fresh = terrainState()
        snapshotKeys.forEach((key) => { this[key] = fresh[key] })
        this.terrain.userSystemId = this.currentUser?.dpi ?? ''
        this.saveUncertain = false; this.splitUncertain = false
        this.changed()
      },
      updateTerrain(field, value) {
        if (this.busy || !Object.hasOwn(this.terrain, field) || field === 'userSystemId') return
        this.checkpoint()
        this.terrain[field] = value
        this.changed(false)
      },
      setTool(tool) {
        if (this.busy || !['draw', 'select', 'pan', 'street', 'divide'].includes(tool)) return
        if (tool === 'street' || tool === 'divide') { this.startCut(tool); return }
        if (tool === 'draw' && this.stage !== 'drawing') { this.resumeDrawing(); return }
        this.activeTool = tool
      },
      addVertex(raw) {
        if (this.stage !== 'drawing') return
        this.run(() => {
          if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) throw new Error('El punto no es válido.')
          this.checkpoint()
          const point = this.snapEnabled && this.vertices.length ? snapPoint(this.vertices.at(-1), raw) : raw
          this.vertices.push({ ...point })
          this.boundaries.push(boundary(this.nextBoundaryId++))
          this.changed()
        })
      },
      closePolygon() {
        if (this.stage !== 'drawing') return
        this.run(() => {
          if (this.vertices.length < 3) throw new Error('Dibuja al menos tres vértices.')
          this.checkpoint()
          this.stage = 'measuring'; this.activeTool = 'select'
        })
      },
      undoVertex() {
        if (this.busy || !this.vertices.length) return
        this.checkpoint(); this.stage = 'drawing'
        this.vertices.pop(); this.boundaries.pop()
        this.selectedVertexIndex = null; this.selectedSideId = null
        this.changed()
      },
      resumeDrawing() {
        if (this.busy) return
        this.checkpoint(); this.stage = 'drawing'; this.changed()
      },
      updateMeasurement(sideId, index, field, value) {
        const item = this.boundaries.find((side) => side.id === sideId)?.measurements[index]
        if (this.busy || !item || !['value', 'unit'].includes(field)) return
        this.checkpoint(); item[field] = value; this.changed()
      },
      addMeasurement(sideId) {
        const side = this.boundaries.find((item) => item.id === sideId)
        if (this.busy || !side) return
        this.checkpoint(); side.measurements.push({ value: '', unit: 'varas' }); this.changed()
      },
      removeMeasurement(sideId, index) {
        const side = this.boundaries.find((item) => item.id === sideId)
        if (this.busy || !side || side.measurements.length <= 1) return
        this.checkpoint(); side.measurements.splice(index, 1); this.changed()
      },
      updateBoundary(sideId, field, value) {
        const side = this.boundaries.find((item) => item.id === sideId)
        if (this.busy || !side || !['referencePoint', 'orientation'].includes(field)) return
        this.checkpoint(); side[field] = value; this.changed(false)
      },
      calculate() {
        if (!this.canCalculate) return
        this.run(() => {
          const lengths = this.boundaries.map((side, i) => {
            try { return sumDraftMeasurements(side.measurements) }
            catch (error) { throw new Error(`Lado ${i + 1}: ${error.message}`) }
          })
          this.result = { ...reconstructPolygon(this.vertices, lengths), lengths }
          this.stage = 'done'; this.activeTool = 'select'
        })
      },
      setGeometry(vertices, measurements) {
        this.vertices = clone(vertices)
        this.boundaries = vertices.map((point, i) => ({ ...boundary(this.nextBoundaryId++), measurements: measurements?.[i] ?? [{ value: distance(point, vertices[(i + 1) % vertices.length]), unit: 'metros' }] }))
        this.stage = 'measuring'; this.changed(); this.calculate()
      },
      rectangle(width, height, unit) {
        this.run(() => {
          const vertices = createRectangle(toMeters({ value: width, unit }), toMeters({ value: height, unit }))
          this.checkpoint()
          this.setGeometry(vertices, [width, height, width, height].map((value) => [{ value: Number(value), unit }]))
        })
      },
      fromCourses(courses) {
        this.run(() => {
          const normalized = courses.map((item) => {
            if (String(item.bearing ?? '').trim() === '') throw new Error('Indica la dirección de cada tramo.')
            return { lengthMeters: toMeters(item), bearingDegrees: Number(item.bearing) }
          })
          const { vertices } = verticesFromCourses(normalized)
          this.checkpoint()
          this.setGeometry(vertices, courses.map((item) => [normalizeMeasurement(item)]))
        })
      },
      refreshSideLengths(indices) {
        indices.forEach((index) => {
          const i = (index + this.vertices.length) % this.vertices.length
          this.boundaries[i].measurements = [{ value: distance(this.vertices[i], this.vertices[(i + 1) % this.vertices.length]), unit: 'metros' }]
        })
      },
      moveVertex(index, point) {
        this.run(() => {
          if (!this.displayVertices[index] || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
          this.checkpoint(); this.vertices = clone(this.displayVertices); this.vertices[index] = { ...point }
          this.refreshSideLengths([index - 1, index]); this.changed()
          if (this.stage !== 'drawing') this.calculate()
        })
      },
      editSide(index, value, unit, bearing) {
        this.run(() => {
          const length = toMeters({ value, unit }), angle = Number(bearing)
          if (String(bearing ?? '').trim() === '' || !Number.isFinite(angle) || !this.displayVertices[index]) throw new Error('Indica una dirección válida.')
          this.checkpoint(); this.vertices = clone(this.displayVertices)
          const next = (index + 1) % this.vertices.length, start = this.vertices[index], radians = angle * Math.PI / 180
          this.vertices[next] = { x: start.x + Math.sin(radians) * length, y: start.y + Math.cos(radians) * length }
          this.refreshSideLengths([next]); this.boundaries[index].measurements = [normalizeMeasurement({ value, unit })]
          this.changed(); this.calculate()
        })
      },
      insertVertex(index, point) {
        this.run(() => {
          if (this.stage === 'drawing' || !this.displayVertices[index]) return
          this.checkpoint(); this.vertices = clone(this.displayVertices)
          this.vertices.splice(index + 1, 0, { ...point })
          const side = this.boundaries[index]
          this.boundaries.splice(index + 1, 0, { ...clone(side), id: this.nextBoundaryId++ })
          this.refreshSideLengths([index, index + 1]); this.changed(); this.calculate()
        })
      },
      deleteVertex() {
        this.run(() => {
          const index = this.selectedVertexIndex
          if (index === null || !this.displayVertices[index]) return
          if (this.vertices.length <= 3) throw new Error('Conserva al menos tres esquinas en el terreno.')
          this.checkpoint(); this.vertices = clone(this.displayVertices)
          this.vertices.splice(index, 1); this.boundaries.splice(index, 1)
          this.refreshSideLengths([index - 1]); this.selectedVertexIndex = null; this.selectedSideId = null
          this.changed(); this.calculate()
        })
      },
      loadExample() { this.rectangle(20, 30, 'metros') },
      startCut(kind) {
        if (this.busy || !this.result) { if (!this.result) this.error = 'Calcula el terreno antes de dividirlo.'; return }
        this.checkpoint(); this.street = street(); this.subdivisions = []
        this.cutKind = kind === 'divide' ? 'divide' : 'street'; this.activeTool = this.cutKind; this.error = ''
      },
      startStreet() { this.startCut('street') },
      addStreetPoint(point) {
        if (this.busy || !this.result || !['street', 'divide'].includes(this.activeTool) || this.street.points.length >= 2) return
        this.checkpoint(); this.street.points.push({ ...point }); this.previewCut()
      },
      updateStreet(field, value) {
        if (this.busy || !['width', 'unit'].includes(field)) return
        this.checkpoint(); this.street[field] = value; this.subdivisions = []; this.previewCut()
      },
      moveStreetPoint(index, point) {
        if (this.busy || !this.street.points[index]) return
        this.checkpoint(); this.street.points[index] = { ...point }; this.previewCut()
      },
      previewCut() {
        if (this.street.points.length !== 2 || (this.cutKind === 'street' && !(Number(this.street.width) > 0))) return
        this.calculateStreet()
      },
      calculateStreet() {
        if (!this.result) return
        this.run(() => {
          this.subdivisions = []
          if (this.street.points.length !== 2) throw new Error('Marca la entrada y la salida de la calle o división.')
          const [start, end] = this.street.points
          this.subdivisions = this.cutKind === 'divide'
            ? splitByLine(this.result.vertices, start, end)
            : splitByStreet(this.result.vertices, start, end, toMeters({ value: this.street.width, unit: this.street.unit }))
          this.activeTool = 'select'
        })
      },
      renameRegion(index, name) {
        if (this.busy || !this.subdivisions[index]) return
        this.checkpoint(); this.subdivisions[index].cutName = name
      },
      cancelStreet() {
        if (this.busy) return
        this.checkpoint(); this.street = street(); this.subdivisions = []; this.activeTool = 'select'; this.error = ''
      },
      async loadReferences(email) {
        if (this.busy) return
        const id = ++this.referenceRequestId
        this.isLoadingReferences = true; this.referenceError = ''; this.referenceEmail = email
        if (this.currentUser?.email?.toLowerCase() !== String(email).toLowerCase()) { this.currentUser = null; this.terrain.userSystemId = '' }
        try {
          const [clients, user] = await Promise.all([api.getClients(), api.getCurrentUser(email)])
          if (id !== this.referenceRequestId) return
          this.clients = clients; this.currentUser = user; this.terrain.userSystemId = user.dpi
        } catch (error) { if (id === this.referenceRequestId) this.referenceError = error.message }
        finally { if (id === this.referenceRequestId) this.isLoadingReferences = false }
      },
      async calculateRemote() {
        if (this.busy || !this.canCalculate) return false
        this.error = ''; this.isConverting = true
        const revision = this.revision
        try {
          const sides = cleanBoundaries(this.boundaries)
          if (sides.some((side) => !side.measurements.length)) throw new Error('Ingresa al menos una medida por lado.')
          const measures = sides.flatMap((side) => side.measurements)
          const converted = await api.convertUnits(measures)
          if (revision !== this.revision) return false
          if (!Array.isArray(converted) || converted.length !== measures.length) throw new Error('La conversión recibida está incompleta.')
          converted.forEach((item, i) => {
            if (!Number.isFinite(item.convertedValueMeters) || item.convertedValueMeters <= 0
              || Number(item.originalValue) !== measures[i].value || item.unit !== measures[i].unit) throw new Error('El servidor devolvió una conversión inválida.')
          })
          let offset = 0
          const lengths = sides.map((side) => side.measurements.reduce((sum) => sum + converted[offset++].convertedValueMeters, 0))
          this.result = { ...reconstructPolygon(this.vertices, lengths), lengths }
          this.convertedRevision = revision; this.stage = 'done'; this.activeTool = 'select'
          return true
        } catch (error) { this.error = error.message; return false }
        finally { this.isConverting = false }
      },
      async save() {
        if (this.busy || this.isCurrentSaved || this.saveUncertain) return
        this.error = ''; this.notice = ''
        try {
          if (this.isLoadingReferences || !this.currentUser || this.terrain.userSystemId !== this.currentUser.dpi) throw new Error('Carga el usuario responsable antes de guardar.')
          if (!this.clients.some((client) => client.dpi === this.terrain.clientDpi)) throw new Error('Selecciona un cliente registrado.')
          if (!this.result) throw new Error('Calcula el área antes de guardar.')
          buildCalculationRequest(this.terrain, cleanBoundaries(this.boundaries))
        } catch (error) { this.error = error.message; return }
        if (this.convertedRevision !== this.revision && !await this.calculateRemote()) return
        this.isSaving = true
        const signature = fingerprint(this), revision = this.revision
        try {
          const record = await api.calculateAndSavePolygon(clone(this.terrain), cleanBoundaries(this.boundaries))
          if (!Number.isSafeInteger(record?.id) || record.id <= 0 || !Number.isFinite(record.totalAreaSquareMeters)) {
            this.saveUncertain = true; throw new Error('La respuesta no permite confirmar el registro. Verifica si se guardó antes de reintentar.')
          }
          this.savedRecord = record; this.savedFingerprint = signature; this.savedRevision = revision
          this.savedCalculationId = record.id
          this.notice = `Cálculo ${record.id} guardado.`
        } catch (error) {
          if (!error.status || error.status >= 500) this.saveUncertain = true
          this.error = error.message
        } finally { this.isSaving = false }
      },
      async saveSplit() {
        if (this.busy || this.splitUncertain) return
        this.error = ''
        const signature = JSON.stringify([this.savedRecord?.id, this.subdivisions])
        if (signature === this.savedSplitFingerprint) return
        try {
          if (!this.isCurrentSaved) throw new Error('Guarda primero esta versión del terreno.')
          validateSubdivision(this.result.vertices, this.subdivisions)
          if (this.subdivisions.some((region) => !region.cutName.trim())) throw new Error('Asigna un nombre a cada lote.')
        } catch (error) { this.error = error.message; return }
        this.isSavingSplit = true
        try {
          const records = await api.splitPolygon(this.savedRecord.id, clone(this.subdivisions))
          if (!Array.isArray(records) || records.length !== this.subdivisions.length
            || records.some((record) => !Number.isSafeInteger(record.id) || record.id <= 0 || !Number.isFinite(record.totalAreaSquareMeters))) {
            this.splitUncertain = true; throw new Error('No fue posible confirmar todos los lotes registrados. Verifica el guardado antes de reintentar.')
          }
          this.savedSubdivisions = records; this.savedSubdivisionIds = records.map((record) => record.id)
          this.savedSplitFingerprint = signature; this.notice = 'Subdivisiones guardadas.'
        } catch (error) {
          if (!error.status || error.status >= 500) this.splitUncertain = true
          this.error = error.message
        } finally { this.isSavingSplit = false }
      },
      async downloadServerPdf(id) {
        if (this.downloadingId !== null) return null
        this.downloadingId = id; this.error = ''
        try { return await api.downloadPdf(id) } catch (error) { this.error = error.message; return null }
        finally { this.downloadingId = null }
      },
    },
  }
}

// El mismo estado y acciones que consume Pinia pueden probarse sin un navegador.
export function createTerrainEditor(api = {}) {
  const definition = createTerrainDefinition(api), editor = definition.state()
  Object.entries(definition.getters).forEach(([name, getter]) => Object.defineProperty(editor, name, { get: () => getter(editor) }))
  Object.entries(definition.actions).forEach(([name, action]) => { editor[name] = action.bind(editor) })
  return editor
}
