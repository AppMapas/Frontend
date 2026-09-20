// Contrato de UnitConversion.java. Las superficies se convierten con el factor al cuadrado.
import { CONVERSION_FACTORS } from '../../../utils/constants.js'
export const VARA_TO_METERS = CONVERSION_FACTORS.VARA_TO_M
export const CUERDA_TO_METERS = CONVERSION_FACTORS.CUERDA_SIDE_VARAS * VARA_TO_METERS
export const CUERDA_TO_SQUARE_METERS = CUERDA_TO_METERS ** 2
export const UNITS = Object.freeze([
  { value: 'varas', label: 'Varas', factor: VARA_TO_METERS },
  { value: 'cuerda', label: 'Cuerda (26 varas)', factor: CUERDA_TO_METERS },
  { value: 'metros', label: 'Metros', factor: 1 },
  { value: 'centímetros', label: 'Centímetros', factor: 0.01 },
  { value: 'pulgadas', label: 'Pulgadas', factor: 0.0254 },
  { value: 'yardas', label: 'Yardas', factor: 0.9144 },
])

const aliases = new Map([
  ['vara', 'varas'], ['m', 'metros'], ['metro', 'metros'],
  ['cuerdas', 'cuerda'],
  ['cm', 'centímetros'], ['centimetro', 'centímetros'], ['centímetro', 'centímetros'],
  ['centimetros', 'centímetros'], ['in', 'pulgadas'], ['pulgada', 'pulgadas'],
  ['yd', 'yardas'], ['yarda', 'yardas'],
])

export function normalizeUnit(unit) {
  const input = String(unit ?? '').trim().toLowerCase()
  const normalized = aliases.get(input) || input
  if (!UNITS.some((item) => item.value === normalized)) {
    throw new Error(`Unidad no admitida: ${input || '(vacía)'}.`)
  }
  return normalized
}

export function normalizeMeasurement(measurement) {
  if (!measurement || !['number', 'string'].includes(typeof measurement.value)) {
    throw new Error('Cada medida debe ser un número mayor que cero.')
  }
  const value = Number(measurement.value)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Cada medida debe ser un número mayor que cero.')
  }
  return { value, unit: normalizeUnit(measurement.unit) }
}

export function toMeters(measurement) {
  const { value, unit } = normalizeMeasurement(measurement)
  const meters = value * UNITS.find((item) => item.value === unit).factor
  if (!Number.isFinite(meters)) throw new Error('La medida excede el rango permitido.')
  return meters
}

export function sumMeasurements(measurements) {
  if (!Array.isArray(measurements) || !measurements.length) {
    throw new Error('Cada colindancia debe incluir al menos una medida.')
  }
  const total = measurements.reduce((sum, item) => sum + toMeters(item), 0)
  if (!Number.isFinite(total)) throw new Error('La suma de medidas excede el rango permitido.')
  return total
}

export function toSquareVaras(squareMeters) {
  return squareMeters / (VARA_TO_METERS ** 2)
}

export function toCuerdas(squareMeters) {
  const area = Number(squareMeters)
  if (!Number.isFinite(area)) throw new Error('El área no es válida para convertir a cuerdas.')
  return area / CUERDA_TO_SQUARE_METERS
}

// Durante el dibujo solo se suman los componentes positivos, como en el demo original.
// La normalización del DTO sigue validando todas las medidas al preparar una petición.
export function positiveDraftMeasurements(measurements) {
  return measurements.filter((item) => ['number', 'string'].includes(typeof item.value)
    && Number.isFinite(Number(item.value)) && Number(item.value) > 0)
}

export function sumDraftMeasurements(measurements) {
  return sumMeasurements(positiveDraftMeasurements(measurements))
}

export function formatSideMeasurements(measurements) {
  const labels = { varas: 'varas', cuerda: 'cuerda', metros: 'm', 'centímetros': 'cm', pulgadas: 'pulg', yardas: 'yd' }
  return positiveDraftMeasurements(measurements)
    .map((item) => `${item.value} ${labels[normalizeUnit(item.unit)]}`).join(' + ')
}
