import { defineStore } from 'pinia'
import { ref } from 'vue'
import { agendaApi } from '../services/agendaApi.js'
const STORAGE_KEY = 'legal-agenda-pending-v1'
// Conserva el identificador de un envío para que reintentar un guardado no duplique la actividad.
export const useAgendaSubmissionStore = defineStore('agendaSubmission', () => {
  const pending = ref(null),
    busy = ref(false)
  let generation = 0,
    flight = null
  function persist() {
    try {
      if (pending.value) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending.value))
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* La solicitud permanece en memoria cuando el almacenamiento está restringido. */
    }
  }

  function restore(actor) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null')
      if (saved?.actor === actor && typeof saved.payload?.requestId === 'string' && saved.payload?.startsAt) {
        pending.value = saved
      } else {
        pending.value = null
        window.sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      pending.value = null
    }
  }

  function reset() {
    generation += 1
    pending.value = null
    busy.value = false
    flight = null
    persist()
  }

  async function send(payload, actor, eventId = null) {
    if (flight) {
      return flight
    }
    if (pending.value && (pending.value.actor !== actor || pending.value.eventId !== eventId)) {
      throw new Error('Confirma primero la actividad cuyo guardado está pendiente.')
    }
    if (!pending.value) {
      pending.value = {
        payload,
        actor,
        eventId,
      }
    }
    persist()
    const current = ++generation
    busy.value = true
    const request = pending.value
    flight = (async () => {
      try {
        let result
        if (request.eventId) {
          result = await agendaApi.update(request.eventId, request.payload)
        } else {
          result = await agendaApi.create(request.payload)
        }
        if (current !== generation) {
          return null
        }
        pending.value = null
        persist()
        return result
      } catch (error) {
        if (current !== generation) {
          return null
        }
        if (error.status > 0 && error.status < 500) {
          pending.value = null
          persist()
        }
        throw error
      } finally {
        if (current === generation) {
          busy.value = false
          flight = null
        }
      }
    })()
    return flight
  }
  return {
    pending,
    busy,
    restore,
    send,
    reset,
  }
})
