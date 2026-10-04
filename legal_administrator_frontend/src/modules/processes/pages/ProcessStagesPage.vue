<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore.js'
import { useProcessCatalogStore } from '../stores/processCatalogStore.js'
import { createStageDraft, stagePayload, validateStageDraft } from '../domain/stageConfiguration.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { useLeaveConfirmation } from '@/shared/forms/useLeaveConfirmation.js'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import LeaveConfirmation from '@/components/common/LeaveConfirmation.vue'

const route = useRoute()
const catalog = useProcessCatalogStore()
const auth = useAuthStore()
const notifications = useNotificationStore()
const draft = reactive({ version: 0, stages: [], transitions: [] })
const processType = ref(null)
const loading = ref(true)
const failed = ref(false)
const busy = ref(false)
const reloadOpen = ref(false)
const savedSnapshot = ref('')
const needsSave = ref(false)
let loadNumber = 0
let nextKey = 1

const canManage = computed(() => ['Abogada', 'Administrador'].includes(auth.user?.role))
const readonly = computed(() => !canManage.value || processType.value?.status === 'INACTIVE')
const dirty = computed(() => !loading.value && !failed.value
  && (needsSave.value || JSON.stringify(stagePayload(draft)) !== savedSnapshot.value))
const leave = useLeaveConfirmation(dirty, busy)
const statusText = computed(() => {
  if (processType.value?.status === 'PUBLISHED') return 'Publicado'
  if (processType.value?.status === 'INACTIVE') return 'Inactivo'
  return 'Borrador'
})

function setDraft(configuration) {
  const prepared = createStageDraft(configuration)
  draft.version = prepared.version
  draft.stages = prepared.stages
  draft.transitions = prepared.transitions
  nextKey = draft.stages.length + 1
  savedSnapshot.value = JSON.stringify(stagePayload(draft))
  needsSave.value = !configuration?.stages?.length
}

async function load() {
  const current = ++loadNumber
  loading.value = true
  failed.value = false
  try {
    const id = Number(route.params.id)
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('El trámite solicitado no es válido.')
    const [type, configuration] = await Promise.all([catalog.getProcessType(id), catalog.getStages(id)])
    if (current !== loadNumber) return
    processType.value = type
    setDraft(configuration)
  } catch (error) {
    if (current !== loadNumber) return
    failed.value = true
    notifyRequestError(error, 'No fue posible cargar las etapas.', 'Reintentar', load)
  } finally {
    if (current === loadNumber) loading.value = false
  }
}

function addStage() {
  if (readonly.value || busy.value || draft.stages.length >= 40) return
  draft.stages.push({ key: nextKey++, code: '', name: '', initial: false, terminal: false })
}
function removeStage(key) {
  if (readonly.value || busy.value) return
  draft.stages = draft.stages.filter(stage => stage.key !== key)
  draft.transitions = draft.transitions.filter(edge => edge.fromKey !== key && edge.toKey !== key)
}
function moveStage(index, offset) {
  const target = index + offset
  if (target < 0 || target >= draft.stages.length || busy.value) return
  const stage = draft.stages.splice(index, 1)[0]
  draft.stages.splice(target, 0, stage)
}
function setInitial(key) {
  if (readonly.value || busy.value) return
  for (const stage of draft.stages) stage.initial = stage.key === key
}
function setTerminal(stage) {
  if (readonly.value || busy.value) return
  stage.terminal = !stage.terminal
  if (stage.terminal) draft.transitions = draft.transitions.filter(edge => edge.fromKey !== stage.key)
}
function hasTransition(fromKey, toKey) {
  return draft.transitions.some(edge => edge.fromKey === fromKey && edge.toKey === toKey)
}
function setTransition(fromKey, toKey) {
  if (readonly.value || busy.value) return
  if (hasTransition(fromKey, toKey)) {
    draft.transitions = draft.transitions.filter(edge => edge.fromKey !== fromKey || edge.toKey !== toKey)
    return
  }
  draft.transitions.push({ fromKey, toKey })
}
function destinationOptions(stage) {
  return draft.stages.filter(item => item.key !== stage.key)
}
function destinationName(stage) {
  if (stage.name.trim()) return stage.name.trim()
  return 'Etapa ' + (draft.stages.indexOf(stage) + 1)
}

