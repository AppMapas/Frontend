import { httpClient } from '../../../shared/api/httpClient.js'
import { expectPage, queryString } from '../../../shared/api/pagination.js'

export const clientsApi = {
  async getAll() {
    const clients = await httpClient('/clients')
    if (!Array.isArray(clients)) throw new Error('El servidor no devolvió una lista de clientes válida.')
    return clients
  },
  async search(filters, options = {}) {
    return expectPage(await httpClient('/clients/search' + queryString(filters), options))
  },
  get(dpi, options = {}) {
    return httpClient('/clients/' + encodeURIComponent(dpi), options)
  },
  create(payload) {
    return httpClient('/clients', { method: 'POST', body: payload })
  },
  update(dpi, payload) {
    return httpClient('/clients/' + encodeURIComponent(dpi), { method: 'PUT', body: payload })
  },
  deactivate(dpi, version) {
    return httpClient('/clients/' + encodeURIComponent(dpi) + '/deactivate', { method: 'PATCH', body: { version } })
  },
}
