import test, { afterEach, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, configureHttpClientAuth } from '../src/shared/api/httpClient.js'
import { processCatalogApi } from '../src/modules/processes/services/processCatalogApi.js'
import { useProcessCatalogStore } from '../src/modules/processes/stores/processCatalogStore.js'
import { catalogErrorMessage } from '../src/modules/processes/utils/catalogError.js'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  configureHttpClientAuth({
    getAccessToken: () => 'catalog-token',
    canRefresh: () => false,
    refreshSession: null,
    logout: null,
  })
  setActivePinia(createPinia())
})

afterEach(() => mock.restoreAll())

test('consulta ambos catálogos con JWT y rechaza listas inválidas', async () => {
  configureHttpClientAuth({ getAccessToken: () => 'catalog-token' })
  const requests = []
  let invalid = false
  mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(url)
    assert.equal(options.headers.get('Authorization'), 'Bearer catalog-token')
    if (url.endsWith('/requirements')) {
      if (invalid) return json({ content: [] })
      return json([{ id: 2, name: 'DPI', active: true }])
    }
    if (url.endsWith('/process-types')) {
      return json([{ id: 5, name: 'Memorial', status: 'DRAFT', version: 0 }])
    }
    throw new Error('Ruta inesperada')
  })

  assert.equal((await processCatalogApi.getRequirements())[0].name, 'DPI')
  assert.equal((await processCatalogApi.getProcessTypes())[0].status, 'DRAFT')
  invalid = true
  await assert.rejects(processCatalogApi.getRequirements(), /lista válida de requisitos/)
  assert.ok(requests.every((url) => url.includes('/api/v1/')))
})

test('envía creación, edición y desactivación de requisitos a las rutas del backend', async () => {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, method: options.method || 'GET', body: options.body })
    if (options.method === 'PATCH') return json({ id: 9, name: 'DPI', active: false })
    return json({ id: 9, name: 'DPI', active: true }, 201)
  })

  const payload = { name: 'DPI', description: 'Copia legible' }
  await processCatalogApi.createRequirement(payload)
  await processCatalogApi.updateRequirement(9, payload)
  await processCatalogApi.deactivateRequirement(9)

  assert.deepEqual(calls.map((call) => call.method), ['POST', 'PUT', 'PATCH'])
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/api/v1/requirements',
    '/api/v1/requirements/9',
    '/api/v1/requirements/9/deactivate',
  ])
  assert.deepEqual(JSON.parse(calls[0].body), payload)
  assert.deepEqual(JSON.parse(calls[1].body), payload)
  assert.equal(calls[2].body, undefined)
})

test('envía orden, opciones y versión al guardar y publicar un trámite', async () => {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, method: options.method || 'GET', body: options.body })
    return json({ id: 8, name: 'Titulación', status: 'PUBLISHED', version: 4, requirements: [] })
  })

  const payload = {
    name: 'Titulación',
    description: 'Proceso legal',
    version: 3,
    requirements: [
      { requirementId: 2, required: true, requiresDocument: true, displayOrder: 1, instructions: 'Original' },
    ],
  }
  await processCatalogApi.createProcessType(payload)
  await processCatalogApi.updateProcessType(8, payload)
  await processCatalogApi.publishProcessType(8, 4)
  await processCatalogApi.deactivateProcessType(8, 5)

  assert.deepEqual(calls.map((call) => call.method), ['POST', 'PUT', 'PATCH', 'PATCH'])
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/api/v1/process-types',
    '/api/v1/process-types/8',
    '/api/v1/process-types/8/publish',
    '/api/v1/process-types/8/deactivate',
  ])
  assert.deepEqual(JSON.parse(calls[1].body), payload)
  assert.deepEqual(JSON.parse(calls[2].body), { version: 4 })
  assert.deepEqual(JSON.parse(calls[3].body), { version: 5 })
})

test('expone los estados HTTP y mensajes de conflicto y permisos', async () => {
  let status = 409
  mock.method(globalThis, 'fetch', async () => json({
    message: 'El trámite cambió desde la última consulta.',
  }, status))

  await assert.rejects(processCatalogApi.publishProcessType(8, 2), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 409)
    assert.match(error.message, /cambió/)
    return true
  })
  status = 403
  await assert.rejects(processCatalogApi.createRequirement({ name: 'DPI' }), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 403)
    return true
  })
})

test('Pinia conserva los catálogos y actualiza estado y versión tras cada acción', async () => {
  const seen = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname
    seen.push(path)
    if (path.endsWith('/requirements') && !options.method) {
      return json([{ id: 2, name: 'DPI', active: true }])
    }
    if (path.endsWith('/process-types') && !options.method) {
      return json([{ id: 8, name: 'Titulación', status: 'DRAFT', version: 0 }])
    }
    if (path.endsWith('/process-types/8/publish')) {
      return json({ id: 8, name: 'Titulación', status: 'PUBLISHED', version: 2, requirements: [] })
    }
    if (path.endsWith('/requirements/2/deactivate')) {
      return json({ id: 2, name: 'DPI', active: false })
    }
    if (path.endsWith('/process-types') && options.method === 'POST') {
      return json({ id: 8, name: 'Titulación', status: 'DRAFT', version: 1, requirements: [] }, 201)
    }
    throw new Error('Ruta inesperada: ' + path)
  })

  const catalog = useProcessCatalogStore()
  await Promise.all([catalog.loadRequirements(), catalog.loadProcessTypes()])
  assert.equal(catalog.loadingRequirements, false)
  assert.equal(catalog.loadingProcessTypes, false)
  await catalog.saveProcessType(null, { name: 'Titulación', requirements: [], version: null })
  assert.equal(catalog.processTypes.length, 1)
  assert.equal(catalog.processTypes[0].version, 1)
  await catalog.publishProcessType(8, 1)
  assert.equal(catalog.processTypes[0].status, 'PUBLISHED')
  assert.equal(catalog.processTypes[0].version, 2)
  await catalog.deactivateRequirement(2)
  assert.equal(catalog.requirements[0].active, false)
  assert.equal(seen.length, 5)
})

test('explica sesión vencida, falta de permisos y desconexión con mensajes claros', () => {
  assert.match(catalogErrorMessage({ status: 401 }, 'Error'), /sesión venció/)
  assert.match(catalogErrorMessage({ status: 403 }, 'Error'), /permiso/)
  assert.match(catalogErrorMessage({ status: 0 }, 'Error'), /conectar/)
  assert.equal(catalogErrorMessage({ status: 409, message: 'Versión antigua' }, 'Error'), 'Versión antigua')
})
