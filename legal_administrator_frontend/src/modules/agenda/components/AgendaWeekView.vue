<!-- Calcula posiciones y columnas para que actividades simultáneas sigan siendo legibles y seleccionables. -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { dateLabel, dayKey, inputDate } from '../domain/agenda.js'
import { eventKey, eventsForDay, weekDays, weekPlacements } from '../domain/calendar.js'
import BaseButton from '@/components/common/BaseButton.vue'
const props = defineProps({ events: { type: Array, default: () => [] }, day: String })
const emit = defineEmits(['open', 'select'])
const days = computed(() => weekDays(props.day))
const now = ref(new Date())
const timeline = ref(null)
let timer = null
const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}:00`)
function dayLabel(day) {
  return new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).format(
    new Date(`${day}T12:00:00Z`),
  )
}

function timed(day) {
  return eventsForDay(props.events, day).filter((event) => !event.allDay)
}

function allDay(day) {
  return eventsForDay(props.events, day).filter((event) => event.allDay)
}
const placements = computed(() => new Map(days.value.map((day) => [day, weekPlacements(props.events, day)])))
function placement(event, day) {
  return placements.value.get(day).get(eventKey(event))
}

function currentPosition() {
  const value = inputDate(now.value).slice(11)
  const [hour, minute] = value.split(':').map(Number)
  return { top: `${(hour * 60 + minute) * 0.9}px` }
}
onMounted(() => {
  if (timeline.value) {
    timeline.value.scrollTop = 7 * 60 * 0.9
  }
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 60000)
})
onBeforeUnmount(() => window.clearInterval(timer))
</script>
<template>
  <section class="week-view" aria-label="Actividades de la semana">
    <div class="mobile-week">
      <div class="day-switch">
        <BaseButton
          v-for="date in days"
          :key="date"
          variant="outline"
          :aria-pressed="date === day"
          :class="{ 'is-selected': date === day }"
          @click="emit('select', date)"
          >{{ dayLabel(date) }}</BaseButton
        >
      </div>
      <p v-if="!eventsForDay(events, day).length" class="empty">No hay actividades para este día.</p>
      <button
        v-for="event in eventsForDay(events, day)"
        :key="eventKey(event)"
        type="button"
        class="mobile-event"
        @click="emit('open', event)"
      >
        <span v-if="event.allDay">Todo el día</span><span v-else>{{ dateLabel(event.startsAt) }}</span
        ><strong>{{ event.title }}</strong
        ><span v-if="event.origin === 'GOOGLE'">Google Calendar</span><span v-else>Agenda del despacho</span>
      </button>
    </div>
    <div
      ref="timeline"
      class="desktop-week"
      tabindex="0"
      aria-label="Horario semanal; desplázate para consultar todas las horas"
    >
      <div class="week-head">
        <span>Hora</span
        ><button
          v-for="date in days"
          :key="date"
          type="button"
          :aria-pressed="date === day"
          :class="{ 'is-today': date === dayKey(now) }"
          @click="emit('select', date)"
        >
          <span class="week-day-name">{{ dayLabel(date).split(' ')[0] }}</span
          ><strong class="week-day-number">{{ Number(date.slice(-2)) }}</strong>
        </button>
      </div>
      <div class="all-day-row">
        <span>Todo el día</span>
        <div v-for="date in days" :key="date">
          <button
            v-for="event in allDay(date)"
            :key="eventKey(event)"
            type="button"
            @click="emit('open', event)"
          >
            {{ event.title }}
          </button>
        </div>
      </div>
      <div class="hour-grid">
        <div class="hours">
          <span v-for="hour in hours" :key="hour">{{ hour }}</span>
        </div>
        <div v-for="date in days" :key="date" class="day-column">
          <div v-for="hour in hours" :key="hour" class="hour-line" />
          <span
            v-if="date === dayKey(now)"
            class="now-line"
            :style="currentPosition()"
            aria-label="Hora actual"
          /><button
            v-for="event in timed(date)"
            :key="eventKey(event)"
            type="button"
            class="timed-event"
            :class="{ external: event.origin === 'GOOGLE' }"
            :style="placement(event, date)"
            :aria-label="`${event.title}, ${dateLabel(event.startsAt)}`"
            :title="event.title"
            @click="emit('open', event)"
          >
            <strong>{{ event.title }}</strong
            ><span>{{ inputDate(event.startsAt).slice(11) }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
<style scoped>
.week-view button:focus-visible {
  outline: 3px solid var(--color-border-focus);
  outline-offset: -3px;
}
.day-switch :deep(.is-selected) {
  background: var(--color-primary-subtle);
  border-color: var(--color-primary);
  color: var(--color-text-title);
}
.week-view {
  min-width: 0;
}
.mobile-week,
.mobile-event {
  display: grid;
  gap: 0.6rem;
}
.day-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.mobile-event {
  width: 100%;
  text-align: left;
  padding: 0.9rem;
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-body);
  font-size: 1rem;
  min-height: 48px;
}
.mobile-event span,
.empty {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
.desktop-week {
  scroll-padding-top: 80px;
  display: none;
}
@media (min-width: 1000px) {
  .mobile-week {
    display: none;
  }
  .desktop-week {
    scroll-padding-top: 80px;
    display: block;
    max-height: 620px;
    overflow-y: auto;
    border: 1px solid var(--color-border-control);
    border-radius: var(--radius-sm);
  }
  .week-head,
  .all-day-row,
  .hour-grid {
    display: grid;
    grid-template-columns: 60px repeat(7, minmax(0, 1fr));
  }
  .week-head {
    position: sticky;
    top: 0;
    z-index: 4;
    background: var(--color-bg-card);
  }
  .week-head button {
    min-height: 78px;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 0.3rem;
    border: 0;
    border-left: 1px solid var(--color-border-control);
    background: var(--color-bg-card);
    color: var(--color-text-body);
    font-size: 0.9rem;
  }
  .week-day-name {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    text-transform: capitalize;
  }
  .week-day-number {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    font-size: 1.1rem;
  }
  .week-head button[aria-pressed='true'] {
    background: var(--color-primary-subtle);
  }
  .week-head button.is-today .week-day-number {
    background: var(--color-primary);
    color: var(--color-text-on-primary);
  }
  .week-head > span,
  .all-day-row > span {
    padding: 0.4rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .all-day-row > div {
    min-height: 44px;
    padding: 0.2rem;
    border-left: 1px solid var(--color-border-control);
  }
  .all-day-row button {
    max-width: 100%;
    min-height: 44px;
    font-size: 0.85rem;
    color: var(--color-text-body);
    background: var(--color-bg-card);
    overflow-wrap: anywhere;
    border: 1px solid var(--color-border-control);
  }
  .hours span {
    display: block;
    height: 54px;
    padding: 0.2rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .day-column {
    position: relative;
    min-width: 0;
    border-left: 1px solid var(--color-border-control);
  }
  .hour-line {
    height: 54px;
    border-top: 1px solid var(--color-border-control);
  }
  .timed-event {
    position: absolute;
    scroll-margin-top: 80px;
    z-index: 2;
    display: grid;
    align-content: start;
    gap: 0.2rem;
    padding: 0.25rem;
    text-align: left;
    overflow: hidden;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background: var(--color-bg-subtle);
    border-left-width: 3px;
    color: var(--color-text-body);
    font-size: 0.85rem;
    cursor: pointer;
  }
  .timed-event strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timed-event.external {
    border-color: var(--color-coral-decorative);
    background: var(--color-coral-decorative-pale);
    border-style: dashed;
  }
  .now-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--color-danger);
    z-index: 3;
    pointer-events: none;
  }
}

@media (min-width: 1000px) {
  .week-head button:nth-of-type(7n + 1) {
    --day-fill: color-mix(in srgb, var(--color-secondary) 24%, var(--color-bg-card));
    --day-accent: var(--color-primary);
  }
  .week-head button:nth-of-type(7n + 2) {
    --day-fill: var(--color-calendar-blue-bg);
    --day-accent: var(--color-calendar-blue-accent);
  }
  .week-head button:nth-of-type(7n + 3) {
    --day-fill: var(--color-calendar-violet-bg);
    --day-accent: var(--color-calendar-violet-accent);
  }
  .week-head button:nth-of-type(7n + 4) {
    --day-fill: color-mix(in srgb, var(--color-secondary) 24%, var(--color-bg-card));
    --day-accent: var(--color-primary);
  }
  .week-head button:nth-of-type(7n + 5) {
    --day-fill: var(--color-calendar-blue-bg);
    --day-accent: var(--color-calendar-blue-accent);
  }
  .week-head button:nth-of-type(7n + 6) {
    --day-fill: var(--color-calendar-amber-bg);
    --day-accent: var(--color-calendar-amber-accent);
  }
  .week-head button:nth-of-type(7n + 7) {
    --day-fill: var(--color-coral-decorative-pale);
    --day-accent: var(--color-coral-decorative-strong);
  }

  .week-head button {
    background: var(--day-fill);
    border-top: 3px solid var(--day-accent);
  }
  .week-day-name {
    color: var(--color-text-body);
  }
  .week-head button[aria-pressed='true'] {
    box-shadow: inset 0 -3px var(--color-primary);
  }
  .timed-event {
    background: color-mix(in srgb, var(--color-secondary) 24%, var(--color-bg-card));
  }
  .timed-event.external {
    background: var(--color-coral-decorative-pale);
  }
}
</style>
