<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { CASH_CATEGORIES, cashFormErrors, cashPayload, emptyCashForm, formatCashMoney, parseCashAmount, todayInGuatemala, categoryName } from '../domain/cashForm.js'
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '../../processes/domain/paymentLedger.js'
import BaseButton from '@/components/common/BaseButton.vue'
import CasePicker from './CasePicker.vue'
import CaseIncomeSummary from './CaseIncomeSummary.vue'
import { useIncomeSummary } from '../composables/useIncomeSummary.js'
import { finalPaymentSuggestion } from '../domain/incomeSummary.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
const props = defineProps({ initial: Object, busy: Boolean, locked: Boolean })
const emit = defineEmits(['submit', 'cancel'])
const notifications = useNotificationStore()
const form = reactive({ ...emptyCashForm(), ...props.initial })
const paymentInfo = useIncomeSummary()
const financialSummary = computed(() => paymentInfo.summary.value)
const consultingPayments = computed(() => paymentInfo.loading.value)
const paymentLookupFailed = computed(() => paymentInfo.failed.value)
const errors = ref({})
const review = ref(false)
const caseLabel = ref('')
let reviewedFinancialSummary = null
function identifyCase(item) { caseLabel.value = item.caseCode + ' · ' + item.clientName }
const income = computed(() => form.category === 'TRAMITES')
const maxDescription = computed(() => { if (income.value) return 120; return 500 })
async function reloadIncomeSummary() {
  if (!income.value || !form.caseId) return
  try {
    const result = await paymentInfo.load(form.caseId)
    if (review.value && reviewedFinancialSummary && result) {
      const fields = ['totalAmount', 'paidAmount', 'pendingAmount', 'caseActive', 'finalPaymentAmount', 'finalPaymentCount']
      if (fields.some(field => reviewedFinancialSummary[field] !== result[field])) {
        review.value = false
        reviewedFinancialSummary = null
        notifications.show('Los pagos del expediente cambiaron. Revisa el monto del cobro antes de guardar.', 'warning')
      }
    }
  } catch (error) {
    notifyRequestError(error, 'No fue posible consultar el monto pactado y los pagos.', 'Reintentar', reloadIncomeSummary)
  }
}
function usePendingAmount() {
  if (props.busy || props.locked) return
  const amount = finalPaymentSuggestion(financialSummary.value)
  if (!amount) return
  form.amount = amount
  form.paymentType = 'PAGO_FINAL'
  review.value = false
  notifications.show('Se completaron el monto pendiente y el tipo Pago final. Revisa los datos antes de guardar.', 'info')
}
watch(() => [form.category, form.caseId], () => {
  if (income.value && form.caseId) reloadIncomeSummary()
  else { caseLabel.value = ''; paymentInfo.reset() }
}, { immediate: true })
onBeforeUnmount(paymentInfo.reset)

function continueToReview() {
  if (props.locked) { emit('submit', null); return }
  errors.value = cashFormErrors(form)
  if (Object.keys(errors.value).length) { notifications.show(Object.values(errors.value)[0], 'warning'); return }
  if (!validateIncomeSummary()) return
  reviewedFinancialSummary = financialSummary.value
  review.value = true
}

function validateIncomeSummary() {
  if (!income.value) return true
  if (consultingPayments.value || !financialSummary.value) {
    notifications.show('Consulta el estado de pagos del expediente antes de continuar.', 'warning')
    return false
  }
  if (!financialSummary.value.caseActive) {
    notifications.show('El expediente está inactivo. Selecciona otro expediente para registrar un ingreso.', 'warning')
    return false
  }
  return true
}

function confirm() {
  if (props.busy || props.locked || !validateIncomeSummary()) return
  emit('submit', { category: form.category, payload: cashPayload(form) })
}

