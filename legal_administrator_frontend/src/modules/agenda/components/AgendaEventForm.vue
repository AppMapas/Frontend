<!-- Formulario de actividades internas: diferencia una serie completa de una ocurrencia y conserva el control de versión. -->
<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import {
  TYPES,
  FREQUENCIES,
  emptyEvent,
  eventDraft,
  eventErrors,
  eventPayload,
  nextDay,
} from '../domain/agenda.js'
import { useAgendaSubmissionStore } from '../stores/agendaSubmissionStore.js'
import { useLeaveConfirmation } from '@/shared/forms/useLeaveConfirmation.js'
import LeaveConfirmation from '@/components/common/LeaveConfirmation.vue'
import { createRequestId } from '@/modules/processes/domain/caseRegistration.js'
import { useAuthStore } from '@/modules/auth/stores/authStore.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import ClientSelector from '@/modules/users/components/ClientSelector.vue'
import CasePicker from '@/modules/cash/components/CasePicker.vue'
const props = defineProps({
  open: Boolean,
  event: Object,
  day: String,
  caseId: [String, Number],
  client: Object,
  resume: Boolean,
})
const emit = defineEmits(['close', 'saved'])
const auth = useAuthStore()
const notifications = useNotificationStore()
const submission = useAgendaSubmissionStore()
const form = ref(emptyEvent())
const errors = ref({})
const busy = ref(false)
const uncertain = ref(false)
const element = ref(null)
const discardOpen = ref(false)
let requestId = null
let submitted = null
let snapshot = ''
let actor = ''
const editing = computed(
  () => Boolean(props.event?.id) || Boolean(props.resume && submission.pending?.eventId),
)
const occurrenceEditing = computed(() => Boolean(form.value.originalStartsAt))
const dirty = computed(() => props.open && snapshot !== JSON.stringify(form.value))
const leave = useLeaveConfirmation(dirty, busy)
watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }
    form.value = emptyEvent(props.day)
    if (props.event) {
      form.value = eventDraft(props.event)
    } else {
      form.value.caseId = props.caseId || ''
      form.value.client = props.client || null
    }
    requestId = createRequestId()
    submitted = null
    uncertain.value = false
    errors.value = {}
    snapshot = JSON.stringify(form.value)
    actor = auth.user?.email
    if (props.resume && submission.pending?.actor === actor) {
      submitted = submission.pending.payload
      requestId = submitted.requestId
      form.value = eventDraft({
        ...submitted,
        id: submission.pending.eventId,
        clientName: 'Cliente seleccionado',
      })
      uncertain.value = true
    }
  },
  {
    immediate: true,
  },
)
function close() {
  if (busy.value) {
    return
  }
  if (uncertain.value) {
    notifications.show(
      'Confirma el intento pendiente antes de cerrar para evitar crear la actividad dos veces.',
      'warning',
    )
    return
  }
  if (snapshot !== JSON.stringify(form.value)) {
    discardOpen.value = true
    return
  }
  emit('close')
}

function allDayChanged() {
  if (form.value.allDay) {
    const day = form.value.startsAt.slice(0, 10)
    form.value.startsAt = `${day}T00:00`
    form.value.endsAt = `${nextDay(day)}T00:00`
  }
}

