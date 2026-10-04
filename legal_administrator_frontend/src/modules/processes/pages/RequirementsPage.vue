<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
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

const authStore = useAuthStore()
const catalog = useProcessCatalogStore()
const search = ref('')
const filter = ref('active')
const loadError = ref('')
const actionError = ref('')
const success = ref('')
const editorOpen = ref(false)
const confirmOpen = ref(false)
const selected = ref(null)
const busy = ref(false)
const formKey = ref(0)

const toastMessage = computed(() => {
  if (success.value) return success.value
  if (actionError.value) return actionError.value
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

const canManage = computed(() => ['Abogada', 'Administrador'].includes(authStore.user?.role))
const emptyTitle = computed(() => {
  if (catalog.requirements.length) return 'No hay coincidencias'
  return 'Aún no hay requisitos'
})
const emptyDescription = computed(() => {
  if (catalog.requirements.length) return 'Prueba otra búsqueda o cambia el filtro.'
  return 'Crea el primero para empezar a configurar trámites.'
})
function requirementStatus(requirement) {
  if (requirement.active) return 'Activo'
  return 'Inactivo'
}
function requirementStatusVariant(requirement) {
  if (requirement.active) return 'teal'
  return 'neutral'
}
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es')
  return catalog.requirements.filter((item) => {
    if (filter.value === 'active' && !item.active) return false
    if (filter.value === 'inactive' && item.active) return false
    if (!term) return true
    const text = [item.name, item.description].join(' ').toLocaleLowerCase('es')
    return text.includes(term)
  })
})

async function loadRequirements() {
  loadError.value = ''
  try {
    await catalog.loadRequirements()
  } catch (error) {
    loadError.value = catalogErrorMessage(error, 'No fue posible cargar los requisitos.')
  }
}

function openEditor(requirement = null) {
  selected.value = requirement
  actionError.value = ''
  formKey.value += 1
  editorOpen.value = true
}

async function saveRequirement(payload) {
  busy.value = true
  actionError.value = ''
  success.value = ''
  try {
    let id = null
    if (selected.value) id = selected.value.id
    const wasEditing = id !== null
    await catalog.saveRequirement(id, payload)
    editorOpen.value = false
    if (wasEditing) {
      success.value = 'Requisito actualizado correctamente.'
    } else {
      success.value = 'Requisito creado correctamente.'
    }
  } catch (error) {
    actionError.value = catalogErrorMessage(error, 'No fue posible guardar el requisito.')
  } finally {
    busy.value = false
  }
}

function askDeactivate(requirement) {
  selected.value = requirement
  actionError.value = ''
  confirmOpen.value = true
}

async function deactivate() {
  if (!selected.value) return
  busy.value = true
  actionError.value = ''
  success.value = ''
  try {
    await catalog.deactivateRequirement(selected.value.id)
    confirmOpen.value = false
    success.value = 'Requisito desactivado. Los trámites existentes conservan su información.'
  } catch (error) {
    actionError.value = catalogErrorMessage(error, 'No fue posible desactivar el requisito.')
  } finally {
    busy.value = false
  }
}

function closeToast() {
  success.value = ''
  actionError.value = ''
  loadError.value = ''
}

async function runToastAction() {
  closeToast()
  await loadRequirements()
}

onMounted(loadRequirements)
</script>

