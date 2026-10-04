import { httpClient, ApiError } from '../../../shared/api/httpClient.js'

function expectList(value, label) {
  if (!Array.isArray(value)) {
    throw new Error('El servidor no devolvió una lista válida de ' + label + '.')
  }
  return value
}

function expectConfiguration(value) {
  if (!Number.isSafeInteger(value?.version) || !Array.isArray(value.stages)
    || !Array.isArray(value.transitions)) {
    throw new ApiError('El servidor no devolvió una configuración de etapas válida.', { status: 200 })
  }
  return value
}

export const processCatalogApi = {
  async getRequirements() {
    return expectList(await httpClient('/requirements'), 'requisitos')
  },

  getRequirement(id) {
    return httpClient('/requirements/' + encodeURIComponent(id))
  },

  createRequirement(payload) {
    return httpClient('/requirements', { method: 'POST', body: payload })
  },

  updateRequirement(id, payload) {
    return httpClient('/requirements/' + encodeURIComponent(id), { method: 'PUT', body: payload })
  },

  deactivateRequirement(id) {
    return httpClient('/requirements/' + encodeURIComponent(id) + '/deactivate', { method: 'PATCH' })
  },

  async getProcessTypes() {
    return expectList(await httpClient('/process-types'), 'trámites')
  },

  getProcessType(id) {
    return httpClient('/process-types/' + encodeURIComponent(id))
  },

  async getStages(id) {
    return expectConfiguration(await httpClient('/process-types/' + encodeURIComponent(id) + '/stages'))
  },

  async saveStages(id, payload) {
    return expectConfiguration(await httpClient('/process-types/' + encodeURIComponent(id) + '/stages', {
      method: 'PUT', body: payload,
    }))
  },

  createProcessType(payload) {
    return httpClient('/process-types', { method: 'POST', body: payload })
  },

  updateProcessType(id, payload) {
    return httpClient('/process-types/' + encodeURIComponent(id), { method: 'PUT', body: payload })
  },

  publishProcessType(id, version) {
    return httpClient('/process-types/' + encodeURIComponent(id) + '/publish', {
      method: 'PATCH',
      body: { version },
    })
  },

  deactivateProcessType(id, version) {
    return httpClient('/process-types/' + encodeURIComponent(id) + '/deactivate', {
      method: 'PATCH',
      body: { version },
    })
  },
}
