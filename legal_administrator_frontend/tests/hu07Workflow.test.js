import test, { beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
import { processCatalogApi } from '../src/modules/processes/services/processCatalogApi.js'
import { legalProcessApi } from '../src/modules/processes/services/legalProcessApi.js'
import { useStageTransitionStore } from '../src/modules/processes/stores/stageTransitionStore.js'
import { createStageDraft, stagePayload, validateStageDraft } from '../src/modules/processes/domain/stageConfiguration.js'

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}
function detail() {
  return {
    caseData: { id: 8, version: 2, currentStageId: 42, currentStageName: 'En revisión' },
    requirements: [],
    timeline: {
      currentStage: { id: 42, code: 'EN_REVISION', name: 'En revisión' },
      stages: [],
      allowedNextStageIds: [43],
      events: [{ id: 7, fromStageId: 41, toStageId: 42, actorDpi: '1234567890123' }],
    },
  }
}
beforeEach(() => {
  setActivePinia(createPinia())
  configureHttpClientAuth({
    getAccessToken: () => 'hu07-token', canRefresh: () => false,
    refreshSession: null, logout: null,
  })
})
afterEach(() => mock.restoreAll())

test('crea el flujo inicial y valida alcance, finales y códigos antes de enviar', () => {
  const draft = createStageDraft({ version: 0, stages: [], transitions: [] })
  assert.equal(validateStageDraft(draft), '')
  assert.deepEqual(stagePayload(draft).stages.map(stage => stage.displayOrder), [1, 2, 3, 4])
  assert.equal(stagePayload(draft).transitions[0].fromCode, 'PRESENTADO')
  draft.stages[1].name = 'Revisión legal'
  assert.equal(stagePayload(draft).transitions[0].toCode, 'EN_REVISION')
  draft.transitions = []
  assert.match(validateStageDraft(draft), /alcanzable/)
  draft.transitions = [{ fromKey: 1, toKey: 2 }, { fromKey: 2, toKey: 3 }, { fromKey: 3, toKey: 4 }]
  draft.stages[2].code = 'código inválido'
  assert.match(validateStageDraft(draft), /código/)
  draft.stages[2].code = 'APROBADO'
  draft.stages[3].terminal = false
  assert.match(validateStageDraft(draft), /final/)
})

test('consulta y guarda etapas con Bearer, versión y rutas correctas', async () => {
  configureHttpClientAuth({ getAccessToken: () => 'hu07-token' })
  const calls = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ path: new URL(url).pathname, method: options.method || 'GET', body: options.body })
    assert.equal(options.headers.get('Authorization'), 'Bearer hu07-token')
    return json({ version: 4, stages: [], transitions: [] })
  })
  const draft = createStageDraft({ version: 3, stages: [], transitions: [] })
  await processCatalogApi.getStages(5)
  await processCatalogApi.saveStages(5, stagePayload(draft))
  assert.deepEqual(calls.map(call => call.path), [
    '/api/v1/process-types/5/stages', '/api/v1/process-types/5/stages',
  ])
  assert.deepEqual(calls.map(call => call.method), ['GET', 'PUT'])
  assert.equal(JSON.parse(calls[1].body).version, 3)
  assert.equal(JSON.parse(calls[1].body).stages.length, 4)
})

test('no permite editar con una configuración incompleta del servidor', async () => {
  mock.method(globalThis, 'fetch', async () => json({ version: 1, stages: [] }))
  await assert.rejects(processCatalogApi.getStages(5), /configuración de etapas válida/)
})

test('envía código para inicializar un expediente anterior y valida la respuesta', async () => {
  const bodies = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/v1/legal-processes/8/stage-transitions')
    bodies.push(JSON.parse(options.body))
    return json(detail())
  })
  await legalProcessApi.transitionStage(8, {
    requestId: '747c68df-c646-4f75-a34e-16cce22864f4',
    version: 0, targetStageCode: 'EN_REVISION', comment: 'Estado confirmado',
  })
  assert.equal(bodies[0].targetStageCode, 'EN_REVISION')
  assert.equal(bodies[0].targetStageId, undefined)
})

