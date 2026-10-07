<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { caseDocumentsApi } from '../services/caseDocumentsApi.js'
import {
  documentExtension,
  documentFileError,
  formatFileSize,
  isImageDocument,
  isPermanentError,
} from '../domain/documentFiles.js'
import { formatTimestamp } from '../domain/caseRegistration.js'

const props = defineProps({ caseId: { type: Number, required: true }, requirementId: Number, requiresDocument: Boolean, active: Boolean })
const emit = defineEmits(['state', 'documents'])
const documents = ref([])
watch(() => documents.value.filter(document => document.contentType === 'application/pdf').length,
  count => emit('documents', count), { immediate: true })
const queue = ref([])
const policy = ref(null)
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const feedback = ref('')
const opening = ref(null)
const preview = ref(null)
const filesInput = ref(null)
// Solo los archivos que el servidor todavía podría aceptar cuentan como pendientes:
// los inválidos o ya rechazados se muestran con su error, pero no bloquean la navegación.
const isWaiting = (item) => !item.validation && item.status !== 'saved' && item.status !== 'rejected'
const pending = computed(() => queue.value.some(isWaiting))
const previewMeta = computed(() => (preview.value
  ? `${formatFileSize(preview.value.document.sizeBytes)} · ${formatTimestamp(preview.value.document.uploadedAt)}`
  : ''))
let alive = true
let selectionId = 0
const downloadUrls = new Map()

watch([pending, uploading], () => emit('state', { pending: pending.value, busy: uploading.value }), { immediate: true })

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [items, rules] = await Promise.all([caseDocumentsApi.list(props.caseId, props.requirementId), caseDocumentsApi.policy()])
    if (!alive) return
    documents.value = items
    policy.value = rules
  } catch (cause) {
    if (alive) error.value = cause.message || 'No fue posible cargar los documentos.'
  } finally {
    if (alive) loading.value = false
  }
}

function selectFiles(event) {
  for (const file of Array.from(event.target.files || [])) {
    const validation = documentFileError(file, policy.value)
    queue.value.push({ id: ++selectionId, file, validation, error: validation, status: 'pending' })
  }
  event.target.value = ''
  feedback.value = ''
}

async function upload() {
  if (uploading.value || loading.value || !props.active) return
  uploading.value = true
  feedback.value = ''
  let saved = 0
  try {
    for (const item of queue.value) {
      if (!alive) break
      if (item.validation || item.status === 'saved' || item.status === 'rejected') continue
      item.status = 'uploading'
      item.error = ''
      try {
        const document = await caseDocumentsApi.upload(props.caseId, item.file, props.requirementId)
        if (!alive) break
        documents.value.unshift(document)
        item.status = 'saved'
        saved += 1
      } catch (cause) {
        item.status = isPermanentError(cause) ? 'rejected' : 'failed'
        item.error = cause.message || 'No fue posible guardar este documento.'
      }
    }
    if (!alive) return
    const remaining = pending.value
    if (saved > 0) {
      const summary = saved === 1 ? '1 documento guardado.' : `${saved} documentos guardados.`
      feedback.value = `${summary}${remaining ? ' Revisa los archivos pendientes.' : ''}`
    } else {
      feedback.value = remaining ? 'No se guardaron los archivos pendientes. Revisa los mensajes.' : ''
    }
  } finally {
    uploading.value = false
  }
}

function releasePreviewUrl() {
  if (preview.value?.url) {
    URL.revokeObjectURL(preview.value.url)
    preview.value.url = ''
  }
}

function closePreview() {
  releasePreviewUrl()
  preview.value = null
}

// El visor se abre de inmediato: en un teléfono con datos lentos el usuario debe ver
// que la consulta arrancó, aunque el documento tarde en llegar.
async function openDocument(document) {
  if (opening.value) return
  closePreview()
  preview.value = { document, url: '', error: '', permanent: false }
  await loadPreview(document)
}

