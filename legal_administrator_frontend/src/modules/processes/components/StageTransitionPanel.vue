<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore.js'
import { useStageTransitionStore } from '../stores/stageTransitionStore.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps({
  detail: { type: Object, required: true },
})
const emit = defineEmits(['updated', 'conflict'])
const auth = useAuthStore()
const transitions = useStageTransitionStore()
const notifications = useNotificationStore()
const target = ref('')
const comment = ref('')
const confirmOpen = ref(false)
const timeline = computed(() => props.detail.timeline)
const record = computed(() => props.detail.caseData)
const legacy = computed(() => !timeline.value?.currentStage)
const canManage = computed(() => ['Abogada', 'Administrador'].includes(auth.user?.role))
const pendingHere = computed(() => transitions.uncertain && transitions.pendingCaseId === record.value?.id
  && transitions.pendingActor === auth.user?.dpi)
const pendingElsewhere = computed(() => transitions.uncertain && transitions.pendingCaseId !== record.value?.id
  && transitions.pendingActor === auth.user?.dpi)
const destinations = computed(() => {
  if (!timeline.value) return []
  if (legacy.value) return timeline.value.stages || []
  return (timeline.value.stages || []).filter(stage => timeline.value.allowedNextStageIds?.includes(stage.id))
})
const selected = computed(() => {
  if (legacy.value) return destinations.value.find(stage => stage.code === target.value)
  return destinations.value.find(stage => String(stage.id) === target.value)
})
const heading = computed(() => {
  if (legacy.value) return 'Asignar etapa actual'
  return 'Cambiar etapa'
})
const commentLabel = computed(() => {
  if (legacy.value) return 'obligatoria'
  return 'opcional'
})
function optionValue(stage) {
  if (legacy.value) return stage.code
  return String(stage.id)
}

function resetFields() {
  target.value = ''
  comment.value = ''
  confirmOpen.value = false
}
watch(() => record.value?.id, resetFields)

function requestTransition() {
  if (transitions.busy || pendingHere.value || pendingElsewhere.value || !record.value?.active) return
  if (!selected.value) {
    notifications.show('Selecciona una etapa de destino.', 'warning')
    return
  }
  if (comment.value.trim().length > 1000) {
    notifications.show('La observación no puede superar 1000 caracteres.', 'warning')
    return
  }
  if (legacy.value && !comment.value.trim()) {
    notifications.show('Explica la etapa real antes de inicializar este expediente anterior.', 'warning')
    return
  }
  confirmOpen.value = true
}
async function sendTransition() {
  if (transitions.busy) return
  const wasLegacy = legacy.value
  let payload = null
  if (!pendingHere.value) {
    if (!selected.value) {
      notifications.show('Selecciona una etapa de destino.', 'warning')
      return
    }
    payload = { version: record.value.version, comment: comment.value.trim() || null }
    if (legacy.value) payload.targetStageCode = selected.value.code
    else payload.targetStageId = selected.value.id
  }
  confirmOpen.value = false
  try {
    const updated = await transitions.move(record.value.id, payload, auth.user?.dpi)
    emit('updated', updated)
    resetFields()
    if (wasLegacy) notifications.show('Etapa inicial registrada con su fecha real.', 'success')
    else notifications.show('Etapa del expediente actualizada.', 'success')
  } catch (error) {
    if (transitions.uncertain) {
      notifyRequestError(error, 'No se pudo confirmar el cambio de etapa.', 'Reintentar mismo cambio', sendTransition)
      return
    }
    let actionLabel = ''
    let action = null
    if (error?.status === 409) {
      actionLabel = 'Actualizar expediente'
      action = () => emit('conflict')
    }
    notifyRequestError(error, 'No fue posible cambiar la etapa.', actionLabel, action)
  }
}
</script>
<template>
  <div class="transition-panel">
    <div>
      <h3>{{ heading }}</h3>
      <p class="muted" v-if="legacy">Este expediente se abrió antes del seguimiento por etapas. Selecciona la fase real y explica cómo se verificó.</p>
      <p class="muted" v-else>Solo aparecen los destinos permitidos por el trámite al abrir este expediente.</p>
    </div>
    <div v-if="pendingHere" class="pending-actions">
      <p class="muted">El servidor aún no confirmó el cambio. Reintenta la misma solicitud para comprobar el resultado.</p>
      <BaseButton :loading="transitions.busy" @click="sendTransition">Reintentar mismo cambio</BaseButton>
    </div>
    <div v-else-if="pendingElsewhere" class="pending-actions">
      <p class="muted">Hay un cambio de etapa sin confirmar en otro expediente. Comprueba ese resultado antes de registrar uno nuevo.</p>
      <RouterLink class="link-button" :to="{ name: 'legal-process-detail', params: { id: transitions.pendingCaseId } }">Ir al expediente pendiente</RouterLink>
    </div>
    <p v-else-if="!record.active" class="muted">El expediente está inactivo y no permite cambiar de etapa.</p>
    <p v-else-if="!canManage" class="muted">Tu perfil solo puede consultar el seguimiento.</p>
    <p v-else-if="!destinations.length" class="muted">No hay más cambios de etapa permitidos desde la fase actual.</p>
    <div v-else class="transition-fields">
      <label for="next-stage">Etapa de destino
        <select id="next-stage" v-model="target" :disabled="transitions.busy">
          <option value="">Selecciona una etapa</option>
          <option v-for="stage in destinations" :key="stage.code" :value="optionValue(stage)">{{ stage.name }}</option>
        </select>
      </label>
      <label for="transition-comment">Observación {{ commentLabel }}
        <textarea id="transition-comment" v-model="comment" rows="3" maxlength="1000" :disabled="transitions.busy"
          placeholder="Ej. Se recibió la constancia de presentación"></textarea>
      </label>
      <BaseButton :disabled="!target || transitions.busy" @click="requestTransition">Continuar</BaseButton>
    </div>
    <BaseModal :open="confirmOpen" title-id="stage-confirm-title" @close="confirmOpen = false">
      <div class="confirm-content">
        <h2 id="stage-confirm-title">Confirmar etapa</h2>
        <p>Se registrará “{{ selected?.name }}” en el historial con la fecha y la usuaria de la sesión actual.</p>
        <div class="actions">
          <BaseButton variant="outline" @click="confirmOpen = false">Cancelar</BaseButton>
          <BaseButton :loading="transitions.busy" @click="sendTransition">Registrar etapa</BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
<style scoped>
.transition-panel { display: grid; gap: 1rem; }
.transition-panel h3 { color: var(--color-text-title); }
.transition-fields { display: grid; gap: .8rem; }
.transition-fields select, .transition-fields textarea { width: 100%; min-height: 46px; }
.transition-fields :deep(button), .pending-actions :deep(button) { min-height: 44px; }
.pending-actions { display: grid; gap: .7rem; padding: 1rem; border: 1px solid var(--color-border-medium); border-radius: var(--radius-sm); background: var(--color-bg-subtle); }
.pending-actions .link-button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: .6rem 1rem; border: 1px solid var(--color-border-control); border-radius: var(--radius-sm); color: var(--color-teal-strong); font-weight: 650; text-align: center; }
@media (min-width: 720px) {
  .transition-fields { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: end; }
  .transition-fields :deep(button) { justify-self: start; }
}
</style>
