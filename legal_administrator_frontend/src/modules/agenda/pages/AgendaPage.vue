<!-- Coordina filtros, vistas y modales; los errores y confirmaciones se muestran mediante toasts. -->
<script setup>
import { validDay } from '@/shared/date/calendarDay.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore.js'
import { useAgendaSubmissionStore } from '../stores/agendaSubmissionStore.js'
import { useAgendaStore } from '../stores/agendaStore.js'
import { clientsApi } from '@/modules/users/services/clientsApi.js'
import { agendaApi } from '../services/agendaApi.js'
import {
  TYPES,
  FREQUENCIES,
  STATUS_LABELS,
  SYNC_LABELS,
  dayKey,
  dayStart,
  nextDay,
  monthDays,
  monthWindow,
  dateLabel,
} from '../domain/agenda.js'
import { dayCounts, eventKey, mergeEvents, weekDays } from '../domain/calendar.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import AgendaDayActivities from '../components/AgendaDayActivities.vue'
import AgendaCalendar from '../components/AgendaCalendar.vue'
import AgendaWeekView from '../components/AgendaWeekView.vue'
import AgendaEventForm from '../components/AgendaEventForm.vue'
import GoogleEventForm from '../components/GoogleEventForm.vue'
import GoogleCalendarConnection from '../components/GoogleCalendarConnection.vue'
import UpcomingActivities from '../components/UpcomingActivities.vue'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const agenda = useAgendaStore()
const submission = useAgendaSubmissionStore()
const notifications = useNotificationStore()
let initialDay = dayKey()
if (validDay(route.query.day)) {
  initialDay = route.query.day
}
const selectedDay = ref(initialDay)
const dayOpen = ref(false)
const listOpen = ref(false)
const view = ref('month')
const mode = ref('day')
const filterStatus = ref('SCHEDULED')
const page = ref(0)
const revision = ref(0)
const resume = ref(false)
const selectedClient = ref(null)
const formOpen = ref(false)
const editingEvent = ref(null)
const googleFormOpen = ref(false)
const googleEditing = ref(null)
const detail = ref(null)
const history = ref([])
const detailBusy = ref(false)
const confirmation = ref(null)
const reason = ref('')
const statusScope = ref('ONE')
const changing = ref(false)
const reconcileOpen = ref(false)
const editChoice = ref(false)
let clientSequence = 0
let detailSequence = 0
let alive = true
let timer = null
const caseId = computed(() => route.query.caseId || '')
const clientDpi = computed(() => route.query.clientDpi || '')
const visibleDays = computed(() => {
  if (view.value === 'week') {
    return weekDays(selectedDay.value)
  }
  return monthDays(selectedDay.value)
})
const calendarRange = computed(() => ({
  from: dayStart(visibleDays.value[0]),
  to: dayStart(nextDay(visibleDays.value.at(-1))),
}))
const allEvents = computed(() =>
  mergeEvents(agenda.calendarEvents, agenda.googleEvents).filter((event) => {
    if (caseId.value && String(event.caseId) !== String(caseId.value)) {
      return false
    }
    if (clientDpi.value && event.clientDpi !== clientDpi.value) {
      return false
    }
    if (filterStatus.value && event.status !== filterStatus.value) {
      return false
    }
    return true
  }),
)
const counts = computed(() => dayCounts(allEvents.value, visibleDays.value))
const listRange = computed(() => {
  if (mode.value === 'month') {
    return monthWindow(selectedDay.value)
  }
  if (mode.value === 'week') {
    const days = weekDays(selectedDay.value)
    return { from: dayStart(days[0]), to: dayStart(nextDay(days[6])) }
  }
  return { from: dayStart(selectedDay.value), to: dayStart(nextDay(selectedDay.value)) }
})
const listEvents = computed(() =>
  allEvents.value.filter(
    (event) =>
      Date.parse(event.startsAt) < Date.parse(listRange.value.to) &&
      Date.parse(event.endsAt) > Date.parse(listRange.value.from),
  ),
)
const totalPages = computed(() => Math.ceil(listEvents.value.length / 25))
const displayed = computed(() => listEvents.value.slice(page.value * 25, (page.value + 1) * 25))
const monthLabel = computed(() =>
  new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    new Date(`${selectedDay.value.slice(0, 7)}-01T12:00:00Z`),
  ),
)
const listTitle = computed(() => {
  if (mode.value === 'month') {
    return 'Actividades del mes'
  }
  if (mode.value === 'week') {
    return 'Actividades de la semana'
  }
  return `Actividades del ${new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(`${selectedDay.value}T12:00:00Z`))}`
})
async function loadCalendar(report = true) {
  const result = await agenda.loadCalendar({
    ...calendarRange.value,
    caseId: caseId.value,
    clientDpi: clientDpi.value,
  })
  if (!alive || !result || !report) {
    return
  }
  if (result.localError) {
    notifyRequestError(
      result.localError,
      'No fue posible consultar las actividades internas.',
      'Reintentar',
      () => loadCalendar(),
    )
  }
  if (result.googleError) {
    notifyRequestError(
      result.googleError,
      'No fue posible consultar Google. Las actividades locales siguen disponibles.',
      'Reintentar',
      () => loadCalendar(),
    )
  }
}