</script>
<template>
  <div class="movement-form">
    <header><p class="eyebrow">Caja del despacho</p><h2 id="cash-form-title">Registrar movimiento</h2>
      <p class="help">Registra dinero recibido o un gasto realizado. Todos los importes se expresan en quetzales.</p></header>
    <form v-if="!review || locked" novalidate @submit.prevent="continueToReview">
      <fieldset :disabled="busy || locked">
        <legend class="visually-hidden">Datos del movimiento</legend>
        <label for="cash-category">Categoría
          <select id="cash-category" v-model="form.category" :aria-invalid="!!errors.category">
            <option v-for="category in CASH_CATEGORIES" :key="category.code" :value="category.code">{{ category.name }}</option>
          </select>
        </label>
        <p v-if="form.category === 'GASTOS_PERSONALES'" class="help">Este gasto será privado y solo podrás consultarlo desde tu cuenta.</p>
        <CasePicker v-if="income" v-model="form.caseId" :disabled="busy || locked" :invalid="!!errors.caseId" @selected="identifyCase" />
        <CaseIncomeSummary v-if="income && form.caseId" :summary="financialSummary" :loading="consultingPayments"
          :failed="paymentLookupFailed" :busy="busy" :locked="locked" @reload="reloadIncomeSummary" @use-pending="usePendingAmount" />
        <div class="field-row">
          <label for="cash-amount">Monto (Q) <input id="cash-amount" v-model="form.amount" inputmode="decimal" maxlength="16" placeholder="0.00" :aria-invalid="!!errors.amount" /></label>
          <label for="cash-date">Fecha <input id="cash-date" v-model="form.date" type="date" :max="todayInGuatemala()" :aria-invalid="!!errors.date" /></label>
        </div>
        <label for="cash-description">Descripción
          <textarea id="cash-description" v-model="form.description" :maxlength="maxDescription" rows="3" :aria-invalid="!!errors.description" placeholder="Ej. Anticipo del trámite o compra de papel"></textarea>
        </label>
        <div class="field-row">
          <label for="cash-method">Forma de pago <select id="cash-method" v-model="form.paymentMethod" :aria-invalid="!!errors.paymentMethod">
            <option v-for="(label, code) in PAYMENT_METHOD_LABELS" :key="code" :value="code">{{ label }}</option>
          </select></label>
          <label v-if="income" for="cash-payment-type">Tipo de cobro <select id="cash-payment-type" v-model="form.paymentType" :aria-invalid="!!errors.paymentType">
            <option v-for="(label, code) in PAYMENT_TYPE_LABELS" :key="code" :value="code">{{ label }}</option>
          </select></label>
        </div>
        <label for="cash-reference">Referencia opcional <input id="cash-reference" v-model="form.reference" maxlength="60" placeholder="Número de recibo o transferencia" /></label>
      </fieldset>
      <div class="form-actions"><BaseButton variant="outline" :disabled="busy" @click="emit('cancel')">Cerrar</BaseButton>
        <BaseButton type="submit" :loading="busy" :disabled="income && !!form.caseId && consultingPayments && !locked"><span v-if="locked">Reintentar mismo registro</span><span v-else>Revisar movimiento</span></BaseButton></div>
    </form>
    <div v-else class="review">
      <h3>Revisa antes de guardar</h3>
      <CaseIncomeSummary v-if="income && form.caseId" :summary="financialSummary" :loading="consultingPayments"
        :failed="paymentLookupFailed" :busy="busy" :locked="locked" @reload="reloadIncomeSummary" @use-pending="usePendingAmount" />
      <strong class="review-amount">{{ formatCashMoney(parseCashAmount(form.amount).amount) }}</strong>
      <dl><div><dt>Categoría</dt><dd>{{ categoryName(form.category) }}</dd></div>
        <div v-if="income"><dt>Expediente</dt><dd><span v-if="caseLabel">{{ caseLabel }}</span><span v-else>#{{ form.caseId }}</span></dd></div>
        <div v-if="income"><dt>Tipo de cobro</dt><dd>{{ PAYMENT_TYPE_LABELS[form.paymentType] }}</dd></div>
        <div><dt>Descripción</dt><dd>{{ form.description }}</dd></div>
        <div><dt>Fecha</dt><dd>{{ form.date }}</dd></div><div><dt>Forma de pago</dt><dd>{{ PAYMENT_METHOD_LABELS[form.paymentMethod] }}</dd></div></dl>
      <div class="form-actions"><BaseButton variant="outline" :disabled="busy" @click="review = false">Corregir</BaseButton><BaseButton :loading="busy" :disabled="income && consultingPayments" @click="confirm">Confirmar y guardar</BaseButton></div>
    </div>
  </div>
</template>
<style scoped>
.movement-form { padding: clamp(1rem, 4vw, 1.6rem); display: grid; gap: 1rem; }
header { display: grid; gap: .35rem; } h2 { font-size: 1.3rem; } .eyebrow { color: var(--color-primary); font-family: var(--font-mono); font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
fieldset { border: 0; min-width: 0; display: grid; gap: 1rem; } label { display: grid; gap: .4rem; min-width: 0; font-weight: 600; font-size: .9rem; }
input, select, textarea { width: 100%; min-width: 0; min-height: 46px; font-size: 1rem; border-color: var(--color-border-control); } textarea { resize: vertical; }
[aria-invalid='true'] { border-color: var(--color-danger-strong); }
.field-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.help { font-size: .875rem; color: var(--color-text-muted); }
.form-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .65rem; margin-top: 1rem; } .form-actions :deep(button) { min-height: 46px; flex: 1 1 auto; }
.review { display: grid; gap: 1rem; } .review-amount { color: var(--color-teal-strong); font-size: clamp(1.5rem, 5vw, 2rem); font-family: var(--font-mono); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.review dl { display: grid; gap: .8rem; } dt { font-size: .85rem; color: var(--color-text-muted); } dd { margin: 0; overflow-wrap: anywhere; white-space: pre-line; }
@media (min-width: 580px) { .field-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } .form-actions :deep(button) { flex: 0 1 auto; } }
</style>
