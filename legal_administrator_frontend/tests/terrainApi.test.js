import test, { afterEach, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, configureHttpClientAuth, httpClient } from '../src/shared/api/httpClient.js'
import { calculationService } from '../src/modules/terrenos/services/calculationApi.js'

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
})
const pdfResponse = () => new Response('%PDF-1.4\nreporte', { headers: { 'Content-Type': 'application/pdf' } })
const terrain = { clientDpi: '0012345678901', userSystemId: '0098765432101', terrainName: 'Los Pinos', propertyType: 'RURAL' }
const boundaries = [20, 30, 20, 30].map((value) => ({ measurements: [{ value, unit: 'm' }] }))

beforeEach(() => configureHttpClientAuth({
  getAccessToken: () => 'session-token',
  canRefresh: () => false,
  refreshSession: null,
  logout: null,
}))
afterEach(() => mock.restoreAll())

test('conversiones envía un lote con unidades admitidas y conserva la respuesta del servidor', async () => {
  const converted = [
    { originalValue: 10, unit: 'varas', convertedValueMeters: 8.36 },
    { originalValue: 12, unit: 'pulgadas', convertedValueMeters: 0.3048 },
  ]
  const request = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/api/v1/calculations/convert'))
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.get('Authorization'), 'Bearer session-token')
    assert.equal(options.headers.get('Content-Type'), 'application/json')
    assert.equal(options.headers.get('Accept'), 'application/json')
    assert.deepEqual(JSON.parse(options.body), [{ value: 10, unit: 'varas' }, { value: 12, unit: 'pulgadas' }])
    return json(converted)
  })
  const measures = [{ value: '10', unit: 'vara' }, { value: 12, unit: 'in' }]
  assert.deepEqual(await calculationService.convertUnits(measures), converted)
  assert.deepEqual(measures[0], { value: '10', unit: 'vara' })
  assert.throws(() => calculationService.convertUnits([]), /al menos una/)
  assert.throws(() => calculationService.convertUnits([{ value: 1, unit: 'feet' }]), /Unidad no admitida/)
  assert.equal(request.mock.callCount(), 1)
})

test('guardar el polígono realiza una sola creación con DPI como texto y acepta 201', async () => {
  const request = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/calculations/polygon'))
    assert.equal(options.method, 'POST')
    const body = JSON.parse(options.body)
    assert.equal(body.clientDpi, terrain.clientDpi)
    assert.equal(body.userSystemId, terrain.userSystemId)
    assert.equal('vertices' in body, false)
    assert.deepEqual(body.boundaries.map((side) => side.sideNumber), [1, 2, 3, 4])
    assert.equal(body.boundaries[0].measurements[0].unit, 'metros')
    return json({ id: 18, totalAreaSquareMeters: 1250, legalNotice: 'Cálculo preliminar' }, 201)
  })
  const saved = await calculationService.calculateAndSavePolygon(terrain, boundaries)
  assert.equal(saved.id, 18)
  assert.equal(saved.totalAreaSquareMeters, 1250)
  assert.equal(saved.legalNotice, 'Cálculo preliminar')
  assert.equal(request.mock.callCount(), 1)
})

test('subdivisión envía polígonos completos y el identificador del padre', async () => {
  const points = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 0, y: 30 }]
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/calculations/split'))
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { parentCalculationId: 18, splitLines: [{ cutName: 'Lote A', points }] })
    return json([{ id: 19, totalAreaSquareMeters: 600 }], 201)
  })
  assert.deepEqual(await calculationService.splitPolygon(18, [{ cutName: 'Lote A', points, area: 600 }]), [{ id: 19, totalAreaSquareMeters: 600 }])
})

test('clientes conserva los DPI con ceros iniciales y detecta respuestas inválidas', async () => {
  const clients = [{ dpi: '0012345678901', firstName: 'Ana', lastName: 'Pérez' }]
  let response = clients
  mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.endsWith('/clients'))
    return json(response)
  })
  assert.deepEqual(await calculationService.getClients(), clients)
  response = { clients }
  await assert.rejects(calculationService.getClients(), /lista de clientes válida/)
  response = [{ dpi: 123 }]
  await assert.rejects(calculationService.getClients(), /lista de clientes válida/)
  response = []
  assert.deepEqual(await calculationService.getClients(), [])
})

test('responsable se resuelve por coincidencia exacta única del correo de sesión', async () => {
  const responsible = { dpi: '0098765432101', email: ' Ana@Example.com ', firstName: 'Ana' }
  mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.endsWith('/users'))
    return json([{ dpi: '1', email: 'other-ana@example.com' }, responsible])
  })
  assert.deepEqual(await calculationService.getCurrentUser('ana@example.com'), responsible)
})

test('responsable no usa usuarios ambiguos, ausentes o sin DPI válido', async () => {
  let response = []
  const request = mock.method(globalThis, 'fetch', async () => json(response))
  await assert.rejects(calculationService.getCurrentUser(''), /Inicia sesión/)
  assert.equal(request.mock.callCount(), 0)
  await assert.rejects(calculationService.getCurrentUser('ana@example.com'), /No se encontró/)
  response = [{ dpi: '1', email: 'ana@example.com' }, { dpi: '2', email: 'ANA@example.com' }]
  await assert.rejects(calculationService.getCurrentUser('ana@example.com'), /varios usuarios/)
  response = [{ dpi: 123, email: 'ana@example.com' }]
  await assert.rejects(calculationService.getCurrentUser('ana@example.com'), /DPI válido/)
  response = {}
  await assert.rejects(calculationService.getCurrentUser('ana@example.com'), /lista de usuarios válida/)
})