function selectDay(day) {
  selectedDay.value = day
  mode.value = 'day'
  page.value = 0
}

// Abrir el resumen no desplaza la página; las actividades ya cargadas se reutilizan.
function showDay(day) {
  selectDay(day)
  dayOpen.value = true
}

async function openDayActivity(event) {
  dayOpen.value = false
  await nextTick()
  openDetail(event)
}

async function createDayActivity() {
  dayOpen.value = false
  await nextTick()
  newEvent()
}

function changeView(value) {
  view.value = value
  mode.value = value
  page.value = 0
}

function movePeriod(offset) {
  if (view.value === 'week') {
    selectedDay.value = nextDay(selectedDay.value, offset * 7)
    mode.value = 'week'
    return
  }
  const day = new Date(`${selectedDay.value.slice(0, 7)}-01T12:00:00Z`)
  day.setUTCMonth(day.getUTCMonth() + offset)
  selectDay(day.toISOString().slice(0, 10))
}

function newEvent() {
  if (submission.pending) {
    notifications.show('Confirma primero el guardado pendiente.', 'warning')
    resumePending()
    return
  }
  resume.value = false
  editingEvent.value = null
  formOpen.value = true
}

function resumePending() {
  resume.value = true
  editingEvent.value = null
  formOpen.value = true
}

async function editEvent(scope = 'ONE') {
  if (detail.value?.origin === 'GOOGLE' && !detail.value.localEventId) {
    googleEditing.value = detail.value
    detail.value = null
    googleFormOpen.value = true
    return
  }
  if (submission.pending) {
    detail.value = null
    resumePending()
    return
  }
  if (detail.value?.recurrence && scope === 'CHOOSE') {
    editChoice.value = true
    return
  }
  editChoice.value = false
  resume.value = false
  let event = detail.value
  if (scope === 'ALL') {
    const actor = auth.user?.email
    try {
      event = await agendaApi.get(detail.value.id)
      if (!alive || actor !== auth.user?.email || !auth.isAuthenticated) {
        return
      }
    } catch (error) {
      notifyRequestError(error, 'No fue posible consultar la serie.')
      return
    }
  }
  editingEvent.value = event
  detail.value = null
  formOpen.value = true
}

async function openDetail(item) {
  const current = ++detailSequence
  detailBusy.value = true
  detail.value = null
  history.value = []
  try {
    let localId = item.id
    if (item.origin === 'GOOGLE') {
      const external = await agendaApi.googleEvent(item.id)
      if (current !== detailSequence || !alive) {
        return
      }
      if (!external.localEventId) {
        detail.value = { ...external, origin: 'GOOGLE' }
        return
      }
      localId = external.localEventId
      item = {
        ...item,
        originalStartsAt: external.originalStartsAt,
        externalEvent: external,
        externalChange: external.linkedConflict,
      }
    }
    let eventPromise = agendaApi.get(localId)
    if (item.originalStartsAt) {
      eventPromise = agendaApi.occurrence(localId, item.originalStartsAt)
    }
    const result = await Promise.all([eventPromise, agendaApi.history(localId)])
    if (current !== detailSequence || !alive) {
      return
    }
    detail.value = {
      ...result[0],
      origin: 'LOCAL',
      externalChange: item.externalChange,
      externalEvent: item.externalEvent,
    }
    history.value = result[1]
  } catch (error) {
    if (current === detailSequence && alive) {
      notifyRequestError(error, 'No fue posible consultar la actividad.')
    }
  } finally {
    if (current === detailSequence) {
      detailBusy.value = false
    }
  }
}

