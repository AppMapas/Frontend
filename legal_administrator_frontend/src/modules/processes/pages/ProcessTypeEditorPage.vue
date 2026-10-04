<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import { useProcessCatalogStore } from '../stores/processCatalogStore'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import CatalogNotice from '../components/CatalogNotice.vue'
import CatalogToast from '../components/CatalogToast.vue'
import { catalogErrorMessage } from '../utils/catalogError.js'
import RequirementForm from '../components/RequirementForm.vue'
import ProcessRequirementRow from '../components/ProcessRequirementRow.vue'

const route = useRoute()
const authStore = useAuthStore()
const catalog = useProcessCatalogStore()

const currentId = ref(null)
const loading = ref(true)
const busy = ref(false)
const requirementBusy = ref(false)
const error = ref('')
const requirementError = ref('')
const success = ref('')
const loadError = ref('')
const selectedRequirementId = ref('')
const requirementModalOpen = ref(false)
const confirmDeactivateOpen = ref(false)
const requirementFormKey = ref(0)
const savedSnapshot = ref('')

const toastMessage = computed(() => {
  if (success.value) return success.value
  if (error.value) return error.value
  return loadError.value
})
const toastTone = computed(() => {
  if (success.value) return 'success'
  return 'error'
})
const toastActionLabel = computed(() => {
  if (loadError.value) return 'Reintentar'
  return ''
})

const draft = reactive({
  name: '',
  description: '',
  status: 'DRAFT',
  version: null,
  requirements: [],
})

const canManage = computed(() => ['Abogada', 'Administrador'].includes(authStore.user?.role))
const readonly = computed(() => !canManage.value || draft.status === 'INACTIVE')
const availableRequirements = computed(() => catalog.requirements.filter((requirement) => {
  if (!requirement.active) return false
  return !draft.requirements.some((item) => item.requirementId === requirement.id)
}))
const hasInactiveRequirements = computed(() => draft.requirements.some((item) => {
  const requirement = catalog.requirements.find((entry) => entry.id === item.requirementId)
  return requirement && !requirement.active
}))
const pageTitle = computed(() => {
  if (currentId.value === null) return 'Nuevo trámite'
  return draft.name || 'Detalle de trámite'
})
const saveActionLabel = computed(() => {
  if (currentId.value === null) return 'Guardar trámite'
  return 'Guardar cambios'
})
const statusLabel = computed(() => {
  if (draft.status === 'PUBLISHED') return 'Publicado'
  if (draft.status === 'INACTIVE') return 'Inactivo'
  return 'Borrador'
})
const statusVariant = computed(() => {
  if (draft.status === 'PUBLISHED') return 'teal'
  if (draft.status === 'INACTIVE') return 'neutral'
  return 'sage'
})
const isDirty = computed(() => {
  if (loading.value) return false
  return JSON.stringify(toPayload()) !== savedSnapshot.value
})

function toPayload() {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    version: draft.version,
    requirements: draft.requirements.map((item, index) => ({
      requirementId: item.requirementId,
      required: item.required,
      requiresDocument: item.requiresDocument,
      displayOrder: index + 1,
      instructions: item.instructions.trim(),
    })),
  }
}

function setDraft(processType) {
  currentId.value = processType.id
  draft.name = processType.name
  draft.description = processType.description || ''
  draft.status = processType.status
  draft.version = processType.version
  draft.requirements = processType.requirements.map((item) => ({
    requirementId: item.requirementId,
    name: item.name,
    description: item.description || '',
    required: item.required,
    requiresDocument: item.requiresDocument,
    instructions: item.instructions || '',
  }))
  savedSnapshot.value = JSON.stringify(toPayload())
}

function clearDraft() {
  currentId.value = null
  draft.name = ''
  draft.description = ''
  draft.status = 'DRAFT'
  draft.version = null
  draft.requirements = []
  selectedRequirementId.value = ''
  requirementError.value = ''
  requirementModalOpen.value = false
  confirmDeactivateOpen.value = false
  savedSnapshot.value = JSON.stringify(toPayload())
}