async function save() {
  if (busy.value) {
    return
  }
  errors.value = eventErrors(form.value)
  if (!uncertain.value && Object.keys(errors.value).length) {
    notifications.show(Object.values(errors.value).join(' · '), 'warning')
    await nextTick()
    element.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }
  if (!submitted) {
    submitted = eventPayload(form.value, requestId)
  }
  busy.value = true
  try {
    let saved
    let eventId = null
    if (props.event?.id) {
      eventId = props.event.id
    } else if (props.resume) {
      eventId = submission.pending?.eventId || null
    }
    saved = await submission.send(submitted, actor, eventId)
    if (!saved || !auth.isAuthenticated || auth.user?.email !== actor) {
      return
    }
    snapshot = JSON.stringify(form.value)
    uncertain.value = false
    form.value = emptyEvent(props.day)
    notifications.show(
      'Actividad guardada en la agenda. La sincronización con Google se procesa por separado.',
      'success',
    )
    emit('saved', saved)
    emit('close')
  } catch (error) {
    if (!auth.isAuthenticated || auth.user?.email !== actor) {
      return
    }
    uncertain.value = error.status === 0 || error.status >= 500 || !error.status
    if (!uncertain.value) {
      submitted = null
    }
    if (error.status === 409 && editing.value) {
      notifications.show(
        'La actividad cambió. Cierra el formulario y vuelve a abrirla para consultar sus datos actuales.',
        'warning',
      )
    } else {
      notifyRequestError(error, 'No fue posible guardar la actividad.')
    }
  } finally {
    busy.value = false
  }
}
watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (!authenticated) {
      submission.reset()
      submitted = null
      uncertain.value = false
      emit('close')
    }
  },
)
function discardChanges() {
  discardOpen.value = false
  emit('close')
}
</script>
<template>
  <BaseModal :open="open" title-id="agenda-form-title" :dismissible="!busy" @close="close">
    <form ref="element" class="agenda-form" novalidate @submit.prevent="save">
      <div class="form-heading">
        <h2 id="agenda-form-title">
          <span v-if="editing">Editar actividad</span><span v-else>Nueva actividad</span>
        </h2>
        <p>Zona del horario: {{ form.timeZone }}. Los campos con * son obligatorios.</p>
      </div>
      <fieldset :disabled="busy || uncertain">
        <div class="fields">
          <label
            >Título *<input
              v-model="form.title"
              autofocus
              maxlength="150"
              :aria-invalid="Boolean(errors.title)"
              placeholder="Ej. Consulta inicial"
          /></label>
          <label
            >Tipo de actividad *<select v-model="form.type" :disabled="occurrenceEditing">
              <option v-for="type in TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
            </select></label
          >
          <label class="check"
            ><input
              v-model="form.allDay"
              :disabled="occurrenceEditing"
              type="checkbox"
              @change="allDayChanged"
            />
            Todo el día</label
          >
          <div class="two-columns">
            <label
              >Inicio *<input
                v-model="form.startsAt"
                type="datetime-local"
                :aria-invalid="Boolean(errors.startsAt)"
            /></label>
            <label
              >Fin *<input v-model="form.endsAt" type="datetime-local" :aria-invalid="Boolean(errors.endsAt)"
            /></label>
          </div>
          <p v-if="form.allDay" class="help">
            Para una actividad de un día, utiliza las 00:00 del día siguiente como fin.
          </p>
          <template v-if="!occurrenceEditing"
            ><label
              >Repetición<select v-model="form.repeatFrequency">
                <option value="">Sin repetición</option>
                <option v-for="item in FREQUENCIES" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select></label
            >
            <label v-if="form.repeatFrequency"
              >Repetir hasta *<input
                v-model="form.repeatUntil"
                type="date"
                :min="form.startsAt.slice(0, 10)"
                :aria-invalid="Boolean(errors.repeatUntil)" /></label
          ></template>
          <p v-else class="help">
            Estás editando una sola ocurrencia. La serie conserva su cliente, expediente y repetición.
          </p>
          <label
            >Lugar<input
              v-model="form.location"
              maxlength="255"
              placeholder="Oficina, juzgado o reunión virtual"
          /></label>
          <CasePicker
            v-model="form.caseId"
            :disabled="busy || uncertain || occurrenceEditing"
            :invalid="Boolean(errors.caseId)"
          />
          <div v-if="!form.caseId">
            <h3>Cliente de la actividad</h3>
            <ClientSelector v-model="form.client" :disabled="busy || uncertain || occurrenceEditing" />
          </div>
          <p v-else class="help">La actividad se asociará al cliente del expediente seleccionado.</p>
          <label
            >Notas privadas<textarea
              v-model="form.description"
              rows="3"
              maxlength="2000"
              placeholder="Estas notas permanecen en la aplicación."
            />
          </label>
        </div>
      </fieldset>
      <div class="actions">
        <BaseButton variant="outline" :disabled="busy" @click="close">Cerrar</BaseButton>
        <BaseButton type="submit" :loading="busy"
          ><span v-if="uncertain">Confirmar intento pendiente</span
          ><span v-else>Guardar actividad</span></BaseButton
        >
      </div>
    </form>
  </BaseModal>
  <BaseModal :open="discardOpen" title-id="agenda-discard-title" @close="discardOpen = false"
    ><div class="agenda-form">
      <h2 id="agenda-discard-title">Cerrar sin guardar</h2>
      <p>Se perderán los cambios de este formulario.</p>
      <div class="actions">
        <BaseButton variant="outline" @click="discardOpen = false">Continuar editando</BaseButton
        ><BaseButton @click="discardChanges">Descartar cambios</BaseButton>
      </div>
    </div></BaseModal
  >
  <LeaveConfirmation :open="leave.open.value" @decide="leave.decide" />
</template>
<style scoped>
.agenda-form {
  display: grid;
  gap: 1.2rem;
  padding: 1.5rem;
}
.form-heading p,
.help {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
fieldset {
  padding: 0;
  border: 0;
  min-width: 0;
}
.fields {
  display: grid;
  gap: 1rem;
}
label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.95rem;
  font-weight: 600;
}
input,
select,
textarea {
  width: 100%;
  min-height: 46px;
  font-size: 1rem;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.check input {
  width: 22px;
  min-height: 22px;
}
.two-columns {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
.two-columns label {
  min-width: 0;
}
.actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.7rem;
}
@media (min-width: 640px) {
  .two-columns {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
