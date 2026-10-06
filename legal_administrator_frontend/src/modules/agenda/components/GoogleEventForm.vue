<!-- Edición de eventos externos: conserva el ETag y no convierte automáticamente el evento en una actividad interna. -->
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { agendaApi } from '../services/agendaApi.js'
import { FREQUENCIES, inputDate, localInputInstant, nextDay } from '../domain/agenda.js'
import { useAuthStore } from '@/modules/auth/stores/authStore.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { useLeaveConfirmation } from '@/shared/forms/useLeaveConfirmation.js'
import LeaveConfirmation from '@/components/common/LeaveConfirmation.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
const props = defineProps({ open: Boolean, event: Object })
const emit = defineEmits(['close', 'saved'])
const auth = useAuthStore()
const notifications = useNotificationStore()
const current = ref(null)
const form = ref({})
const scope = ref('ONE')
const busy = ref(false)
const discard = ref(false)
let actor = ''
let snapshot = ''
let sequence = 0
const dirty = computed(() => props.open && snapshot !== JSON.stringify(form.value))
const leave = useLeaveConfirmation(dirty, busy)
function draft(event) {
  let repeatFrequency = ''
  let repeatUntil = ''
  if (event.recurrence?.length) {
    repeatFrequency = 'KEEP'
    const match = event.recurrence[0].match(
      /^RRULE:FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY);UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
    )
    if (match) {
      repeatFrequency = match[1]
      repeatUntil = inputDate(
        `${match[2]}-${match[3]}-${match[4]}T${match[5]}:${match[6]}:${match[7]}Z`,
        event.timeZone,
      ).slice(0, 10)
    }
  }
  return {
    title: event.title,
    description: event.description || '',
    startsAt: inputDate(event.startsAt, event.timeZone),
    endsAt: inputDate(event.endsAt, event.timeZone),
    timeZone: event.timeZone,
    allDay: event.allDay,
    repeatFrequency,
    repeatUntil,
  }
}
watch(
  () => props.open,
  (open) => {
    sequence += 1
    busy.value = false
    discard.value = false
    if (!open || !props.event) {
      current.value = null
      form.value = {}
      return
    }
    actor = auth.user?.email
    current.value = props.event
    scope.value = 'ONE'
    if (props.event.recurrence?.length) {
      scope.value = 'ALL'
    }
    form.value = draft(props.event)
    snapshot = JSON.stringify(form.value)
  },
)
async function changeScope() {
  if (!current.value || busy.value) {
    return
  }
  const request = ++sequence
  busy.value = true
  try {
    let id = props.event.id
    if (scope.value === 'ALL' && props.event.seriesId) {
      id = props.event.seriesId
    }
    const event = await agendaApi.googleEvent(id)
    if (request !== sequence || actor !== auth.user?.email || !props.open) {
      return
    }
    current.value = event
    form.value = draft(event)
    snapshot = JSON.stringify(form.value)
  } catch (error) {
    if (request === sequence) {
      notifyRequestError(error, 'No fue posible consultar la serie.')
      emit('close')
    }
  } finally {
    if (request === sequence) {
      busy.value = false
    }
  }
}

function close() {
  if (busy.value) {
    return
  }
  if (dirty.value) {
    discard.value = true
    return
  }
  emit('close')
}

function allDayChanged() {
  if (!form.value.allDay) {
    return
  }
  const day = form.value.startsAt.slice(0, 10)
  form.value.startsAt = `${day}T00:00`
  form.value.endsAt = `${nextDay(day)}T00:00`
}

