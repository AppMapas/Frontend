<script setup>
/**
 * Gestión de pagos del expediente: costo pactado, anticipos, abonos y saldo
 * pendiente, con el avance en porcentaje para saber cuánto falta por pagar.
 *
 * El libro completo (resumen + lista) llega en una sola respuesta del backend y
 * cada escritura devuelve el estado recalculado. Por eso esta vista nunca suma
 * por su cuenta ni muestra un porcentaje que no cuadre con la lista.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { casePaymentsApi } from '../services/casePaymentsApi.js'
import { caseDocumentsApi } from '../services/caseDocumentsApi.js'
import { documentFileError } from '../domain/documentFiles.js'
import PaymentReceiptRow from './PaymentReceiptRow.vue'
import { createRequestId } from '../domain/caseRegistration.js'
import {
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_TYPES, PAYMENT_TYPE_LABELS,
  amountToRequest, formatMoney, formatPaymentDate, formatPercent, parseAmount,
  parseTotalAmount, paymentFormErrors, paymentMethodLabel, paymentProgress,
  paymentTypeLabel, progressSummary, retainRequestId, todayISO,
} from '../domain/paymentLedger.js'

const props = defineProps({ caseId: { type: Number, required: true }, active: Boolean })
const emit = defineEmits(['state', 'version', 'ledger'])
const notifications = useNotificationStore()

const ledger = ref(null)
const receipt = ref(null)
const receiptPolicy = ref(null)
const receiptUrl = ref('')
const openingReceipt = ref(false)
const receipts = ref({})
const receiptInput = ref(null)
let receiptLoad = 0
async function loadReceipts() {
  const current = ++receiptLoad
  try {
    const entries = await Promise.all((ledger.value?.payments || []).map(async payment =>
      [payment.id, (await caseDocumentsApi.receipts(props.caseId, payment.id))[0] || null]))
    if (alive && current === receiptLoad) receipts.value = Object.fromEntries(entries)
  } catch (cause) { if (alive) notifyRequestError(cause, 'No fue posible cargar los comprobantes.') }
}
async function selectReceipt(event) {
  const file = event.target.files?.[0] || null
  formErrors.value.receipt = ''
  if (!file) return
  try {
    receiptPolicy.value = await caseDocumentsApi.policy()
    const error = documentFileError(file, receiptPolicy.value)
    if (error) { formErrors.value.receipt = error; event.target.value = ''; return }
    receipt.value = file
  } catch (cause) { notifyRequestError(cause, 'No fue posible validar el comprobante.') }
}
function removeSelectedReceipt() {
  receipt.value = null
  if (receiptInput.value) receiptInput.value.value = ''
}
function viewSelectedReceipt() {
  closeReceipt()
  receiptUrl.value = URL.createObjectURL(receipt.value)
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function downloadReceipt(payment) {
  if (openingReceipt.value) return
  openingReceipt.value = true
  try {
    const document = receipts.value[payment.id]
    const blob = await caseDocumentsApi.content(props.caseId, document.id, true)
    downloadBlob(blob, document.name)
  } catch (cause) { notifyRequestError(cause, 'No fue posible descargar el comprobante.') }
  finally { openingReceipt.value = false }
}
async function removeReceipt(payment) {
  if (openingReceipt.value) return
  openingReceipt.value = true
  try {
    await caseDocumentsApi.removeReceipt(props.caseId, payment.id, receipts.value[payment.id].id)
    receipts.value[payment.id] = null
    closeReceipt()
    notifications.show('Comprobante eliminado. El abono se conserva.', 'success')
  } catch (cause) { notifyRequestError(cause, 'No fue posible quitar el comprobante.') }
  finally { openingReceipt.value = false }
}
function closeReceipt() {
  if (receiptUrl.value) URL.revokeObjectURL(receiptUrl.value)
  receiptUrl.value = ''
}
async function viewReceipt(payment) {
  if (openingReceipt.value) return
  openingReceipt.value = true
  try {
    const items = await caseDocumentsApi.receipts(props.caseId, payment.id)
    if (!items.length) { notifications.show('Este abono no tiene comprobante adjunto.', 'info'); return }
    const blob = await caseDocumentsApi.content(props.caseId, items[0].id)
    if (!alive) return
    closeReceipt()
    receiptUrl.value = URL.createObjectURL(blob)
  } catch (cause) {
    notifyRequestError(cause, 'No fue posible consultar el comprobante.')
  } finally { openingReceipt.value = false }
}
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const formOpen = ref(false)
const totalOpen = ref(false)
const form = ref(emptyForm())
const formErrors = ref({})
const totalText = ref('')
const totalErrors = ref({})
const annulling = ref(null)
/** Abono a la espera de confirmarse, con la clave que lo identifica. */
let pendingPayment = null
let alive = true