async function loadPreview(document) {
  if (opening.value) return
  opening.value = document.id
  // El reintento debe limpiar el error anterior: si no, el mensaje persiste aunque el visor se recupere.
  if (preview.value?.document.id === document.id) {
    preview.value.error = ''
    preview.value.permanent = false
  }
  try {
    const blob = await caseDocumentsApi.content(props.caseId, document.id, false)
    if (!alive || preview.value?.document.id !== document.id) return
    releasePreviewUrl()
    preview.value.url = URL.createObjectURL(blob)
  } catch (cause) {
    if (alive && preview.value?.document.id === document.id) {
      preview.value.error = cause.message || 'No fue posible consultar el documento.'
      // Un rechazo definitivo (p. ej. el archivo ya no está en el almacenamiento) no mejora reintentando.
      preview.value.permanent = isPermanentError(cause)
    }
  } finally {
    if (opening.value === document.id) opening.value = null
  }
}

async function downloadDocument(document) {
  if (opening.value) return
  opening.value = document.id
  error.value = ''
  try {
    const blob = await caseDocumentsApi.content(props.caseId, document.id, true)
    if (!alive) return
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = document.name
    window.document.body.append(link)
    link.click()
    link.remove()
    const timer = setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url) }, 60000)
    downloadUrls.set(url, timer)
  } catch (cause) {
    if (alive) error.value = cause.message || 'No fue posible descargar el documento.'
  } finally {
    if (opening.value === document.id) opening.value = null
  }
}

onMounted(load)
onBeforeUnmount(() => {
  alive = false
  closePreview()
  for (const [url, timer] of downloadUrls) { clearTimeout(timer); URL.revokeObjectURL(url) }
  emit('state', { pending: false, busy: false })
})
</script>

