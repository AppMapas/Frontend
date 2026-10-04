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
  return 'Abrir expediente'
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
        notifications.show('Selecciona un cliente activo con nacionalidad, estado civil y dirección completos.', 'warning')
        form.value?.querySelector('#case-client-query')?.focus()
        return
      }
      payload.clientDpi = existingClient.value.dpi
    }
  }
  try {
    const detail = await cases.open(payload)
    if (!alive || !detail) return
    newClient.value = emptyClient()
    existingClient.value = null
    template.value = null
    generalDetails.value = ''
    baseline.value = capture()
    notifications.show('Expediente ' + detail.caseData.caseCode + ' registrado correctamente.', 'success')
    await router.replace({ name: 'legal-process-detail', params: { id: detail.caseData.id } })
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