function emptyForm() {
  return {
    amount: '',
    paymentType: 'ABONO',
    paymentMethod: 'EFECTIVO',
    concept: '',
    paymentDate: todayISO(),
    reference: '',
  }
}

const progress = computed(() => paymentProgress(ledger.value))
const barWidth = computed(() => `${progress.value.known ? progress.value.percent : 0}%`)
const pendingWork = computed(() => formOpen.value || totalOpen.value)

watch([pendingWork, saving], () => emit('state', { pending: pendingWork.value, busy: saving.value }))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await casePaymentsApi.ledger(props.caseId)
    if (!alive) return
    applyLedger(result)
    if (totalOpen.value) totalText.value = editableAmount(result.totalAmount)
  } catch (cause) {
    if (alive) error.value = cause.message || 'No fue posible consultar los pagos del expediente.'
  } finally {
    if (alive) loading.value = false
  }
}

function applyLedger(result) {
  ledger.value = result
  loadReceipts()
  emit('ledger', result)
  // El backend incrementa la versión del expediente al pactar el costo; sin esto,
  // guardar las observaciones después daría un conflicto por versión antigua.
  emit('version', result.caseVersion)
}

/** El monto tal como lo acepta el parseo: sin miles y con el separador del teclado. */
function editableAmount(amount) {
  if (amount === null || amount === undefined) return ''
  const [integer, decimals] = String(amount).split('.')
  return decimals ? `${integer}.${decimals.padEnd(2, '0')}` : `${integer}.00`
}

function openPaymentForm() {
  receipt.value = null
  form.value = emptyForm()
  formErrors.value = {}
  pendingPayment = null
  totalOpen.value = false
  formOpen.value = true
}

function openTotalForm() {
  formOpen.value = false
  totalErrors.value = {}
  totalText.value = editableAmount(ledger.value?.totalAmount)
  totalOpen.value = true
}

function closeForms() {
  if (saving.value) return
  formOpen.value = false
  totalOpen.value = false
  pendingPayment = null
}

async function submit() {
  if (saving.value || !props.active) return
  const amount = parseAmount(form.value.amount)
  formErrors.value = paymentFormErrors(form.value, { today: todayISO() })
  if (receipt.value) {
    try { receiptPolicy.value = await caseDocumentsApi.policy() }
    catch (cause) { notifyRequestError(cause, 'No fue posible validar el comprobante.'); return }
    const fileError = documentFileError(receipt.value, receiptPolicy.value)
    if (fileError) formErrors.value.receipt = fileError
  }
  if (amount.error || amount.cents <= 0) {
    formErrors.value.amount = amount.error || 'El monto debe ser mayor que cero.'
  }
  if (Object.keys(formErrors.value).length) return

  const payload = {
    amount: amountToRequest(amount.cents),
    paymentType: form.value.paymentType,
    paymentMethod: form.value.paymentMethod,
    concept: form.value.concept.trim(),
    paymentDate: form.value.paymentDate,
    reference: form.value.reference.trim() || null,
  }
  const signature = JSON.stringify(payload)
  // Una clave por abono. Se reutiliza solo mientras el contenido sea el mismo y
  // no sepamos si entró: así un doble toque o una respuesta perdida no cobran dos
  // veces. Si la abogada corrige algo, es otro abono y necesita otra clave.
  if (!pendingPayment || pendingPayment.signature !== signature) {
    pendingPayment = { signature, requestId: createRequestId(), payload }
  }

  saving.value = true
  try {
    const result = await casePaymentsApi.register(props.caseId, {
      requestId: pendingPayment.requestId, ...pendingPayment.payload,
    })
    if (!alive) return
    const requestId = pendingPayment.requestId
    pendingPayment = null
    applyLedger(result)
    let receiptFailed = false
    if (receipt.value) {
      try { await caseDocumentsApi.uploadReceipt(props.caseId, requestId, receipt.value) }
      catch (cause) {
        receiptFailed = true
        notifyRequestError(cause, 'El abono fue registrado, pero no se pudo guardar el comprobante. No registres el abono nuevamente.')
      }
      await loadReceipts()
    }
    formOpen.value = false
    form.value = emptyForm()
    const hadReceipt = !!receipt.value
    receipt.value = null
    if (!receiptFailed) notifications.show(hadReceipt ? 'Abono registrado y comprobante PDF guardado.' : 'Abono registrado.', 'success')
  } catch (cause) {
    if (!alive) return
    if (retainRequestId(cause)) {
      notifications.show(
        'No se pudo confirmar si el abono quedó registrado. Puedes reintentar con seguridad: no se cobrará dos veces.',
        'warning', 'Reintentar', submit,
      )
    } else {
      // Respuesta definitiva del servidor: la siguiente corrección es otro abono.
      pendingPayment = null
      notifyRequestError(cause, 'No fue posible registrar el abono.')
    }
  } finally {
    if (alive) saving.value = false
  }
}

