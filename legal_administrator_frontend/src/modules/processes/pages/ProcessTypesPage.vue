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

const authStore = useAuthStore()
const catalog = useProcessCatalogStore()
const search = ref('')
const filter = ref('all')
const loadError = ref('')
const actionError = ref('')
const success = ref('')
const busyId = ref(null)
const confirmTarget = ref(null)

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
  if (actionError.value) return 'Actualizar lista'
  return ''
})

const canManage = computed(() => ['Abogada', 'Administrador'].includes(authStore.user?.role))
const emptyTitle = computed(() => {
  if (catalog.processTypes.length) return 'No hay coincidencias'
  return 'Aún no hay trámites'
})
const emptyDescription = computed(() => {
  if (catalog.processTypes.length) return 'Prueba otra búsqueda o cambia el filtro.'
  return 'Crea una plantilla para empezar a organizar los requisitos del despacho.'
})
function detailActionLabel(processType) {
  if (canManage.value && processType.status !== 'INACTIVE') return 'Editar plantilla'
  return 'Ver detalle'
}
const statusLabels = { DRAFT: 'Borrador', PUBLISHED: 'Publicado', INACTIVE: 'Inactivo' }
const statusVariants = { DRAFT: 'sage', PUBLISHED: 'teal', INACTIVE: 'neutral' }
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es')
  return catalog.processTypes.filter((item) => {
    if (filter.value !== 'all' && filter.value !== item.status) return false
    if (!term) return true
    return [item.name, item.description].join(' ').toLocaleLowerCase('es').includes(term)
  })
})

async function loadProcessTypes() {
  loadError.value = ''
  try {
    await catalog.loadProcessTypes()
  } catch (error) {
    loadError.value = catalogErrorMessage(error, 'No fue posible cargar los trámites.')
  }
}

async function publish(processType) {
  if (busyId.value !== null) return
  busyId.value = processType.id
  actionError.value = ''
  success.value = ''
  try {
    const configuration = await catalog.getStages(processType.id)
    if (!configuration.stages.length) {
      actionError.value = 'Configura y guarda las etapas de este trámite antes de publicarlo.'
      return
    }
    await catalog.publishProcessType(processType.id, processType.version)
    success.value = 'Trámite publicado. Ya puedes utilizarlo para abrir expedientes de clientes.'
  } catch (error) {
    actionError.value = catalogErrorMessage(error, 'No fue posible publicar el trámite.')
    if (error.status === 409) await refreshAfterConflict()
  } finally {
    busyId.value = null
  }
}

async function deactivate() {
  if (!confirmTarget.value || busyId.value !== null) return
  const processType = confirmTarget.value
  busyId.value = processType.id
  actionError.value = ''
  success.value = ''
  try {
    await catalog.deactivateProcessType(processType.id, processType.version)
    confirmTarget.value = null
    success.value = 'Trámite desactivado correctamente.'
  } catch (error) {
    actionError.value = catalogErrorMessage(error, 'No fue posible desactivar el trámite.')
    if (error.status === 409) await refreshAfterConflict()
  } finally {
    busyId.value = null
  }
}

async function refreshAfterConflict() {
  try {
    await catalog.loadProcessTypes()
  } catch {
    // Se conserva el mensaje del conflicto original y la acción de reintento.
  }
}

function closeToast() {
  success.value = ''
  actionError.value = ''
  loadError.value = ''
}

async function runToastAction() {
  closeToast()
  await loadProcessTypes()
}

