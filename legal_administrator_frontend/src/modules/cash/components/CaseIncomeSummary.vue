<script setup>
import { computed } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import { formatCashMoney } from '../domain/cashForm.js'
import { finalPaymentSuggestion, incomeSummaryStatus, pendingBalanceLabel, visiblePendingBalance } from '../domain/incomeSummary.js'
import { formatPaymentDate } from '../../processes/domain/paymentLedger.js'

const props = defineProps({ summary: Object, loading: Boolean, failed: Boolean, busy: Boolean, locked: Boolean })
defineEmits(['reload', 'use-pending'])
const suggestion = computed(() => finalPaymentSuggestion(props.summary))
</script>

<template>
  <section class="income-summary" aria-label="Estado de pagos del expediente">
    <LoadingCards v-if="loading" label="Consultando monto pactado y pagos del expediente" :count="1" />
    <div v-else-if="failed" class="summary-unavailable">
      <h3>Información de pagos pendiente de consultar</h3>
      <BaseButton variant="outline" :disabled="busy" @click="$emit('reload')">Reintentar consulta de pagos</BaseButton>
    </div>
    <template v-else-if="summary">
      <header class="summary-heading">
        <h3>Estado de pagos del expediente</h3>
        <BaseButton variant="outline" :disabled="busy" @click="$emit('reload')">Actualizar pagos</BaseButton>
      </header>
      <BaseBadge v-if="summary.settled" variant="teal">{{ incomeSummaryStatus(summary) }}</BaseBadge>
      <p v-else class="summary-state">{{ incomeSummaryStatus(summary) }}</p>
      <dl class="summary-amounts">
        <div><dt>Monto total pactado</dt>
          <dd v-if="summary.totalAgreed">{{ formatCashMoney(summary.totalAmount) }}</dd><dd v-else>Sin pactar</dd>
        </div>
        <div><dt>Abonado hasta ahora</dt><dd>{{ formatCashMoney(summary.paidAmount) }}</dd></div>
        <div><dt>{{ pendingBalanceLabel(summary) }}</dt>
          <dd v-if="summary.totalAgreed">{{ formatCashMoney(visiblePendingBalance(summary)) }}</dd><dd v-else>Sin definir</dd>
        </div>
      </dl>
      <div v-if="summary.finalPaymentCount > 0" class="final-payment-details">
        <strong>Pago final registrado</strong>
        <p>Importe recibido en pagos finales vigentes: <span class="money">{{ formatCashMoney(summary.finalPaymentAmount) }}</span>.</p>
        <p v-if="summary.lastFinalPaymentDate">Último pago final: {{ formatPaymentDate(summary.lastFinalPaymentDate) }}.</p>
        <p class="help">Comprueba estos pagos antes de registrar un nuevo cobro.</p>
      </div>
      <p v-if="!summary.caseActive" class="help">El expediente está inactivo. Puedes consultar sus pagos y confirmar un registro pendiente.</p>
      <BaseButton v-else-if="suggestion" variant="outline" :disabled="busy || locked" @click="$emit('use-pending')">
        Usar saldo como pago final · {{ formatCashMoney(suggestion) }}
      </BaseButton>
      <p class="help">El monto pactado es informativo. En Caja registra únicamente el dinero que ya recibiste.</p>
    </template>
  </section>
</template>

<style scoped>
.income-summary { display: grid; gap: .8rem; min-width: 0; padding: 1rem; border: 1px solid var(--color-border-control); border-radius: var(--radius-md); background: var(--color-bg-subtle); }
.summary-heading { display: flex; flex-wrap: wrap; gap: .7rem; align-items: center; justify-content: space-between; }
h3 { font-size: 1rem; } .summary-state { color: var(--color-text-title); font-weight: 600; }
.summary-amounts { display: grid; gap: .8rem; grid-template-columns: minmax(0, 1fr); margin: 0; }
dt, .help { color: var(--color-text-muted); font-size: .875rem; }
dd { margin: .2rem 0 0; font-family: var(--font-mono); font-weight: 600; color: var(--color-text-title); overflow-wrap: anywhere; }
.final-payment-details, .summary-unavailable { display: grid; gap: .5rem; }
.final-payment-details { padding-top: .7rem; border-top: 1px solid var(--color-border-control); }
.final-payment-details strong { color: var(--color-text-title); } .final-payment-details p { font-size: .9rem; }
.money { font-family: var(--font-mono); overflow-wrap: anywhere; }
.income-summary :deep(button) { min-height: 46px; white-space: normal; }
@media (min-width: 580px) { .summary-amounts { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
