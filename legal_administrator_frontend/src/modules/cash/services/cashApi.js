import { httpClient, ApiError } from '../../../shared/api/httpClient.js'
import { queryString, expectPage } from '../../../shared/api/pagination.js'

export const cashApi = {
  async incomeSummary(caseId, options = {}) {
    const result = await httpClient('/cash/incomes/' + encodeURIComponent(caseId) + '/summary', options)
    const money = /^\d+\.\d{2}$/
    const balance = /^-?\d+\.\d{2}$/
    let valid = result?.caseId === Number(caseId)
      && typeof result.totalAgreed === 'boolean' && typeof result.settled === 'boolean'
      && typeof result.overpaid === 'boolean' && typeof result.caseActive === 'boolean'
      && Number.isInteger(result.finalPaymentCount) && result.finalPaymentCount >= 0
      && typeof result.paidAmount === 'string' && money.test(result.paidAmount)
      && typeof result.finalPaymentAmount === 'string' && money.test(result.finalPaymentAmount)
    if (valid && result.totalAgreed) {
      valid = typeof result.totalAmount === 'string' && money.test(result.totalAmount)
        && typeof result.pendingAmount === 'string' && balance.test(result.pendingAmount)
    }
    if (valid && !result.totalAgreed) valid = result.totalAmount === null && result.pendingAmount === null
    if (!valid) throw new ApiError('El servidor no confirmó el estado de pagos del expediente.', { status: 200 })
    return result
  },
  async overview(filters, options = {}) {
    const result = await httpClient('/cash' + queryString(filters), options)
    if (!result?.summary || !result?.movements) throw new ApiError('No se pudo confirmar el resumen de Caja.', { status: 200 })
    expectPage(result.movements)
    for (const field of ['income', 'officeExpenses', 'personalExpenses', 'officeBalance', 'generalBalance']) {
      if (typeof result.summary[field] !== 'string' || !/^-?\d+\.\d{2}$/.test(result.summary[field])) {
        throw new ApiError('El servidor devolvió un total financiero no válido.', { status: 200 })
      }
    }
    return result
  },
  async annul(item, reason) {
    const body = { version: item.version, reason: reason.trim() }
    let endpoint = '/cash/incomes/' + encodeURIComponent(item.caseId) + '/' + encodeURIComponent(item.sourceId) + '/annul'
    if (item.source === 'EXPENSE') endpoint = '/cash/expenses/' + encodeURIComponent(item.sourceId) + '/annul'
    const result = await httpClient(endpoint, { method: 'POST', body })
    if (result?.source !== item.source || String(result?.sourceId) !== String(item.sourceId)) {
      throw new ApiError('El servidor no confirmó la anulación.', { status: 200 })
    }
    return result
  },
}