test('un fallo incierto conserva exactamente el mismo cuerpo y UUID al reintentar', async () => {
  const bodies = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    bodies.push(options.body)
    if (bodies.length === 1) return json({ message: 'Error inesperado' }, 500)
    return json(detail())
  })
  const transitions = useStageTransitionStore()
  await assert.rejects(transitions.move(8, { version: 1, targetStageId: 42, comment: 'Avance' }, '1234567890123'))
  assert.equal(transitions.uncertain, true)
  await transitions.move(8, { version: 99, targetStageId: 99, comment: 'Otro' }, '1234567890123')
  assert.equal(bodies[0], bodies[1])
  assert.match(JSON.parse(bodies[0]).requestId, /^[0-9a-f-]{36}$/)
  assert.equal(transitions.uncertain, false)
})

test('un conflicto libera la intención anterior para permitir corrección', async () => {
  const bodies = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    bodies.push(JSON.parse(options.body))
    if (bodies.length === 1) return json({ message: 'Versión obsoleta' }, 409)
    return json(detail())
  })
  const transitions = useStageTransitionStore()
  await assert.rejects(transitions.move(8, { version: 1, targetStageId: 42, comment: null }, '1234567890123'))
  assert.equal(transitions.uncertain, false)
  await transitions.move(8, { version: 2, targetStageId: 42, comment: null }, '1234567890123')
  assert.notEqual(bodies[0].requestId, bodies[1].requestId)
  assert.equal(bodies[1].version, 2)
})

test('una respuesta 200 sin historial confirmado conserva la clave para reintento', async () => {
  const bodies = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    bodies.push(options.body)
    if (bodies.length === 1) return json({ caseData: { id: 8 }, requirements: [] })
    return json(detail())
  })
  const transitions = useStageTransitionStore()
  await assert.rejects(transitions.move(8, { version: 1, targetStageId: 42, comment: null }, '1234567890123'))
  assert.equal(transitions.uncertain, true)
  await transitions.move(8, null, '1234567890123')
  assert.equal(bodies[0], bodies[1])
})

test('una cuenta distinta no reutiliza la solicitud incierta de otra abogada', async () => {
  const bodies = []
  mock.method(globalThis, 'fetch', async (url, options) => {
    bodies.push(JSON.parse(options.body))
    if (bodies.length === 1) throw new TypeError('Conexión perdida')
    return json(detail())
  })
  const transitions = useStageTransitionStore()
  await assert.rejects(transitions.move(8, { version: 1, targetStageId: 42 }, '1234567890123'))
  assert.equal(transitions.pendingActor, '1234567890123')
  await transitions.move(8, { version: 2, targetStageId: 43 }, '9999999999999')
  assert.notEqual(bodies[0].requestId, bodies[1].requestId)
  assert.equal(bodies[1].targetStageId, 43)
})

test('la renovación de sesión repite el cambio con el mismo cuerpo', async () => {
  let token = 'expired'
  let refreshes = 0
  const bodies = []
  configureHttpClientAuth({
    getAccessToken: () => token, canRefresh: () => true,
    refreshSession: async () => { refreshes += 1; token = 'renewed' },
    logout: null,
  })
  mock.method(globalThis, 'fetch', async (url, options) => {
    bodies.push(options.body)
    if (bodies.length === 1) return json({ message: 'Sesión vencida' }, 401)
    assert.equal(options.headers.get('Authorization'), 'Bearer renewed')
    return json(detail())
  })
  await useStageTransitionStore().move(8, { version: 1, targetStageId: 42 }, '1234567890123')
  assert.equal(refreshes, 1)
  assert.equal(bodies[0], bodies[1])
})