test('PDF usa la ruta implementada, Accept PDF y JWT sin enviar opciones internas a fetch', async () => {
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/calculations/18/pdf'))
    assert.equal(options.headers.get('Accept'), 'application/pdf')
    assert.equal(options.headers.get('Authorization'), 'Bearer session-token')
    assert.equal('responseType' in options, false)
    assert.equal('retryOnUnauthorized' in options, false)
    return pdfResponse()
  })
  const pdf = await calculationService.downloadPdf(18)
  assert.ok(pdf instanceof Blob)
  assert.equal(pdf.type, 'application/pdf')
  assert.ok((await pdf.text()).startsWith('%PDF-'))
})

test('PDF rechaza identificadores, archivos vacíos y respuestas que no son PDF', async () => {
  let response = () => json({ message: 'No es un PDF' })
  const request = mock.method(globalThis, 'fetch', async () => response())
  for (const id of [null, 0, -1, 1.5, '18']) {
    await assert.rejects(calculationService.downloadPdf(id), /cálculo guardado/)
  }
  assert.equal(request.mock.callCount(), 0)
  await assert.rejects(calculationService.downloadPdf(18), /PDF válido/)
  response = () => new Response('', { headers: { 'Content-Type': 'application/pdf' } })
  await assert.rejects(calculationService.downloadPdf(18), /PDF válido/)
  response = () => new Response(null, { status: 204 })
  await assert.rejects(calculationService.downloadPdf(18), /PDF válido/)
})

test('un error JSON durante la descarga conserva el mensaje y estado HTTP', async () => {
  mock.method(globalThis, 'fetch', async () => json({ message: 'Cálculo no encontrado' }, 404))
  await assert.rejects(calculationService.downloadPdf(18), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.message, 'Cálculo no encontrado')
    assert.equal(error.status, 404)
    assert.deepEqual(error.data, { message: 'Cálculo no encontrado' })
    return true
  })
})

test('renueva una sola sesión para descargas concurrentes y reintenta con el JWT nuevo', async () => {
  let token = 'expired'
  let refreshes = 0
  let requests = 0
  configureHttpClientAuth({
    getAccessToken: () => token,
    canRefresh: () => true,
    refreshSession: async () => {
      refreshes += 1
      await new Promise((resolve) => setImmediate(resolve))
      token = 'renewed'
    },
  })
  mock.method(globalThis, 'fetch', async (_url, options) => {
    requests += 1
    assert.equal(options.headers.get('Accept'), 'application/pdf')
    if (options.headers.get('Authorization') === 'Bearer expired') {
      // Incluso un 401 con JSON defectuoso debe permitir renovar la sesión.
      return new Response('{', { status: 401, headers: { 'Content-Type': 'application/json' } })
    }
    assert.equal(options.headers.get('Authorization'), 'Bearer renewed')
    return pdfResponse()
  })
  const pdfs = await Promise.all([calculationService.downloadPdf(18), calculationService.downloadPdf(19)])
  assert.equal(pdfs.length, 2)
  assert.equal(refreshes, 1)
  assert.equal(requests, 4)
})

test('un segundo 401 cierra la sesión sin reintentos infinitos', async () => {
  let refreshes = 0
  let logouts = 0
  configureHttpClientAuth({
    canRefresh: () => true,
    refreshSession: async () => { refreshes += 1 },
    logout: () => { logouts += 1 },
  })
  const request = mock.method(globalThis, 'fetch', async () => json({ message: 'Sesión vencida' }, 401))
  await assert.rejects(calculationService.downloadPdf(18), (error) => error.status === 401 && error.message === 'Sesión vencida')
  assert.equal(refreshes, 1)
  assert.equal(logouts, 1)
  assert.equal(request.mock.callCount(), 2)
})

test('un fallo al renovar cierra la sesión y conserva el error original del servidor', async () => {
  let logouts = 0
  configureHttpClientAuth({
    canRefresh: () => true,
    refreshSession: () => { throw new Error('Refresh no disponible') },
    logout: () => { logouts += 1 },
  })
  const request = mock.method(globalThis, 'fetch', async () => json({ message: 'Sesión vencida' }, 401))
  await assert.rejects(httpClient('/clients'), (error) => error.status === 401)
  assert.equal(logouts, 1)
  assert.equal(request.mock.callCount(), 1)
})

test('skipAuth conserva el flujo de login y nunca renueva ante un 401', async () => {
  let refreshes = 0
  configureHttpClientAuth({ canRefresh: () => true, refreshSession: () => { refreshes += 1 } })
  mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.has('Authorization'), false)
    return json({ message: 'Credenciales inválidas' }, 401)
  })
  await assert.rejects(httpClient('/auth/login', { skipAuth: true }), (error) => error.status === 401)
  assert.equal(refreshes, 0)
})

test('JSON inválido conserva el estado para distinguirlo de un fallo de conexión', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('{broken', {
    status: 502,
    headers: { 'Content-Type': 'application/problem+json' },
  }))
  await assert.rejects(httpClient('/clients'), (error) => {
    assert.equal(error.status, 502)
    assert.match(error.message, /JSON inválida/)
    return true
  })
})

test('errores de conexión mantienen la causa y respuestas vacías siguen soportadas', async () => {
  const cause = new TypeError('fetch failed')
  let fails = true
  mock.method(globalThis, 'fetch', async () => {
    if (fails) throw cause
    return new Response(null, { status: 204 })
  })
  await assert.rejects(httpClient('/clients'), (error) => error instanceof ApiError && error.status === 0 && error.cause === cause)
  fails = false
  assert.equal(await httpClient('/clients'), null)
})
