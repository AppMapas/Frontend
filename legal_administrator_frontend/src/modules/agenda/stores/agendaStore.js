import { defineStore } from 'pinia'
import { ref } from 'vue'
import { agendaApi } from '../services/agendaApi.js'
// Mantiene listas locales y externas separadas; una respuesta antigua nunca reemplaza la consulta vigente.
export const useAgendaStore = defineStore('agenda', () => {
  const events = ref([])
  const totalPages = ref(0)
  const totalElements = ref(0)
  const loading = ref(false)
  const failed = ref(false)
  const calendarEvents = ref([])
  const googleEvents = ref([])
  const calendarLoading = ref(false)
  const googleLoading = ref(false)
  const googleState = ref('DISCONNECTED')
  const googleFailed = ref(false)
  const checkedAt = ref(null)
  let calendarSequence = 0
  let calendarController = null
  let sequence = 0
  let controller = null
  // Invalida solicitudes al cambiar de sesión y elimina datos de la usuaria anterior.
  function reset() {
    calendarSequence += 1
    calendarController?.abort()
    calendarEvents.value = []
    googleEvents.value = []
    calendarLoading.value = false
    googleLoading.value = false
    googleState.value = 'DISCONNECTED'
    googleFailed.value = false
    checkedAt.value = null
    sequence += 1
    controller?.abort()
    events.value = []
    totalPages.value = 0
    totalElements.value = 0
    loading.value = false
    failed.value = false
  }

  async function load(filters) {
    controller?.abort()
    controller = new AbortController()
    const current = ++sequence
    loading.value = true
    failed.value = false
    try {
      const page = await agendaApi.list(filters, {
        signal: controller.signal,
      })
      if (current !== sequence) {
        return null
      }
      if (!Array.isArray(page.content) || !Number.isInteger(page.totalPages)) {
        throw new Error('La agenda recibida no es válida.')
      }
      events.value = page.content
      totalPages.value = page.totalPages
      totalElements.value = page.totalElements
      return page
    } catch (error) {
      if (current !== sequence || controller.signal.aborted) {
        return null
      }
      failed.value = true
      events.value = []
      throw error
    } finally {
      if (current === sequence) {
        loading.value = false
      }
    }
  }
  // Consulta ambos orígenes en paralelo: un fallo de Google no oculta las actividades internas.
  async function loadCalendar(filters) {
    calendarController?.abort()
    const request = new AbortController()
    calendarController = request
    const current = ++calendarSequence
    calendarLoading.value = true
    googleLoading.value = true
    googleFailed.value = false
    checkedAt.value = null
    googleState.value = 'DISCONNECTED'
    calendarEvents.value = []
    googleEvents.value = []
    const options = { signal: request.signal }
    const errors = { localError: null, googleError: null }
    async function loadLocal() {
      try {
        const rows = await agendaApi.calendar(filters, options)
        if (!Array.isArray(rows) || rows.length > 10000) {
          throw new Error('La agenda recibida no es válida.')
        }
        if (current === calendarSequence) {
          calendarEvents.value = rows
        }
      } catch (error) {
        if (current === calendarSequence && !request.signal.aborted) {
          errors.localError = error
        }
      } finally {
        if (current === calendarSequence) {
          calendarLoading.value = false
        }
      }
    }
    async function loadGoogle() {
      try {
        const status = await agendaApi.googleStatus(options)
        if (current !== calendarSequence) {
          return
        }
        googleState.value = status.state
        if (status.state !== 'CONNECTED') {
          return
        }
        const rows = []
        const seen = new Set()
        let pageToken = null
        // Acota páginas y detecta cursores repetidos para evitar consultas externas interminables.
        for (let page = 0; page < 40; page += 1) {
          const result = await agendaApi.googleEvents(
            { from: filters.from, to: filters.to, pageToken },
            options,
          )
          if (current !== calendarSequence) {
            return
          }
          if (!Array.isArray(result.items) || result.items.length > 250) {
            throw new Error('Google devolvió una agenda no válida.')
          }
          rows.push(...result.items)
          pageToken = result.nextPageToken
          if (!pageToken) {
            googleEvents.value = rows
            checkedAt.value = result.checkedAt
            return
          }
          if (seen.has(pageToken)) {
            throw new Error('No fue posible completar las páginas de Google. Actualiza la consulta.')
          }
          seen.add(pageToken)
        }
        throw new Error('Hay demasiados eventos de Google. Consulta una semana o un día.')
      } catch (error) {
        if (current === calendarSequence && !request.signal.aborted) {
          googleFailed.value = true
          errors.googleError = error
        }
      } finally {
        if (current === calendarSequence) {
          googleLoading.value = false
        }
      }
    }
    await Promise.allSettled([loadLocal(), loadGoogle()])
    if (current !== calendarSequence) {
      return null
    }
    return errors
  }
  return {
    events,
    calendarEvents,
    googleEvents,
    calendarLoading,
    googleLoading,
    googleState,
    googleFailed,
    checkedAt,
    loadCalendar,
    totalPages,
    totalElements,
    loading,
    failed,
    load,
    reset,
  }
})
