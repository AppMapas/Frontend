<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useLegalProcessStore } from '../stores/legalProcessStore.js'
import { useClientStore } from '@/modules/users/stores/clientStore.js'
import { statusLabel, formatTimestamp } from '../domain/caseRegistration.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { useLeaveConfirmation } from '@/shared/forms/useLeaveConfirmation.js'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import LeaveConfirmation from '@/components/common/LeaveConfirmation.vue'
import CaseDocuments from '../components/CaseDocuments.vue'
import CasePayments from '../components/CasePayments.vue'
import UpcomingActivities from '@/modules/agenda/components/UpcomingActivities.vue'

const route = useRoute()
const cases = useLegalProcessStore()
const clients = useClientStore()
const notifications = useNotificationStore()
const detail = ref(null)
const client = ref(null)
const notes = ref('')
const savedNotes = ref('')
const loading = ref(true)
const failed = ref(false)
const busy = ref(false)
const documentState = ref({ pending: false, busy: false })
const paymentState = ref({ pending: false, busy: false })
const reloadOpen = ref(false)
let loadNumber = 0
const record = computed(() => detail.value?.caseData)
const title = computed(() => record.value?.caseCode || 'Detalle del expediente')
const dirty = computed(() => !loading.value && notes.value !== savedNotes.value)
// Documentos y pagos son secciones independientes: el aviso de salida tiene que
//uya en cuenta cualquiera de las dos con trabajo a medias.
const section = computed(() => ({
  pending: documentState.value.pending || paymentState.value.pending,
  busy: documentState.value.busy || paymentState.value.busy,
}))
const leave = useLeaveConfirmation(
  computed(() => dirty.value || section.value.pending),
  computed(() => busy.value || section.value.busy),
)
/**
 * Pactar el costo total incrementa la versión del expediente. Si la vista de
 * pagos no la devolviera, guardar las observaciones después fallaría con un
 * conflicto por versión antigua.
 */
