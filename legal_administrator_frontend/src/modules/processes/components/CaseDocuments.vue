<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { caseDocumentsApi } from '../services/caseDocumentsApi.js'
import { documentFileError, formatFileSize, isPermanentUploadError } from '../domain/documentFiles.js'
import { formatTimestamp } from '../domain/caseRegistration.js'

const props = defineProps({ caseId: { type: Number, required: true }, active: Boolean })
const emit = defineEmits(['state'])
const documents = ref([])
const queue = ref([])
const policy = ref(null)
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const feedback = ref('')
const opening = ref(null)
const preview = ref(null)
const filesInput = ref(null)
const galleryInput = ref(null)
const cameraInput = ref(null)
// Solo los archivos que el servidor todavía podría aceptar cuentan como pendientes:
// los inválidos o ya rechazados se muestran con su error, pero no bloquean la navegación.
const isWaiting = (item) => !item.validation && item.status !== 'saved' && item.status !== 'rejected'
const pending = computed(() => queue.value.some(isWaiting))
let alive = true
let selectionId = 0
const downloadUrls = new Map()

watch([pending, uploading], () => emit('state', { pending: pending.value, busy: uploading.value }), { immediate: true })

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [items, rules] = await Promise.all([caseDocumentsApi.list(props.caseId), caseDocumentsApi.policy()])
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
        const document = await caseDocumentsApi.upload(props.caseId, item.file)
        if (!alive) break
        documents.value.unshift(document)
        item.status = 'saved'
        saved += 1
      } catch (cause) {
        item.status = isPermanentUploadError(cause) ? 'rejected' : 'failed'
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

function closePreview() {
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  preview.value = null
}

async function openDocument(document, download = false) {
  if (opening.value) return
  opening.value = document.id
  error.value = ''
  try {
    const blob = await caseDocumentsApi.content(props.caseId, document.id, download)
    if (!alive) return
    const url = URL.createObjectURL(blob)
    if (download) {
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.name
      window.document.body.append(link)
      link.click()
      link.remove()
      const timer = setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url) }, 60000)
      downloadUrls.set(url, timer)
    } else {
      closePreview()
      preview.value = { ...document, url }
    }
  } catch (cause) {
    if (alive) error.value = cause.message || 'No fue posible consultar el documento.'
  } finally {
    opening.value = null
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
      <div><h2>Documentos adjuntos</h2><p class="help">Escrituras, DPI, licencias y documentación del expediente.</p></div>
      <BaseButton variant="outline" :disabled="loading || uploading" @click="load">Actualizar documentos</BaseButton>
    </header>
    <p v-if="error" role="alert" class="document-error">{{ error }} <button type="button" @click="load" :disabled="loading || uploading">Reintentar consulta</button></p>
    <p v-if="loading" role="status">Cargando documentos…</p>
    <template v-if="policy && active">
      <p class="help">PDF, JPG y PNG · Máximo {{ formatFileSize(policy.maxFileSize) }} por archivo. Puedes agregar varios documentos.</p>
      <div class="actions">
        <BaseButton variant="outline" :disabled="uploading" @click="filesInput.click()">Seleccionar archivos</BaseButton>
        <BaseButton variant="outline" :disabled="uploading" @click="galleryInput.click()">Galería</BaseButton>
        <BaseButton variant="outline" :disabled="uploading" @click="cameraInput.click()">Tomar foto</BaseButton>
      </div>
      <input ref="filesInput" type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" @change="selectFiles" />
      <input ref="galleryInput" type="file" hidden multiple accept="image/jpeg,image/png" @change="selectFiles" />
      <input ref="cameraInput" type="file" hidden accept="image/jpeg,image/png" capture="environment" @change="selectFiles" />
      <p class="help">En el teléfono, «Tomar foto» solicita la cámara según el navegador. Si la foto está en HEIC, conviértela a JPG o PNG.</p>
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
        <div class="document-info"><strong>{{ document.name }}</strong>
          <span>{{ formatFileSize(document.sizeBytes) }} · {{ formatTimestamp(document.uploadedAt) }}</span>
        </div>
        <div class="actions">
          <BaseButton variant="outline" :disabled="!!opening" @click="openDocument(document)">Consultar</BaseButton>
          <BaseButton variant="outline" :disabled="!!opening" @click="openDocument(document, true)">Descargar</BaseButton>
        </div>
      </li>
    </ul>
    <p v-if="opening" role="status">Recuperando documento…</p>
  </BaseCard>
  <BaseModal :open="!!preview" title-id="document-preview-title" wide @close="closePreview">
    <div v-if="preview" class="document-preview">
      <header class="record-heading"><h2 id="document-preview-title">{{ preview.name }}</h2>
        <BaseButton variant="outline" @click="closePreview">Cerrar</BaseButton></header>
      <img v-if="preview.contentType.startsWith('image/')" :src="preview.url" :alt="preview.name" />
      <iframe v-else :src="preview.url" :title="preview.name" sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe>
      <p class="help">Si el navegador no muestra la vista previa, descarga el documento para abrirlo.</p>
      <BaseButton :disabled="!!opening" @click="openDocument(preview, true)">Descargar documento</BaseButton>
    </div>
  </BaseModal>
</template>

<style src="../../../shared/styles/office.css" scoped></style>
<style scoped>
.document-list { display: grid; gap: .75rem; list-style: none; padding: 0; }
.document-list li { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .75rem; padding: 1rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); }
.document-info { display: grid; gap: .35rem; min-width: 0; overflow-wrap: anywhere; }
.document-info span { font-size: .85rem; }
.document-error { color: var(--color-danger-strong); overflow-wrap: anywhere; }
.document-preview { display: grid; gap: 1rem; padding: 1.25rem; }
.document-preview h2 { overflow-wrap: anywhere; min-width: 0; }
.document-preview img { max-width: 100%; max-height: 65vh; object-fit: contain; justify-self: center; }
.document-preview iframe { width: 100%; height: 65vh; border: 0; }
</style>
