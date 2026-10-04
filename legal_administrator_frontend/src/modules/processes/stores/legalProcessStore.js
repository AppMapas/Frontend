import { ref } from 'vue'
import { defineStore } from 'pinia'
import { legalProcessApi } from '../services/legalProcessApi.js'
import { createRequestId, uncertainResponse } from '../domain/caseRegistration.js'
import { usePagedResource } from '../../../shared/lists/usePagedResource.js'

export const useLegalProcessStore = defineStore('legalProcesses', () => {
  const directory = usePagedResource(legalProcessApi.search)
  const creating = ref(false)
  const uncertain = ref(false)
  let pendingRequest = null
  let inFlight = null
  let generation = 0

  function open(payload) {
    if (inFlight) return inFlight
    if (!pendingRequest) pendingRequest = { ...structuredClone(payload), requestId: createRequestId() }
    const current = generation
    creating.value = true
    inFlight = legalProcessApi.create(pendingRequest).then(detail => {
      if (current !== generation) return null
      pendingRequest = null
      uncertain.value = false
      return detail
    }).catch(error => {
      if (current !== generation) return null
      uncertain.value = uncertainResponse(error)
      if (!uncertain.value) pendingRequest = null
      throw error
    }).finally(() => {
      if (current !== generation) return
      creating.value = false
      inFlight = null
    })
    return inFlight
  }
  function resetRegistration() {
    if (creating.value) return
    pendingRequest = null
    uncertain.value = false
  }
  function resetSession() {
    generation += 1
    directory.reset()
    pendingRequest = null
    creating.value = false
    uncertain.value = false
    inFlight = null
  }
  return { ...directory, creating, uncertain, open, resetRegistration, resetSession,
    get: legalProcessApi.get, update: legalProcessApi.update }
})
