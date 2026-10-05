import { httpClient } from '../../../shared/api/httpClient.js'

const paymentsBase = (caseId) => `/legal-processes/${caseId}/payments`

/**
 * El backend devuelve el resumen y la lista de abonos juntos en la misma
 * respuesta, así que cada escritura devuelve el libro completo y la vista no
 * necesita una segunda consulta para cuadrar las cifras.
 */
export const casePaymentsApi = {
  ledger: (caseId) => httpClient(paymentsBase(caseId)),
  register: (caseId, payment) => httpClient(paymentsBase(caseId), { method: 'POST', body: payment }),
  setTotalAmount: (caseId, { version, totalAmount }) => httpClient(
    `/legal-processes/${caseId}/total-amount`, { method: 'PUT', body: { version, totalAmount } },
  ),
  annul: (caseId, paymentId) => httpClient(`${paymentsBase(caseId)}/${paymentId}`, { method: 'DELETE' }),
}