async function loadEditor() {
  loading.value = true
  loadError.value = ''
  error.value = ''
  try {
    const requestedId = route.params.id
    if (requestedId) {
      const numericId = Number(requestedId)
      if (!Number.isSafeInteger(numericId) || numericId < 1) {
        throw new Error('El identificador del trámite no es válido.')
      }
      const [processType] = await Promise.all([
        catalog.getProcessType(numericId),
        catalog.loadRequirements(),
      ])
      setDraft(processType)
    } else {
      await catalog.loadRequirements()
      savedSnapshot.value = JSON.stringify(toPayload())
    }
  } catch (requestError) {
    loadError.value = catalogErrorMessage(requestError, 'No fue posible cargar el editor.')
  } finally {
    loading.value = false
  }
}

function addRequirement(id = selectedRequirementId.value) {
  const numericId = Number(id)
  const requirement = catalog.requirements.find((item) => item.id === numericId && item.active)
  if (!requirement) {
    error.value = 'Selecciona un requisito activo.'
    return
  }
  if (draft.requirements.some((item) => item.requirementId === numericId)) {
    error.value = 'Ese requisito ya forma parte del trámite.'
    return
  }
  draft.requirements.push({
    requirementId: requirement.id,
    name: requirement.name,
    description: requirement.description || '',
    required: true,
    requiresDocument: false,
    instructions: '',
  })
  selectedRequirementId.value = ''
  error.value = ''
}

function changeRequirement(index, value) {
  draft.requirements[index] = value
}

function moveRequirement(index, offset) {
  const target = index + offset
  if (target < 0 || target >= draft.requirements.length) return
  const item = draft.requirements.splice(index, 1)[0]
  draft.requirements.splice(target, 0, item)
}

function removeRequirement(index) {
  draft.requirements.splice(index, 1)
}

function validateDraft() {
  if (!draft.name.trim()) return 'Escribe el nombre del trámite.'
  if (draft.name.trim().length > 100) return 'El nombre no puede superar 100 caracteres.'
  if (draft.description.trim().length > 255) return 'La descripción no puede superar 255 caracteres.'
  if (hasInactiveRequirements.value) return 'Quita los requisitos inactivos antes de guardar.'
  return ''
}

async function persistDraft() {
  const validationError = validateDraft()
  if (validationError) {
    error.value = validationError
    return null
  }
  const saved = await catalog.saveProcessType(currentId.value, toPayload())
  setDraft(saved)
  return saved
}

async function save() {
  if (readonly.value || busy.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const wasCreating = currentId.value === null
    const saved = await persistDraft()
    if (!saved) return
    if (wasCreating) {
      clearDraft()
      success.value = 'Trámite creado correctamente. El formulario está listo para un nuevo registro.'
      return
    }
    success.value = 'Cambios del trámite guardados correctamente.'
  } catch (requestError) {
    error.value = catalogErrorMessage(requestError, 'No fue posible guardar el trámite.')
  } finally {
    busy.value = false
  }
}

async function publish() {
  if (readonly.value || busy.value) return
  if (currentId.value === null) {
    error.value = 'Guarda el trámite y configura sus etapas antes de publicarlo.'
    return
  }
  if (!draft.requirements.length) {
    error.value = 'Agrega al menos un requisito antes de publicar.'
    return
  }
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const configuration = await catalog.getStages(currentId.value)
    if (!configuration.stages.length) {
      error.value = 'Configura y guarda las etapas antes de publicar el trámite.'
      return
    }
    const saved = await persistDraft()
    if (!saved) return
    const published = await catalog.publishProcessType(saved.id, saved.version)
    setDraft(published)
    success.value = 'Trámite publicado. Su configuración está lista para futuros expedientes.'
  } catch (requestError) {
    error.value = catalogErrorMessage(requestError, 'No fue posible publicar el trámite.')
  } finally {
    busy.value = false
  }
}

