import { httpClient, ApiError } from '../../../shared/api/httpClient.js'
import { queryString, expectPage } from '../../../shared/api/pagination.js'

function expectDetail(detail) {
  if (!detail?.caseData?.id || !Array.isArray(detail.requirements)) {
    throw new ApiError('El servidor no confirmó un expediente válido.', { status: 200 })
  }
  return detail
}
export const legalProcessApi = {
  async search(filters, options = {}) {
    return expectPage(await httpClient('/legal-processes' + queryString(filters), options))
  },
  async get(id, options = {}) {
    return expectDetail(await httpClient('/legal-processes/' + encodeURIComponent(id), options))
  },
  async create(payload) {
    return expectDetail(await httpClient('/legal-processes', { method: 'POST', body: payload }))
  },
  async update(id, payload) {
    return expectDetail(await httpClient('/legal-processes/' + encodeURIComponent(id), { method: 'PUT', body: payload }))
  },
  async transitionStage(id, payload) {
    const detail = await httpClient('/legal-processes/' + encodeURIComponent(id) + '/stage-transitions', {
      method: 'POST', body: payload,
    })
    if (!detail?.timeline || !Array.isArray(detail.timeline.events)) {
      throw new ApiError('El servidor no confirmó la nueva etapa.', { status: 200 })
    }
    return expectDetail(detail)
  },
  async publishedTemplates() {
    const result = await httpClient('/process-types?status=PUBLISHED')
    if (!Array.isArray(result)) throw new Error('El servidor no devolvió los trámites publicados.')
    return result.filter(item => item.status === 'PUBLISHED')
  },
}
