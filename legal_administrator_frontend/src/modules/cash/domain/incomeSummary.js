import { parseCashAmount } from './cashForm.js'

export function finalPaymentSuggestion(summary) {
  if (!summary?.totalAgreed || !summary.caseActive) return ''
  const amount = parseCashAmount(summary.pendingAmount)
  if (amount.error) return ''
  return amount.amount
}

export function incomeSummaryStatus(summary) {
  if (!summary) return ''
  if (!summary.totalAgreed) return 'Monto total sin pactar'
  if (summary.overpaid) return 'Saldo a favor del cliente'
  if (summary.settled) return 'Monto pactado cubierto'
  return 'Saldo pendiente de cobro'
}

export function pendingBalanceLabel(summary) {
  if (summary?.overpaid) return 'Saldo a favor del cliente'
  return 'Saldo pendiente'
}

export function visiblePendingBalance(summary) {
  const amount = summary?.pendingAmount
  if (typeof amount !== 'string') return null
  if (summary.overpaid && amount.startsWith('-')) return amount.slice(1)
  return amount
}