async function deactivate() {
  if (currentId.value === null || busy.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const inactive = await catalog.deactivateProcessType(currentId.value, draft.version)
    setDraft(inactive)
    confirmDeactivateOpen.value = false
    success.value = 'Trámite desactivado correctamente.'
  } catch (requestError) {
    error.value = catalogErrorMessage(requestError, 'No fue posible desactivar el trámite.')
    confirmDeactivateOpen.value = false
  } finally {
    busy.value = false
  }
}

function openRequirementModal() {
  requirementError.value = ''
  requirementFormKey.value += 1
  requirementModalOpen.value = true
}

async function createRequirement(payload) {
  requirementBusy.value = true
  requirementError.value = ''
  try {
    const saved = await catalog.saveRequirement(null, payload)
    requirementModalOpen.value = false
    addRequirement(saved.id)
    success.value = 'Requisito creado y agregado al trámite. Guarda la plantilla para conservar el cambio.'
  } catch (requestError) {
    requirementError.value = catalogErrorMessage(requestError, 'No fue posible crear el requisito.')
  } finally {
    requirementBusy.value = false
  }
}

function closeToast() {
  success.value = ''
  error.value = ''
  loadError.value = ''
}

async function runToastAction() {
  closeToast()
  await loadEditor()
}

onBeforeRouteLeave(() => {
  if (!isDirty.value || readonly.value) return true
  return window.confirm('Tienes cambios sin guardar. ¿Quieres salir de esta pantalla?')
})

onMounted(loadEditor)
</script>