<template>
  <BaseCard class="form-section documents-section">
    <header class="record-heading">
      <div><h2>Documentos adjuntos</h2><p class="help">{{ requirementId ? (requiresDocument ? 'Este requisito exige un documento adjunto.' : 'Puedes adjuntar evidencia opcional para este requisito.') : 'Documentación del expediente.' }}</p></div>
    </header>
    <p v-if="error" role="alert" class="document-error">{{ error }} <button type="button" class="link-button" @click="load" :disabled="loading || uploading">Reintentar consulta</button></p>
    <p v-if="loading" role="status">Cargando documentos…</p>
    <template v-if="policy && active">
      <p class="help">Solo PDF · Máximo {{ formatFileSize(policy.maxFileSize) }} por archivo.</p>
      <div class="actions">
        <BaseButton variant="outline" :disabled="uploading" @click="filesInput.click()">Seleccionar archivos</BaseButton>
      </div>
      <input ref="filesInput" type="file" hidden multiple accept=".pdf,application/pdf" @change="selectFiles" />
      <ul v-if="queue.length" class="document-list" aria-label="Archivos seleccionados">
        <li v-for="item in queue" :key="item.id">
          <div class="document-info"><strong>{{ item.file.name }}</strong><span>{{ formatFileSize(item.file.size) }}</span>
            <span v-if="item.status === 'uploading'" role="status">Guardando…</span>
            <span v-if="item.status === 'saved'">Guardado</span>
            <span v-if="item.error" class="document-error" role="alert">{{ item.error }}</span>
          </div>
          <BaseButton variant="outline" :disabled="uploading" :aria-label="`Quitar de la selección: ${item.file.name}`" @click="queue = queue.filter(entry => entry.id !== item.id)">Quitar</BaseButton>
        </li>
      </ul>
      <div v-if="queue.length" class="actions">
        <BaseButton :disabled="!pending || loading" :loading="uploading" @click="upload">Guardar archivos pendientes</BaseButton>
        <BaseButton variant="outline" :disabled="uploading" @click="queue = []">Limpiar selección</BaseButton>
      </div>
      <p v-if="feedback" role="status">{{ feedback }}</p>
    </template>
    <p v-if="!active" class="help">Este expediente está inactivo. Puedes consultar sus documentos.</p>
    <p v-if="!loading && !error && !documents.length" class="muted">Todavía no hay documentos adjuntos.</p>
    <ul v-if="documents.length" class="document-list" aria-label="Documentos guardados">
      <li v-for="document in documents" :key="document.id">
        <div class="document-info">
          <span class="document-badge" aria-hidden="true">{{ documentExtension(document.name) }}</span>
          <strong>{{ document.name }}</strong>
          <span>{{ formatFileSize(document.sizeBytes) }} · {{ formatTimestamp(document.uploadedAt) }}</span>
        </div>
        <div class="actions">
          <BaseButton
            variant="outline"
            :disabled="!!opening"
            :aria-label="`Consultar ${document.name}`"
            @click="openDocument(document)"
          >Consultar</BaseButton>
          <BaseButton
            variant="outline"
            :disabled="!!opening"
            :aria-label="`Descargar ${document.name}`"
            @click="downloadDocument(document)"
          >Descargar</BaseButton>
        </div>
      </li>
    </ul>
    <p v-if="opening && !preview" role="status">Recuperando documento…</p>
  </BaseCard>
  <BaseModal
    :open="!!preview"
    title-id="document-preview-title"
    description-id="document-preview-status"
    wide
    @close="closePreview"
  >
    <div v-if="preview" class="document-preview">
      <header class="record-heading">
        <div>
          <h2 id="document-preview-title">{{ preview.document.name }}</h2>
          <p class="help">{{ previewMeta }}</p>
        </div>
        <BaseButton variant="outline" @click="closePreview">Cerrar</BaseButton>
      </header>

      <p id="document-preview-status" class="help" role="status">
        <template v-if="preview.error">No fue posible mostrar el documento.</template>
        <template v-else-if="!preview.url">Preparando documento…</template>
        <template v-else-if="isImageDocument(preview.document)">Imagen del expediente.</template>
        <template v-else>Vista previa del documento PDF.</template>
      </p>

      <img
        v-if="preview.url && isImageDocument(preview.document)"
        class="document-image"
        :src="preview.url"
        :alt="`Imagen del documento ${preview.document.name}`"
      />
      <object
        v-else-if="preview.url"
        class="document-frame"
        :data="preview.url"
        :type="preview.document.contentType || 'application/pdf'"
      >
        <p class="document-fallback">
          Tu navegador no puede mostrar este documento aquí. Usa «Descargar documento» para abrirlo.
        </p>
      </object>

      <p v-if="preview.error" class="document-error">
        {{ preview.error }}
        <button
          v-if="!preview.permanent"
          type="button"
          class="link-button"
          :disabled="!!opening"
          @click="loadPreview(preview.document)"
        >Reintentar</button>
      </p>

      <p v-else-if="preview.url" class="help">
        Si el navegador no muestra la vista previa, descarga el documento para abrirlo.
      </p>

      <BaseButton
        :loading="!!opening"
        :disabled="preview.permanent"
        :title="preview.permanent ? 'El archivo ya no está en el almacenamiento.' : undefined"
        @click="downloadDocument(preview.document)"
      >Descargar documento</BaseButton>
    </div>
  </BaseModal>
</template>

<style src="../../../shared/styles/office.css" scoped></style>
<style scoped>
.document-list { display: grid; gap: .75rem; list-style: none; padding: 0; }
.document-list li { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem; padding: 1rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); }
.document-info { display: grid; gap: .35rem; min-width: 0; overflow-wrap: anywhere; }
.document-info span { font-size: .85rem; }
.document-badge { justify-self: start; padding: .1rem .45rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); font-size: .75rem !important; font-weight: 700; letter-spacing: .04em; color: var(--color-text-muted); background: var(--color-bg-subtle); }
.document-error { color: var(--color-danger-strong); overflow-wrap: anywhere; }
.document-preview { display: grid; gap: 1rem; padding: 1.25rem; }
.document-preview h2 { overflow-wrap: anywhere; min-width: 0; }
.document-image { max-width: 100%; max-height: 65vh; object-fit: contain; justify-self: center; }
.document-frame { width: 100%; height: 65vh; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); background: var(--color-bg-subtle); }
.document-fallback { display: grid; gap: .5rem; place-content: center; height: 100%; margin: 0; padding: 1rem; text-align: center; color: var(--color-text-muted); }

/* En pantallas bajas el visor cede espacio para que «Descargar documento» quede a la vista. */
@media (max-width: 640px), (max-height: 720px) {
  .document-frame { height: 50vh; }
  .document-image { max-height: 50vh; }
}
</style>
