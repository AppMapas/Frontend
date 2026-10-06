import { PAYMENT_METHODS, PAYMENT_TYPES, isCalendarDate } from '../../processes/domain/paymentLedger.js'

export const CASH_CATEGORIES = [
  { code: 'TRAMITES', name: 'Trámites', direction: 'INGRESO' },
  { code: 'UTILES_OFICINA', name: 'Útiles de oficina', direction: 'EGRESO' },
  { code: 'GASTOS_PERSONALES', name: 'Gastos personales', direction: 'EGRESO' },
]
export function todayInGuatemala(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return values.year + '-' + values.month + '-' + values.day
}
export function emptyCashForm(category = 'TRAMITES') {
  return { category, caseId: '', amount: '', description: '', date: todayInGuatemala(),
    paymentMethod: 'EFECTIVO', paymentType: 'ABONO', reference: '' }
}
export function parseCashAmount(value) {
  const text = String(value ?? '').trim().replace(',', '.')
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) return { error: 'Escribe un monto positivo con hasta 12 dígitos y dos decimales.' }
  const [integer, fraction = ''] = text.split('.')
  const cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents <= 0n) return { error: 'El monto debe ser mayor que cero.' }
  return { amount: (cents / 100n).toString() + '.' + (cents % 100n).toString().padStart(2, '0'), error: '' }
}
export function formatCashMoney(value) {
  const text = String(value ?? '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return 'Sin monto'
  let sign = ''
  let unsigned = text
  if (text.startsWith('-')) { sign = '-'; unsigned = text.slice(1) }
  const [integer, fraction = ''] = unsigned.split('.')
  const grouped = BigInt(integer).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return 'Q ' + sign + grouped + '.' + fraction.padEnd(2, '0')
}
export function categoryName(code) {
  return CASH_CATEGORIES.find(item => item.code === code)?.name || code
}
export function cashFormErrors(form) {
  const errors = {}
  if (!CASH_CATEGORIES.some(item => item.code === form.category)) errors.category = 'Elige una categoría.'
  if (parseCashAmount(form.amount).error) errors.amount = parseCashAmount(form.amount).error
  const description = String(form.description || '').trim()
  let max = 500
  if (form.category === 'TRAMITES') max = 120
  if (!description || description.length > max) errors.description = 'La descripción es obligatoria y admite hasta ' + max + ' caracteres.'
  if (!isCalendarDate(form.date) || form.date > todayInGuatemala()) errors.date = 'Selecciona una fecha válida, igual o anterior a hoy.'
  if (!PAYMENT_METHODS.includes(form.paymentMethod)) errors.paymentMethod = 'Elige una forma de pago.'
  if (String(form.reference || '').trim().length > 60) errors.reference = 'La referencia admite hasta 60 caracteres.'
  if (form.category === 'TRAMITES') {
    if (!Number.isSafeInteger(Number(form.caseId)) || Number(form.caseId) <= 0) errors.caseId = 'Selecciona un expediente activo.'
    if (!PAYMENT_TYPES.includes(form.paymentType)) errors.paymentType = 'Elige anticipo, abono o pago final.'
  }
  return errors
}
export function cashPayload(form) {
  const result = { amount: parseCashAmount(form.amount).amount, description: form.description.trim(),
    date: form.date, paymentMethod: form.paymentMethod, reference: String(form.reference || '').trim() || null }
  if (form.category === 'TRAMITES') {
    result.caseId = Number(form.caseId)
    result.paymentType = form.paymentType
  } else result.category = form.category
  return result
}
