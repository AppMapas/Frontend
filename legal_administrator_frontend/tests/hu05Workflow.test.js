import test, { beforeEach, afterEach, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createPinia, setActivePinia } from 'pinia'
import { configureHttpClientAuth, ApiError } from '../src/shared/api/httpClient.js'
import { clientsApi } from '../src/modules/users/services/clientsApi.js'
import { clientCatalogApi } from '../src/modules/users/services/clientCatalogApi.js'
import { legalProcessApi } from '../src/modules/processes/services/legalProcessApi.js'
import { useClientStore } from '../src/modules/users/stores/clientStore.js'
import { useLegalProcessStore } from '../src/modules/processes/stores/legalProcessStore.js'
import { clientPayload, emptyClient, validateClient } from '../src/modules/users/domain/clientForm.js'
import { createRequestId } from '../src/modules/processes/domain/caseRegistration.js'
import { useNotificationStore } from '../src/shared/notifications/notificationStore.js'
import { notifyRequestError } from '../src/shared/forms/requestFeedback.js'
import { queryString } from '../src/shared/api/pagination.js'

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}
function profile() {
  return { ...emptyClient(), dpi: '0123456789012', firstName: 'Ana', lastName: 'Pérez',
    email: 'ana@example.test', phone: '+50255551234', nationalityId: 1, maritalStatusId: 1,
    exactAddress: 'Zona 1', municipalityId: '' }
}
function page(content) {
  return { content, page: 0, size: 12, totalElements: content.length, totalPages: 1 }
}
function detail(id = 8) {
  return { caseData: { id, caseCode: 'EXP-' + id, version: 0, clientDpi: '0123456789012' },
    requirements: [{ id: 1, name: 'DPI', status: 'PENDING' }] }
}
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
describe('HU-05', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    configureHttpClientAuth({ getAccessToken: () => 'hu05-token', canRefresh: () => false, logout: null, refreshSession: null })
  })
  afterEach(() => mock.restoreAll())
  
  test('valida datos completos, formato de DPI y catálogos antes de guardar', () => {
    assert.deepEqual(validateClient(profile()), {})
    const invalid = profile()
    invalid.dpi = '１２３４５６７８９０１２３'
    invalid.nationalityId = ''
    invalid.maritalStatusId = 0
    invalid.exactAddress = ' '
    invalid.birthDate = '2999-01-01'
    invalid.phone = 'abc'
    const errors = validateClient(invalid)
    for (const field of ['dpi', 'nationalityId', 'maritalStatusId', 'exactAddress', 'birthDate', 'phone']) {
      assert.ok(errors[field], field)
    }
  })
  
  test('conserva ceros de DPI y envía solamente campos editables y versión', () => {
    const draft = { ...profile(), firstName: ' Ana ', role: 'Administrador', active: false, version: 900 }
    const created = clientPayload(draft)
    assert.equal(created.dpi, '0123456789012')
    assert.equal(created.firstName, 'Ana')
    assert.equal(created.municipalityId, null)
    assert.equal(created.role, undefined)
    assert.equal(created.active, undefined)
    const updated = clientPayload(draft, 0)
    assert.equal(updated.version, 0)
    assert.equal(updated.dpi, undefined)
  })
  
  test('el teléfono y las longitudes coinciden con el contrato del backend', () => {
    const draft = profile()
    draft.phone = '1'.repeat(13)
    draft.firstName = 'a'.repeat(101)
    draft.email = 'bad-email'
    draft.occupation = 'b'.repeat(151)
    const errors = validateClient(draft)
    assert.deepEqual(Object.keys(errors).sort(), ['email', 'firstName', 'occupation', 'phone'])
  })
  
  test('usa las rutas CRUD de clientes, Bearer y la versión para desactivar', async () => {
    const seen = []
    mock.method(globalThis, 'fetch', async (url, options) => {
      seen.push({ url, options })
      assert.equal(options.headers.get('Authorization'), 'Bearer hu05-token')
      return json({ ...profile(), version: 3 })
    })
    await clientsApi.create(clientPayload(profile()))
    await clientsApi.get('0123456789012')
    await clientsApi.update('0123456789012', clientPayload(profile(), 2))
    await clientsApi.deactivate('0123456789012', 3)
    assert.deepEqual(seen.map(call => new URL(call.url).pathname), [
      '/api/v1/clients', '/api/v1/clients/0123456789012', '/api/v1/clients/0123456789012',
      '/api/v1/clients/0123456789012/deactivate',
    ])
    assert.deepEqual(seen.map(call => call.options.method || 'GET'), ['POST', 'GET', 'PUT', 'PATCH'])
    assert.deepEqual(JSON.parse(seen[3].options.body), { version: 3 })
  })
  
  test('pagina búsquedas en el servidor conservando false, cero y caracteres especiales', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      const query = new URL(url).searchParams
      assert.equal(query.get('active'), 'false')
      assert.equal(query.get('page'), '0')
      assert.equal(query.get('q'), 'Ana & Pérez %')
      return json(page([]))
    })
    await clientsApi.search({ q: 'Ana & Pérez %', active: false, page: 0, size: 12 })
    assert.equal(queryString({ active: null, q: '', page: 0 }), '?page=0')
  })
  
  test('consulta nacionalidades, estados civiles y municipios reales', async () => {
    const paths = []
    mock.method(globalThis, 'fetch', async (url) => {
      paths.push(new URL(url).pathname)
      return json([{ id: 1, name: 'Catálogo' }])
    })
    await Promise.all([clientCatalogApi.countries(), clientCatalogApi.maritalStatuses(), clientCatalogApi.municipalities()])
    assert.deepEqual(paths.sort(), ['/api/v1/catalogs/countries', '/api/v1/catalogs/marital-statuses', '/api/v1/catalogs/municipalities'])
  })
  
  test('carga catálogos una vez por sesión y no conserva datos tras cerrar sesión', async () => {
    let requests = 0
    mock.method(globalThis, 'fetch', async () => { requests += 1; return json([{ id: 1, name: 'Guatemala' }]) })
    const clients = useClientStore()
    await Promise.all([clients.loadCatalogs(), clients.loadCatalogs()])
    await clients.loadCatalogs()
    assert.equal(requests, 3)
    assert.equal(clients.catalogsReady, true)
    clients.resetSession()
    assert.equal(clients.catalogsReady, false)
    assert.deepEqual(clients.countries, [])
  })
  
  test('ignora catálogos pendientes que llegan después del cierre de sesión', async () => {
    const pending = deferred()
    mock.method(globalThis, 'fetch', () => pending.promise.then(response => response.clone()))
    const clients = useClientStore()
    const loading = clients.loadCatalogs()
    clients.resetSession()
    pending.resolve(json([{ id: 1, name: 'Dato de sesión anterior' }]))
    await loading
    assert.equal(clients.catalogsReady, false)
    assert.deepEqual(clients.countries, [])
  })
  
  test('solo presenta plantillas publicadas para abrir expedientes', async () => {
    mock.method(globalThis, 'fetch', async (url) => {
      assert.equal(new URL(url).searchParams.get('status'), 'PUBLISHED')
      return json([{ id: 1, status: 'DRAFT' }, { id: 2, status: 'PUBLISHED', version: 3 }])
    })
    assert.deepEqual(await legalProcessApi.publishedTemplates(), [{ id: 2, status: 'PUBLISHED', version: 3 }])
  })
  
  test('el reintento después de un fallo de red conserva cuerpo y UUID', async () => {
    const requests = []
    mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push(JSON.parse(options.body))
      if (requests.length === 1) throw new TypeError('Conexión perdida después de guardar')
      return json(detail())
    })
    const cases = useLegalProcessStore()
    const payload = { clientDpi: '0123456789012', processTypeId: 2, processTypeVersion: 3, generalDetails: 'Original' }
    await assert.rejects(cases.open(payload), error => error.status === 0)
    assert.equal(cases.uncertain, true)
    // Un cambio accidental de la vista no debe sustituir la solicitud pendiente.
    await cases.open({ ...payload, generalDetails: 'Otro valor' })
    assert.deepEqual(requests[1], requests[0])
    assert.match(requests[0].requestId, /^[0-9a-f-]{36}$/)
    assert.equal(cases.uncertain, false)
  })
  
  test('un resultado 500 mantiene la solicitud para reintentar sin duplicar', async () => {
    const bodies = []
    mock.method(globalThis, 'fetch', async (url, options) => {
      bodies.push(options.body)
      if (bodies.length === 1) return json({ message: 'Error inesperado' }, 500)
      return json(detail())
    })
    const cases = useLegalProcessStore()
    await assert.rejects(cases.open({ clientDpi: '0123456789012', processTypeId: 1, processTypeVersion: 0 }))
    await cases.open(null)
    assert.equal(bodies[0], bodies[1])
  })
  
  test('una respuesta exitosa sin expediente confirmado tampoco permite cambiar el UUID', async () => {
    const bodies = []
    mock.method(globalThis, 'fetch', async (url, options) => {
      bodies.push(options.body)
      if (bodies.length === 1) return json({})
      return json(detail())
    })
    const cases = useLegalProcessStore()
    await assert.rejects(cases.open({ clientDpi: '0123456789012', processTypeId: 1, processTypeVersion: 0 }))
    assert.equal(cases.uncertain, true)
    await cases.open(null)
    assert.equal(bodies[0], bodies[1])
  })
  
  test('doble pulsación mientras se guarda produce una sola petición', async () => {
    const pending = deferred()
    let requests = 0
    mock.method(globalThis, 'fetch', () => { requests += 1; return pending.promise })
    const cases = useLegalProcessStore()
    const payload = { clientDpi: '0123456789012', processTypeId: 1, processTypeVersion: 0 }
    const first = cases.open(payload)
    const second = cases.open(payload)
    pending.resolve(json(detail()))
    const results = await Promise.all([first, second])
    assert.equal(requests, 1)
    assert.equal(results[0].caseData.id, results[1].caseData.id)
  })
  
  test('un conflicto permite corregir datos y generar una nueva intención de apertura', async () => {
    const requests = []
    mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push(JSON.parse(options.body))
      if (requests.length === 1) return json({ message: 'El trámite cambió' }, 409)
      return json(detail())
    })
    const cases = useLegalProcessStore()
    await assert.rejects(cases.open({ clientDpi: '0123456789012', processTypeId: 1, processTypeVersion: 0 }))
    assert.equal(cases.uncertain, false)
    await cases.open({ clientDpi: '0123456789012', processTypeId: 1, processTypeVersion: 1 })
    assert.notEqual(requests[0].requestId, requests[1].requestId)
  })
  
  test('la renovación 401 repite la misma apertura con el token actualizado', async () => {
    let token = 'expired'
    let renewals = 0
    const bodies = []
    const tokens = []
    configureHttpClientAuth({
      getAccessToken: () => token, canRefresh: () => true,
      refreshSession: async () => { renewals += 1; token = 'renewed' }, logout: null,
    })
    mock.method(globalThis, 'fetch', async (url, options) => {
      bodies.push(options.body)
      tokens.push(options.headers.get('Authorization'))
      if (bodies.length === 1) return json({ message: 'Expirado' }, 401)
      return json(detail())
    })
    await useLegalProcessStore().open({ clientDpi: '0123456789012', processTypeId: 1, processTypeVersion: 0 })
    assert.equal(renewals, 1)
    assert.equal(bodies[0], bodies[1])
    assert.deepEqual(tokens, ['Bearer expired', 'Bearer renewed'])
  })
  
  test('una apertura pendiente no publica datos al llegar después de cerrar sesión', async () => {
    const pending = deferred()
    mock.method(globalThis, 'fetch', () => pending.promise)
    const cases = useLegalProcessStore()
    const request = cases.open({ clientDpi: '0123456789012', processTypeId: 1, processTypeVersion: 0 })
    cases.resetSession()
    pending.resolve(json(detail()))
    assert.equal(await request, null)
    assert.equal(cases.creating, false)
    assert.equal(cases.uncertain, false)
  })
  
  test('una búsqueda nueva aborta la anterior y descarta sus resultados tardíos', async () => {
    const first = deferred()
    const second = deferred()
    const signals = []
    mock.method(globalThis, 'fetch', (url, options) => {
      signals.push(options.signal)
      if (signals.length === 1) return first.promise
      return second.promise
    })
    const clients = useClientStore()
    const slow = clients.load({ q: 'Ana', page: 0, size: 12 })
    const fast = clients.load({ q: 'Marta', page: 0, size: 12 })
    assert.equal(signals[0].aborted, true)
    second.resolve(json(page([{ dpi: '1234567890123', firstName: 'Marta' }])))
    await fast
    first.resolve(json(page([{ dpi: '0123456789012', firstName: 'Ana' }])))
    assert.equal(await slow, null)
    assert.equal(clients.items[0].firstName, 'Marta')
    assert.equal(clients.failed, false)
  })
  
  test('la edición del expediente envía observaciones y versión, sin alterar relaciones', async () => {
    mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(new URL(url).pathname, '/api/v1/legal-processes/8')
      assert.equal(options.method, 'PUT')
      assert.deepEqual(JSON.parse(options.body), { version: 2, generalDetails: 'Nueva observación' })
      return json(detail())
    })
    await legalProcessApi.update(8, { version: 2, generalDetails: 'Nueva observación' })
  })
  
  test('errores de validación, conflicto y permisos usan el estado de tarjetas flotantes', () => {
    notifyRequestError(new ApiError('Corrige los datos', { status: 400, data: { details: { dpi: 'DPI inválido' } } }))
    const notifications = useNotificationStore()
    assert.match(notifications.current.message, /DPI inválido/)
    assert.equal(notifications.current.tone, 'error')
    notifyRequestError(new ApiError('El cliente cambió', { status: 409 }))
    assert.equal(notifications.current.tone, 'warning')
    notifyRequestError(new ApiError('Forbidden', { status: 403 }))
    assert.match(notifications.current.message, /permiso/)
  })
  
  test('genera UUID con criptografía también cuando randomUUID no está disponible en móvil', () => {
    const source = { getRandomValues: bytes => webcrypto.getRandomValues(bytes) }
    const first = createRequestId(source)
    const second = createRequestId(source)
    assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.notEqual(first, second)
  })
})
