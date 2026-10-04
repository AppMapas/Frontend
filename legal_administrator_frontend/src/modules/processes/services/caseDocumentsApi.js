import { httpClient } from '../../../shared/api/httpClient.js'

const base = (caseId) => `/legal-processes/${caseId}/documents`

export const caseDocumentsApi = {
  policy: () => httpClient('/legal-processes/documents/policy'),
  list: (caseId) => httpClient(base(caseId)),
  upload(caseId, file) {
    const body = new FormData()
    body.append('file', file)
    return httpClient(base(caseId), { method: 'POST', body })
  },
  content: (caseId, id, download = false) => httpClient(
    `${base(caseId)}/${id}/content?download=${download}`, { responseType: 'blob' },
  ),
}
