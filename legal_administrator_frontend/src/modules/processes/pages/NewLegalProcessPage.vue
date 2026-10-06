<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useLegalProcessStore } from '../stores/legalProcessStore.js'
import { useClientStore } from '@/modules/users/stores/clientStore.js'
import { emptyClient, clientPayload, validateClient, completeClient } from '@/modules/users/domain/clientForm.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { useLeaveConfirmation } from '@/shared/forms/useLeaveConfirmation.js'
import ClientSelector from '@/modules/users/components/ClientSelector.vue'
import ClientFormFields from '@/modules/users/components/ClientFormFields.vue'
import PublishedTemplateSelector from '../components/PublishedTemplateSelector.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import LeaveConfirmation from '@/components/common/LeaveConfirmation.vue'
import { casePaymentsApi } from '../services/casePaymentsApi.js'
import { caseDocumentsApi } from '../services/caseDocumentsApi.js'
import { parseAmount, todayISO } from '../domain/paymentLedger.js'

const route = useRoute()
const router = useRouter()
const cases = useLegalProcessStore()
const clients = useClientStore()
const notifications = useNotificationStore()
const mode = ref('existing')
const existingClient = ref(null)
const newClient = ref(emptyClient())
const template = ref(null)
const templateLoading = ref(false)
const generalDetails = ref('')
const payment = ref({
  totalAmountText: '',
  amountText: '',
  paymentType: 'ANTICIPO',
  paymentMethod: 'EFECTIVO',
  concept: '',
  paymentDate: todayISO(),
  reference: ''
})
const receiptFile = ref(null)
const hasInitialPayment = ref(false)
const errors = ref({})
const fields = ref(null)
const templateSelector = ref(null)
const initialLoading = ref(Boolean(route.query.clientDpi))
const baseline = ref('')
const form = ref(null)
let alive = true
const frozen = computed(() => cases.creating || cases.uncertain)
function capture() {
  return JSON.stringify({ mode: mode.value, clientDpi: existingClient.value?.dpi || '',
    newClient: newClient.value, templateId: template.value?.id || '', notes: generalDetails.value })
}
const dirty = computed(() => !initialLoading.value && (cases.uncertain || baseline.value !== capture()))
const busy = computed(() => cases.creating)
const leave = useLeaveConfirmation(dirty, busy)
const submitLabel = computed(() => {
  if (cases.uncertain) return 'Reintentar guardado'
  if (cases.draftId) return 'Continuar apertura'
  return 'Crear expediente'
})
function modeVariant(value) {
  if (mode.value === value) return 'primary'
  return 'outline'
}
async function loadCatalogs() {
  try { await clients.loadCatalogs() }
  catch (error) { if (alive) notifyRequestError(error, 'No fue posible cargar los catálogos.', 'Reintentar', loadCatalogs) }
}
async function changeMode(value) {
  if (frozen.value) return
  mode.value = value
  errors.value = {}
  if (value === 'new') await loadCatalogs()
}
async function submit() {
  if (cases.creating) return
  let payload = null
  if (!cases.uncertain) {
    errors.value = {}
    if (!template.value || templateLoading.value) {
      notifications.show('Selecciona un trámite publicado y espera a que carguen sus requisitos.', 'warning')
      form.value?.querySelector('#case-template')?.focus()
      return
    }
    payload = { processTypeId: template.value.id, processTypeVersion: template.value.version,
      generalDetails: generalDetails.value.trim() || null }
    const pAmount = parseAmount(payment.value.amountText)
    if (payment.value.amountText.trim()) {
      if (pAmount.error || pAmount.cents <= 0) {
        notifications.show('Revisa el monto del abono: ' + (pAmount.error || 'Debe ser mayor a cero.'), 'warning')
        return
      }
      payload.initialPayment = {
        amount: pAmount.cents / 100,
        paymentType: payment.value.paymentType,
        paymentMethod: payment.value.paymentMethod,
        concept: payment.value.concept.trim() || 'Abono al abrir expediente',
        paymentDate: payment.value.paymentDate,
        reference: payment.value.reference.trim() || null
      }
    }
    const pTotal = parseAmount(payment.value.totalAmountText)
    if (payment.value.totalAmountText.trim() && !pTotal.error && pTotal.cents >= 0) {
      // opcional: el backend no lo guarda al crear; pero podemos registrar tras crear
    }
    if (generalDetails.value.length > 5000) {
      notifications.show('Las observaciones admiten hasta 5000 caracteres.', 'warning')
      return
    }
    if (mode.value === 'new') {
      errors.value = validateClient(newClient.value)
      if (Object.keys(errors.value).length) {
        notifications.show(Object.values(errors.value).join(' · '), 'warning')
        await nextTick()
        fields.value?.focusInvalid()
        return
      }
      payload.client = clientPayload(newClient.value)
    } else {
      if (!existingClient.value?.active || !completeClient(existingClient.value)) {
        notifications.show('Selecciona un cliente activo con nacionalidad, estado civil y dirección completos.', 'warning', 'Completar datos', async () => {
          if (existingClient.value?.dpi) {
            try {
              existingClient.value = await clients.get(existingClient.value.dpi)
            } catch (refreshError) {
              notifyRequestError(refreshError, 'No fue posible actualizar el cliente.')
            }
          }
        })
        form.value?.querySelector('#case-client-query')?.focus()
        return
      }
      payload.clientDpi = existingClient.value.dpi
    }
  }
  try {
    const detail = await cases.open(payload)
    if (!alive || !detail) return
    // costo total opcional
    try {
      const pTotal = parseAmount(payment.value.totalAmountText)
      if (payment.value.totalAmountText.trim() && !pTotal.error && pTotal.cents >= 0) {
        await casePaymentsApi.setTotalAmount(detail.caseData.id, { version: detail.caseData.version, totalAmount: pTotal.cents / 100 })
      }
    } catch (e) { /* no bloquea creación */ }
    // comprobante opcional
    if (receiptFile.value && detail.caseData.id) {
      try { await caseDocumentsApi.upload(detail.caseData.id, receiptFile.value) } catch (e) {}
    }
    notifications.show('Expediente ' + detail.caseData.caseCode + ' registrado correctamente.', 'success')
    // Reset dirty state before navigation to avoid leave confirmation
    baseline.value = capture()
    await router.replace({ name: 'legal-processes' })
  } catch (error) {
    if (!alive) return
    if (cases.uncertain) {
      notifications.show('No se confirmó el guardado. Reintenta esta misma solicitud; el sistema evitará duplicar el expediente.',
        'warning', 'Reintentar guardado', submit)
      return
    }
    const details = error?.data?.details || {}
    for (const [name, message] of Object.entries(details)) errors.value[name.replace(/^client\./, '')] = message
    let label = ''
    let action = null
    if (error?.status === 409) {
      label = 'Actualizar selección'
      action = async () => {
        await templateSelector.value?.refreshSelection()
        if (existingClient.value) {
          try { existingClient.value = await clients.get(existingClient.value.dpi) }
          catch (refreshError) { notifyRequestError(refreshError, 'No fue posible actualizar el cliente.') }
        }
      }
    }
    notifyRequestError(error, 'No fue posible abrir el expediente.', label, action)
    await nextTick()
    fields.value?.focusInvalid()
  }
}
onMounted(async () => {
  cases.resetRegistration()
  try {
    if (typeof route.query.clientDpi === 'string' && route.query.clientDpi) {
      existingClient.value = await clients.get(route.query.clientDpi)
    }
  } catch (error) {
    if (alive) notifyRequestError(error, 'No fue posible seleccionar el cliente.')
  } finally {
    if (alive) {
      initialLoading.value = false
      baseline.value = capture()
    }
  }
})
onBeforeUnmount(() => {
  alive = false
  cases.resetRegistration()
})
</script>
<template>
  <div class="office-page">
    <PageHeader eyebrow="Gestión jurídica" title="Abrir expediente"
      subtitle="Elige el cliente y el trámite legal para reunir su información y requisitos.">
      <template #actions><RouterLink class="link-button" :to="{ name: 'legal-processes' }">Volver a expedientes</RouterLink></template>
    </PageHeader>
    <LoadingCards v-if="initialLoading" label="Consultando el cliente" />
    <form v-else ref="form" class="form-stack" novalidate @submit.prevent="submit">
      <BaseCard class="form-section">
        <header><h2>1. Cliente</h2><p class="help">Puedes usar un registro existente o crear uno junto con este expediente.</p></header>
        <div class="actions" role="group" aria-label="Origen del cliente">
          <BaseButton :variant="modeVariant('existing')" :aria-pressed="mode === 'existing'" :disabled="frozen" @click="changeMode('existing')">Cliente existente</BaseButton>
          <BaseButton :variant="modeVariant('new')" :aria-pressed="mode === 'new'" :disabled="frozen" @click="changeMode('new')">Cliente nuevo</BaseButton>
        </div>
        <ClientSelector v-if="mode === 'existing'" v-model="existingClient" :disabled="frozen" />
        <LoadingCards v-else-if="clients.catalogsLoading" :count="1" label="Cargando datos personales" />
        <ClientFormFields v-else-if="clients.catalogsReady" ref="fields" v-model="newClient" prefix="new-case-client"
          :countries="clients.countries" :marital-statuses="clients.maritalStatuses" :municipalities="clients.municipalities"
          :disabled="frozen" :errors="errors" />
        <BaseButton v-else variant="outline" :disabled="frozen" @click="loadCatalogs">Cargar formulario del cliente</BaseButton>
      </BaseCard>
      <BaseCard class="form-section">
        <header><h2>2. Trámite legal</h2><p class="help">Los requisitos de esta configuración se conservarán en el expediente.</p></header>
        <PublishedTemplateSelector ref="templateSelector" v-model="template" :disabled="frozen" @loading="templateLoading = $event" />
      </BaseCard>
      <BaseCard class="form-section">
        <header><h2>3. Observaciones</h2><p class="help">Añade información adicional si el caso lo necesita.</p></header>
        <label for="case-notes">Observaciones del expediente
          <textarea id="case-notes" v-model="generalDetails" :disabled="frozen" maxlength="5000" rows="4" placeholder="Detalles relevantes para el despacho"></textarea>
        </label>
        <span class="meta">{{ generalDetails.length }} / 5000 caracteres</span>
      </BaseCard>
      <BaseCard class="form-section">
        <header><h2>4. Pagos (opcional)</h2><p class="help">Registra costo total y un anticipo/abono al crear el expediente.</p></header>
        <label for="payment-total">Costo total pactado (Q)
          <input id="payment-total" v-model="payment.totalAmountText" type="text" inputmode="decimal" autocomplete="off" placeholder="10000.00" />
        </label>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem;">
          <input id="has-initial-payment" v-model="hasInitialPayment" type="checkbox" style="width: 16px; height: 16px; margin: 0; cursor: pointer;" />
          <label for="has-initial-payment" style="margin: 0; cursor: pointer; font-weight: 600;">El cliente realizará un abono / anticipo ahora</label>
        </div>
        <template v-if="hasInitialPayment">
          <div class="payment-form-row">
            <label for="payment-amount">Monto del abono (Q)
              <input id="payment-amount" v-model="payment.amountText" type="text" inputmode="decimal" autocomplete="off" placeholder="5000.00" />
            </label>
            <label for="payment-type">Tipo
              <select id="payment-type" v-model="payment.paymentType">
                <option value="ANTICIPO">Anticipo</option>
                <option value="ABONO">Abono</option>
                <option value="PAGO_FINAL">Pago final</option>
              </select>
            </label>
            <label for="payment-method">Forma de pago
              <select id="payment-method" v-model="payment.paymentMethod">
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTRO">Otro</option>
              </select>
            </label>
          </div>
          <label for="payment-concept">Concepto
            <input id="payment-concept" v-model="payment.concept" type="text" maxlength="120" placeholder="50% inicial" />
          </label>
          <div class="payment-form-row">
            <label for="payment-date">Fecha del pago
              <input id="payment-date" v-model="payment.paymentDate" type="date" :max="todayISO()" />
            </label>
            <label for="payment-reference">Referencia (opcional)
              <input id="payment-reference" v-model="payment.reference" type="text" maxlength="60" placeholder="Recibo o transferencia" />
            </label>
          </div>
          <label for="payment-receipt">Comprobante de pago (opcional)
            <input id="payment-receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" @change="onReceiptChange" />
          </label>
        </template>
      </BaseCard>
      <div class="form-actions">
        <RouterLink class="link-button" :to="{ name: 'legal-processes' }">Volver al listado</RouterLink>
        <BaseButton type="submit" :loading="cases.creating" :disabled="templateLoading || (mode === 'new' && !clients.catalogsReady)">
          {{ submitLabel }}
        </BaseButton>
      </div>
    </form>
    <LeaveConfirmation :open="leave.open.value" :uncertain="cases.uncertain" @decide="leave.decide" />
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