async function saveTotal() {
  if (saving.value || !props.active) return
  const parsed = parseTotalAmount(totalText.value)
  totalErrors.value = parsed.error ? { totalAmount: parsed.error } : {}
  if (Object.keys(totalErrors.value).length) return

  saving.value = true
  try {
    const result = await casePaymentsApi.setTotalAmount(props.caseId, {
      version: ledger.value.caseVersion,
      totalAmount: amountToRequest(parsed.cents),
    })
    if (!alive) return
    applyLedger(result)
    totalOpen.value = false
    notifications.show('Costo total actualizado.', 'success')
  } catch (cause) {
    if (alive) notifyRequestError(cause, 'No fue posible guardar el costo total.')
  } finally {
    if (alive) saving.value = false
  }
}

async function confirmAnnul() {
  const target = annulling.value
  if (!target || saving.value) return
  saving.value = true
  try {
    const result = await casePaymentsApi.annul(props.caseId, target.id)
    if (!alive) return
    applyLedger(result)
    annulling.value = null
    notifications.show('Abono anulado. El saldo pendiente se actualizó.', 'success')
  } catch (cause) {
    if (alive) notifyRequestError(cause, 'No fue posible anular el abono.', 'Actualizar', load)
  } finally {
    if (alive) saving.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => {
  closeReceipt()
  alive = false
  emit('state', { pending: false, busy: false })
})
</script>

<template>
  <BaseCard class="form-section payments-section">
    <header class="record-heading">
      <div>
        <h2>Pagos y anticipos</h2>
        <p class="help">Anticipos y abonos del cliente, con el saldo pendiente al día.</p>
      </div>
    </header>

    <p v-if="error" role="alert" class="payment-error">
      {{ error }}
      <button type="button" :disabled="loading || saving" @click="load">Reintentar consulta</button>
    </p>
    <p v-if="loading" role="status">Cargando pagos del expediente…</p>

    <template v-if="ledger">
      <dl class="payment-summary">
        <div><dt>Costo total</dt><dd>{{ ledger.totalAgreed ? formatMoney(ledger.totalAmount) : 'Sin pactar' }}</dd></div>
        <div><dt>Abonado</dt><dd>{{ formatMoney(ledger.paidAmount) }}</dd></div>
        <div><dt>Anticipos</dt><dd>{{ formatMoney(ledger.advancesAmount) }}</dd></div>
        <div>
          <dt>Pendiente</dt>
          <dd :class="{ 'payment-overpaid': ledger.overpaid }">
            {{ ledger.totalAgreed ? formatMoney(ledger.pendingAmount) : 'Sin costo pactado' }}
          </dd>
        </div>
      </dl>

      <div class="payment-progress">
        <div class="payment-progress-head">
          <strong>{{ progressSummary(ledger) }}</strong>
          <span v-if="progress.known" class="mono">{{ formatPercent(progress.percent) }}</span>
        </div>
        <div
          class="payment-bar"
          role="progressbar"
          :aria-valuenow="progress.known ? progress.percent : undefined"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="progressSummary(ledger)"
        >
          <span :style="{ width: barWidth }"></span>
        </div>
      </div>

      <p v-if="!active" class="help">Este expediente está inactivo. Puedes consultar sus pagos, pero no registrar abonos.</p>
      <div class="actions">
        <BaseButton v-if="active" :disabled="saving" @click="openPaymentForm">Registrar abono</BaseButton>
        <BaseButton v-if="active" variant="outline" :disabled="saving" @click="openTotalForm">
          {{ ledger.totalAgreed ? 'Editar costo total' : 'Definir costo total' }}
        </BaseButton>
        <BaseButton variant="outline" :disabled="loading || saving" @click="load"
          title="Recargar pagos y anticipos" aria-label="Recargar pagos y anticipos">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 7v5h-5" />
            <path d="M20 12a8 8 0 1 0-2.34 5.66M20 7l-2.34-2.66" />
          </svg>
        </BaseButton>
      </div>

      <form v-if="totalOpen && active" novalidate class="payment-form" @submit.prevent="saveTotal">
        <label for="payment-total">Costo total pactado (Q)
          <input
            id="payment-total"
            v-model="totalText"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="10000.00"
            :aria-invalid="!!totalErrors.totalAmount"
            :aria-describedby="totalErrors.totalAmount ? 'payment-total-error' : undefined"
          />
        </label>
        <p v-if="totalErrors.totalAmount" id="payment-total-error" role="alert" class="payment-error">
          {{ totalErrors.totalAmount }}
        </p>
        <p class="help">Déjalo vacío si el costo todavía no está pactado. Sin costo total no hay avance en porcentaje.</p>
        <div class="actions">
          <BaseButton type="submit" :loading="saving">Guardar costo total</BaseButton>
          <BaseButton variant="outline" :disabled="saving" @click="closeForms">Cancelar</BaseButton>
        </div>
      </form>

      <form v-if="formOpen && active" novalidate class="payment-form" @submit.prevent="submit">
        <label for="payment-amount">Monto del abono (Q)
          <input
            id="payment-amount"
            v-model="form.amount"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="5000.00"
            :aria-invalid="!!formErrors.amount"
            :aria-describedby="formErrors.amount ? 'payment-amount-error' : undefined"
          />
        </label>
        <p v-if="formErrors.amount" id="payment-amount-error" role="alert" class="payment-error">
          {{ formErrors.amount }}
        </p>

        <div class="payment-form-row">
          <label for="payment-type">Tipo de abono
            <select id="payment-type" v-model="form.paymentType">
              <option v-for="option in PAYMENT_TYPES" :key="option" :value="option">
                {{ PAYMENT_TYPE_LABELS[option] }}
              </option>
            </select>
          </label>
          <label for="payment-method">Forma de pago
            <select id="payment-method" v-model="form.paymentMethod">
              <option v-for="option in PAYMENT_METHODS" :key="option" :value="option">
                {{ PAYMENT_METHOD_LABELS[option] }}
              </option>
            </select>
          </label>
        </div>

        <label for="payment-concept">Concepto
          <input
            id="payment-concept"
            v-model="form.concept"
            type="text"
            maxlength="120"
            placeholder="50% inicial"
            :aria-invalid="!!formErrors.concept"
            :aria-describedby="formErrors.concept ? 'payment-concept-error' : undefined"
          />
        </label>
        <p v-if="formErrors.concept" id="payment-concept-error" role="alert" class="payment-error">
          {{ formErrors.concept }}
        </p>

        <div class="payment-form-row">
          <label for="payment-date">Fecha del pago
            <input
              id="payment-date"
              v-model="form.paymentDate"
              type="date"
              :max="todayISO()"
              :aria-invalid="!!formErrors.paymentDate"
              :aria-describedby="formErrors.paymentDate ? 'payment-date-error' : undefined"
            />
          </label>
          <label for="payment-receipt">Comprobante PDF (opcional)
            <input
              id="payment-receipt"
              ref="receiptInput"
              type="file"
              accept=".pdf,application/pdf"
              :disabled="saving || !!receipt"
              @change="selectReceipt"
              :aria-invalid="!!formErrors.receipt"
              :aria-describedby="formErrors.receipt ? 'payment-receipt-error' : undefined"
            />
          </label>
        </div>
        <PaymentReceiptRow v-if="receipt" :name="receipt.name" :disabled="saving"
          @view="viewSelectedReceipt" @remove="removeSelectedReceipt" @download="downloadBlob(receipt, receipt.name)" />
        <p v-if="formErrors.paymentDate" id="payment-date-error" role="alert" class="payment-error">
          {{ formErrors.paymentDate }}
        </p>
        <p v-if="formErrors.receipt" id="payment-receipt-error" role="alert" class="payment-error">
          {{ formErrors.receipt }}
        </p>

        <div class="actions">
          <BaseButton type="submit" :loading="saving">Registrar abono</BaseButton>
          <BaseButton variant="outline" :disabled="saving" @click="closeForms">Cancelar</BaseButton>
        </div>
      </form>

      <p v-if="!ledger.payments.length" class="muted">Todavía no hay abonos registrados en este expediente.</p>
      <ol v-else class="payment-list" aria-label="Abonos del expediente">
        <li v-for="payment in ledger.payments" :key="payment.id" :class="{ 'is-annulled': !payment.active }">
          <div class="payment-row">
            <div class="payment-amount">
              <strong>{{ formatMoney(payment.amount) }}</strong>
              <span class="meta">{{ formatPaymentDate(payment.paymentDate) }}</span>
            </div>
            <div class="payment-detail">
              <span>{{ payment.concept }}</span>
              <div class="payment-tags">
                <BaseBadge :variant="payment.paymentType === 'ANTICIPO' ? 'teal' : 'neutral'">
                  {{ paymentTypeLabel(payment.paymentType) }}
                </BaseBadge>
                <BaseBadge variant="neutral">{{ paymentMethodLabel(payment.paymentMethod) }}</BaseBadge>
                <BaseBadge v-if="!payment.active" variant="soft-coral">Anulado</BaseBadge>
              </div>
              <span v-if="payment.reference" class="mono">Ref. {{ payment.reference }}</span>
              <span class="meta">Registrado por {{ payment.registeredBy }}</span>
              <PaymentReceiptRow v-if="receipts[payment.id]" :name="receipts[payment.id].name" saved
                :disabled="openingReceipt || saving || !active" @view="viewReceipt(payment)"
                @remove="removeReceipt(payment)" @download="downloadReceipt(payment)" />
            </div>
            <BaseButton
              v-if="payment.active && active"
              variant="outline"
              size="sm"
              :disabled="saving"
              :aria-label="`Anular el abono de ${formatMoney(payment.amount)}: ${payment.concept}`"
              @click="annulling = payment"
            >
              Anular
            </BaseButton>
          </div>
        </li>
      </ol>
    </template>
  </BaseCard>

  <BaseModal :open="!!receiptUrl" title-id="payment-receipt-title" @close="closeReceipt">
    <div style="padding: 1rem;">
      <h2 id="payment-receipt-title">Comprobante de pago</h2>
      <iframe v-if="receiptUrl" :src="receiptUrl" title="Comprobante PDF" style="width: 100%; height: 70vh; border: 0;"></iframe>
      <BaseButton variant="outline" @click="closeReceipt">Cerrar</BaseButton>
    </div>
  </BaseModal>
  <BaseModal :open="!!annulling" title-id="annul-payment-title" @close="annulling = null">
    <div v-if="annulling" class="confirm-content">
      <h2 id="annul-payment-title">Anular abono</h2>
      <p>
        Se anulará el abono de <strong>{{ formatMoney(annulling.amount) }}</strong>
        («{{ annulling.concept }}»). El registro se conserva para auditoría, pero dejará de contar
        en el saldo pendiente.
      </p>
      <div class="actions">
        <BaseButton variant="outline" :disabled="saving" @click="annulling = null">Conservar abono</BaseButton>
        <BaseButton :loading="saving" @click="confirmAnnul">Anular abono</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

<style src="../../../shared/styles/office.css" scoped></style>
<style scoped>
.payment-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; margin: 0; }
.payment-summary > div { display: grid; gap: .25rem; padding: .85rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); background: var(--color-bg-subtle); }
.payment-summary dt { color: var(--color-text-muted); font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
.payment-summary dd { margin: 0; font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.payment-overpaid { color: var(--color-warning-strong); }
.payment-progress { display: grid; gap: .5rem; }
.payment-progress-head { display: flex; flex-wrap: wrap; gap: .5rem; align-items: baseline; justify-content: space-between; }
.payment-progress-head strong { min-width: 0; }
.payment-bar { height: 12px; overflow: hidden; border-radius: var(--radius-full); background: var(--color-teal-soft); border: 1px solid var(--color-border-subtle); }
.payment-bar span { display: block; height: 100%; border-radius: inherit; background: var(--color-primary); transition: width var(--transition-normal); }
.payment-form { display: grid; gap: .9rem; padding: 1rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); }
.payment-form-row { display: grid; gap: .9rem; }
.payment-list { display: grid; gap: .7rem; list-style: none; padding: 0; margin: 0; }
.payment-list li { padding: .9rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); }
.payment-list li.is-annulled { opacity: .72; border-style: dashed; }
.payment-list li.is-annulled .payment-amount strong { text-decoration: line-through; }
.payment-row { display: grid; gap: .6rem; }
.payment-amount { display: flex; flex-wrap: wrap; gap: .5rem; align-items: baseline; justify-content: space-between; font-variant-numeric: tabular-nums; }
.payment-detail { display: grid; gap: .35rem; min-width: 0; overflow-wrap: anywhere; }
.payment-tags { display: flex; flex-wrap: wrap; gap: .4rem; }
.payment-error { color: var(--color-danger-strong); overflow-wrap: anywhere; }
.payment-error button { margin-left: .35rem; text-decoration: underline; }
@media (min-width: 640px) {
  .payment-summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .payment-form-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .payment-row { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
}
</style>