onMounted(loadProcessTypes)
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
      eyebrow="Configuración jurídica"
      title="Trámites"
      subtitle="Prepara las plantillas y sus requisitos antes de abrir expedientes para clientes."
    >
      <template #actions>
        <RouterLink v-if="canManage" class="primary-link" to="/tramites/nuevo">Nuevo trámite</RouterLink>
      </template>
    </PageHeader>

    <nav class="section-nav" aria-label="Configuración de trámites">
      <RouterLink to="/tramites" aria-current="page">Trámites</RouterLink>
      <RouterLink to="/requisitos">Requisitos</RouterLink>
    </nav>

    <div class="feedback-stack">
      <CatalogNotice v-if="!canManage">
        Tu perfil puede consultar trámites. La edición está disponible para Abogada y Administrador.
      </CatalogNotice>
    </div>

    <div class="toolbar">
      <label for="process-search">Buscar trámite</label>
      <input id="process-search" v-model="search" type="search" placeholder="Nombre o descripción">
      <label for="process-filter">Estado</label>
      <select id="process-filter" v-model="filter">
        <option value="all">Todos</option>
        <option value="PUBLISHED">Publicados</option>
        <option value="DRAFT">Borradores</option>
        <option value="INACTIVE">Inactivos</option>
      </select>
    </div>

    <div v-if="catalog.loadingProcessTypes" class="card-grid" role="status" aria-label="Cargando trámites">
      <BaseCard v-for="item in 3" :key="item" class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </BaseCard>
    </div>
    <BaseCard v-else-if="!loadError && !filtered.length" class="empty-card">
      <h2>{{ emptyTitle }}</h2>
      <p>{{ emptyDescription }}</p>
      <RouterLink v-if="canManage && !catalog.processTypes.length" class="primary-link" to="/tramites/nuevo">Crear trámite</RouterLink>
    </BaseCard>
    <div v-else-if="!loadError || filtered.length" class="card-grid">
      <BaseCard v-for="processType in filtered" :key="processType.id" class="process-card">
        <div class="card-top">
          <span class="process-symbol" aria-hidden="true">§</span>
          <BaseBadge :variant="statusVariants[processType.status] || 'neutral'">
            {{ statusLabels[processType.status] || processType.status }}
          </BaseBadge>
        </div>
        <h2>{{ processType.name }}</h2>
        <p class="description">{{ processType.description || 'Sin descripción adicional.' }}</p>
        <div class="card-actions">
          <RouterLink class="outline-link" :to="{ name: 'process-type-edit', params: { id: processType.id } }">
            {{ detailActionLabel(processType) }}
          </RouterLink>
          <RouterLink class="outline-link" :to="{ name: 'process-type-stages', params: { id: processType.id } }">Etapas</RouterLink>
          <BaseButton
            v-if="canManage && processType.status === 'DRAFT'"
            size="sm"
            :loading="busyId === processType.id"
            :disabled="busyId !== null"
            @click="publish(processType)"
          >Publicar</BaseButton>
          <BaseButton
            v-if="canManage && processType.status !== 'INACTIVE'"
            variant="ghost"
            size="sm"
            :disabled="busyId !== null"
            @click="confirmTarget = processType; actionError = ''"
          >Desactivar</BaseButton>
        </div>
      </BaseCard>
    </div>

    <BaseModal
      :open="Boolean(confirmTarget)"
      :dismissible="busyId === null"
      title-id="deactivate-process-title"
      @close="confirmTarget = null"
    >
      <div class="confirm-content">
        <h2 id="deactivate-process-title">Desactivar trámite</h2>
        <p>“{{ confirmTarget?.name }}” dejará de estar disponible para futuros expedientes.</p>
        <div class="confirm-actions">
          <BaseButton variant="outline" :disabled="busyId !== null" @click="confirmTarget = null">Cancelar</BaseButton>
          <BaseButton :loading="busyId !== null" @click="deactivate">Desactivar trámite</BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.catalog-page { width: 100%; min-width: 0; }
.primary-link, .outline-link { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border-radius: var(--radius-sm); padding: .55rem 1.1rem; font-size: .88rem; font-weight: 700; text-align: center; }
.primary-link { color: var(--color-text-on-primary); background: var(--color-primary); }
.primary-link:hover { color: var(--color-text-on-primary); background: var(--color-primary-hover); }
.outline-link { color: var(--color-text-body); border: 1px solid var(--color-border-medium); }
.outline-link:hover { color: var(--color-primary); background: var(--color-primary-subtle); }
.section-nav { display: flex; gap: .4rem; margin: -1rem 0 1.5rem; border-bottom: 1px solid var(--color-border-subtle); }
.section-nav a { padding: .7rem 1rem; color: var(--color-text-muted); font-weight: 650; border-bottom: 3px solid transparent; }
.section-nav a[aria-current='page'] { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.feedback-stack { display: grid; gap: .7rem; margin-bottom: 1rem; }
.toolbar { display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; gap: .35rem; margin-bottom: 1.25rem; }
.toolbar label:not(:first-child) { margin-top: .6rem; }
.toolbar label { font-size: .85rem; font-weight: 650; }
.toolbar input, .toolbar select { min-width: 0; min-height: 44px; font-size: 1rem; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr)); gap: 1rem; }
.process-card { min-width: 0; }
.card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.process-symbol { display: grid; place-items: center; width: 2.7rem; height: 2.7rem; border-radius: var(--radius-sm); background: var(--color-primary-subtle); color: var(--color-primary); font-size: 1.35rem; font-weight: 700; }
.process-card h2 { font-size: 1.1rem; overflow-wrap: anywhere; }
.description { color: var(--color-text-muted); font-size: .9rem; margin: .7rem 0 1.2rem; overflow-wrap: anywhere; }
.card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-top: auto; }
.card-actions > * { flex: 1 1 auto; min-height: 44px; }
.empty-card { text-align: center; }
.empty-card p { color: var(--color-text-muted); margin: .5rem 0 1rem; }
.skeleton-card { min-height: 190px; }
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
  .card-actions > * { flex: 0 1 auto; min-height: 40px; }
  .confirm-actions { flex-direction: row; }
  .confirm-actions :deep(button) { width: auto; }
}
</style>
