import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import { caseDocumentsApi } from '../src/modules/processes/services/caseDocumentsApi.js'
import { documentFileError, isPermanentUploadError } from '../src/modules/processes/domain/documentFiles.js'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'

const policy = { maxFileSize: 1024, extensions: ['pdf', 'jpg', 'jpeg', 'png'] }
describe('Documentos del expediente', () => {
beforeEach(() => configureHttpClientAuth({ getAccessToken: () => 'documents-token', canRefresh: () => false }))
afterEach(() => mock.restoreAll())

test('valida formatos, tamaño, archivos vacíos y MIME antes de subir', () => {
  for (const [name, type] of [['DPI.PDF', 'application/pdf'], ['foto.jpeg', 'image/jpeg'], ['foto.png', 'image/png']]) {
    assert.equal(documentFileError({ name, type, size: 1024 }, policy), '')
  }
  for (const file of [
    { name: 'foto.heic', type: 'image/heic', size: 50 },
    { name: 'dpi.pdf', type: 'text/html', size: 50 },
    { name: 'dpi.pdf', type: 'application/pdf', size: 0 },
    { name: 'dpi.pdf', type: 'application/pdf', size: 1025 },
  ]) assert.ok(documentFileError(file, policy))
  assert.ok(documentFileError({ name: 'dpi.pdf', size: 100 }, null))
})

test('distingue rechazos definitivos del servidor de fallos reintentables', () => {
  for (const status of [400, 401, 403, 404, 409, 413, 415, 422]) {
    assert.equal(isPermanentUploadError({ status }), true, `el estado ${status} no debe reintentarse`)
  }
  for (const status of [0, 408, 429, 500, 502, 503, 504]) {
    assert.equal(isPermanentUploadError({ status }), false, `el estado ${status} sí debe reintentarse`)
  }
  assert.equal(isPermanentUploadError(new Error('sin estado')), false)
})

test('sube multipart con Bearer y permite al navegador generar el boundary', async () => {
  const file = new File(['%PDF-1.7\n%%EOF'], 'DPI.pdf', { type: 'application/pdf' })
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(url.endsWith('/legal-processes/12/documents'))
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.get('Authorization'), 'Bearer documents-token')
    assert.equal(options.headers.has('Content-Type'), false)
    assert.ok(options.body instanceof FormData)
    assert.equal(options.body.get('file').name, 'DPI.pdf')
    return Response.json({ id: 'document-id' }, { status: 201 })
  })
  assert.equal((await caseDocumentsApi.upload(12, file)).id, 'document-id')
})

test('consulta y descarga contenido autenticado como Blob', async () => {
  const urls = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(url)
    assert.equal(options.headers.get('Authorization'), 'Bearer documents-token')
    return new Response('%PDF-1.7\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } })
  })
  const preview = await caseDocumentsApi.content(12, 'id')
  assert.equal(preview.type, 'application/pdf')
  assert.equal(await preview.text(), '%PDF-1.7\n%%EOF')
  await caseDocumentsApi.content(12, 'id', true)
  assert.ok(urls[0].endsWith('/12/documents/id/content?download=false'))
  assert.ok(urls[1].endsWith('/12/documents/id/content?download=true'))
})

test('muestra errores JSON del servidor incluso al solicitar un Blob', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Documento no encontrado.' }, { status: 404 }))
  await assert.rejects(caseDocumentsApi.content(12, 'otro'), { status: 404, message: 'Documento no encontrado.' })
})
})
