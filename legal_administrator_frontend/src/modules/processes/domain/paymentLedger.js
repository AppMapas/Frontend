/**
 * Dinero del expediente: parseo, formato y avance en porcentaje.
 *
 * Todo se calcula en centavos enteros. El porcentaje se redondea hacia abajo a
 * propósito: si quedaran cinco centavos, un redondeo normal mostraría "100%"
 * mientras la ficha de abonos dice que falta dinero, que es justo el error que
 * este control no debe cometer.
 */

export const PAYMENT_TYPE_LABELS = {
  ANTICIPO: 'Anticipo',
  ABONO: 'Abono',
  PAGO_FINAL: 'Pago final',
}
export const PAYMENT_METHOD_LABELS = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
}
export const PAYMENT_TYPES = Object.keys(PAYMENT_TYPE_LABELS)
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS)
/** La columna numeric(14,2) admite 12 dígitos enteros. */
const MAX_INTEGER_DIGITS = 12

export function paymentTypeLabel(value) {
  return PAYMENT_TYPE_LABELS[value] || value || 'Abono'
}

export function paymentMethodLabel(value) {
  return PAYMENT_METHOD_LABELS[value] || value || 'Otro'
}

/**
 * Monto a centavos enteros, o `null` si no hay un número utilizable.
 *
 * `Number(null)`, `Number('')` y `Number([])` son `0` en JavaScript, así que sin
 * este filtro un total sin pactar se mostraría como "Q 0.00", que es
 * precisamente la cifra inventada que el expediente debe distinguir de cero.
 */
export function toCents(amount) {
  if (typeof amount !== 'number' && typeof amount !== 'string') return null
  if (typeof amount === 'string' && !amount.trim()) return null
  const value = Number(amount)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

/**
 * `Q 3,499.50`. Pasa por centavos enteros para no heredar el error de coma
 * flotante que un `toFixed` sobre el valor original sí arrastraría.
 */
export function formatMoney(amount) {
  const cents = toCents(amount)
  if (cents === null) return 'Sin monto'
  return `Q ${(cents / 100).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatPercent(value) {
  return `${(Math.floor(value * 10) / 10).toFixed(1)}%`
}

/**
 * Avance del expediente sobre el costo pactado.
 *
 * `known` es `false` cuando no hay costo pactado o es cero: sin total no hay
 * porcentaje honesto que mostrar, y la vista dice "sin pactar" en vez de
 * inventar 0% o 100%.
 */
export function paymentProgress(ledger) {
  const paidCents = toCents(ledger?.paidAmount) ?? 0
  const totalCents = ledger?.totalAmount === null || ledger?.totalAmount === undefined
    ? null
    : toCents(ledger.totalAmount)

  if (totalCents === null || totalCents <= 0) {
    return { known: false, percent: null, settled: false, overpaid: paidCents > 0 }
  }

  const overpaid = paidCents > totalCents
  const settled = paidCents === totalCents
  const percent = overpaid || settled ? 100 : Math.floor((paidCents * 1000) / totalCents) / 10
  return { known: true, percent, settled, overpaid }
}

/** Frase de una línea que resume cuánto se ha pagado y cuánto falta. */
export function progressSummary(ledger) {
  const { known, percent, settled, overpaid } = paymentProgress(ledger)
  if (!known) {
    return ledger?.totalAmount === null || ledger?.totalAmount === undefined
      ? 'Define el costo total del expediente para ver el avance.'
      : `Abonado ${formatMoney(ledger?.paidAmount)} sin costo pactado que comparar.`
  }
  if (overpaid) return `Costo cubierto y saldo a favor de ${formatMoney(-ledger.pendingAmount)}.`
  if (settled) return 'Costo cubierto al 100%. No queda saldo pendiente.'
  return `Llevas ${formatPercent(percent)} del total. Faltan ${formatMoney(ledger.pendingAmount)}.`
}

/**
 * Interpreta lo que la abogada escribe: acepta punto o coma decimal, porque en
 * el teléfono el teclado suele separar así. No admite separador de miles.
 *
 * @returns {{ cents: number|null, error: string }} `cents` es `0` o más.
 */
export function parseAmount(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return { cents: null, error: 'Escribe el monto.' }
  const normalized = raw.replace(/,/g, '.')
  if (!new RegExp(`^\\d{1,${MAX_INTEGER_DIGITS}}(\\.\\d{1,2})?$`).test(normalized)) {
    return {
      cents: null,
      error: `Usa hasta ${MAX_INTEGER_DIGITS} dígitos y 2 decimales. El separador puede ser punto o coma.`,
    }
  }
  return { cents: toCents(normalized), error: '' }
}

/** Lo que se envía al backend: un número, nunca un string de texto. */
export function amountToRequest(cents) {
  return cents === null ? null : cents / 100
}

/**
 * El costo pactado sí admite "todavía sin pactar": un texto vacío viaja como
 * `null`, que el backend distingue de cero. Rechazar el vacío obligaría a
 * inventar un monto.
 */
export function parseTotalAmount(text) {
  return String(text ?? '').trim() ? parseAmount(text) : { cents: null, error: '' }
}

/**
 * Valida el formulario antes de llamar al backend. El servidor sigue siendo la
 * autoridad: esto solo evita un viaje de ida y vuelta por un error de tecleo.
 */
export function paymentFormErrors(form = {}, { today = '' } = {}) {
  const errors = {}
  const amount = parseAmount(form.amount)
  if (amount.error) errors.amount = amount.error
  else if (amount.cents <= 0) errors.amount = 'El monto debe ser mayor que cero.'

  if (!PAYMENT_TYPES.includes(form.paymentType)) errors.paymentType = 'Elige el tipo de abono.'
  if (!PAYMENT_METHODS.includes(form.paymentMethod)) errors.paymentMethod = 'Elige cómo se pagó.'

  const concept = String(form.concept ?? '').trim()
  if (!concept) errors.concept = 'Describe el abono, por ejemplo «50% inicial».'
  else if (concept.length > 120) errors.concept = 'El concepto admite hasta 120 caracteres.'

  const date = String(form.paymentDate ?? '').trim()
  if (!date) errors.paymentDate = 'Indica la fecha en que se recibió el pago.'
  else if (!isCalendarDate(date)) errors.paymentDate = 'La fecha no es válida.'
  else if (today && date > today) errors.paymentDate = 'No se puede registrar un pago con fecha futura.'

  const reference = String(form.reference ?? '').trim()
  if (reference.length > 60) errors.reference = 'La referencia admite hasta 60 caracteres.'

  return errors
}

/**
 * ¿Se conserva la clave de idempotencia tras este fallo? Solo cuando no sabemos
 * si el abono llegó a entrar (red caída o error del servidor). Un 400 o un 409
 * sí son respuesta definitiva: reintentar con esa clave no ayudaría.
 */
export function retainRequestId(error) {
  const status = error?.status ?? 0
  return status === 0 || status >= 500
}

/** Fecha local en formato ISO, para el `max` del campo de fecha. */
export function todayISO(now = new Date()) {
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 10)
}

/**
 * Una fecha ISO con el formato correcto no garantiza un día existente:
 * `2026-13-40` lo cumple y comparada como texto parecería futura.
 */
export function isCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

/**
 * `paymentDate` es una fecha sin zona horaria: "2026-10-04". Pasarla por `Date`
 * la interpretaría como UTC y en Guatemala se mostraría como 3 de octubre.
 */
export function formatPaymentDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return 'Sin fecha'
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}