async function save() {
  if (busy.value || !current.value?.editable) {
    return
  }
  let payload
  try {
    const start = localInputInstant(form.value.startsAt, form.value.timeZone)
    const end = localInputInstant(form.value.endsAt, form.value.timeZone)
    if (!form.value.title.trim() || end <= start || new Date(end) - new Date(start) > 31 * 86400000) {
      throw new Error('Indica título y un horario válido de hasta 31 días.')
    }
    if (
      form.value.allDay &&
      (!form.value.startsAt.endsWith('T00:00') || !form.value.endsAt.endsWith('T00:00'))
    ) {
      throw new Error('Para todo el día utiliza medianoche y un fin exclusivo.')
    }
    let recurrence = null
    if (scope.value === 'ALL' && FREQUENCIES.some((item) => item.value === form.value.repeatFrequency)) {
      if (!form.value.repeatUntil) {
        throw new Error('Indica cuándo termina la repetición.')
      }
      recurrence = { frequency: form.value.repeatFrequency, until: form.value.repeatUntil }
    }
    payload = {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      startsAt: start,
      endsAt: end,
      timeZone: form.value.timeZone,
      allDay: form.value.allDay,
      etag: current.value.etag,
      scope: scope.value,
      recurrence,
      clearRecurrence:
        scope.value === 'ALL' && !form.value.repeatFrequency && Boolean(current.value.recurrence?.length),
    }
  } catch (error) {
    notifications.show(error.message, 'warning')
    return
  }
  busy.value = true
  const request = ++sequence
  try {
    const saved = await agendaApi.updateGoogle(current.value.id, payload)
    if (request !== sequence || actor !== auth.user?.email || !auth.isAuthenticated) {
      return
    }
    snapshot = JSON.stringify(form.value)
    notifications.show('Evento actualizado en Google Calendar.', 'success')
    emit('saved', saved)
    emit('close')
  } catch (error) {
    if (request === sequence && actor === auth.user?.email) {
      notifyRequestError(error, 'No fue posible actualizar Google. Recarga el evento antes de reintentar.')
    }
  } finally {
    if (request === sequence) {
      busy.value = false
    }
  }
}
watch(
  () => auth.user?.email,
  () => {
    sequence += 1
    current.value = null
    form.value = {}
    busy.value = false
    emit('close')
  },
)
onBeforeUnmount(() => {
  sequence += 1
  current.value = null
})
function discardChanges() {
  discard.value = false
  emit('close')
}
</script>
<template>
  <BaseModal :open="open" title-id="google-event-title" :dismissible="!busy" @close="close"
    ><form class="google-form" @submit.prevent="save">
      <h2 id="google-event-title">Editar evento de Google</h2>
      <p>Este contenido pertenece al calendario compartido. Zona: {{ form.timeZone }}.</p>
      <fieldset :disabled="busy">
        <label v-if="event?.seriesId || event?.recurrence?.length"
          >Aplicar cambios a<select
            v-model="scope"
            :disabled="!event?.seriesId || dirty"
            @change="changeScope"
          >
            <option value="ONE">Solo esta ocurrencia</option>
            <option value="ALL">Toda la serie</option>
          </select></label
        >
        <label>Título *<input v-model="form.title" maxlength="150" required /></label
        ><label class="check"
          ><input v-model="form.allDay" type="checkbox" @change="allDayChanged" /> Todo el día</label
        >
        <div class="two-columns">
          <label>Inicio *<input v-model="form.startsAt" type="datetime-local" required /></label
          ><label>Fin *<input v-model="form.endsAt" type="datetime-local" required /></label>
        </div>
        <template v-if="scope === 'ALL'"
          ><label
            >Repetición<select v-model="form.repeatFrequency">
              <option value="">Sin repetición</option>
              <option v-if="form.repeatFrequency === 'KEEP'" value="KEEP">
                Conservar la regla de Google
              </option>
              <option v-for="item in FREQUENCIES" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select></label
          ><label v-if="FREQUENCIES.some((item) => item.value === form.repeatFrequency)"
            >Repetir hasta *<input
              v-model="form.repeatUntil"
              type="date"
              :min="form.startsAt?.slice(0, 10)" /></label
        ></template>
        <label
          >Descripción visible en Google<textarea v-model="form.description" maxlength="2000" rows="3" />
        </label>
        <p>No incluyas DPI, documentos ni notas privadas del expediente.</p>
      </fieldset>
      <div class="actions">
        <BaseButton variant="outline" :disabled="busy" @click="close">Cerrar</BaseButton
        ><BaseButton type="submit" :loading="busy" :disabled="!current?.editable"
          >Guardar en Google</BaseButton
        >
      </div>
    </form></BaseModal
  >
  <BaseModal :open="discard" title-id="google-discard-title" @close="discard = false"
    ><div class="google-form">
      <h2 id="google-discard-title">Cerrar sin guardar</h2>
      <p>Se perderán los cambios del formulario.</p>
      <div class="actions">
        <BaseButton variant="outline" @click="discard = false">Continuar editando</BaseButton
        ><BaseButton @click="discardChanges">Descartar cambios</BaseButton>
      </div>
    </div></BaseModal
  >
  <LeaveConfirmation :open="leave.open.value" @decide="leave.decide" />
</template>
<style scoped>
.google-form,
fieldset,
label {
  display: grid;
  gap: 0.8rem;
  min-width: 0;
}
.google-form {
  padding: 1.5rem;
}
fieldset {
  padding: 0;
  border: 0;
}
p {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
input,
select,
textarea {
  min-height: 46px;
  font-size: 1rem;
  width: 100%;
}
.check {
  display: flex;
  align-items: center;
}
.check input {
  width: 22px;
  min-height: 22px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
}
.two-columns {
  display: grid;
  gap: 0.8rem;
}
@media (min-width: 640px) {
  .two-columns {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
