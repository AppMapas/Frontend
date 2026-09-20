import { normalizeMeasurement } from './units.js'
import { validatePolygon } from './geometry.js'

const API_UNITS = Object.freeze({
  metros: 'METERS',
  varas: 'VARAS',
  cuerda: 'CUERDA',
  'centímetros': 'CENTIMETERS',
  pulgadas: 'INCHES',
  yardas: 'YARDS',
})

const API_ORIENTATIONS = Object.freeze({ N: 'Norte', S: 'Sur', E: 'Este', O: 'Oeste' })

export const BACKEND_CAPABILITIES = Object.freeze({
  savesVertices: false,
  exactAreaForIrregularPolygons: false,
  updatesCalculations: false,
  retrievesGeometry: false,
  pdfUsesSavedGeometry: false,
})

export function getCalculationValidationErrors(terrain = {}, boundaries = []) {
  const errors = []
  const required = [
    ['clientDpi', 'Selecciona el cliente propietario.'],
    ['userSystemId', 'No se pudo identificar el usuario responsable.'],
    ['terrainName', 'Ingresa el nombre del terreno.'],
    ['propertyType', 'Selecciona el tipo de propiedad.'],
    ['location', 'Ingresa la ubicación del terreno.'],
  ]

  required.forEach(([field, message]) => {
    if (typeof terrain[field] !== 'string' || !terrain[field].trim()) errors.push(message)
  })

  if (!Array.isArray(boundaries) || boundaries.length < 3) {
    errors.push('El plano debe incluir al menos tres colindancias.')
    return errors
  }

  boundaries.forEach((boundary, index) => {
    if (!Array.isArray(boundary.measurements) || !boundary.measurements.length) {
      errors.push(`Ingresa al menos una medida para el lado ${index + 1}.`)
      return
    }
    boundary.measurements.forEach((measurement, measurementIndex) => {
      try {
        normalizeMeasurement(measurement)
      } catch {
        errors.push(`Completa una medida válida en el lado ${index + 1}, medida ${measurementIndex + 1}.`)
      }
    })
    const orientation = String(boundary.orientation ?? '').trim().toUpperCase().replace(/^W$/, 'O')
    if (orientation && !['N', 'S', 'E', 'O'].includes(orientation)) {
      errors.push(`La orientación del lado ${index + 1} debe ser N, S, E u O.`)
    }
  })

  return errors
}

export function buildCalculationRequest(terrain, boundaries, planImageBase64) {
  const requiredText = (value, name) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} es obligatorio.`)
    return value.trim()
  }
  if (!Array.isArray(boundaries) || boundaries.length < 3) {
    throw new Error('Incluye al menos tres colindancias.')
  }
  if (typeof planImageBase64 !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(planImageBase64)) {
    throw new Error('No fue posible generar la imagen PNG del plano.')
  }
  return {
    clientDpi: requiredText(terrain.clientDpi, 'El DPI del cliente'),
    userSystemId: requiredText(terrain.userSystemId, 'El DPI del usuario'),
    terrainName: requiredText(terrain.terrainName, 'El nombre del terreno'),
    generalDescription: String(terrain.generalDescription ?? '').trim(),
    propertyType: requiredText(terrain.propertyType, 'El tipo de propiedad'),
    location: requiredText(terrain.location, 'La ubicación del terreno'),
    planImageBase64,
    boundaries: boundaries.map((boundary, i) => {
      if (!Array.isArray(boundary.measurements) || !boundary.measurements.length) {
        throw new Error(`El lado ${i + 1} debe incluir medidas.`)
      }
      const orientation = String(boundary.orientation ?? '').trim().toUpperCase().replace(/^W$/, 'O')
      if (orientation && !['N', 'S', 'E', 'O'].includes(orientation)) {
        throw new Error(`La orientación del lado ${i + 1} debe ser N, S, E u O.`)
      }
      return {
        sideNumber: i + 1,
        referencePoint: String(boundary.referencePoint ?? '').trim(),
        orientation: orientation ? API_ORIENTATIONS[orientation] : '',
        measurements: boundary.measurements.map((measurement) => {
          const normalized = normalizeMeasurement(measurement)
          return { value: normalized.value, unit: API_UNITS[normalized.unit] }
        }),
      }
    }),
  }
}

export function buildSplitRequest(parentCalculationId, regions) {
  if (!Number.isSafeInteger(parentCalculationId) || parentCalculationId <= 0) {
    throw new Error('Primero debe existir un cálculo padre guardado.')
  }
  if (!Array.isArray(regions) || !regions.length) throw new Error('Incluye al menos una subdivisión.')
  return {
    parentCalculationId,
    splitLines: regions.map((region) => {
      const cutName = String(region.cutName ?? '').trim()
      if (!cutName) throw new Error('Cada subdivisión debe tener un nombre.')
      validatePolygon(region.points)
      return { cutName, points: region.points.map(({ x, y }) => ({ x, y })) }
    }),
  }
}