<template>
  <div class="editor-page">
    <CatalogToast
      v-if="toastMessage"
      :message="toastMessage"
      :tone="toastTone"
      :action-label="toastActionLabel"
      @close="closeToast"
      @action="runToastAction"
    />
    <PageHeader
      eyebrow="Configuración de trámites"
      :title="pageTitle"
      subtitle="Define lo que debe presentarse para iniciar este tipo de trámite."
    >
      <template #actions>
        <RouterLink class="back-link" to="/tramites">← Volver a trámites</RouterLink>
      </template>
    </PageHeader>

    <div class="feedback-stack">
      <CatalogNotice v-if="!canManage">
        Puedes consultar esta plantilla. Solo Abogada y Administrador pueden modificarla.
      </CatalogNotice>
      <CatalogNotice v-if="draft.status === 'PUBLISHED'">
        Los cambios guardados actualizarán esta plantilla. Revisa los requisitos antes de continuar.
      </CatalogNotice>
    </div>

    <div v-if="loading" class="editor-layout" role="status" aria-label="Cargando editor de trámites">
      <BaseCard class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </BaseCard>
      <BaseCard class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
      </BaseCard>
    </div>

    <form v-else-if="!loadError" class="editor-layout" @submit.prevent="save">
      <div class="editor-main">
        <BaseCard class="details-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">Datos generales</p>
              <h2>Identidad del trámite</h2>
            </div>
            <BaseBadge :variant="statusVariant">{{ statusLabel }}</BaseBadge>
          </div>
          <div class="field-grid">
            <label for="process-name">Nombre del trámite <span aria-hidden="true">*</span></label>
            <input
              id="process-name"
              v-model="draft.name"
              required
              maxlength="100"
              :disabled="readonly || busy"
              placeholder="Ej. Titulación supletoria"
            >
            <label for="process-description">Descripción breve</label>
            <textarea
              id="process-description"
              v-model="draft.description"
              rows="3"
              maxlength="255"
              :disabled="readonly || busy"
              placeholder="Explica cuándo se usa este trámite"
            ></textarea>
          </div>
        </BaseCard>

        <BaseCard class="requirements-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">Lista configurable</p>
              <h2>Requisitos del trámite</h2>
              <p class="hint">Ordena los requisitos según el flujo de atención.</p>
            </div>
            <span class="count">{{ draft.requirements.length }}</span>
          </div>

          <div v-if="!readonly" class="add-requirement">
            <label for="requirement-picker">Agregar requisito existente</label>
            <div class="picker-row">
              <select id="requirement-picker" v-model="selectedRequirementId" :disabled="busy || !availableRequirements.length">
                <option value="">Selecciona un requisito</option>
                <option v-for="item in availableRequirements" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </select>
              <BaseButton variant="outline" :disabled="!selectedRequirementId || busy" @click="addRequirement()">
                Agregar
              </BaseButton>
            </div>
            <div class="create-row">
              <span>¿Falta uno en el catálogo?</span>
              <button type="button" class="text-action" :disabled="busy" @click="openRequirementModal">
                Crear requisito
              </button>
              <RouterLink to="/requisitos">Ver catálogo</RouterLink>
            </div>
          </div>

          <div v-if="!draft.requirements.length" class="requirements-empty">
            <strong>Aún no has agregado requisitos.</strong>
            <p>Puedes guardar este borrador y completar la lista después. Necesitas al menos uno para publicarlo.</p>
          </div>
          <div v-else class="requirement-list">
            <ProcessRequirementRow
              v-for="(item, index) in draft.requirements"
              :key="item.requirementId"
              :item="item"
              :index="index"
              :count="draft.requirements.length"
              :readonly="readonly || busy"
              @change="changeRequirement(index, $event)"
              @move="moveRequirement(index, $event)"
              @remove="removeRequirement(index)"
            />
          </div>
        </BaseCard>
        <BaseCard v-if="currentId !== null" class="requirements-card">
          <div class="card-heading"><div><p class="eyebrow">Seguimiento del expediente</p><h2>Etapas y transiciones</h2>
            <p class="hint">Configura las fases por las que puede pasar este tipo de trámite.</p></div></div>
          <RouterLink class="back-link" :to="{ name: 'process-type-stages', params: { id: currentId } }">Configurar etapas →</RouterLink>
        </BaseCard>
      </div>

      <aside class="editor-sidebar">
        <BaseCard class="summary-card">
          <p class="eyebrow">Resumen</p>
          <h2>Antes de continuar</h2>
          <dl>
            <div><dt>Estado</dt><dd>{{ statusLabel }}</dd></div>
            <div><dt>Requisitos</dt><dd>{{ draft.requirements.length }}</dd></div>
            <div><dt>Con archivo</dt><dd>{{ draft.requirements.filter((item) => item.requiresDocument).length }}</dd></div>
          </dl>
          <p class="sidebar-hint">Guarda este trámite y configura sus etapas antes de publicarlo para abrir expedientes.</p>
          <div v-if="canManage && draft.status !== 'INACTIVE'" class="sidebar-actions">
            <BaseButton type="submit" :loading="busy" block>{{ saveActionLabel }}</BaseButton>
            <BaseButton
              v-if="draft.status === 'DRAFT'"
              variant="outline"
              :disabled="busy || !draft.requirements.length || currentId === null"
              block
              @click="publish"
            >Guardar y publicar</BaseButton>
            <BaseButton
              v-if="currentId !== null"
              variant="ghost"
              :disabled="busy"
              block
              @click="confirmDeactivateOpen = true"
            >Desactivar trámite</BaseButton>
          </div>
        </BaseCard>
      </aside>
    </form>

    <BaseModal :open="requirementModalOpen" :dismissible="!requirementBusy" title-id="requirement-dialog-title" @close="requirementModalOpen = false">
      <RequirementForm
        :key="requirementFormKey"
        :busy="requirementBusy"
        :error="requirementError"
        @submit="createRequirement"
        @cancel="requirementModalOpen = false"
      />
    </BaseModal>

    <BaseModal
      :open="confirmDeactivateOpen"
      :dismissible="!busy"
      title-id="editor-deactivate-title"
      @close="confirmDeactivateOpen = false"
    >
      <div class="confirm-content">
        <h2 id="editor-deactivate-title">Desactivar trámite</h2>
        <p>La plantilla dejará de estar disponible para expedientes nuevos. Esta acción no borra sus datos.</p>
        <p v-if="isDirty">Los cambios que aún no guardaste se perderán.</p>
        <div class="confirm-actions">
          <BaseButton variant="outline" :disabled="busy" @click="confirmDeactivateOpen = false">Cancelar</BaseButton>
          <BaseButton :loading="busy" @click="deactivate">Desactivar trámite</BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.editor-page { width: 100%; min-width: 0; }
