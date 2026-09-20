import { httpClient } from '../../../shared/api/httpClient.js'
import { buildCalculationRequest, buildSplitRequest } from '../domain/calculationContract.js'
import { normalizeMeasurement } from '../domain/units.js'

// Estos métodos crean registros. No usarlos para la previsualización del editor.
export const calculationService = {
  async getClients() {
    const clients = await httpClient('/clients')
    if (!Array.isArray(clients) || clients.some((client) => typeof client?.dpi !== 'string' || !client.dpi.trim())) {
      throw new Error('El servidor no devolvió una lista de clientes válida.')
    }
    return clients
  },
  async getCurrentUser(email) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!normalizedEmail) throw new Error('Inicia sesión para identificar al usuario responsable.')
    const users = await httpClient('/users')
    if (!Array.isArray(users)) throw new Error('El servidor no devolvió una lista de usuarios válida.')
    const matches = users.filter((user) => typeof user?.email === 'string' && user.email.trim().toLowerCase() === normalizedEmail)
    if (matches.length !== 1) {
      throw new Error(matches.length
        ? 'Hay varios usuarios asociados al correo de la sesión. No se pudo identificar al responsable.'
        : 'No se encontró al usuario responsable de la sesión.')
    }
    if (typeof matches[0].dpi !== 'string' || !matches[0].dpi.trim()) {
      throw new Error('El usuario responsable no tiene un DPI válido.')
    }
    return matches[0]
  },
  convertUnits(measurements) {
    if (!Array.isArray(measurements) || !measurements.length) throw new Error('Incluye al menos una medida.')
    return httpClient('/calculations/convert', { method: 'POST', body: measurements.map(normalizeMeasurement) })
  },
  // El backend actual almacena totalAreaSquareMeters = 0 en esta operación.
  saveCalculation(terrain, boundaries, planImageBase64) {
    return httpClient('/calculations/save', { method: 'POST', body: buildCalculationRequest(terrain, boundaries, planImageBase64) })
  },
  // El área devuelta es una estimación por longitudes, independiente del plano local.
  calculateAndSavePolygon(terrain, boundaries, planImageBase64) {
    return httpClient('/calculations/polygon', { method: 'POST', body: buildCalculationRequest(terrain, boundaries, planImageBase64) })
  },
  splitPolygon(parentCalculationId, regions) {
    return httpClient('/calculations/split', { method: 'POST', body: buildSplitRequest(parentCalculationId, regions) })
  },
  async downloadPdf(id) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Selecciona un cálculo guardado para descargar el reporte.')
    const pdf = await httpClient(`/calculations/${id}/pdf`, {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
    })
    if (!(pdf instanceof Blob) || !pdf.size || pdf.type.split(';')[0].toLowerCase() !== 'application/pdf') {
      throw new Error('El servidor no devolvió un reporte PDF válido.')
    }
    return pdf
  },
}
