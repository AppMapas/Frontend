import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useDashboardStore } from '../src/modules/dashboard/stores/dashboardStore.js'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
import { defaultHome, explicitRedirect, loginRedirect } from '../src/shared/auth/homeRedirect.js'
import {
  validDay,
  validateSummary,
  activityRoute,
  validateRemindersPage,
} from '../src/modules/dashboard/domain/dashboard.js'
const originalFetch = globalThis.fetch
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function summary() {
  return {
    date: '2027-01-01',
    generatedAt: '2027-01-01T16:00:00Z',
    timeZone: 'America/Guatemala',
    activeCases: 103,
    todayActivities: 0,
    agenda: [],
    reminders: { today: 0, upcoming: 0, unattended: 0 },
    reminderPreview: [],
    unattendedFrom: '2026-12-02',
    upcomingThrough: '2027-01-07',
    week: Array.from({ length: 7 }, (_, index) => ({ date: `2027-01-0${index + 1}`, count: index })),
  }
}
beforeEach(() => {
  setActivePinia(createPinia())
  configureHttpClientAuth({ getAccessToken: () => 'jwt', canRefresh: () => false, logout: null })
})
afterEach(() => {
  globalThis.fetch = originalFetch
  configureHttpClientAuth({ getAccessToken: () => null })
})

test('el destino por rol conserva accesos directos y rechaza redirecciones externas', () => {
  assert.equal(defaultHome('Abogada'), '/inicio')
  assert.equal(defaultHome('Administrador'), '/inicio')
  assert.equal(defaultHome('Topografo'), '/terrenos')
  assert.equal(loginRedirect('/expedientes/9', 'Abogada'), '/expedientes/9')
  for (const path of [
    '//evil.test',
    '/\\evil.test',
    'https://evil.test',
    '/login',
    '/verificacion',
    ['/agenda'],
  ]) {
    assert.equal(explicitRedirect(path), null)
  }
  assert.equal(loginRedirect(undefined, 'Abogada'), '/inicio')
})
test('la navegación de actividades respeta Guatemala y rechaza fechas imposibles', () => {
  assert.equal(validDay('2027-02-29'), false)
  assert.equal(validDay(['2027-01-01']), false)
  assert.equal(validDay('2028-02-29'), true)
  assert.deepEqual(
    activityRoute(
      { id: 9, startsAt: '2027-01-01T16:00:00Z', originalStartsAt: '2027-01-01T16:00:00Z' },
      '2027-01-01',
    ),
    { name: 'agenda', query: { day: '2027-01-01', activity: '9', originalStartsAt: '2027-01-01T16:00:00Z' } },
  )
  assert.deepEqual(activityRoute({ startsAt: '2027-01-02T02:00:00Z' }, '2027-01-02'), {
    name: 'agenda',
    query: { day: '2027-01-01' },
  })
})
test('las estadísticas inválidas no se convierten en ceros', () => {
  assert.equal(validateSummary(summary()).activeCases, 103)
  assert.throws(() => validateSummary({ ...summary(), activeCases: -1 }))
  assert.throws(() => validateSummary({ ...summary(), week: [] }))
  assert.throws(() => validateSummary({ ...summary(), agenda: [{ id: 1, startsAt: 'fecha inválida' }] }))
  assert.throws(() =>
    validateRemindersPage({
      ...summary(),
      reminders: { content: [], size: 10, page: 0, totalElements: -1, totalPages: 0 },
    }),
  )
})
test('Google caído no bloquea el resumen interno y no añade campos monetarios', async () => {
  globalThis.fetch = async (url) => {
    if (url.includes('/dashboard/summary')) {
      return json(summary())
    }
    return json({ message: 'no disponible' }, 503)
  }
  const store = useDashboardStore()
  const result = await store.load()
  assert.equal(store.summary.activeCases, 103)
  assert.equal(store.loading, false)
  assert.equal(store.googleLoading, false)
  assert.equal(store.googleFailed, true)
  assert.equal(result.localError, null)
  assert.ok(result.googleError)
  assert.equal('balance' in store.summary, false)
})
test('los eventos enlazados y las páginas repetidas no duplican actividades externas', async () => {
  let page = 0
  globalThis.fetch = async (url) => {
    if (url.includes('/dashboard/summary')) {
      return json(summary())
    }
    if (url.includes('/google/status')) {
      return json({ enabled: true, state: 'CONNECTED' })
    }
    page += 1
    let nextPageToken = null
    if (page === 1) {
      nextPageToken = 'second'
    }
    return json({
      items: [
        {
          id: 'linked',
          localEventId: 1,
          title: 'Enlazado',
          startsAt: '2027-01-01T18:00:00Z',
          endsAt: '2027-01-01T19:00:00Z',
        },
        { id: 'foreign', title: 'Externo', startsAt: '2027-01-01T18:00:00Z', endsAt: '2027-01-01T19:00:00Z' },
      ],
      nextPageToken,
      checkedAt: '2027-01-01T16:00:00Z',
    })
  }
  const store = useDashboardStore()
  await store.load()
  assert.equal(store.googleCount, 1)
  assert.deepEqual(
    store.googleEvents.map((event) => event.id),
    ['foreign'],
  )
})
test('reset impide que una respuesta tardía de otra sesión reaparezca', async () => {
  let finish
  globalThis.fetch = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const store = useDashboardStore()
  const request = store.load()
  store.reset()
  finish(json(summary()))
  assert.equal(await request, null)
  assert.equal(store.summary, null)
  assert.equal(store.googleEvents.length, 0)
})
test('la consulta más reciente prevalece aunque la anterior ignore la cancelación', async () => {
  let finish
  let calls = 0
  globalThis.fetch = async (url) => {
    if (url.includes('/google/status')) {
      return json({ enabled: false, state: 'DISCONNECTED' })
    }
    calls += 1
    if (calls === 1) {
      return new Promise((resolve) => {
        finish = resolve
      })
    }
    return json({ ...summary(), activeCases: 7 })
  }
  const store = useDashboardStore()
  const previous = store.load()
  await store.load()
  finish(json({ ...summary(), activeCases: 99 }))
  await previous
  assert.equal(store.summary.activeCases, 7)
})
test('un error de actualización conserva cifras identificables y un 403 las elimina', async () => {
  globalThis.fetch = async (url) => {
    if (url.includes('/dashboard/summary')) {
      return json(summary())
    }
    return json({ state: 'DISCONNECTED', enabled: false })
  }
  const store = useDashboardStore()
  await store.load()
  globalThis.fetch = async () => json({ message: 'fallo' }, 503)
  await store.load()
  assert.equal(store.failed, true)
  assert.equal(store.summary.activeCases, 103)
  globalThis.fetch = async () => json({ message: 'sin permiso' }, 403)
  await store.load()
  assert.equal(store.summary, null)
})
