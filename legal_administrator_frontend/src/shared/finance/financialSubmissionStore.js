import { ref } from 'vue'
import { defineStore } from 'pinia'
import { httpClient, ApiError } from '../api/httpClient.js'
import { createRequestId, uncertainResponse } from '../../modules/processes/domain/caseRegistration.js'

export const useFinancialSubmissionStore = defineStore('financialSubmission', () => {
  const pending = ref(null)
  const busy = ref(false)
  const uncertain = ref(false)
  let inFlight = null
  let generation = 0
  const storageKey = 'legal-cash-pending-v1'
  function persist() {
    if (typeof window === 'undefined') return
    try {
      if (pending.value) window.sessionStorage.setItem(storageKey, JSON.stringify(pending.value))
      else window.sessionStorage.removeItem(storageKey)
    } catch (cause) {
      throw new ApiError('El navegador no permite conservar la solicitud. Habilita el almacenamiento de sesión antes de registrar movimientos.', { status: 409, cause })
    }
  }
  function restoreSession(actor) {
    if (!actor || typeof window === 'undefined' || pending.value) return
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null')
      if (saved?.actor === actor && /^\/(cash\/(incomes|expenses)|legal-processes\/\d+\/payments)$/.test(saved.endpoint)
          && /^[0-9a-f-]{36}$/i.test(saved.payload?.requestId) && ['cash', 'ledger'].includes(saved.kind)) {
        pending.value = Object.freeze({ ...saved, payload: Object.freeze(saved.payload) })
        uncertain.value = true
      } else window.sessionStorage.removeItem(storageKey)
    } catch {
      try { window.sessionStorage.removeItem(storageKey) } catch { /* El guardado verificará si hay almacenamiento disponible. */ }
    }
  }
  function resetSession() {
    generation += 1
    pending.value = null
    busy.value = false
    uncertain.value = false
    inFlight = null
    try { persist() } catch { /* Ya se borraron los datos de memoria. */ }
  }
  function send(endpoint, payload, actor, kind = 'cash') {
    if (!actor) throw new ApiError('Inicia sesión para registrar movimientos.', { status: 401 })
    if (pending.value && pending.value.actor !== actor) resetSession()
    if (pending.value && pending.value.endpoint !== endpoint) {
      throw new ApiError('Hay un movimiento sin confirmar. Resuélvelo antes de registrar otro.', { status: 409 })
    }
    if (inFlight) return inFlight
    if (!pending.value) {
      const body = Object.freeze({ ...structuredClone(payload), requestId: createRequestId() })
      pending.value = Object.freeze({ endpoint, payload: body, actor, kind })
      try { persist() } catch (error) { pending.value = null; throw error }
    }
    const request = pending.value
    const current = generation
    busy.value = true
    inFlight = httpClient(request.endpoint, { method: 'POST', body: request.payload }).then(result => {
      if (current !== generation) return null
      let valid = result?.source && result?.sourceId
      if (request.kind === 'ledger') valid = Array.isArray(result?.payments) && result?.paidAmount !== undefined
      if (!valid) throw new ApiError('El servidor no confirmó el movimiento.', { status: 200 })
      pending.value = null
      uncertain.value = false
      try { persist() } catch { /* El servidor confirmó el registro; una copia antigua solo permite reintentarlo. */ }
      return result
    }).catch(error => {
      if (current !== generation) return null
      uncertain.value = uncertainResponse(error)
      if (!uncertain.value) {
        pending.value = null
        persist()
      }
      throw error
    }).finally(() => {
      if (current !== generation) return
      busy.value = false
      inFlight = null
    })
    return inFlight
  }
  return { pending, busy, uncertain, send, resetSession, restoreSession }
})
