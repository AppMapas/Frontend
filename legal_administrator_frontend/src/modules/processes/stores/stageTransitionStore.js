import { ref } from 'vue'
import { defineStore } from 'pinia'
import { legalProcessApi } from '../services/legalProcessApi.js'
import { createRequestId, uncertainResponse } from '../domain/caseRegistration.js'

export const useStageTransitionStore = defineStore('stageTransitions', () => {
  const busy = ref(false)
  const uncertain = ref(false)
  const pendingCaseId = ref(null)
  const pendingActor = ref(null)
  let pendingBody = null
  let inFlight = null

  function clear() {
    if (busy.value) return
    pendingBody = null
    pendingActor.value = null
    pendingCaseId.value = null
    uncertain.value = false
  }

  function move(caseId, input, actor) {
    if (!actor) throw new Error('Inicia sesión para cambiar la etapa.')
    if (inFlight && pendingActor.value !== actor) {
      throw new Error('Hay una solicitud pendiente de otra sesión.')
    }
    if (inFlight) return inFlight
    if (pendingBody && pendingActor.value !== actor) clear()
    if (pendingBody && pendingCaseId.value !== caseId) {
      throw new Error('Primero confirma el cambio de etapa pendiente en el otro expediente.')
    }
    if (!pendingBody) {
      pendingCaseId.value = caseId
      pendingActor.value = actor
      pendingBody = { ...structuredClone(input), requestId: createRequestId() }
    }
    busy.value = true
    inFlight = legalProcessApi.transitionStage(caseId, pendingBody)
      .then(detail => {
        busy.value = false
        inFlight = null
        clear()
        return detail
      })
      .catch(error => {
        busy.value = false
        inFlight = null
        uncertain.value = uncertainResponse(error)
        if (!uncertain.value) clear()
        throw error
      })
    return inFlight
  }

  return { busy, uncertain, pendingCaseId, pendingActor, move, clear }
})
