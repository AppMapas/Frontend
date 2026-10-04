export function createRequestId(source = globalThis.crypto) {
  if (typeof source?.randomUUID === 'function') return source.randomUUID()
  if (typeof source?.getRandomValues !== 'function') {
    throw new Error('Este navegador no permite generar una solicitud segura. Usa un navegador actualizado.')
  }
  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hexadecimal = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
  return [hexadecimal.slice(0, 8), hexadecimal.slice(8, 12), hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20), hexadecimal.slice(20)].join('-')
}

export function uncertainResponse(error) {
  const status = error?.status
  if (status === 0 || status >= 500) return true
  if (status >= 200 && status < 300) return true
  return false
}

export function statusLabel(value) {
  const labels = { OPEN: 'Abierto', PENDING: 'Pendiente', IN_REVIEW: 'En revisión',
    COMPLETED: 'Completado', NOT_APPLICABLE: 'No aplica' }
  return labels[value] || value || 'Sin estado'
}

export function formatTimestamp(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
