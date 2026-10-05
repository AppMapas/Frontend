import test, { afterEach, beforeEach, describe, mock } from 'node:test'
import assert from 'node:assert/strict'
import { casePaymentsApi } from '../src/modules/processes/services/casePaymentsApi.js'
import { configureHttpClientAuth } from '../src/shared/api/httpClient.js'
import {
  amountToRequest, formatMoney, formatPaymentDate, formatPercent, isCalendarDate,
  parseAmount, parseTotalAmount, paymentFormErrors, paymentMethodLabel,
  paymentProgress, paymentTypeLabel, progressSummary, retainRequestId, todayISO,
} from '../src/modules/processes/domain/paymentLedger.js'

const ledger = (over = {}) => ({
  totalAmount: 10000.0,
  paidAmount: 6500.5,
  advancesAmount: 5000.0,
  pendingAmount: 3499.5,
  totalAgreed: true,
  settled: false,
  overpaid: false,
  caseVersion: 3,
  caseActive: true,
  payments: [],
  ...over,
})

describe('Dinero del expediente', () => {
  test('formatea con dos decimales y separador de miles', () => {
    assert.equal(formatMoney(3499.5), 'Q 3,499.50')
    assert.equal(formatMoney(10000), 'Q 10,000.00')
    assert.equal(formatMoney(0), 'Q 0.00')
    assert.equal(formatMoney(-400), 'Q -400.00')
    assert.equal(formatMoney(0.1), 'Q 0.10')
    assert.equal(formatMoney(1234567890.05), 'Q 1,234,567,890.05')
    // Sin pactar no es cero: `Number(null)` es 0 en JavaScript.
    assert.equal(formatMoney(null), 'Sin monto')
    assert.equal(formatMoney(undefined), 'Sin monto')
    assert.equal(formatMoney(''), 'Sin monto')
    assert.equal(formatMoney('abc'), 'Sin monto')
  })

  test('el avance refleja cuánto va pagando y nunca promete 100% con saldo', () => {
    assert.deepEqual(paymentProgress(ledger()), {
      known: true, percent: 65.0, settled: false, overpaid: false,
    })
    // 99.99% se muestra 99.9%: un redondeo normal mentiría, aún falta dinero.
    assert.equal(paymentProgress(ledger({
      paidAmount: 9999.9, pendingAmount: 0.1,
    })).percent, 99.9)
    // Quedan cinco centavos: 99.995% debe leerse 99.9, no 100.
    assert.equal(paymentProgress(ledger({
      paidAmount: 9999.95, pendingAmount: 0.05,
    })).percent, 99.9)
    assert.equal(paymentProgress(ledger({
      paidAmount: 10000, pendingAmount: 0,
    })).percent, 100)
    assert.equal(formatPercent(65), '65.0%')
    assert.equal(formatPercent(0), '0.0%')
  })

  test('sin costo pactado no hay porcentaje honesto que mostrar', () => {
    const sinPactar = ledger({ totalAmount: null, paidAmount: 1500.5, advancesAmount: 1500.5, pendingAmount: null, totalAgreed: false })
    assert.equal(paymentProgress(sinPactar).known, false)
    assert.equal(paymentProgress(sinPactar).percent, null)
    assert.match(progressSummary(sinPactar), /Define el costo total/)
    // Costo pactado en cero tampoco permite dividir.
    assert.equal(paymentProgress(ledger({ totalAmount: 0, pendingAmount: -500 })).known, false)
  })

  test('la frase de avance dice lo pagado y lo que falta', () => {
    assert.equal(progressSummary(ledger()), 'Llevas 65.0% del total. Faltan Q 3,499.50.')
    assert.match(progressSummary(ledger({
      paidAmount: 10000, pendingAmount: 0,
    })), /100%.*No queda saldo/)
    const aFavor = ledger({ paidAmount: 10500, advancesAmount: 10500, pendingAmount: -500, overpaid: true })
    assert.equal(progressSummary(aFavor), 'Costo cubierto y saldo a favor de Q 500.00.')
    assert.equal(paymentProgress(aFavor).percent, 100)
  })

  test('acepta coma o punto decimal y rechaza lo que no es un monto', () => {
    assert.deepEqual(parseAmount('1500.5'), { cents: 150050, error: '' })
    assert.deepEqual(parseAmount('1500,50'), { cents: 150050, error: '' })
    assert.deepEqual(parseAmount(' 500 '), { cents: 50000, error: '' })
    assert.deepEqual(parseAmount('0.07'), { cents: 7, error: '' })
    for (const malo of ['', '   ', 'abc', '-5', '1.234', '10.005', '1,500.50', '1e3', 'Q 500', '1234567890123']) {
      assert.ok(parseAmount(malo).error, `debía rechazar ${JSON.stringify(malo)}`)
      assert.equal(parseAmount(malo).cents, null)
    }
    assert.equal(amountToRequest(150050), 1500.5)
    assert.equal(amountToRequest(7), 0.07)
    assert.equal(amountToRequest(null), null)
  })

  test('el costo total puede quedar sin pactar, que no es lo mismo que cero', () => {
    assert.deepEqual(parseTotalAmount(''), { cents: null, error: '' })
    assert.deepEqual(parseTotalAmount('  '), { cents: null, error: '' })
    assert.deepEqual(parseTotalAmount('0'), { cents: 0, error: '' })
    assert.deepEqual(parseTotalAmount('10000'), { cents: 1000000, error: '' })
    assert.ok(parseTotalAmount('abc').error)
  })

  test('valida el formulario antes de viajar al servidor', () => {
    const hoy = '2026-10-04'
    const valido = {
      amount: '5000', paymentType: 'ANTICIPO', paymentMethod: 'TRANSFERENCIA',
      concept: '50% inicial', paymentDate: '2026-10-01', reference: 'REC-001',
    }
    assert.deepEqual(paymentFormErrors(valido, { today: hoy }), {})

    assert.match(paymentFormErrors({ ...valido, amount: '' }, { today: hoy }).amount, /Escribe el monto/)
    assert.match(paymentFormErrors({ ...valido, amount: '0' }, { today: hoy }).amount, /mayor que cero/)
    assert.match(paymentFormErrors({ ...valido, amount: '-5' }, { today: hoy }).amount, /Escribe|12 dígitos/)
    assert.match(paymentFormErrors({ ...valido, paymentType: 'OTRO' }, { today: hoy }).paymentType, /Elige el tipo/)
    assert.match(paymentFormErrors({ ...valido, paymentMethod: 'CRYPTO' }, { today: hoy }).paymentMethod, /Elige cómo/)
    assert.match(paymentFormErrors({ ...valido, concept: '  ' }, { today: hoy }).concept, /Describe el abono/)
    assert.match(paymentFormErrors({ ...valido, concept: 'a'.repeat(121) }, { today: hoy }).concept, /120/)
    assert.match(paymentFormErrors({ ...valido, reference: 'a'.repeat(61) }, { today: hoy }).reference, /60/)
    assert.match(paymentFormErrors({ ...valido, paymentDate: '' }, { today: hoy }).paymentDate, /Indica la fecha/)
    assert.match(paymentFormErrors({ ...valido, paymentDate: '2026-13-40' }, { today: hoy }).paymentDate, /no es válida/)
    assert.match(paymentFormErrors({ ...valido, paymentDate: '2026-10-05' }, { today: hoy }).paymentDate, /futura/)
    // El mismo día sí se acepta: un pago recibido hoy es lo normal.
    assert.deepEqual(paymentFormErrors({ ...valido, paymentDate: hoy }, { today: hoy }), {})
  })

  test('conserva la clave de idempotencia solo si no sabemos si el abono entró', () => {
    assert.equal(retainRequestId({ status: 0 }), true)
    assert.equal(retainRequestId({ status: 500 }), true)
    assert.equal(retainRequestId({ status: 503 }), true)
    assert.equal(retainRequestId({ status: 400 }), false)
    assert.equal(retainRequestId({ status: 409 }), false)
    assert.equal(retainRequestId({ status: 403 }), false)
    assert.equal(retainRequestId({ status: 422 }), false)
  })

  test('la fecha del abono no se corre un día por zona horaria', () => {
    assert.equal(formatPaymentDate('2026-10-04'), '04/10/2026')
    assert.equal(formatPaymentDate('2026-01-01'), '01/01/2026')
    assert.equal(formatPaymentDate(''), 'Sin fecha')
    assert.equal(formatPaymentDate(null), 'Sin fecha')
    assert.equal(todayISO(new Date(2026, 9, 4, 23, 30)), '2026-10-04')
    assert.equal(todayISO(new Date(2026, 0, 1, 0, 5)), '2026-01-01')
  })

  test('una fecha con formato ISO puede no ser un día que exista', () => {
    assert.equal(isCalendarDate('2026-10-04'), true)
    assert.equal(isCalendarDate('2024-02-29'), true)
    for (const falsa of ['2026-13-40', '2026-02-30', '2025-02-29', '04/10/2026', '2026-10-4', '', null]) {
      assert.equal(isCalendarDate(falsa), false, `debía rechazar ${JSON.stringify(falsa)}`)
    }
  })

  test('traduce los tipos y métodos del backend', () => {
    assert.equal(paymentTypeLabel('ANTICIPO'), 'Anticipo')
    assert.equal(paymentTypeLabel('PAGO_FINAL'), 'Pago final')
    assert.equal(paymentTypeLabel('X'), 'X')
    assert.equal(paymentMethodLabel('CHEQUE'), 'Cheque')
    assert.equal(paymentMethodLabel(null), 'Otro')
  })
})

