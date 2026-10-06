<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore.js'
import { useCashStore } from '../stores/cashStore.js'
import { useFinancialSubmissionStore } from '@/shared/finance/financialSubmissionStore.js'
import { useDirectorySearch } from '@/shared/lists/useDirectorySearch.js'
import { useLeaveConfirmation } from '@/shared/forms/useLeaveConfirmation.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { CASH_CATEGORIES, emptyCashForm, todayInGuatemala, formatCashMoney, categoryName } from '../domain/cashForm.js'
import { cashApi } from '../services/cashApi.js'
import { formatPaymentDate, PAYMENT_METHOD_LABELS } from '../../processes/domain/paymentLedger.js'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import LeaveConfirmation from '@/components/common/LeaveConfirmation.vue'
import CashMovementForm from '../components/CashMovementForm.vue'

let alive = true
onBeforeUnmount(() => { alive = false })
const auth = useAuthStore()
const cash = useCashStore()
const submission = useFinancialSubmissionStore()
const notifications = useNotificationStore()
const today = todayInGuatemala()
const filters = reactive({ from: today.slice(0, 8) + '01', to: today, category: '', paymentMethod: '', status: 'ACTIVE', q: '', page: 0, size: 25 })
const { refresh } = useDirectorySearch(filters, cash)
const formOpen = ref(false)
const formKey = ref(0)
const initial = ref(emptyCashForm())
const annulTarget = ref(null)
const annulReason = ref('')
const annulling = ref(false)
const annulUncertain = ref(false)
const hasPending = computed(() => {
  if (!submission.pending || !auth.user?.dpi) return false
  return submission.pending.actor === auth.user.dpi
})
const pendingCash = computed(() => hasPending.value && submission.pending.endpoint.startsWith('/cash/'))
const pendingCaseId = computed(() => {
  if (!hasPending.value) return null
  const match = submission.pending?.endpoint.match(/^\/legal-processes\/(\d+)\/payments$/)
  if (match) return match[1]
  return null
})
const workPending = computed(() => formOpen.value || !!annulTarget.value || hasPending.value)
const busy = computed(() => submission.busy || annulling.value || annulUncertain.value)
const leave = useLeaveConfirmation(workPending, busy)
const metrics = computed(() => {
  const summary = cash.summary
  if (!summary) return []
  return [
    { label: 'Ingresos por trámites', value: summary.income, note: 'Dinero recibido' },
    { label: 'Útiles de oficina', value: summary.officeExpenses, note: 'Gastos del período' },
    { label: 'Gastos personales', value: summary.personalExpenses, note: 'Privados de tu cuenta' },
    { label: 'Balance de oficina', value: summary.officeBalance, note: 'Ingresos menos útiles' },
    { label: 'Balance general', value: summary.generalBalance, note: 'Después de ambos gastos', highlighted: true },
  ]
})
async function confirmAccount() {
  if (auth.isProfileLoading || !auth.isAuthenticated) return
  try {
    await auth.loadCurrentUser()
  } catch (error) {
    if (alive) notifyRequestError(error, 'No fue posible confirmar tu cuenta.', 'Reintentar', confirmAccount)
  }
}
function openForm() {
  if (!auth.user?.dpi) {
    notifications.show('Espera a que se confirme la cuenta antes de registrar movimientos.', 'warning')
    return
  }
  if (hasPending.value && !pendingCash.value) {
    notifications.show('Confirma el abono pendiente desde su expediente antes de registrar otro movimiento.', 'warning')
    return
  }
  initial.value = emptyCashForm()
  if (pendingCash.value) {
    const payload = submission.pending.payload
    let category = payload.category
    if (submission.pending.endpoint === '/cash/incomes') category = 'TRAMITES'
    initial.value = { ...emptyCashForm(category), ...payload }
  }
  formKey.value += 1
  formOpen.value = true
}
async function register(input) {
  let endpoint = submission.pending?.endpoint
  let payload = null
  if (input) {
    payload = input.payload
    endpoint = '/cash/expenses'
    if (input.category === 'TRAMITES') endpoint = '/cash/incomes'
  }
  try {
    const result = await submission.send(endpoint, payload, auth.user?.dpi)
    if (!result) return
    formOpen.value = false
    notifications.show('Movimiento registrado correctamente.', 'success')
    await refresh()
  } catch (error) {
    if (submission.uncertain) {
      notifications.show('El servidor no confirmó el resultado. Reintenta el mismo registro antes de crear otro.', 'warning', 'Reintentar', () => register(null))
    } else notifyRequestError(error, 'No fue posible registrar el movimiento.')
  }
}
function openAnnul(item) { annulTarget.value = item; annulReason.value = ''; annulUncertain.value = false }
function closeAnnul() {
  if (annulling.value) return
  if (annulUncertain.value) { notifications.show('Reintenta la anulación para confirmar el resultado.', 'warning'); return }
  annulTarget.value = null
}
async function annul() {
  if (annulling.value) return
  if (!annulReason.value.trim()) { notifications.show('Escribe el motivo de anulación.', 'warning'); return }
  annulling.value = true
  try {
    await cashApi.annul(annulTarget.value, annulReason.value)
    if (!alive) return
    annulTarget.value = null
    annulUncertain.value = false
    notifications.show('Movimiento anulado. Se conserva su historial.', 'success')
    await refresh()
  } catch (error) {
    if (!alive) return
    if (error?.status === 0 || error?.status >= 500 || (error?.status >= 200 && error?.status < 300)) {
      annulUncertain.value = true
      notifications.show('No se confirmó la anulación. Reintenta con el mismo motivo.', 'warning', 'Reintentar', annul)
    } else {
      annulUncertain.value = false
      notifyRequestError(error, 'No fue posible anular el movimiento.', 'Actualizar', refresh)
    }
  } finally { annulling.value = false }
}
</script>
<template>
  <div class="office-page cash-page">
    <PageHeader eyebrow="Control financiero" title="Caja"
      subtitle="Consulta tus cobros y registra gastos de oficina o personales en un solo lugar.">
      <template #actions><BaseButton variant="outline" :loading="cash.loading" :disabled="busy" @click="refresh">Actualizar</BaseButton>
        <BaseButton v-if="auth.profileError && !auth.user?.dpi" variant="outline" :loading="auth.isProfileLoading" :disabled="busy" @click="confirmAccount">Reintentar cargar cuenta</BaseButton>
        <BaseButton :loading="auth.isProfileLoading" :disabled="busy || hasPending || !auth.user?.dpi" @click="openForm">Registrar movimiento</BaseButton></template>
    </PageHeader>
    <BaseCard v-if="hasPending" class="pending-card">
      <h2>Hay un registro pendiente de confirmar</h2>
      <p class="muted">Conservamos la misma solicitud para comprobar el resultado sin duplicarla.</p>
      <BaseButton v-if="pendingCash" :disabled="submission.busy" @click="openForm">Resolver registro pendiente</BaseButton>
      <RouterLink v-else-if="pendingCaseId" class="link-button" :to="{ name: 'legal-process-detail', params: { id: pendingCaseId } }">Ir al expediente pendiente</RouterLink>
    </BaseCard>
    <div class="cash-filters">
      <label for="cash-from">Desde <input id="cash-from" v-model="filters.from" type="date" :max="filters.to" /></label>
      <label for="cash-to">Hasta <input id="cash-to" v-model="filters.to" type="date" :min="filters.from" /></label>
      <label for="cash-filter-category">Categoría <select id="cash-filter-category" v-model="filters.category"><option value="">Todas</option>
        <option v-for="item in CASH_CATEGORIES" :key="item.code" :value="item.code">{{ item.name }}</option></select></label>
      <label for="cash-filter-method">Forma de pago <select id="cash-filter-method" v-model="filters.paymentMethod"><option value="">Todas</option>
        <option v-for="(label, code) in PAYMENT_METHOD_LABELS" :key="code" :value="code">{{ label }}</option></select></label>
      <label for="cash-search">Buscar movimiento <input id="cash-search" v-model="filters.q" type="search" maxlength="100" placeholder="Descripción, expediente o referencia" /></label>
      <label for="cash-filter-state">Estado <select id="cash-filter-state" v-model="filters.status"><option value="ACTIVE">Vigentes</option><option value="ALL">Todos, incluidos anulados</option><option value="ANNULLED">Solo anulados</option></select></label>
    </div>
    <LoadingCards v-if="cash.loading" label="Cargando movimientos y balance" :count="3" />
    <BaseCard v-else-if="cash.failed" class="empty-state"><h2>Información pendiente de cargar</h2><BaseButton @click="refresh">Reintentar</BaseButton></BaseCard>
    <div v-else>
      <div class="summary-grid" aria-label="Resumen del período">
        <BaseCard v-for="metric in metrics" :key="metric.label" class="metric-card" :class="{ highlighted: metric.highlighted }">
          <p class="metric-label">{{ metric.label }}</p><strong class="metric-value">{{ formatCashMoney(metric.value) }}</strong><p class="meta">{{ metric.note }}</p>
        </BaseCard>
      </div>
      <p class="balance-note">Totales del período y filtros seleccionados. Los anulados aportan Q 0.00. El balance del período incluye transferencias y otros medios; no representa el efectivo físico disponible.</p>
      <div class="section-heading"><h2 id="cash-movements-title">Movimientos</h2><span class="meta">{{ cash.totalElements }} registros · 25 por página</span></div>
      <BaseCard v-if="!cash.items.length" class="empty-state"><h2>No hay movimientos en esta selección</h2><p class="muted">Ajusta las fechas o registra el primer cobro o gasto.</p></BaseCard>
      <div v-else class="movement-list">
        <p id="cash-table-help" class="table-help">Desplázate horizontalmente para consultar todas las columnas.</p>
        <div class="table-scroll" role="region" aria-labelledby="cash-movements-title" aria-describedby="cash-table-help" tabindex="0">
          <table class="movement-table">
            <caption class="visually-hidden">Movimientos de Caja</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Categoría</th>
                <th scope="col">Descripción</th>
                <th scope="col" class="amount-column">Monto</th>
                <th scope="col">Forma de pago</th>
                <th scope="col">Estado</th>
                <th scope="col">Expediente</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in cash.items" :key="item.source + ':' + item.sourceId">
                <td class="date-column">{{ formatPaymentDate(item.date) }}</td>
                <td><span>{{ categoryName(item.category) }}</span><span class="cell-detail">{{ item.direction }}</span></td>
                <td class="description-column">
                  <p class="movement-description">{{ item.description }}</p>
                  <p v-if="item.reference" class="cell-detail">Referencia: {{ item.reference }}</p>
                  <p v-if="item.annulReason" class="cell-detail">Motivo de anulación: {{ item.annulReason }}</p>
                </td>
                <td class="amount-column movement-amount">{{ formatCashMoney(item.amount) }}</td>
                <td>{{ PAYMENT_METHOD_LABELS[item.paymentMethod] }}</td>
                <td><BaseBadge v-if="!item.active" variant="neutral">Anulado</BaseBadge><BaseBadge v-else variant="teal">Vigente</BaseBadge></td>
                <td><RouterLink v-if="item.caseId" class="link-button case-link" :to="{ name: 'legal-process-detail', params: { id: item.caseId } }">{{ item.caseCode }}</RouterLink><span v-else class="cell-detail">No aplica</span></td>
                <td><BaseButton v-if="item.active" variant="outline" :disabled="busy || hasPending || !auth.user?.dpi" @click="openAnnul(item)">Anular</BaseButton><span v-else class="cell-detail">Sin acciones</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <ListPagination :page="filters.page" :total-pages="cash.totalPages" :total-elements="cash.totalElements" :loading="cash.loading" @change="filters.page = $event" />
    </div>
    <BaseModal :open="formOpen" :dismissible="!submission.busy" title-id="cash-form-title" @close="formOpen = false">
      <CashMovementForm :key="formKey" :initial="initial" :busy="submission.busy" :locked="pendingCash" @submit="register" @cancel="formOpen = false" />
    </BaseModal>
    <BaseModal :open="!!annulTarget" :dismissible="!annulling && !annulUncertain" title-id="cash-annul-title" @close="closeAnnul">
      <div class="confirm-content"><h2 id="cash-annul-title">Anular movimiento</h2>
        <p>{{ formatCashMoney(annulTarget?.amount) }} · {{ annulTarget?.description }}</p>
        <p class="muted">Úsalo para corregir un registro equivocado. La anulación conserva su historial y no representa una devolución real de dinero.</p>
        <label for="cash-annul-reason">Motivo obligatorio <textarea id="cash-annul-reason" v-model="annulReason" rows="3" maxlength="500" :disabled="annulling || annulUncertain"></textarea></label>
        <div class="actions"><BaseButton variant="outline" :disabled="annulling || annulUncertain" @click="closeAnnul">Cancelar</BaseButton>
          <BaseButton :loading="annulling" @click="annul"><span v-if="annulUncertain">Reintentar anulación</span><span v-else>Confirmar anulación</span></BaseButton></div>
      </div>
    </BaseModal>
    <LeaveConfirmation :open="leave.open.value" :uncertain="submission.uncertain || annulUncertain" @decide="leave.decide" />
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
<style scoped>
.cash-filters { display: grid; grid-template-columns: minmax(0, 1fr); gap: .8rem; padding: 1rem; margin-bottom: 1.25rem; background: var(--color-bg-subtle); border-radius: var(--radius-md); }
.summary-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: .85rem; }
.metric-card { min-width: 0; } .metric-card :deep(.card-body) { display: grid; gap: .65rem; }
.metric-label { color: var(--color-text-muted); font-size: .85rem; } .metric-value { color: var(--color-text-title); font-size: clamp(1.1rem, 2vw, 1.45rem); font-family: var(--font-mono); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.highlighted { border-color: var(--color-teal-strong) !important; background: var(--color-primary-subtle); }
.balance-note { color: var(--color-text-muted); font-size: .875rem; margin: .9rem 0 1.4rem; }
.section-heading { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: space-between; margin-bottom: .8rem; }
.movement-list { min-width: 0; }
.table-help { color: var(--color-text-muted); font-size: .875rem; margin-bottom: .6rem; }
.table-scroll { max-width: 100%; overflow-x: auto; border: 1px solid var(--color-border-control); border-radius: var(--radius-md); background: var(--color-bg-card); }
.table-scroll:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.movement-table { width: 100%; min-width: 1080px; border-collapse: collapse; font-size: .9rem; text-align: left; }
.movement-table th { padding: .9rem 1rem; background: var(--color-bg-subtle); color: var(--color-text-title); font-weight: 650; white-space: nowrap; }
.movement-table td { padding: .85rem 1rem; border-top: 1px solid var(--color-border-subtle); vertical-align: top; }
.movement-table tbody tr:hover { background: var(--color-primary-subtle); }
.movement-table tbody tr:focus-within { background: var(--color-primary-subtle); }
.date-column { white-space: nowrap; }
.description-column { min-width: 240px; max-width: 360px; }
.amount-column { text-align: right; white-space: nowrap; }
.movement-amount { font-family: var(--font-mono); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-text-title); }
.movement-description { color: var(--color-text-title); overflow-wrap: anywhere; white-space: pre-line; }
.cell-detail { display: block; color: var(--color-text-muted); font-size: .85rem; overflow-wrap: anywhere; }
.case-link { white-space: nowrap; }
.pending-card { margin-bottom: 1rem; } .pending-card :deep(.card-body) { display: grid; gap: .7rem; }
@media (min-width: 640px) { .cash-filters, .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1000px) { .cash-filters { grid-template-columns: repeat(3, minmax(0, 1fr)); } .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1280px) { .summary-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
</style>