function syncVersion(next) {
  if (record.value && Number.isSafeInteger(next)) record.value.version = next
}
async function load() {
  const current = ++loadNumber
  loading.value = true
  failed.value = false
  try {
    const id = Number(route.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('El identificador del expediente no es válido.')
    const result = await cases.get(id)
    if (current !== loadNumber) return
    detail.value = result
    notes.value = result.caseData.generalDetails || ''
    savedNotes.value = notes.value
    client.value = null
    try {
      const profile = await clients.get(result.caseData.clientDpi)
      if (current === loadNumber) client.value = profile
    } catch (error) {
      if (current === loadNumber) notifyRequestError(error, 'No fue posible consultar los datos del cliente.')
    }
  } catch (error) {
    if (current !== loadNumber) return
    failed.value = true
    notifyRequestError(error, 'No fue posible consultar el expediente.', 'Reintentar', load)
  } finally {
    if (current === loadNumber) loading.value = false
  }
}
async function save() {
  if (busy.value || !record.value?.active) return
  busy.value = true
  const current = loadNumber
  try {
    const saved = await cases.update(record.value.id, { version: record.value.version, generalDetails: notes.value.trim() || null })
    if (current !== loadNumber) return
    detail.value = saved
    notes.value = detail.value.caseData.generalDetails || ''
    savedNotes.value = notes.value
    notifications.show('Observaciones del expediente guardadas.', 'success')
  } catch (error) {
    if (current !== loadNumber) return
    let label = ''
    let action = null
    if (error?.status === 409) {
      label = 'Recargar expediente'
      action = () => { reloadOpen.value = true }
    }
    notifyRequestError(error, 'No fue posible guardar las observaciones.', label, action)
  } finally {
    busy.value = false
  }
}
function requestReload() {
  if (section.value.busy) return
  if (dirty.value || section.value.pending) reloadOpen.value = true
  else load()
}
async function reload() {
  reloadOpen.value = false
  await load()
}
watch(() => route.params.id, load, { immediate: true })
onBeforeUnmount(() => { loadNumber += 1 })
</script>
<template>
  <div class="office-page">
    <PageHeader eyebrow="Expediente del despacho" :title="title" :subtitle="record?.processTypeName || ''">
      <template #actions><RouterLink class="link-button" :to="{ name: 'legal-processes' }">Volver a expedientes</RouterLink>
        <BaseButton variant="outline" :disabled="busy || section.busy" :loading="loading" @click="requestReload">Actualizar</BaseButton></template>
    </PageHeader>
    <LoadingCards v-if="loading" label="Cargando expediente y requisitos" />
    <BaseCard v-else-if="failed" class="empty-state"><h2>Expediente pendiente de cargar</h2><BaseButton @click="load">Reintentar carga</BaseButton></BaseCard>
    <div v-else-if="record" class="form-stack">
      <div class="detail-grid">
        <BaseCard class="form-section">
          <div class="record-heading"><h2>Cliente</h2><BaseBadge v-if="client && !client.active" variant="neutral">Cliente inactivo</BaseBadge></div>
          <dl class="record-data">
            <div><dt>Nombre completo</dt><dd>{{ record.clientName }}</dd></div>
            <div><dt>DPI</dt><dd class="mono">{{ record.clientDpi }}</dd></div>
            <div v-if="client"><dt>Correo</dt><dd><a :href="'mailto:' + client.email">{{ client.email }}</a></dd></div>
            <div v-if="client"><dt>Teléfono</dt><dd><a :href="'tel:' + client.phone">{{ client.phone }}</a></dd></div>
            <div v-if="client"><dt>Dirección</dt><dd>{{ client.exactAddress || 'Pendiente de completar' }}</dd></div>
          </dl>
          <RouterLink class="link-button" :to="{ name: 'client-edit', params: { dpi: record.clientDpi } }">Ver datos del cliente</RouterLink>
        </BaseCard>
        <BaseCard class="form-section">
          <h2>Información del expediente</h2>
          <dl class="record-data">
            <div><dt>Trámite legal</dt><dd>{{ record.processTypeName }}</dd></div>
            <div><dt>Estado</dt><dd><BaseBadge variant="teal">{{ statusLabel(record.currentStatus) }}</BaseBadge></dd></div>
            <div><dt>Actividad</dt><dd><span v-if="record.active">Activo</span><span v-else>Inactivo</span></dd></div>
            <div><dt>Fecha de apertura</dt><dd>{{ formatTimestamp(record.openedAt) }}</dd></div>
            <div><dt>Última actualización</dt><dd>{{ formatTimestamp(record.modifiedAt) }}</dd></div>
          </dl>
        </BaseCard>
      </div>
      <BaseCard class="form-section">
        <header><h2>Requisitos del expediente</h2><p class="help">Se conservan según la configuración utilizada al abrir este caso.</p></header>
        <p v-if="!detail.requirements.length" class="muted">Este expediente histórico no tiene requisitos registrados.</p>
        <ol v-else class="requirements-list">
          <li v-for="item in detail.requirements" :key="item.id">
            <div class="requirement-top"><h3>{{ item.displayOrder }}. {{ item.name }}</h3><BaseBadge variant="neutral">{{ statusLabel(item.status) }}</BaseBadge></div>
            <p v-if="item.description">{{ item.description }}</p><p v-if="item.instructions">{{ item.instructions }}</p>
            <div class="actions"><BaseBadge v-if="item.required" variant="teal">Obligatorio</BaseBadge><BaseBadge v-else variant="neutral">Opcional</BaseBadge>
              <span v-if="item.requiresDocument" class="meta">Requiere documentación</span></div>
          </li>
        </ol>
      </BaseCard>
      <UpcomingActivities v-if="record" :case-id="record.id" />
      <CasePayments
        :key="record.id"
        :case-id="record.id"
        :active="record.active"
        @state="paymentState = $event"
        @version="syncVersion"
      />
      <CaseDocuments :key="record.id" :case-id="record.id" :active="record.active" @state="documentState = $event" />
      <form novalidate @submit.prevent="save">
        <BaseCard class="form-section">
          <h2>Observaciones</h2>
          <label for="detail-notes">Información adicional
            <textarea id="detail-notes" v-model="notes" rows="4" maxlength="5000" :disabled="busy || !record.active"></textarea>
          </label>
          <div class="form-actions"><BaseButton v-if="record.active" type="submit" :loading="busy" :disabled="!dirty">Guardar observaciones</BaseButton></div>
        </BaseCard>
      </form>
    </div>
    <BaseModal :open="reloadOpen" title-id="reload-case-title" @close="reloadOpen = false">
      <div class="confirm-content"><h2 id="reload-case-title">Recargar expediente</h2>
        <p>Se perderán las observaciones sin guardar y la selección de archivos pendientes. Los documentos ya guardados se conservarán.</p>
        <div class="actions"><BaseButton variant="outline" @click="reloadOpen = false">Conservar cambios</BaseButton><BaseButton @click="reload">Recargar</BaseButton></div>
      </div>
    </BaseModal>
    <LeaveConfirmation :open="leave.open.value" @decide="leave.decide" />
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
<style scoped>
.requirements-list { list-style: none; display: grid; gap: .9rem; }
.requirements-list li { display: grid; gap: .65rem; padding: 1rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); }
.requirement-top { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; justify-content: space-between; }
.requirements-list h3, .requirements-list p { white-space: pre-line; overflow-wrap: anywhere; }
.requirements-list p { font-size: .9rem; }
</style>
