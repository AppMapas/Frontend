import { httpClient } from '../../../shared/api/httpClient.js'
function query(filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== null && value !== undefined) {
      params.set(key, String(value))
    }
  }
  return params.toString()
}

function confirmed(value) {
  if (!value || !Number.isSafeInteger(value.id) || !Number.isSafeInteger(value.version)) {
    throw new Error('El servidor no confirmó la actividad. Consulta la agenda antes de volver a intentar.')
  }
  return value
}
const oauthHeaders = {
  'X-Requested-With': 'XmlHttpRequest',
}
// Centraliza los endpoints de Agenda sobre el cliente HTTP compartido, que gestiona la sesión y los errores.
export const agendaApi = {
  list: (filters, options = {}) => httpClient(`/agenda/events?${query(filters)}`, options),
  calendar: (filters, options = {}) => httpClient(`/agenda/calendar?${query(filters)}`, options),
  googleEvents: (filters, options = {}) => httpClient(`/agenda/google/events?${query(filters)}`, options),
  googleEvent: (id) => httpClient(`/agenda/google/events/${encodeURIComponent(id)}`),
  updateGoogle: (id, payload) =>
    httpClient(`/agenda/google/events/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  occurrence: (id, originalStartsAt) =>
    httpClient(`/agenda/events/${id}/occurrence?${query({ originalStartsAt })}`),
  days: (filters, options = {}) => httpClient(`/agenda/days?${query(filters)}`, options),
  upcoming: (filters = {}, options = {}) => httpClient(`/agenda/upcoming?${query(filters)}`, options),
  get: (id) => httpClient(`/agenda/events/${id}`),
  history: (id) => httpClient(`/agenda/events/${id}/history`),
  create: async (payload) =>
    confirmed(
      await httpClient('/agenda/events', {
        method: 'POST',
        body: payload,
      }),
    ),
  update: async (id, payload) => {
    if (payload.originalStartsAt) {
      const { originalStartsAt, ...event } = payload
      return confirmed(
        await httpClient(`/agenda/events/${id}/occurrence`, {
          method: 'PUT',
          body: { originalStartsAt, event },
        }),
      )
    }
    return confirmed(await httpClient(`/agenda/events/${id}`, { method: 'PUT', body: payload }))
  },
  changeStatus: async (event, status, reason) => {
    if (event.originalStartsAt) {
      return confirmed(
        await httpClient(`/agenda/events/${event.id}/occurrence/status`, {
          method: 'POST',
          body: {
            originalStartsAt: event.originalStartsAt,
            change: { status, version: event.version, reason },
          },
        }),
      )
    }
    return confirmed(
      await httpClient(`/agenda/events/${event.id}/status`, {
        method: 'POST',
        body: {
          status,
          version: event.version,
          reason,
        },
      }),
    )
  },
  assign: (event) =>
    httpClient(`/agenda/events/${event.id}/google/assign`, {
      method: 'POST',
      body: { version: event.version },
    }),
  reconcile: (event, useAppSchedule = true) =>
    httpClient(`/agenda/events/${event.id}/google/reconcile`, {
      method: 'POST',
      body: {
        version: event.version,
        useAppSchedule,
        originalStartsAt: event.originalStartsAt || null,
      },
    }),
  googleStatus: (options = {}) => httpClient('/agenda/google/status', options),
  intent: () =>
    httpClient('/agenda/google/intent', {
      method: 'POST',
      headers: oauthHeaders,
    }),
  connect: (body) =>
    httpClient('/agenda/google/connect', {
      method: 'POST',
      headers: oauthHeaders,
      body,
    }),
  disconnect: () =>
    httpClient('/agenda/google/connect', {
      method: 'DELETE',
    }),
  retry: () =>
    httpClient('/agenda/google/retry', {
      method: 'POST',
    }),
}
