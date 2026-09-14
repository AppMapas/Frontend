/**
 * Funciones de formateo para el sistema LegalAdministrator
 */

/**
 * Formatea un número como área en metros cuadrados (m²)
 */
export function formatSquareMeters(value, decimals = 2) {
  if (value == null || isNaN(value)) return '0.00 m²'
  return `${Number(value).toLocaleString('es-GT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} m²`
}

/**
 * Formatea un número como área en varas cuadradas (v²)
 */
export function formatSquareVaras(value, decimals = 2) {
  if (value == null || isNaN(value)) return '0.00 v²'
  return `${Number(value).toLocaleString('es-GT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} v²`
}

/**
 * Formatea una fecha estándar YYYY-MM-DD a formato legible
 */
export function formatDate(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-GT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
