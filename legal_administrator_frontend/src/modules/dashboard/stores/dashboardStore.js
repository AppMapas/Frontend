import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi } from '../services/dashboardApi.js'
import { agendaApi } from '../../agenda/services/agendaApi.js'
import { dayStart, nextDay } from '../../agenda/domain/agenda.js'
import { validateSummary } from '../domain/dashboard.js'

// Los datos viven solo en memoria; reset invalida incluso solicitudes que no respeten AbortController.
export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref(null)
  const loading = ref(false)
  const failed = ref(false)
  const googleEvents = ref([])
  const googleCount = ref(0)
  const googleLoading = ref(false)
  const googleFailed = ref(false)
  const googleState = ref('NOT_CHECKED')
  const googleCheckedAt = ref(null)
  let sequence = 0
  let request = null

  function reset() {
    sequence += 1
    request?.abort()
    summary.value = null
    loading.value = false
    failed.value = false
    googleEvents.value = []
    googleCount.value = 0
    googleLoading.value = false
    googleFailed.value = false
    googleState.value = 'NOT_CHECKED'
    googleCheckedAt.value = null
  }

  async function loadGoogle(date, current, signal) {
    googleLoading.value = true
    googleFailed.value = false
    googleEvents.value = []
    googleCount.value = 0
    googleCheckedAt.value = null
    try {
      const status = await agendaApi.googleStatus({ signal })
      if (current !== sequence || signal.aborted) {
        return null
      }
      googleState.value = status.state
      if (!status.enabled || status.state !== 'CONNECTED') {
        return null
      }
      const seenPages = new Set()
      const unique = new Map()
      let pageToken = null
      for (let page = 0; page < 40; page += 1) {
        const result = await agendaApi.googleEvents(
          { from: dayStart(date), to: dayStart(nextDay(date)), pageToken },
          { signal },
        )
        if (current !== sequence || signal.aborted) {
          return null
        }
        if (!Array.isArray(result.items) || result.items.length > 250) {
          throw new Error('La agenda externa recibida no es válida.')
        }
        for (const event of result.items) {
          if (
            !event ||
            typeof event.id !== 'string' ||
            typeof event.title !== 'string' ||
            !Number.isFinite(Date.parse(event.startsAt)) ||
            !Number.isFinite(Date.parse(event.endsAt))
          ) {
            throw new Error('Google devolvió una actividad no válida.')
          }
          // Las actividades enlazadas ya pertenecen a la agenda interna; este bloque muestra solo las externas.
          if (!event.localEventId) {
            unique.set(event.id, event)
          }
        }
        pageToken = result.nextPageToken
        if (!pageToken) {
          const events = Array.from(unique.values()).sort(
            (first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt),
          )
          googleEvents.value = events.slice(0, 5)
          googleCount.value = events.length
          googleCheckedAt.value = result.checkedAt
          return null
        }
        if (seenPages.has(pageToken)) {
          throw new Error('Google devolvió páginas repetidas. Consulta la agenda.')
        }
        seenPages.add(pageToken)
      }
      throw new Error('Consulta Google desde Agenda para completar este período.')
    } catch (error) {
      if (current !== sequence || signal.aborted) {
        return null
      }
      googleFailed.value = true
      return error
    } finally {
      if (current === sequence) {
        googleLoading.value = false
      }
    }
  }

  async function load() {
    request?.abort()
    const active = new AbortController()
    request = active
    const current = ++sequence
    loading.value = true
    failed.value = false
    googleLoading.value = false
    // Al cambiar de día no se deben conservar los eventos externos de ayer.
    googleEvents.value = []
    googleCount.value = 0
    googleCheckedAt.value = null
    googleState.value = 'NOT_CHECKED'
    let result
    try {
      result = validateSummary(await dashboardApi.summary({ signal: active.signal }))
      if (current !== sequence || active.signal.aborted) {
        return null
      }
      summary.value = result
    } catch (error) {
      if (current !== sequence || active.signal.aborted) {
        return null
      }
      failed.value = true
      if ([401, 403].includes(error.status)) {
        summary.value = null
      }
      return { localError: error, googleError: null }
    } finally {
      if (current === sequence) {
        loading.value = false
      }
    }
    const googleError = await loadGoogle(result.date, current, active.signal)
    if (current !== sequence || active.signal.aborted) {
      return null
    }
    return { localError: null, googleError }
  }

  return {
    summary,
    loading,
    failed,
    googleEvents,
    googleCount,
    googleLoading,
    googleFailed,
    googleState,
    googleCheckedAt,
    reset,
    load,
  }
})
