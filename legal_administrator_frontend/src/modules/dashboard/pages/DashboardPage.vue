<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/authStore'
import { useDashboardStore } from '../stores/dashboardStore.js'
import { activityRoute, googleActivityRoute, REMINDER_LABELS } from '../domain/dashboard.js'
import { dateLabel, dayKey, TYPES } from '../../agenda/domain/agenda.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import { useNotificationStore } from '@/shared/notifications/notificationStore.js'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import DashboardStat from '../components/DashboardStat.vue'
import DashboardWeekChart from '../components/DashboardWeekChart.vue'
import DashboardReminders from '../components/DashboardReminders.vue'
const auth = useAuthStore()
const dashboard = useDashboardStore()
const notifications = useNotificationStore()
const router = useRouter()
const route = useRoute()
const remindersOpen = ref(false)
const reminderKind = ref('')
let active = true
let timer = null
const today = computed(() => dashboard.summary?.date || dayKey())
const todayLabel = computed(() =>
  new Intl.DateTimeFormat('es-GT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${today.value}T12:00:00Z`)),
)
const firstName = computed(() => auth.user?.firstName || 'licenciada')
const cards = computed(() => {
  const summary = dashboard.summary
  if (!summary) {
    return []
  }
  return [
    {
      label: 'Expedientes activos',
      value: summary.activeCases,
      hint: 'Casos vigentes del despacho',
      tone: 'violet',
      symbol: '▤',
      to: { name: 'legal-processes' },
    },
    {
      label: 'Actividades de hoy',
      value: summary.todayActivities,
      hint: 'Programadas en la agenda interna',
      tone: 'blue',
      symbol: '◷',
      to: { name: 'agenda', query: { day: summary.date } },
    },
    {
      label: 'Recordatorios de hoy',
      value: summary.reminders.today,
      hint: 'Cobros que tienes agendados',
      tone: 'amber',
      symbol: '◇',
      to: { name: 'dashboard', query: { reminders: 'TODAY' } },
    },
    {
      label: 'Por atender',
      value: summary.reminders.unattended,
      hint: 'Recordatorios de los últimos 30 días',
      tone: 'coral',
      symbol: '!',
      to: { name: 'dashboard', query: { reminders: 'UNATTENDED' } },
    },
  ]
})
async function refresh(report = true, confirm = false) {
  const result = await dashboard.load()
  if (!active || !result || !report) {
    return
  }
  if (result.localError) {
    notifyRequestError(result.localError, 'No fue posible actualizar tu resumen.', 'Reintentar', () =>
      refresh(),
    )
  }
  if (result.googleError) {
    notifyRequestError(
      result.googleError,
      'No fue posible consultar Google. Tu resumen interno sigue disponible.',
      'Reintentar',
      () => refresh(),
    )
  }
  if (confirm && !result.localError && !result.googleError) {
    notifications.show('Resumen actualizado.', 'success')
  }
}
function openReminders(kind = '') {
  reminderKind.value = kind
  remindersOpen.value = true
}
function closeReminders() {
  remindersOpen.value = false
  if (route.query.reminders) {
    const query = { ...route.query }
    delete query.reminders
    router.replace({ name: 'dashboard', query })
  }
}
function goDay(day) {
  router.push({ name: 'agenda', query: { day } })
}
function typeLabel(type) {
  return TYPES.find((item) => item.value === type)?.label || 'Actividad'
}
function visibleRefresh() {
  if (
    document.visibilityState === 'visible' &&
    !remindersOpen.value &&
    !dashboard.loading &&
    !dashboard.googleLoading
  ) {
    refresh(false)
  }
}
watch(
  () => route.query.reminders,
  (kind) => {
    if (Object.hasOwn(REMINDER_LABELS, kind || '')) {
      openReminders(kind)
    }
  },
  { immediate: true },
)
watch(
  () => [auth.user?.email, auth.user?.role],
  () => {
    dashboard.reset()
    remindersOpen.value = false
    if (auth.isAuthenticated && ['Abogada', 'Administrador'].includes(auth.user?.role)) {
      refresh()
    }
  },
  { flush: 'sync' },
)
onMounted(() => {
  refresh()
  timer = window.setInterval(visibleRefresh, 60000)
  document.addEventListener('visibilitychange', visibleRefresh)
})
onBeforeUnmount(() => {
  active = false
  dashboard.reset()
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', visibleRefresh)
})
</script>
<template>
  <div class="dashboard-page">
    <header class="dashboard-hero">
      <div class="hero-orbit" aria-hidden="true" />
      <div class="hero-content">
        <p class="eyebrow">El día empieza aquí</p>
        <h1>Hola, {{ firstName }}<span class="greeting-dot" aria-hidden="true">.</span></h1>
        <p class="hero-subtitle">Tu despacho, de un vistazo.</p>
        <p class="hero-date">{{ todayLabel }}</p>
      </div>
      <div class="hero-actions">
        <BaseButton @click="router.push({ name: 'agenda', query: { day: today } })"
          >Abrir agenda de hoy ↗</BaseButton
        ><BaseButton
          variant="outline"
          :loading="dashboard.loading || dashboard.googleLoading"
          @click="refresh(true, true)"
          >Actualizar resumen</BaseButton
        >
      </div>
    </header>
    <LoadingCards
      v-if="dashboard.loading && !dashboard.summary"
      :count="4"
      label="Consultando el resumen del despacho"
    />
    <BaseCard v-else-if="!dashboard.summary" class="unavailable"
      ><h2>Tu resumen está por llegar</h2>
      <p>Vuelve a consultar para mostrar la información del despacho.</p>
      <BaseButton variant="outline" @click="refresh()">Reintentar resumen</BaseButton></BaseCard
    >
    <template v-if="dashboard.summary">
      <p class="updated" role="status">
        <span v-if="dashboard.failed">Última información disponible · </span><span v-else>Actualizado · </span
        >{{ dateLabel(dashboard.summary.generatedAt) }}
      </p>
      <section class="stats-grid" aria-label="Indicadores del despacho">
        <DashboardStat v-for="card in cards" :key="card.label" v-bind="card" />
      </section>
      <div class="main-grid">
        <BaseCard class="agenda-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Haz espacio para lo importante</p>
              <h2>Tu agenda de hoy</h2>
            </div>
            <span class="section-symbol blue" aria-hidden="true">◷</span>
          </div>
          <p class="section-help">
            Actividades internas del despacho. Las de Google aparecen en su propio resumen.
          </p>
          <div v-if="!dashboard.summary.agenda.length" class="empty-state">
            <span aria-hidden="true">☀</span>
            <h3>Un día con espacio disponible</h3>
            <p>No tienes actividades internas programadas para hoy.</p>
          </div>
          <ol v-else class="daily-timeline">
            <li
              v-for="activity in dashboard.summary.agenda"
              :key="`${activity.id}:${activity.originalStartsAt || activity.startsAt}`"
            >
              <RouterLink :to="activityRoute(activity, today)"
                ><span class="timeline-dot" aria-hidden="true" /><span
                  class="activity-time"
                  v-if="activity.allDay"
                  >Todo el día</span
                ><span class="activity-time" v-else>{{
                  new Intl.DateTimeFormat('es-GT', {
                    timeZone: 'America/Guatemala',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(activity.startsAt))
                }}</span
                ><strong>{{ activity.title }}</strong
                ><span class="activity-meta"
                  >{{ typeLabel(activity.type)
                  }}<span v-if="activity.caseCode"> · {{ activity.caseCode }}</span></span
                ></RouterLink
              >
            </li>
          </ol>
          <p v-if="dashboard.summary.todayActivities > dashboard.summary.agenda.length" class="section-help">
            Mostrando {{ dashboard.summary.agenda.length }} de
            {{ dashboard.summary.todayActivities }} actividades.
          </p>
          <BaseButton variant="outline" @click="goDay(today)">Ver el día completo</BaseButton>
        </BaseCard>
        <BaseCard class="reminder-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Un pendiente menos</p>
              <h2>Recordatorios de cobro</h2>
            </div>
            <span class="section-symbol amber" aria-hidden="true">◇</span>
          </div>
          <p class="section-help">Actividades por atender; no representan deudas vencidas.</p>
          <div v-if="!dashboard.summary.reminderPreview.length" class="empty-state">
            <span aria-hidden="true">✓</span>
            <h3>Sin recordatorios por atender</h3>
            <p>No hay recordatorios en el período consultado.</p>
          </div>
          <ul v-else class="reminder-list">
            <li
              v-for="reminder in dashboard.summary.reminderPreview"
              :key="`${reminder.activity.id}:${reminder.activity.originalStartsAt || reminder.activity.startsAt}`"
            >
              <RouterLink :to="activityRoute(reminder.activity, today)"
                ><span class="reminder-kind" :class="{ unattended: reminder.kind === 'UNATTENDED' }">{{
                  REMINDER_LABELS[reminder.kind]
                }}</span
                ><strong>{{ reminder.activity.title }}</strong
                ><span>{{ dateLabel(reminder.activity.startsAt) }}</span></RouterLink
              >
            </li>
          </ul>
          <p class="section-help">
            Pendientes de los últimos 30 días y programación de hoy a seis días adelante.
          </p>
          <BaseButton variant="outline" @click="openReminders()">Ver todos los recordatorios</BaseButton>
        </BaseCard>
      </div>
      <div class="secondary-grid">
        <DashboardWeekChart :days="dashboard.summary.week" @select="goDay" />
        <BaseCard class="google-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">También en tu calendario</p>
              <h2>Google Calendar hoy</h2>
            </div>
            <span class="section-symbol coral" aria-hidden="true">▦</span>
          </div>
          <LoadingCards v-if="dashboard.googleLoading" :count="1" label="Consultando Google Calendar" />
          <BaseButton v-else-if="dashboard.googleFailed" variant="outline" @click="refresh()"
            >Reintentar Google Calendar</BaseButton
          >
          <template v-else-if="dashboard.googleState === 'CONNECTED'"
            ><p class="section-help">
              {{ dashboard.googleCount }} eventos externos. Las actividades enlazadas se consultan en Agenda.
            </p>
            <ul v-if="dashboard.googleEvents.length" class="google-list">
              <li v-for="event in dashboard.googleEvents" :key="event.id">
                <RouterLink :to="googleActivityRoute(event, today)"
                  ><strong>{{ event.title }}</strong
                  ><span v-if="event.allDay">Todo el día</span
                  ><span v-else>{{ dateLabel(event.startsAt) }}</span></RouterLink
                >
              </li>
            </ul>
            <p v-else class="section-help">No hay eventos externos para hoy.</p>
            <p v-if="dashboard.googleCheckedAt" class="section-help">
              Consultado: {{ dateLabel(dashboard.googleCheckedAt) }}
            </p></template
          >
          <p v-else class="section-help">
            Conecta o revisa tu cuenta desde Agenda. Tu resumen interno está disponible.
          </p>
          <BaseButton variant="outline" @click="goDay(today)">Ir a Agenda</BaseButton>
        </BaseCard>
      </div>
    </template>
    <DashboardReminders :open="remindersOpen" :kind="reminderKind" :date="today" @close="closeReminders" />
  </div>
</template>
<style scoped>
.dashboard-page {
  display: grid;
  gap: 1.25rem;
  min-width: 0;
}
.dashboard-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: var(--radius-xl);
  background: linear-gradient(
    115deg,
    var(--color-calendar-blue-bg),
    var(--color-calendar-violet-bg) 70%,
    var(--color-coral-decorative-pale)
  );
  border: 1px solid var(--color-border-medium);
}
.hero-content,
.hero-actions {
  position: relative;
  z-index: 1;
}
.eyebrow {
  color: var(--color-text-body);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.07em;
  font-size: 0.75rem;
}
h1 {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  line-height: 1.2;
  letter-spacing: -0.045em;
  margin: 0.7rem 0 0.4rem;
  color: var(--color-text-title);
  overflow-wrap: anywhere;
}
.greeting-dot {
  color: var(--color-coral-decorative-strong);
}
.hero-subtitle {
  font-size: 1rem;
  color: var(--color-text-body);
}
.hero-date {
  margin-top: 1rem;
  font-size: 0.9rem;
  text-transform: capitalize;
  font-weight: 600;
  color: var(--color-text-title);
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
.hero-orbit {
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: var(--radius-full);
  border: 35px solid color-mix(in srgb, var(--color-calendar-violet-accent) 15%, transparent);
  right: -90px;
  top: -90px;
}
.updated {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.main-grid,
.secondary-grid {
  display: grid;
  gap: 1.2rem;
  min-width: 0;
}
.agenda-card,
.reminder-card,
.google-card {
  min-width: 0;
  border-radius: var(--radius-lg);
}
.agenda-card :deep(.card-body),
.reminder-card :deep(.card-body),
.google-card :deep(.card-body) {
  display: grid;
  gap: 1rem;
  padding: 1.2rem;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}
.section-heading h2 {
  font-size: 1.2rem;
  color: var(--color-text-title);
  margin-top: 0.4rem;
}
.section-symbol {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  height: 44px;
  border-radius: var(--radius-md);
  color: var(--color-text-title);
  font-size: 1.3rem;
}
.blue {
  background: var(--color-calendar-blue-bg);
}
.amber {
  background: var(--color-calendar-amber-bg);
}
.coral {
  background: var(--color-coral-decorative-pale);
}
.section-help {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}
.empty-state {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.65rem;
  padding: 1.3rem 0.4rem;
}
.empty-state > span {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  background: var(--color-calendar-amber-bg);
  color: var(--color-text-title);
  font-size: 1.5rem;
}
.empty-state h3 {
  font-size: 1rem;
  color: var(--color-text-title);
}
.empty-state p {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}
.daily-timeline,
.reminder-list,
.google-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.6rem;
}
.daily-timeline li {
  border-left: 2px solid var(--color-border-medium);
  padding-left: 1.2rem;
}
.daily-timeline a {
  position: relative;
  display: grid;
  gap: 0.4rem;
  padding: 0.7rem;
  border-radius: var(--radius-md);
  color: var(--color-text-body);
}
.daily-timeline a:hover {
  background: var(--color-calendar-blue-bg);
}
.timeline-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: var(--color-calendar-blue-accent);
  left: -1.6rem;
  top: 1rem;
  border: 2px solid var(--color-bg-card);
  box-sizing: content-box;
}
.activity-time {
  font-size: 0.8rem;
  font-family: var(--font-mono);
  font-weight: 600;
}
.activity-meta {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
.daily-timeline strong,
.reminder-list strong,
.google-list strong {
  font-size: 1rem;
  color: var(--color-text-title);
  overflow-wrap: anywhere;
}
.reminder-list a,
.google-list a {
  display: grid;
  gap: 0.45rem;
  padding: 0.9rem;
  border-radius: var(--radius-md);
  background: var(--color-calendar-amber-bg);
  color: var(--color-text-body);
  border: 1px solid var(--color-border-subtle);
}
.reminder-list a:hover,
.google-list a:hover {
  border-color: var(--color-primary);
}
.reminder-kind {
  font-weight: 600;
  font-size: 0.75rem;
}
.reminder-kind.unattended {
  color: var(--color-text-title);
  border-left: 3px solid var(--color-coral-decorative-strong);
  padding-left: 0.5rem;
}
.reminder-list a > span:last-child,
.google-list span {
  font-size: 0.85rem;
}
.google-list a {
  background: var(--color-coral-decorative-pale);
}
a:focus-visible {
  outline: 3px solid var(--color-border-focus);
  outline-offset: 3px;
}
.unavailable {
  line-height: 1.6;
}
.unavailable p {
  margin: 0.7rem 0;
  color: var(--color-text-muted);
}
@media (min-width: 768px) {
  .dashboard-hero {
    padding: 2rem;
  }
  .stats-grid {
    gap: 1rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .main-grid,
  .secondary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}
</style>
