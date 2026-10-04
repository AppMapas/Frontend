import { httpClient } from '../../../shared/api/httpClient.js'

async function list(endpoint) {
  const result = await httpClient('/catalogs/' + endpoint)
  if (!Array.isArray(result)) throw new Error('No fue posible interpretar los catálogos de clientes.')
  return result
}
export const clientCatalogApi = {
  countries: () => list('countries'),
  maritalStatuses: () => list('marital-statuses'),
  municipalities: () => list('municipalities'),
}