// Los accesos del resumen abren el detalle autorizado existente, sin duplicar formularios.
function openRequestedActivity() {
  const external = route.query.googleEvent
  if (typeof external === 'string' && /^[A-Za-z0-9_-]{1,1024}$/.test(external)) {
    openDetail({ id: external, origin: 'GOOGLE' })
    return
  }
  const rawId = route.query.activity
  if (typeof rawId !== 'string' || !/^[1-9]\d{0,15}$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
    return
  }
  const item = { id: Number(rawId), origin: 'LOCAL' }
  const original = route.query.originalStartsAt
  if (typeof original === 'string' && original.length <= 40 && Number.isFinite(Date.parse(original))) {
    item.originalStartsAt = original
  }
  openDetail(item)
}

function confirmStatus(status) {
  confirmation.value = status
  reason.value = ''
  statusScope.value = 'ONE'
}

async function changeStatus() {
  const actor = auth.user?.email
  if (changing.value) {
    return
  }
  if (confirmation.value === 'CANCELLED' && !reason.value.trim()) {
    notifications.show('Indica el motivo de cancelación.', 'warning')
    return
  }
  changing.value = true
  try {
    let target = detail.value
    if (statusScope.value === 'ALL') {
      target = { ...target, originalStartsAt: null }
    }
    const saved = await agendaApi.changeStatus(target, confirmation.value, reason.value.trim() || null)
    if (!alive || actor !== auth.user?.email || !auth.isAuthenticated) {
      return
    }
    detail.value = { ...saved, origin: 'LOCAL' }
    confirmation.value = null
    notifications.show('Estado actualizado y registrado en el historial.', 'success')
    savedEvent()
    const entries = await agendaApi.history(saved.id)
    if (alive && actor === auth.user?.email) {
      history.value = entries
    }
  } catch (error) {
    if (alive && actor === auth.user?.email) {
      notifyRequestError(error, 'No fue posible cambiar el estado. Recarga la actividad.')
    }
  } finally {
    if (alive && actor === auth.user?.email) {
      changing.value = false
    }
  }
}

async function reconcile(useAppSchedule) {
  const actor = auth.user?.email
  if (changing.value) {
    return
  }
  changing.value = true
  try {
    const saved = await agendaApi.reconcile(detail.value, useAppSchedule)
    if (!alive || actor !== auth.user?.email || !auth.isAuthenticated) {
      return
    }
    detail.value = { ...saved, origin: 'LOCAL' }
    reconcileOpen.value = false
    savedEvent()
    const entries = await agendaApi.history(saved.id)
    if (alive && actor === auth.user?.email) {
      history.value = entries
    }
    notifications.show('Horario conciliado. La publicación se procesará por separado.', 'success')
  } catch (error) {
    if (alive && actor === auth.user?.email) {
      notifyRequestError(error, 'No fue posible conciliar los horarios.')
    }
  } finally {
    if (alive && actor === auth.user?.email) {
      changing.value = false
    }
  }
}

async function assign() {
  const actor = auth.user?.email
  if (changing.value) {
    return
  }
  changing.value = true
  try {
    const saved = await agendaApi.assign(detail.value)
    if (!alive || actor !== auth.user?.email || !auth.isAuthenticated) {
      return
    }
    detail.value = { ...saved, origin: 'LOCAL' }
    savedEvent()
    const entries = await agendaApi.history(saved.id)
    if (!alive || actor !== auth.user?.email) {
      return
    }
    history.value = entries
    notifications.show('La publicación pendiente utilizará tu conexión de Google.', 'success')
  } catch (error) {
    if (alive && actor === auth.user?.email) {
      notifyRequestError(error, 'No fue posible reasignar la publicación.')
    }
  } finally {
    if (alive && actor === auth.user?.email) {
      changing.value = false
    }
  }
}

