import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
import { cashApi } from '../src/modules/cash/services/cashApi.js'
import { useIncomeSummary } from '../src/modules/cash/composables/useIncomeSummary.js'
import { finalPaymentSuggestion, incomeSummaryStatus, pendingBalanceLabel, visiblePendingBalance } from '../src/modules/cash/domain/incomeSummary.js'

const agreed = (changes = {}) => ({
  caseId: 1, totalAmount: '2500.00', paidAmount: '1500.30', pendingAmount: '999.70',
  totalAgreed: true, settled: false, overpaid: false, caseActive: true, caseVersion: 4,
  finalPaymentAmount: '0.00', finalPaymentCount: 0, lastFinalPaymentDate: null, ...changes,
})
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('Monto pactado y pago final en Caja', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => configureHttpClientAuth({ getAccessToken: () => 'preview-token', canRefresh: () => false, logout: null }))
  afterEach(() => { globalThis.fetch = originalFetch; configureHttpClientAuth({ getAccessToken: () => null }) })

  test('consulta el libro del expediente con JWT y conserva los centavos exactos', async () => {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /\/cash\/incomes\/1\/summary$/)
      assert.equal(options.headers.get('Authorization'), 'Bearer preview-token')
      return json(agreed({ paidAmount: '9007199254740993.01', pendingAmount: '-9007199254738493.01', overpaid: true }))
    }
    const result = await cashApi.incomeSummary(1)
    assert.equal(result.paidAmount, '9007199254740993.01')
    assert.equal(finalPaymentSuggestion(result), '')
  })

  test('propone únicamente el saldo positivo sin convertir el costo pactado en otro cobro', () => {
    assert.equal(finalPaymentSuggestion(agreed()), '999.70')
    assert.equal(incomeSummaryStatus(agreed()), 'Saldo pendiente de cobro')
    assert.equal(finalPaymentSuggestion(agreed({ caseActive: false })), '')
    assert.equal(finalPaymentSuggestion(agreed({ totalAgreed: false, totalAmount: null, pendingAmount: null })), '')
    assert.equal(incomeSummaryStatus(agreed({ totalAgreed: false })), 'Monto total sin pactar')
  })

  test('si ya está cubierto o tiene saldo a favor no propone otro pago final', () => {
    const covered = agreed({ paidAmount: '2500.00', pendingAmount: '0.00', settled: true, finalPaymentAmount: '999.70', finalPaymentCount: 1 })
    assert.equal(incomeSummaryStatus(covered), 'Monto pactado cubierto')
    assert.equal(finalPaymentSuggestion(covered), '')
    const credit = agreed({ paidAmount: '2600.00', pendingAmount: '-100.00', overpaid: true })
    assert.equal(incomeSummaryStatus(credit), 'Saldo a favor del cliente')
    assert.equal(pendingBalanceLabel(credit), 'Saldo a favor del cliente')
    assert.equal(visiblePendingBalance(credit), '100.00')
    assert.equal(finalPaymentSuggestion(credit), '')
  })

  test('un resumen de otro expediente, incompleto o con importes numéricos no habilita el formulario', async () => {
    for (const invalid of [agreed({ caseId: 2 }), agreed({ totalAmount: 2500 }), agreed({ paidAmount: 1500.3 }), {}, agreed({ finalPaymentCount: -1 })]) {
      globalThis.fetch = async () => json(invalid)
      await assert.rejects(cashApi.incomeSummary(1), /no confirmó/)
    }
  })

  test('al cambiar de expediente descarta la primera respuesta aunque llegue después', async () => {
    const pending = []
    globalThis.fetch = (_url, options) => new Promise(resolve => pending.push({ resolve, signal: options.signal }))
    const state = useIncomeSummary()
    const first = state.load(1)
    const second = state.load(2)
    assert.equal(pending[0].signal.aborted, true)
    pending[1].resolve(json(agreed({ caseId: 2, pendingAmount: '10.00' })))
    await second
    pending[0].resolve(json(agreed()))
    assert.equal(await first, null)
    assert.equal(state.summary.value.caseId, 2)
    assert.equal(state.summary.value.pendingAmount, '10.00')
  })

  test('un fallo elimina el resumen anterior y cerrar el formulario descarta resultados tardíos', async () => {
    globalThis.fetch = async () => json(agreed())
    const state = useIncomeSummary()
    await state.load(1)
    globalThis.fetch = async () => json({ message: 'No se pudo consultar.' }, 500)
    await assert.rejects(state.load(2))
    assert.equal(state.summary.value, null)
    assert.equal(state.failed.value, true)
    let release
    globalThis.fetch = () => new Promise(resolve => { release = resolve })
    const pending = state.load(1)
    state.reset()
    release(json(agreed()))
    assert.equal(await pending, null)
    assert.equal(state.summary.value, null)
    assert.equal(state.loading.value, false)
  })
})