.back-link { display: inline-flex; align-items: center; min-height: 40px; color: var(--color-primary); font-weight: 700; }
.feedback-stack { display: grid; gap: .7rem; margin-bottom: 1rem; }
.editor-layout { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 1.1rem; }
.editor-main { display: grid; gap: 1.1rem; min-width: 0; }
.details-card, .requirements-card, .summary-card { min-width: 0; }
.card-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: .8rem; margin-bottom: 1.2rem; }
.card-heading h2, .summary-card h2 { font-size: 1.16rem; }
.eyebrow { color: var(--color-teal-strong); font-family: var(--font-mono); font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; margin-bottom: .25rem; }
.hint, .sidebar-hint { color: var(--color-text-muted); font-size: .85rem; margin-top: .35rem; }
.field-grid { display: grid; gap: .5rem; }
.field-grid label, .add-requirement label { color: var(--color-text-title); font-size: .87rem; font-weight: 650; margin-top: .4rem; }
.field-grid label span { color: var(--color-danger-strong); }
.field-grid input, .field-grid textarea, .add-requirement select { width: 100%; min-height: 46px; font-size: 1rem; }
.field-grid textarea { resize: vertical; }
.count { display: grid; place-items: center; min-width: 2rem; height: 2rem; padding: .2rem .4rem; border-radius: var(--radius-full); background: var(--color-primary-subtle); color: var(--color-primary); font-family: var(--font-mono); font-weight: 700; }
.add-requirement { display: grid; gap: .55rem; margin-bottom: 1rem; padding: .9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); background: var(--color-bg-subtle); }
.picker-row { display: flex; flex-direction: column; gap: .5rem; }
.picker-row :deep(button) { min-height: 46px; }
.picker-row select { flex: 1; min-width: 0; }
.create-row { display: flex; flex-wrap: wrap; gap: .3rem .8rem; color: var(--color-text-muted); font-size: .83rem; }
.create-row a { color: var(--color-primary); font-weight: 650; }
.requirements-empty { padding: 1.5rem; border: 1px dashed var(--color-border-medium); border-radius: var(--radius-sm); text-align: center; }
.requirements-empty strong { color: var(--color-text-title); }
.requirements-empty p { color: var(--color-text-muted); font-size: .87rem; margin-top: .4rem; }
.requirement-list { display: grid; gap: .75rem; }
.summary-card { position: static; }
.summary-card dl { display: grid; gap: .7rem; margin: 1rem 0; }
.summary-card dl div { display: flex; justify-content: space-between; gap: .5rem; padding-bottom: .5rem; border-bottom: 1px solid var(--color-border-subtle); }
.summary-card dt { color: var(--color-text-muted); font-size: .84rem; }
.summary-card dd { color: var(--color-text-title); font-weight: 700; }
.sidebar-actions { display: grid; gap: .6rem; margin-top: 1.3rem; }
.skeleton-card { min-height: 260px; }
.skeleton { border-radius: var(--radius-xs); background: var(--color-bg-subtle); animation: pulse 1.4s ease-in-out infinite; }
.skeleton-title { width: 60%; height: 22px; margin-bottom: 1.2rem; }
.skeleton-line { width: 100%; height: 14px; margin-bottom: .6rem; }
.skeleton-line.short { width: 70%; }
.confirm-content { padding: clamp(1.2rem, 4vw, 2rem); display: grid; gap: .9rem; }
.confirm-content p { color: var(--color-text-muted); }
.confirm-actions { display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: .65rem; margin-top: .4rem; }
.confirm-actions :deep(button) { width: 100%; min-height: 46px; }
@keyframes pulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
@media (min-width: 551px) {
  .picker-row { flex-direction: row; }
  .confirm-actions { flex-direction: row; }
  .confirm-actions :deep(button) { width: auto; }
}
@media (min-width: 901px) {
  .editor-layout { grid-template-columns: minmax(0, 1fr) minmax(260px, 310px); }
  .summary-card { position: sticky; top: calc(var(--navbar-height) + 2rem); }
}
</style>