async function save() {
  if (readonly.value || busy.value || !dirty.value) return
  const problem = validateStageDraft(draft)
  if (problem) {
    notifications.show(problem, 'warning')
    return
  }
  busy.value = true
  try {
    const result = await catalog.saveStages(processType.value.id, stagePayload(draft))
    setDraft(result)
    notifications.show('Etapas y transiciones guardadas correctamente.', 'success')
  } catch (error) {
    let actionLabel = ''
    let action = null
    if (error?.status === 409) {
      actionLabel = 'Revisar versión'
      action = () => { reloadOpen.value = true }
    }
    notifyRequestError(error, 'No fue posible guardar las etapas.', actionLabel, action)
  } finally {
    busy.value = false
  }
}
async function publish() {
  if (readonly.value || busy.value) return
  if (dirty.value) {
    notifications.show('Guarda los cambios de etapas antes de publicar.', 'warning')
    return
  }
  if (validateStageDraft(draft)) {
    notifications.show('Configura y guarda un flujo válido antes de publicar.', 'warning')
    return
  }
  busy.value = true
  try {
    processType.value = await catalog.publishProcessType(processType.value.id, draft.version)
    draft.version = processType.value.version
    savedSnapshot.value = JSON.stringify(stagePayload(draft))
    notifications.show('Trámite publicado y disponible para nuevos expedientes.', 'success')
  } catch (error) {
    notifyRequestError(error, 'No fue posible publicar el trámite.')
  } finally {
    busy.value = false
  }
}
function requestReload() {
  if (dirty.value) reloadOpen.value = true
  else load()
}
async function reload() {
  reloadOpen.value = false
  await load()
}
watch(() => route.params.id, load, { immediate: true })
</script>