<template>
  <div class="catalog-page">
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
      title="Requisitos"
      subtitle="Crea condiciones reutilizables para los trámites que ofrece el despacho."
    >
      <template #actions>
        <BaseButton v-if="canManage" @click="openEditor()">Nuevo requisito</BaseButton>
      </template>
    </PageHeader>

    <nav class="section-nav" aria-label="Configuración de trámites">
      <RouterLink to="/tramites">Trámites</RouterLink>
      <RouterLink to="/requisitos" aria-current="page">Requisitos</RouterLink>
    </nav>

    <div class="feedback-stack">
      <CatalogNotice v-if="!canManage">
        Tu perfil puede consultar requisitos. La edición está disponible para Abogada y Administrador.
      </CatalogNotice>
    </div>

    <div class="toolbar">
      <label for="requirement-search">Buscar requisito</label>
      <input id="requirement-search" v-model="search" type="search" placeholder="Nombre o descripción">
      <label for="requirement-filter">Estado</label>
      <select id="requirement-filter" v-model="filter">
        <option value="active">Activos</option>
        <option value="inactive">Inactivos</option>
        <option value="all">Todos</option>
      </select>
    </div>

    <div v-if="catalog.loadingRequirements" class="card-grid" role="status" aria-label="Cargando requisitos">
      <BaseCard v-for="item in 3" :key="item" class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </BaseCard>
    </div>
    <BaseCard v-else-if="!loadError && !filtered.length" class="empty-card">
      <h2>{{ emptyTitle }}</h2>
      <p>{{ emptyDescription }}</p>
      <BaseButton v-if="canManage && !catalog.requirements.length" @click="openEditor()">Crear requisito</BaseButton>
    </BaseCard>
    <div v-else-if="!loadError || filtered.length" class="card-grid">
      <BaseCard v-for="requirement in filtered" :key="requirement.id" class="requirement-card">
        <div class="card-top">
          <h2>{{ requirement.name }}</h2>
          <BaseBadge :variant="requirementStatusVariant(requirement)">
            {{ requirementStatus(requirement) }}
          </BaseBadge>
        </div>
        <p class="description">{{ requirement.description || 'Sin descripción adicional.' }}</p>
        <div v-if="canManage && requirement.active" class="card-actions">
          <BaseButton variant="outline" size="sm" @click="openEditor(requirement)">Editar</BaseButton>
          <BaseButton variant="ghost" size="sm" @click="askDeactivate(requirement)">Desactivar</BaseButton>
        </div>
      </BaseCard>
    </div>

    <BaseModal :open="editorOpen" :dismissible="!busy" title-id="requirement-dialog-title" @close="editorOpen = false">
      <RequirementForm
        :key="formKey"
        :requirement="selected"
        :busy="busy"
        @submit="saveRequirement"
        @cancel="editorOpen = false"
      />
    </BaseModal>

    <BaseModal :open="confirmOpen" :dismissible="!busy" title-id="deactivate-requirement-title" @close="confirmOpen = false">
      <div class="confirm-content">
        <h2 id="deactivate-requirement-title">Desactivar requisito</h2>
        <p>“{{ selected?.name }}” dejará de estar disponible para nuevas configuraciones.</p>
        <div class="confirm-actions">
          <BaseButton variant="outline" :disabled="busy" @click="confirmOpen = false">Cancelar</BaseButton>
          <BaseButton :loading="busy" @click="deactivate">Desactivar</BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.catalog-page { width: 100%; min-width: 0; }
.section-nav { display: flex; gap: .4rem; margin: -1rem 0 1.5rem; border-bottom: 1px solid var(--color-border-subtle); }
.section-nav a { padding: .7rem 1rem; color: var(--color-text-muted); font-weight: 650; border-bottom: 3px solid transparent; }
.section-nav a[aria-current='page'] { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.feedback-stack { display: grid; gap: .7rem; margin-bottom: 1rem; }
.toolbar { display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; gap: .35rem; margin-bottom: 1.25rem; }
.toolbar label:not(:first-child) { margin-top: .6rem; }
.toolbar label { font-size: .85rem; font-weight: 650; }
.toolbar input, .toolbar select { min-width: 0; min-height: 44px; font-size: 1rem; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1rem; }
.requirement-card { min-width: 0; }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: .7rem; }
.card-top h2 { font-size: 1.06rem; overflow-wrap: anywhere; }
.description { color: var(--color-text-muted); font-size: .9rem; margin: .75rem 0 1.2rem; overflow-wrap: anywhere; }
.card-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: auto; }
.empty-card { text-align: center; }
.empty-card p { color: var(--color-text-muted); margin: .5rem 0 1rem; }
.skeleton-card { min-height: 154px; }
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
@media (min-width: 651px) {
  .toolbar { grid-template-columns: auto minmax(180px, 1fr) auto minmax(120px, 170px); gap: .65rem; }
  .toolbar label:not(:first-child) { margin-top: 0; }
  .confirm-actions { flex-direction: row; }
  .confirm-actions :deep(button) { width: auto; }
}
</style>
