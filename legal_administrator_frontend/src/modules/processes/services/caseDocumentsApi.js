import { httpClient } from '../../../shared/api/httpClient.js'

const base = (caseId) => `/legal-processes/${caseId}/documents`
const destination = (caseId, requirementId) => requirementId
  ? `/legal-processes/${caseId}/requirements/${requirementId}/documents` : base(caseId)

export const caseDocumentsApi = {
  uploadReceipt(caseId, requestId, file) {
    const body = new FormData()
    body.append('file', file)
    return httpClient(`/legal-processes/${caseId}/payments/requests/${requestId}/receipt`, { method: 'POST', body })
  },
  receipts: (caseId, paymentId) => httpClient(`/legal-processes/${caseId}/payments/${paymentId}/receipts`),
  removeReceipt: (caseId, paymentId, documentId) => httpClient(
    `/legal-processes/${caseId}/payments/${paymentId}/receipts/${documentId}`, { method: 'DELETE' },
  ),
  completeCase: (caseId) => httpClient(`/legal-processes/${caseId}/complete`, { method: 'POST' }),
  updateRequirementStatus: (caseId, requirementId, status) => httpClient(
    `/legal-processes/${caseId}/requirements/${requirementId}/status`, { method: 'PATCH', body: { status } },
  ),
  policy: () => httpClient('/legal-processes/documents/policy'),
  list: (caseId, requirementId) => httpClient(destination(caseId, requirementId)),
  upload(caseId, file, requirementId) {
    const body = new FormData()
    body.append('file', file)
    return httpClient(destination(caseId, requirementId), { method: 'POST', body })
  },
  content: (caseId, id, download = false) => httpClient(
    `${base(caseId)}/${id}/content?download=${download}`, { responseType: 'blob' },
  ),
}
