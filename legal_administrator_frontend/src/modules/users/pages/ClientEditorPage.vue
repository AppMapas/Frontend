<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useClientStore } from '../stores/clientStore.js'
import { clientDraft, clientPayload, emptyClient, validateClient } from '../domain/clientForm.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { useLeaveConfirmation } from '@/shared/forms/useLeaveConfirmation.js'
import ClientFormFields from '../components/ClientFormFields.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import LeaveConfirmation from '@/components/common/LeaveConfirmation.vue'

const route = useRoute()
const router = useRouter()
const clients = useClientStore()
const notifications = useNotificationStore()
const draft = ref(emptyClient())
const version = ref(null)
const active = ref(true)
const loading = ref(true)
const failed = ref(false)
const busy = ref(false)
const errors = ref({})
const fields = ref(null)
const savedSnapshot = ref('')
const reloadOpen = ref(false)
let loadNumber = 0
let alive = true
const editing = computed(() => Boolean(route.params.dpi))
const title = computed(() => {
  if (editing.value) return 'Datos del cliente'
  return 'Nuevo cliente'
})
const dirty = computed(() => !loading.value && savedSnapshot.value !== JSON.stringify(draft.value))
const leave = useLeaveConfirmation(dirty, busy)

async function load() {
  const request = ++loadNumber
  loading.value = true
  failed.value = false
  try {
    let client = null
    if (editing.value) {
      const results = await Promise.all([clients.get(route.params.dpi), clients.loadCatalogs()])
      client = results[0]
    } else await clients.loadCatalogs()
    if (request !== loadNumber) return
    draft.value = clientDraft(client || {})
    version.value = client?.version ?? null
    active.value = client?.active ?? true
    errors.value = {}
    savedSnapshot.value = JSON.stringify(draft.value)
  } catch (error) {
    if (request !== loadNumber) return
    failed.value = true
    notifyRequestError(error, 'No fue posible cargar el formulario.', 'Reintentar', load)
  } finally {
    if (request === loadNumber) loading.value = false
  }
}
async function save() {
  if (busy.value || !active.value || !clients.catalogsReady) return
  errors.value = validateClient(draft.value, editing.value)
  if (Object.keys(errors.value).length) {
    notifications.show(Object.values(errors.value).join(' · '), 'warning')
    await nextTick()
    fields.value?.focusInvalid()
    return
  }
  busy.value = true
  try {
    let saved
    if (editing.value) saved = await clients.update(route.params.dpi, clientPayload(draft.value, version.value))
    else saved = await clients.create(clientPayload(draft.value))
    if (!alive) return
    draft.value = clientDraft(saved)
    version.value = saved.version
    savedSnapshot.value = JSON.stringify(draft.value)
    notifications.show('Datos del cliente guardados correctamente.', 'success')
    if (!editing.value) {
      draft.value = emptyClient()
      savedSnapshot.value = JSON.stringify(draft.value)
      busy.value = false
      await router.replace({ name: 'clientes' })
    }
  } catch (error) {
    if (!alive) return
    errors.value = error?.data?.details || {}
    let label = ''
    let action = null
    if (error?.status === 409 && editing.value) {
      label = 'Recargar datos'
      action = () => { reloadOpen.value = true }
    }
    notifyRequestError(error, 'No fue posible guardar el cliente.', label, action)
    await nextTick()
    fields.value?.focusInvalid()
  } finally {
    busy.value = false
  }
}
async function reload() {
  reloadOpen.value = false
  await load()
}
watch(() => route.params.dpi, load, { immediate: true })
onBeforeUnmount(() => { alive = false; loadNumber += 1 })
</script>
<template>
  <div class="office-page">
    <PageHeader eyebrow="Directorio del despacho" :title="title" subtitle="Completa la información personal antes de asociar un trámite.">
      <template #actions><RouterLink class="link-button" :to="{ name: 'clientes' }">Volver a clientes</RouterLink></template>
    </PageHeader>
    <LoadingCards v-if="loading" :count="2" label="Cargando datos y catálogos" />
    <BaseCard v-else-if="failed" class="empty-state"><h2>Formulario pendiente de cargar</h2><BaseButton @click="load">Reintentar carga</BaseButton></BaseCard>
    <form v-else novalidate class="form-stack" @submit.prevent="save">
      <BaseCard class="form-section">
        <ClientFormFields ref="fields" v-model="draft" :editing="editing" :disabled="busy || !active"
          :countries="clients.countries" :marital-statuses="clients.maritalStatuses"
          :municipalities="clients.municipalities" :errors="errors" />
      </BaseCard>
      <div class="form-actions">
        <RouterLink class="link-button" :to="{ name: 'clientes' }">Volver al directorio</RouterLink>
        <RouterLink v-if="editing" class="link-button" :to="{ name: 'legal-processes', query: { clientDpi: route.params.dpi } }">Ver expedientes</RouterLink>
        <RouterLink v-if="editing" class="link-button" :to="{ name: 'agenda', query: { clientDpi: route.params.dpi } }">Ver agenda del cliente</RouterLink>
        <BaseButton v-if="active" type="submit" :loading="busy" :disabled="!clients.catalogsReady">Guardar cliente</BaseButton>
      </div>
    </form>
    <BaseModal :open="reloadOpen" title-id="reload-client-title" @close="reloadOpen = false">
      <div class="confirm-content"><h2 id="reload-client-title">Consultar los datos actuales</h2>
        <p>La recarga reemplazará tus cambios sin guardar por la información actual del servidor.</p>
        <div class="actions"><BaseButton variant="outline" @click="reloadOpen = false">Conservar cambios</BaseButton><BaseButton @click="reload">Recargar</BaseButton></div>
      </div>
    </BaseModal>
    <LeaveConfirmation :open="leave.open.value" @decide="leave.decide" />
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