<template>
  <div class="office-page stage-page">
    <PageHeader eyebrow="Configuración jurídica" :title="'Etapas de ' + (processType?.name || 'trámite')"
      subtitle="Define la ruta que seguirá cada expediente nuevo. Los expedientes abiertos conservan su propio historial.">
      <template #actions>
        <RouterLink class="link-button" :to="{ name: 'process-type-edit', params: { id: route.params.id } }">Volver al trámite</RouterLink>
        <BaseButton variant="outline" :loading="loading" :disabled="busy" @click="requestReload">Actualizar</BaseButton>
      </template>
    </PageHeader>
    <LoadingCards v-if="loading" label="Cargando etapas del trámite" :count="2" />
    <BaseCard v-else-if="failed" class="empty-state">
      <h2>Etapas pendientes de cargar</h2>
      <BaseButton @click="load">Reintentar carga</BaseButton>
    </BaseCard>
    <div v-else class="stage-layout">
      <div class="stage-main">
        <BaseCard class="stage-intro">
          <div class="heading-line">
            <div><h2>Ruta del trámite</h2><p class="muted">El código identifica la etapa; conserva el mismo código si solo cambias su nombre.</p></div>
            <BaseBadge variant="teal">{{ draft.stages.length }} etapas</BaseBadge>
          </div>
          <p class="muted">Marca una etapa inicial, una o varias finales y los destinos permitidos desde cada una. Todas deben conducir a una final.</p>
        </BaseCard>
        <BaseCard v-for="(stage, index) in draft.stages" :key="stage.key" class="stage-card">
          <div class="heading-line">
            <div class="stage-title"><span class="stage-number">{{ index + 1 }}</span><h2>Etapa {{ index + 1 }}</h2></div>
            <div class="stage-tools" v-if="!readonly">
              <BaseButton variant="ghost" size="sm" :disabled="busy || index === 0" :aria-label="'Subir etapa ' + (index + 1)" @click="moveStage(index, -1)">↑</BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="busy || index === draft.stages.length - 1" :aria-label="'Bajar etapa ' + (index + 1)" @click="moveStage(index, 1)">↓</BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="busy || draft.stages.length <= 2" :aria-label="'Eliminar etapa ' + (index + 1)" @click="removeStage(stage.key)">Eliminar</BaseButton>
            </div>
          </div>
          <div class="stage-fields">
            <label :for="'stage-code-' + stage.key">Código estable
              <input :id="'stage-code-' + stage.key" v-model="stage.code" maxlength="40" autocapitalize="characters"
                placeholder="PRESENTADO" :disabled="readonly || busy" />
            </label>
            <label :for="'stage-name-' + stage.key">Nombre visible
              <input :id="'stage-name-' + stage.key" v-model="stage.name" maxlength="150"
                placeholder="Presentado" :disabled="readonly || busy" />
            </label>
          </div>
          <div class="stage-options">
            <label class="check-option">
              <input type="radio" name="initial-stage" :checked="stage.initial" :disabled="readonly || busy" @change="setInitial(stage.key)" />
              Etapa inicial
            </label>
            <label class="check-option">
              <input type="checkbox" :checked="stage.terminal" :disabled="readonly || busy" @change="setTerminal(stage)" />
              Etapa final
            </label>
          </div>
          <fieldset class="transition-fieldset" :disabled="readonly || busy || stage.terminal">
            <legend>Puede avanzar a</legend>
            <p v-if="stage.terminal" class="muted">Una etapa final no tiene salidas.</p>
            <div v-else class="destination-grid">
              <label v-for="destination in destinationOptions(stage)" :key="destination.key" class="check-option">
                <input type="checkbox" :checked="hasTransition(stage.key, destination.key)"
                  @change="setTransition(stage.key, destination.key)" />
                {{ destinationName(destination) }}
              </label>
            </div>
          </fieldset>
        </BaseCard>
        <BaseButton v-if="!readonly" variant="outline" :disabled="busy || draft.stages.length >= 40" @click="addStage">Agregar etapa</BaseButton>
      </div>
      <aside class="stage-side">
        <BaseCard class="stage-summary">
          <h2>Antes de publicar</h2>
          <p class="muted">Comprueba el orden y que cada etapa tenga una ruta hasta una etapa final.</p>
          <dl class="record-data">
            <div><dt>Estado</dt><dd>{{ statusText }}</dd></div>
            <div><dt>Transiciones</dt><dd>{{ draft.transitions.length }}</dd></div>
            <div><dt>Versión</dt><dd>{{ draft.version }}</dd></div>
          </dl>
          <div v-if="!readonly" class="side-actions">
            <BaseButton block :loading="busy" :disabled="!dirty" @click="save">Guardar etapas</BaseButton>
            <BaseButton v-if="processType?.status === 'DRAFT'" block variant="outline" :disabled="busy" @click="publish">Publicar trámite</BaseButton>
          </div>
        </BaseCard>
      </aside>
    </div>
    <BaseModal :open="reloadOpen" title-id="reload-stages-title" @close="reloadOpen = false">
      <div class="confirm-content"><h2 id="reload-stages-title">Recargar etapas</h2>
        <p>Se descartarán los cambios locales. Consulta la nueva versión antes de guardar de nuevo.</p>
        <div class="actions"><BaseButton variant="outline" @click="reloadOpen = false">Conservar cambios</BaseButton>
          <BaseButton @click="reload">Recargar</BaseButton></div>
      </div>
    </BaseModal>
    <LeaveConfirmation :open="leave.open.value" @decide="leave.decide" />
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
<style scoped>
.stage-layout, .stage-main { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; align-items: start; }
.stage-main, .stage-side, .stage-card { min-width: 0; }
.stage-intro, .stage-card, .stage-summary { display: grid; gap: 1rem; }
.stage-intro :deep(.card-body), .stage-card :deep(.card-body), .stage-summary :deep(.card-body) { display: grid; gap: 1rem; min-width: 0; }
.heading-line { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: .75rem; }
.heading-line > div { min-width: 0; }
.stage-title, .stage-tools { display: flex; align-items: center; gap: .35rem; }
.stage-number { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 50%; background: var(--color-primary-subtle); color: var(--color-teal-strong); font-family: var(--font-mono); font-weight: 700; }
.stage-fields { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; }
.stage-fields input { width: 100%; min-height: 46px; }
.stage-fields label { color: var(--color-text-title); }
.stage-options { display: flex; flex-wrap: wrap; gap: .5rem 1rem; }
.check-option { display: flex !important; align-items: center; gap: .55rem !important; min-height: 44px; padding: .35rem .5rem; border: 1px solid var(--color-border-control); border-radius: var(--radius-sm); color: var(--color-text-body); font-weight: 500 !important; }
.check-option input { width: 1.15rem !important; min-width: 1.15rem !important; min-height: 1.15rem !important; height: 1.15rem; accent-color: var(--color-primary); }
.transition-fieldset { min-width: 0; border: 0; }
.transition-fieldset legend { margin-bottom: .45rem; font-weight: 650; }
.destination-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: .4rem; }
.side-actions { display: grid; gap: .6rem; margin-top: 1rem; }
.stage-summary { position: static; }
@media (min-width: 640px) {
  .stage-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .destination-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 980px) {
  .stage-layout { grid-template-columns: minmax(0, 1fr) minmax(250px, 290px); }
  .stage-summary { position: sticky; top: calc(var(--navbar-height) + 1rem); }
}
</style>