function savedEvent() {
  revision.value += 1
  loadCalendar()
}

function typeLabel(value) {
  return TYPES.find((type) => type.value === value)?.label || value
}

function badgeTone(status) {
  if (status === 'COMPLETED') {
    return 'sage'
  }
  if (status === 'CANCELLED') {
    return 'neutral'
  }
  return 'teal'
}

function historyLabel(action) {
  const labels = {
    CREATED: 'Actividad registrada',
    UPDATED: 'Actividad actualizada',
    COMPLETED: 'Actividad realizada',
    CANCELLED: 'Actividad cancelada',
    OCCURRENCE_UPDATED: 'Ocurrencia actualizada',
    OCCURRENCE_COMPLETED: 'Ocurrencia realizada',
    OCCURRENCE_CANCELLED: 'Ocurrencia cancelada',
    GOOGLE_RECONCILED: 'Horario conciliado con Google',
    GOOGLE_ASSIGNED: 'Publicación reasignada',
  }
  return labels[action] || 'Cambio registrado'
}

function closeDetail() {
  if (!changing.value) {
    detail.value = null
    detailSequence += 1
    detailBusy.value = false
  }
}
watch(
  [() => route.query.activity, () => route.query.googleEvent, () => route.query.originalStartsAt],
  openRequestedActivity,
)
watch(
  () => route.query.day,
  (day) => {
    if (validDay(day)) {
      selectDay(day)
    }
  },
)
watch(
  clientDpi,
  async (dpi) => {
    const current = ++clientSequence
    selectedClient.value = null
    if (!dpi) {
      return
    }
    try {
      const client = await clientsApi.get(dpi)
      if (current === clientSequence && alive) {
        selectedClient.value = client
      }
    } catch (error) {
      if (current === clientSequence && alive) {
        notifyRequestError(error, 'No fue posible cargar el cliente.')
      }
    }
  },
  { immediate: true },
)
watch([() => calendarRange.value.from, () => calendarRange.value.to, caseId, clientDpi], () => {
  page.value = 0
  loadCalendar()
})
watch([mode, filterStatus], () => {
  page.value = 0
})
watch(totalPages, (value) => {
  if (page.value >= value) {
    page.value = Math.max(0, value - 1)
  }
})
watch(
  () => auth.user?.email,
  () => {
    agenda.reset()
    dayOpen.value = false
    submission.reset()
    detailSequence += 1
    detail.value = null
    formOpen.value = false
    googleFormOpen.value = false
    history.value = []
    googleEditing.value = null
    confirmation.value = null
    reconcileOpen.value = false
    editChoice.value = false
    changing.value = false
  },
)
onMounted(() => {
  submission.restore(auth.user?.email)
  loadCalendar()
  openRequestedActivity()
  timer = window.setInterval(() => {
    if (
      !dayOpen.value &&
      !formOpen.value &&
      !googleFormOpen.value &&
      !detail.value &&
      !detailBusy.value &&
      document.visibilityState === 'visible'
    ) {
      revision.value += 1
      loadCalendar(false)
    }
  }, 60000)
})
onBeforeUnmount(() => {
  alive = false
  clientSequence += 1
  detailSequence += 1
  agenda.reset()
  window.clearInterval(timer)
})
</script>
<template>
  <div class="office-page agenda-page">
    <PageHeader
      eyebrow="Organización del despacho"
      title="Agenda"
      subtitle="Actividades del despacho y del calendario compartido, en un solo lugar."
      ><template #actions
        ><BaseButton v-if="submission.pending" variant="outline" @click="resumePending"
          >Confirmar guardado pendiente</BaseButton
        ><BaseButton @click="newEvent">Nueva actividad</BaseButton></template
      ></PageHeader
    >
    <GoogleCalendarConnection :revision="revision" @changed="savedEvent" />
    <div class="agenda-layout">
      <section class="calendar-area" aria-label="Calendario y actividades">
        <BaseCard class="calendar-card">
          <div class="calendar-toolbar">
            <div class="period-heading">
              <p class="period-kicker">Organiza tu tiempo</p>
              <h2>{{ monthLabel }}</h2>
              <p class="calendar-caption">Selecciona una fecha para ver sus actividades.</p>
            </div>
            <div class="period-navigation">
              <BaseButton variant="outline" aria-label="Período anterior" @click="movePeriod(-1)"
                >←</BaseButton
              >
              <BaseButton variant="outline" @click="selectDay(dayKey())">Hoy</BaseButton>
              <BaseButton variant="outline" aria-label="Período siguiente" @click="movePeriod(1)"
                >→</BaseButton
              >
            </div>
          </div>
          <div class="calendar-controls">
            <div class="view-switch" aria-label="Vista del calendario">
              <button type="button" :aria-pressed="view === 'month'" @click="changeView('month')">Mes</button>
              <button type="button" :aria-pressed="view === 'week'" @click="changeView('week')">
                Semana
              </button>
            </div>
            <div class="calendar-legend">
              <span><i aria-hidden="true" />Despacho</span
              ><span><i class="external" aria-hidden="true" />Google Calendar</span>
            </div>
          </div>
          <LoadingCards v-if="agenda.calendarLoading" :count="1" label="Consultando actividades locales" />
          <AgendaCalendar
            v-if="view === 'month'"
            :month="selectedDay"
            :selected="selectedDay"
            :counts="counts"
            :events="allEvents"
            :loading="agenda.calendarLoading"
            @select="showDay"
          />
          <AgendaWeekView
            v-else
            :events="allEvents"
            :day="selectedDay"
            @select="showDay"
            @open="openDetail"
          />
          <p v-if="agenda.googleLoading" role="status">Consultando Google Calendar…</p>
          <p v-else-if="agenda.checkedAt && !agenda.googleFailed" class="source-help">
            Google consultado: {{ dateLabel(agenda.checkedAt) }}
          </p>
          <BaseButton v-if="agenda.googleFailed" variant="outline" @click="loadCalendar()"
            >Reintentar consulta de Google</BaseButton
          >
        </BaseCard>
        <div class="list-disclosure">
          <div>
            <h2>Explora tus actividades</h2>
            <p>Consulta y filtra el listado completo.</p>
          </div>
          <BaseButton
            variant="outline"
            :aria-expanded="listOpen"
            aria-controls="agenda-activity-list"
            @click="listOpen = !listOpen"
            ><span v-if="listOpen">Ocultar listado</span><span v-else>Ver listado</span></BaseButton
          >
        </div>
        <BaseCard v-show="listOpen" id="agenda-activity-list" class="events-section"
          ><div class="calendar-toolbar">
            <h2>{{ listTitle }}</h2>
            <div class="actions">
              <BaseButton variant="outline" :aria-pressed="mode === 'day'" @click="mode = 'day'"
                >Día</BaseButton
              ><BaseButton variant="outline" :aria-pressed="mode === 'month'" @click="mode = 'month'"
                >Mes</BaseButton
              ><BaseButton
                v-if="view === 'week'"
                variant="outline"
                :aria-pressed="mode === 'week'"
                @click="mode = 'week'"
                >Semana</BaseButton
              >
            </div>
          </div>
          <div class="filters">
            <label
              >Estado<select v-model="filterStatus">
                <option value="">Todos los estados</option>
                <option value="SCHEDULED">Programadas</option>
                <option value="COMPLETED">Realizadas</option>
                <option value="CANCELLED">Canceladas</option>
              </select></label
            ><BaseButton
              variant="outline"
              :loading="agenda.calendarLoading || agenda.googleLoading"
              @click="savedEvent"
              >Actualizar</BaseButton
            ><BaseButton
              v-if="caseId || clientDpi"
              variant="outline"
              @click="router.replace({ name: 'agenda' })"
              >Ver toda la agenda</BaseButton
            >
          </div>
          <LoadingCards v-if="agenda.calendarLoading" :count="2" label="Cargando actividades" />
          <div v-else-if="!displayed.length" class="empty-state">
            <h3>No hay actividades en este período</h3>
            <p>Puedes elegir otra fecha o registrar una nueva actividad.</p>
            <BaseButton variant="outline" @click="newEvent">Agendar actividad</BaseButton>
          </div>
          <ul v-else class="event-list">
            <li v-for="event in displayed" :key="eventKey(event)">
              <button type="button" class="event-open" @click="openDetail(event)">
                <span class="event-time"
                  >{{ dateLabel(event.startsAt) }}<span v-if="event.allDay"> · Todo el día</span></span
                ><strong>{{ event.title }}</strong
                ><span v-if="event.origin === 'GOOGLE'">Google Calendar</span
                ><span v-else
                  >{{ typeLabel(event.type) }}<span v-if="event.caseCode"> · {{ event.caseCode }}</span></span
                ><span v-if="event.clientName">{{ event.clientName }}</span
                ><span v-if="event.recurrence || event.seriesId">Actividad recurrente</span
                ><span v-if="event.externalChange || event.linkedConflict" class="sync"
                  >Horario externo por conciliar</span
                ><span v-else-if="event.origin === 'LOCAL'" class="sync">{{
                  SYNC_LABELS[event.syncState] || event.syncState
                }}</span></button
              ><BaseBadge :variant="badgeTone(event.status)">{{ STATUS_LABELS[event.status] }}</BaseBadge>
            </li>
          </ul>
          <ListPagination
            :page="page"
            :total-pages="totalPages"
            :total-elements="listEvents.length"
            :loading="agenda.calendarLoading"
            @change="page = $event"
          />
        </BaseCard>
      </section>
      <aside><UpcomingActivities :client-dpi="clientDpi" :case-id="caseId" :revision="revision" /></aside>
    </div>
    <AgendaDayActivities
      :open="dayOpen"
      :day="selectedDay"
      :events="allEvents"
      :loading="agenda.calendarLoading || agenda.googleLoading"
      @close="dayOpen = false"
      @open="openDayActivity"
      @create="createDayActivity"
    />
    <AgendaEventForm
      :open="formOpen"
      :event="editingEvent"
      :day="selectedDay"
      :case-id="caseId"
      :client="selectedClient"
      :resume="resume"
      @close="formOpen = false"
      @saved="savedEvent"
    />
    <GoogleEventForm
      :open="googleFormOpen"
      :event="googleEditing"
      @close="googleFormOpen = false"
      @saved="savedEvent"
    />
    <BaseModal
      :open="Boolean(detail) || detailBusy"
      title-id="agenda-detail-title"
      :dismissible="!changing"
      @close="closeDetail"
      ><div class="detail">
        <h2 id="agenda-detail-title">
          <span v-if="detail">{{ detail.title }}</span
          ><span v-else>Detalle de la actividad</span>
        </h2>
        <LoadingCards v-if="detailBusy" :count="1" label="Consultando actividad" />
        <template v-else-if="detail"
          ><dl>
            <div>
              <dt>Inicio</dt>
              <dd>{{ dateLabel(detail.startsAt) }}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{{ dateLabel(detail.endsAt) }}</dd>
            </div>
            <div>
              <dt>Zona del evento</dt>
              <dd>{{ detail.timeZone }}</dd>
            </div>
            <div v-if="detail.clientName">
              <dt>Cliente</dt>
              <dd>{{ detail.clientName }}</dd>
            </div>
            <div v-if="detail.location">
              <dt>Lugar</dt>
              <dd>{{ detail.location }}</dd>
            </div>
          </dl>
          <p v-if="detail.description" class="notes">{{ detail.description }}</p>
          <template v-if="detail.origin === 'GOOGLE'"
            ><p>Evento del calendario compartido.</p>
            <p v-if="detail.hasGuests">Este evento tiene invitados y se edita desde Google Calendar.</p>
            <a class="link-button" :href="detail.calendarUrl" target="_blank" rel="noopener noreferrer"
              >Abrir en Google Calendar</a
            ><BaseButton v-if="detail.editable" @click="editEvent()"
              >Editar evento de Google</BaseButton
            ></template
          >
          <template v-else
            ><BaseBadge :variant="badgeTone(detail.status)">{{ STATUS_LABELS[detail.status] }}</BaseBadge>
            <p>{{ SYNC_LABELS[detail.syncState] }}</p>
            <p v-if="detail.recurrence">
              Serie {{ FREQUENCIES.find((item) => item.value === detail.recurrence.frequency)?.label }} hasta
              {{ detail.recurrence.until }}.
            </p>
            <RouterLink
              v-if="detail.caseId"
              class="link-button"
              :to="{ name: 'legal-process-detail', params: { id: detail.caseId } }"
              >Abrir expediente {{ detail.caseCode }}</RouterLink
            >
            <div v-if="detail.status === 'SCHEDULED'" class="actions">
              <BaseButton @click="editEvent('CHOOSE')">Editar actividad</BaseButton
              ><BaseButton variant="outline" @click="confirmStatus('COMPLETED')">Marcar realizada</BaseButton
              ><BaseButton variant="outline" @click="confirmStatus('CANCELLED')"
                >Cancelar actividad</BaseButton
              >
            </div>
            <BaseButton
              v-if="detail.externalChange || ['CONFLICT', 'ERROR'].includes(detail.syncState)"
              variant="outline"
              @click="reconcileOpen = true"
              >Resolver sincronización</BaseButton
            ><BaseButton
              v-if="
                agenda.googleState === 'CONNECTED' && ['LOCAL', 'ERROR', 'PENDING'].includes(detail.syncState)
              "
              variant="outline"
              :loading="changing"
              @click="assign"
              >Publicar pendiente con mi cuenta</BaseButton
            >
            <h3>Historial</h3>
            <ol class="history">
              <li v-for="entry in history" :key="entry.version">
                <strong>{{ dateLabel(entry.recordedAt) }}</strong
                ><span>{{ entry.operatorName }} · {{ historyLabel(entry.action) }}</span
                ><span>{{ dateLabel(entry.startsAt) }} → {{ dateLabel(entry.endsAt) }}</span
                ><span v-if="entry.originalStartsAt"
                  >Ocurrencia original: {{ dateLabel(entry.originalStartsAt) }}</span
                ><span v-if="entry.reason">{{ entry.reason }}</span>
              </li>
            </ol>
          </template>
        </template>
        <div class="actions">
          <BaseButton variant="outline" :disabled="changing" @click="closeDetail">Cerrar</BaseButton>
        </div>
      </div></BaseModal
    >
    <BaseModal :open="editChoice" title-id="agenda-edit-scope" @close="editChoice = false"
      ><div class="detail">
        <h2 id="agenda-edit-scope">Editar actividad recurrente</h2>
        <p>Selecciona dónde aplicar los cambios.</p>
        <div class="actions">
          <BaseButton variant="outline" @click="editEvent('ONE')">Solo esta ocurrencia</BaseButton
          ><BaseButton @click="editEvent('ALL')">Toda la serie</BaseButton
          ><BaseButton variant="outline" @click="editChoice = false">Volver</BaseButton>
        </div>
      </div></BaseModal
    >
    <BaseModal
      :open="reconcileOpen"
      title-id="agenda-reconcile-title"
      :dismissible="!changing"
      @close="reconcileOpen = false"
      ><div class="detail">
        <h2 id="agenda-reconcile-title">Conciliar el horario</h2>
        <p>
          Elige qué horario conservar. La información privada y las relaciones del expediente permanecen en la
          aplicación.
        </p>
        <p v-if="detail?.externalEvent">
          Google: {{ dateLabel(detail.externalEvent.startsAt) }} →
          {{ dateLabel(detail.externalEvent.endsAt) }}
        </p>
        <div class="actions">
          <BaseButton variant="outline" :disabled="changing" @click="reconcileOpen = false">Volver</BaseButton
          ><BaseButton variant="outline" :loading="changing" @click="reconcile(false)"
            >Aplicar horario de Google</BaseButton
          ><BaseButton :loading="changing" @click="reconcile(true)">Conservar horario interno</BaseButton>
        </div>
      </div></BaseModal
    >
    <BaseModal
      :open="Boolean(confirmation)"
      title-id="agenda-status-title"
      :dismissible="!changing"
      @close="confirmation = null"
      ><div class="detail">
        <h2 id="agenda-status-title">
          <span v-if="confirmation === 'CANCELLED'">Cancelar actividad</span
          ><span v-else>Marcar actividad realizada</span>
        </h2>
        <label v-if="detail?.recurrence && confirmation === 'CANCELLED'"
          >Aplicar a<select v-model="statusScope" :disabled="changing">
            <option value="ONE">Solo esta ocurrencia</option>
            <option value="ALL">Toda la serie</option>
          </select></label
        >
        <p>Este cambio queda registrado en el historial de Agenda.</p>
        <label v-if="confirmation === 'CANCELLED'"
          >Motivo *<textarea v-model="reason" maxlength="500" rows="3" :disabled="changing" />
        </label>
        <div class="actions">
          <BaseButton variant="outline" :disabled="changing" @click="confirmation = null">Volver</BaseButton
          ><BaseButton :loading="changing" @click="changeStatus">Confirmar cambio</BaseButton>
        </div>
      </div></BaseModal
    >
  </div>