describe('Cliente de pagos del expediente', () => {
  beforeEach(() => configureHttpClientAuth({ getAccessToken: () => 'payments-token', canRefresh: () => false }))
  afterEach(() => mock.restoreAll())

  const capture = (response = { status: 200, body: { totalAmount: 100, payments: [] } }) => {
    const seen = {}
    mock.method(globalThis, 'fetch', async (url, options = {}) => {
      seen.url = url
      seen.method = options.method || 'GET'
      seen.token = options.headers?.get?.('Authorization')
      seen.body = options.body
      return new Response(JSON.stringify(response.body), {
        status: response.status, headers: { 'content-type': 'application/json' },
      })
    })
    return seen
  }

  test('consulta el libro con el identificador del expediente', async () => {
    const seen = capture()
    await casePaymentsApi.ledger(12)
    assert.match(seen.url, /\/legal-processes\/12\/payments$/)
    assert.equal(seen.method, 'GET')
    assert.equal(seen.token, 'Bearer payments-token')
  })

  test('registra el abono con la clave de idempotencia en el cuerpo', async () => {
    const seen = capture({ status: 201, body: ledger() })
    await casePaymentsApi.register(12, {
      requestId: '2f1f5b1e-0000-4000-8000-000000000001',
      amount: 1500.5, paymentType: 'ABONO', paymentMethod: 'EFECTIVO',
      concept: '50% inicial', paymentDate: '2026-10-01', reference: null,
    })
    assert.equal(seen.method, 'POST')
    assert.equal(seen.url.endsWith('/legal-processes/12/payments'), true)
    const body = JSON.parse(seen.body)
    assert.equal(body.amount, 1500.5)
    assert.equal(body.reference, null)
    assert.match(body.requestId, /^[0-9a-f-]{36}$/)
  })

  test('actualiza el costo total con la versión vigente del expediente', async () => {
    const seen = capture({ status: 200, body: ledger({ totalAmount: 12000, caseVersion: 4 }) })
    const result = await casePaymentsApi.setTotalAmount(12, { version: 3, totalAmount: 12000 })
    assert.equal(seen.method, 'PUT')
    assert.match(seen.url, /\/legal-processes\/12\/total-amount$/)
    assert.deepEqual(JSON.parse(seen.body), { version: 3, totalAmount: 12000 })
    assert.equal(result.caseVersion, 4)
  })

  test('anula el abono por su identificador', async () => {
    const seen = capture({ status: 200, body: ledger({ pendingAmount: 3499.5 }) })
    await casePaymentsApi.annul(12, '7a9f1c30-0000-4000-8000-000000000002')
    assert.equal(seen.method, 'DELETE')
    assert.match(seen.url, /\/legal-processes\/12\/payments\/7a9f1c30-0000-4000-8000-000000000002$/)
  })
})