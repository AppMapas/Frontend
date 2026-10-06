import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import {
  localInputInstant,
  eventErrors,
  eventPayload,
  emptyEvent,
} from '../src/modules/agenda/domain/agenda.js'
import {
  mergeEvents,
  eventKey,
  weekDays,
  eventsForDay,
  weekPlacements,
} from '../src/modules/agenda/domain/calendar.js'
import { useAgendaStore } from '../src/modules/agenda/stores/agendaStore.js'
import { agendaApi } from '../src/modules/agenda/services/agendaApi.js'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
const originalFetch = globalThis.fetch
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => {
  setActivePinia(createPinia())
  configureHttpClientAuth({ getAccessToken: () => 'jwt', canRefresh: () => false, logout: null })
})
afterEach(() => {
  globalThis.fetch = originalFetch
  configureHttpClientAuth({ getAccessToken: () => null })
})

test('la semana empieza el lunes y el fin de todo el día es exclusivo aunque el ISO omita milisegundos', () => {
  assert.deepEqual(weekDays('2027-01-03'), [
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ])
  const event = { startsAt: '2027-01-01T06:00:00Z', endsAt: '2027-01-02T06:00:00Z' }
  assert.equal(eventsForDay([event], '2027-01-01').length, 1)
  assert.equal(eventsForDay([event], '2027-01-02').length, 0)
})
test('los eventos enlazados no se duplican y un cambio externo conserva los datos privados internos', () => {
  const local = {
    id: 1,
    originalStartsAt: '2027-01-01T15:00:00Z',
    startsAt: '2027-01-01T15:00:00Z',
    title: 'Privado',
    status: 'SCHEDULED',
  }
  const external = {
    id: 'external',
    localEventId: 1,
    originalStartsAt: '2027-01-01T15:00:00.000Z',
    startsAt: '2027-01-01T16:00:00Z',
    title: 'Público',
    linkedConflict: true,
  }
  const merged = mergeEvents([local], [external, external])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].title, 'Privado')
  assert.equal(merged[0].externalChange, true)
  assert.equal(eventKey(merged[0]), 'local:1:2027-01-01T15:00:00.000Z')
})
test('fechas en otra zona mantienen su hora local y rechazan horarios inexistentes por cambio horario', () => {
  assert.equal(localInputInstant('2027-01-01T09:00', 'America/New_York'), '2027-01-01T14:00:00.000Z')
  assert.equal(localInputInstant('2027-07-01T09:00', 'America/New_York'), '2027-07-01T13:00:00.000Z')
  assert.throws(() => localInputInstant('2027-03-14T02:30', 'America/New_York'), /no existe/)
})
test('una serie exige fin acotado y una ocurrencia no reenvía la regla de repetición', () => {
  const form = {
    ...emptyEvent('2027-01-01'),
    title: 'Consulta',
    client: { dpi: '1000000000001' },
    repeatFrequency: 'DAILY',
  }
  assert.ok(eventErrors(form).repeatUntil)
  form.repeatUntil = '2027-01-10'
  assert.deepEqual(eventPayload(form, 'request').recurrence, { frequency: 'DAILY', until: '2027-01-10' })
  form.originalStartsAt = '2027-01-02T15:00:00Z'
  assert.equal(eventPayload(form, 'request').recurrence, undefined)
})
test('la agenda local sigue disponible si Google falla y sus cargas terminan por separado', async () => {
  globalThis.fetch = async (url) => {
    if (url.includes('/google/status')) return json({ state: 'CONNECTED' })
    if (url.includes('/google/events')) return json({ message: 'No disponible' }, 503)
    return json([{ id: 1 }])
  }
  const store = useAgendaStore()
  const result = await store.loadCalendar({ from: 'from', to: 'to' })
  assert.equal(store.calendarEvents.length, 1)
  assert.equal(store.googleFailed, true)
  assert.ok(result.googleError)
  assert.equal(result.localError, null)
  assert.equal(store.calendarLoading, false)
  assert.equal(store.googleLoading, false)
})
test('las páginas de Google se completan sin perder eventos y se detectan cursores repetidos', async () => {
  let calls = 0
  globalThis.fetch = async (url) => {
    if (url.includes('/google/status')) return json({ state: 'CONNECTED' })
    if (!url.includes('/google/events')) return json([])
    calls += 1
    if (calls === 1) return json({ items: [{ id: 'a' }], nextPageToken: 'page2' })
    return json({ items: [{ id: 'b' }], nextPageToken: null, checkedAt: 'now' })
  }
  const store = useAgendaStore()
  await store.loadCalendar({ from: 'from', to: 'to' })
  assert.deepEqual(
    store.googleEvents.map((event) => event.id),
    ['a', 'b'],
  )
  assert.equal(store.checkedAt, 'now')
  globalThis.fetch = async (url) => {
    if (url.includes('/google/status')) return json({ state: 'CONNECTED' })
    if (url.includes('/google/events')) return json({ items: [], nextPageToken: 'same' })
    return json([])
  }
  const result = await store.loadCalendar({ from: 'from', to: 'to' })
  assert.match(result.googleError.message, /páginas/)
})
test('cerrar sesión invalida respuestas tardías de Google y limpia el correo y los eventos', async () => {
  let release
  globalThis.fetch = async (url) => {
    if (url.includes('/google/status')) {
      await new Promise((resolve) => {
        release = resolve
      })
      return json({ state: 'CONNECTED', accountEmail: 'old@example.test' })
    }
    return json([{ id: 1 }])
  }
  const store = useAgendaStore()
  const pending = store.loadCalendar({ from: 'from', to: 'to' })
  store.reset()
  release()
  assert.equal(await pending, null)
  assert.deepEqual(store.calendarEvents, [])
  assert.deepEqual(store.googleEvents, [])
  assert.equal(store.googleState, 'DISCONNECTED')
})
test('la edición de una ocurrencia usa su endpoint y no modifica el evento principal', async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(url, /events\/4\/occurrence$/)
    const body = JSON.parse(options.body)
    assert.equal(body.originalStartsAt, '2027-01-01T15:00:00Z')
    assert.equal(body.event.originalStartsAt, undefined)
    return json({ id: 4, version: 2 })
  }
  await agendaApi.update(4, { originalStartsAt: '2027-01-01T15:00:00Z', version: 1, title: 'Consulta' })
})

test('los bloques cortos de la semana se distribuyen sin taparse y respetan el fin del día', () => {
  const events = [
    { id: 1, startsAt: '2027-01-01T15:00:00Z', endsAt: '2027-01-01T15:05:00Z' },
    { id: 2, startsAt: '2027-01-01T15:10:00Z', endsAt: '2027-01-01T15:15:00Z' },
  ]
  const positions = weekPlacements(events, '2027-01-01')
  assert.notEqual(positions.get('local:1:').left, positions.get('local:2:').left)
  assert.equal(positions.get('local:1:').height, '44px')
  const late = weekPlacements(
    [{ id: 3, startsAt: '2027-01-02T05:50:00Z', endsAt: '2027-01-02T06:00:00Z' }],
    '2027-01-01',
  )
  assert.equal(late.get('local:3:').height, '9px')
})
