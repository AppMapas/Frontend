import { test, beforeEach, afterEach, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { cashFormErrors, cashPayload, emptyCashForm, formatCashMoney, parseCashAmount, todayInGuatemala } from '../src/modules/cash/domain/cashForm.js'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
import { useFinancialSubmissionStore } from '../src/shared/finance/financialSubmissionStore.js'
import { useCashStore } from '../src/modules/cash/stores/cashStore.js'
import { cashApi } from '../src/modules/cash/services/cashApi.js'

describe('Caja H09', () => {
const originalFetch = globalThis.fetch
const actor = '3002234560901'
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const payload = { category: 'UTILES_OFICINA', amount: '0.10', description: 'Papel', date: '2020-01-01', paymentMethod: 'EFECTIVO', reference: null }
const result = { source: 'EXPENSE', sourceId: '5', replayed: false, caseVersion: null }
const overview = { summary: { income: '0.30', officeExpenses: '0.10', personalExpenses: '0.05', officeBalance: '0.20', generalBalance: '0.15', currency: 'GTQ' }, movements: { content: [], page: 0, size: 12, totalElements: 0, totalPages: 0 } }
beforeEach(() => { setActivePinia(createPinia()); configureHttpClientAuth({ getAccessToken: () => 'test-token', canRefresh: () => false, logout: null }) })
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.window; configureHttpClientAuth({ getAccessToken: () => null }) })

test('montos exactos hasta el límite del backend y agregados mayores a Number.MAX_SAFE_INTEGER', () => {
  assert.equal(parseCashAmount('999999999999,99').amount, '999999999999.99')
  assert.equal(parseCashAmount('00.10').amount, '0.10')
  for (const amount of ['0', '-1', '10.005', '1e2', '1,000.00', '1000000000000']) assert.ok(parseCashAmount(amount).error)
  assert.equal(formatCashMoney('1234567890123456789.01'), 'Q 1,234,567,890,123,456,789.01')
  assert.equal(formatCashMoney('-0.10'), 'Q -0.10')
})
test('fecha guatemalteca evita cambios de día según la zona del teléfono', () => {
  assert.equal(todayInGuatemala(new Date('2026-10-05T02:00:00Z')), '2026-10-04')
})
test('el ingreso exige expediente; los gastos omiten expediente y propietario manipulados', () => {
  const form = { ...emptyCashForm('UTILES_OFICINA'), ...payload, ownerDpi: 'otro', registeredBy: 'otro', caseId: 80, version: 900 }
  assert.deepEqual(cashFormErrors(form), {})
  assert.equal(cashPayload(form).ownerDpi, undefined)
  assert.equal(cashPayload(form).caseId, undefined)
  const income = { ...form, category: 'TRAMITES', caseId: '' }
  assert.ok(cashFormErrors(income).caseId)
  income.caseId = 10
  assert.equal(cashPayload(income).category, undefined)
  assert.equal(cashPayload(income).caseId, 10)
})
test('rechaza descripción vacía, fecha futura, categorías y métodos desconocidos', () => {
  const errors = cashFormErrors({ ...payload, category: 'OTRA', date: '9999-01-01', description: ' ', paymentMethod: 'CRYPTO' })
  for (const field of ['category', 'date', 'description', 'paymentMethod']) assert.ok(errors[field])
})
test('registro incluye JWT y conserva exactamente monto y solicitud', async () => {
  let body
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/cash\/expenses$/)
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
    body = JSON.parse(options.body)
    return json(result, 201)
  }
  const store = useFinancialSubmissionStore()
  assert.deepEqual(await store.send('/cash/expenses', payload, actor), result)
  assert.equal(body.amount, '0.10')
  assert.match(body.requestId, /^[a-f0-9-]{36}$/)
  assert.equal(store.pending, null)
})
test('respuesta perdida conserva payload y clave, impide otro movimiento y reintenta sin duplicar', async () => {
  const calls = []
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body))
    if (calls.length === 1) throw new TypeError('offline')
    return json({ ...result, replayed: true })
  }
  const store = useFinancialSubmissionStore()
  await assert.rejects(store.send('/cash/expenses', payload, actor))
  assert.equal(store.uncertain, true)
  assert.throws(() => store.send('/cash/incomes', { amount: '1.00' }, actor), /sin confirmar/)
  await store.send('/cash/expenses', { ...payload, amount: '999.00' }, actor)
  assert.deepEqual(calls[0], calls[1])
  assert.equal(store.pending, null)
})
test('doble clic simultáneo comparte la misma petición', async () => {
  let release; let count = 0
  globalThis.fetch = async () => { count += 1; await new Promise(resolve => { release = resolve }); return json(result) }
  const store = useFinancialSubmissionStore()
  const a = store.send('/cash/expenses', payload, actor)
  const b = store.send('/cash/expenses', payload, actor)
  release(); await Promise.all([a, b]); assert.equal(count, 1)
})
test('200 inválido o 500 conservan la solicitud; 409 permite corregir sin mantener un intento ambiguo', async () => {
  const store = useFinancialSubmissionStore()
  for (const response of [() => json({}), () => json({ message: 'falló' }, 500)]) {
    globalThis.fetch = async () => response()
    await assert.rejects(store.send('/cash/expenses', payload, actor))
    assert.equal(store.uncertain, true)
    assert.ok(store.pending)
  }
  globalThis.fetch = async () => json({ message: 'conflicto' }, 409)
  await assert.rejects(store.send('/cash/expenses', payload, actor))
  assert.equal(store.pending, null)
})
test('abonos del expediente comparten la protección y mantienen su contrato', async () => {
  const store = useFinancialSubmissionStore()
  globalThis.fetch = async () => json({ paidAmount: 0.10, payments: [] })
  assert.equal((await store.send('/legal-processes/4/payments', { amount: '0.10' }, actor, 'ledger')).paidAmount, 0.10)
})
test('logout invalida una respuesta tardía y limpia los datos de sesión', async () => {
  let release
  globalThis.fetch = async () => { await new Promise(resolve => { release = resolve }); return json(result) }
  const store = useFinancialSubmissionStore()
  const promise = store.send('/cash/expenses', payload, actor)
  store.resetSession(); release()
  assert.equal(await promise, null)
  assert.equal(store.pending, null)
  assert.equal(store.busy, false)
})
test('recargar la misma pestaña recupera la clave; otra cuenta no recupera información privada', async () => {
  const storage = new Map()
  globalThis.window = { sessionStorage: { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k), removeItem: k => storage.delete(k) } }
  globalThis.fetch = async () => { throw new TypeError('offline') }
  const store = useFinancialSubmissionStore()
  await assert.rejects(store.send('/cash/expenses', payload, actor))
  const key = store.pending.payload.requestId
  setActivePinia(createPinia())
  const recovered = useFinancialSubmissionStore(); recovered.restoreSession(actor)
  assert.equal(recovered.pending.payload.requestId, key)
  setActivePinia(createPinia())
  const other = useFinancialSubmissionStore(); other.restoreSession('3001123450101')
  assert.equal(other.pending, null)
  assert.equal(storage.size, 0)
})
test('resumen y listado se actualizan juntos y un resultado tardío no revive datos tras logout', async () => {
  globalThis.fetch = async () => json(overview)
  const store = useCashStore()
  await store.load({ page: 0 }); assert.equal(store.summary.income, '0.30')
  let release
  globalThis.fetch = async () => { await new Promise(resolve => { release = resolve }); return json(overview) }
  const promise = store.load({ page: 1 }); store.reset(); release()
  assert.equal(await promise, null); assert.equal(store.summary, null); assert.deepEqual(store.items, [])
})
test('resumen con dinero numérico o anulación sin confirmación se rechazan', async () => {
  globalThis.fetch = async () => json({ ...overview, summary: { ...overview.summary, income: 0.3 } })
  await assert.rejects(cashApi.overview({}), /no válido/)
  globalThis.fetch = async () => json({})
  await assert.rejects(cashApi.annul({ source: 'EXPENSE', sourceId: '5', version: 0 }, 'Error'), /no confirmó/)
})

})