</template>
<style src="../../../shared/styles/office.css" scoped></style>
<style scoped>
.agenda-page,
.calendar-area {
  display: grid;
  gap: 1.2rem;
}
.agenda-page :deep(.google-connection) {
  align-items: stretch;
}
.agenda-page :deep(.google-connection > .card-body) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.agenda-page :deep(.google-connection > .card-body > div:first-child) {
  flex: 1 1 260px;
  min-width: 0;
}
.agenda-layout {
  display: grid;
  gap: 1.2rem;
  min-width: 0;
}
.calendar-card,
.events-section {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
.calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}
h2 {
  font-size: 1.2rem;
}
.calendar-card {
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
.calendar-card :deep(.card-body) {
  display: grid;
  gap: 1rem;
  padding: 0.85rem;
}
.period-kicker {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 0.4rem;
}
.period-heading h2 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  letter-spacing: -0.04em;
  line-height: 1.2;
}
.calendar-caption {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}
.period-navigation {
  display: flex;
  gap: 0.35rem;
}
.calendar-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.8rem;
  padding: 0.5rem 0 0.75rem;
  border-bottom: 1px solid var(--color-border-subtle);
}
.view-switch {
  display: inline-flex;
  padding: 0.25rem;
  border-radius: var(--radius-md);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border-medium);
}
.view-switch button {
  min-height: 44px;
  padding: 0.45rem 1rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.view-switch button[aria-pressed='true'] {
  background: var(--color-bg-card);
  color: var(--color-text-title);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}
.view-switch button:focus-visible {
  outline: 3px solid var(--color-border-focus);
  outline-offset: 2px;
}
.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.calendar-legend span {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.calendar-legend i {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}
.calendar-legend i.external {
  background: var(--color-coral-decorative);
}
@media (min-width: 640px) {
  .calendar-card :deep(.card-body) {
    padding: 1.5rem;
  }
}
@media (min-width: 1280px) {
  .agenda-layout {
    grid-template-columns: minmax(0, 1fr) 290px;
    align-items: start;
  }
}

.calendar-toolbar h2 {
  text-transform: capitalize;
}
.list-disclosure {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.75rem 0.25rem;
}
.list-disclosure h2 {
  font-size: 1rem;
}
.list-disclosure p {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 0.35rem;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
}
select,
textarea {
  min-height: 46px;
  font-size: 1rem;
}
.source-help {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.event-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}
.event-list li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.7rem;
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-sm);
  padding: 0.9rem;
}
.event-open {
  display: grid;
  gap: 0.3rem;
  min-height: 44px;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--color-text-body);
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
}
.event-open strong {
  overflow-wrap: anywhere;
  font-size: 1rem;
}
.event-open span {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.event-open .event-time {
  color: var(--color-teal-strong);
  font-weight: 600;
}
.detail {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
}
dl {
  display: grid;
  gap: 0.7rem;
}
dt {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
dd {
  margin: 0;
}
.notes {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.history {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 0.7rem;
}
.history li {
  display: grid;
  gap: 0.2rem;
  border-left: 2px solid var(--color-primary);
  padding-left: 0.8rem;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
@media (min-width: 1500px) {
  .agenda-layout {
    grid-template-columns: minmax(0, 1fr) 310px;
  }
}
</style>
