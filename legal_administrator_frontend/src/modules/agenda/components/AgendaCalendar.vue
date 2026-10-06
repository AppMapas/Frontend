<!-- Los días son botones completos: abren el resumen sin exigir precisión sobre una actividad pequeña. -->
<script setup>
import { computed } from 'vue'
import { eventsForDay, eventKey } from '../domain/calendar.js'
import { dayKey, monthDays } from '../domain/agenda.js'
const props = defineProps({
  month: String,
  selected: String,
  counts: { type: Array, default: () => [] },
  events: { type: Array, default: () => [] },
  loading: Boolean,
})
const emit = defineEmits(['select'])
const days = computed(() => monthDays(props.month))
const today = dayKey()
// Se agrupan una sola vez por consulta para evitar recorrer todos los eventos repetidamente en el template.
const dayEvents = computed(() => new Map(days.value.map((day) => [day, eventsForDay(props.events, day)])))
const countMap = computed(() => Object.fromEntries(props.counts.map((day) => [day.date, day.count])))
function count(day) {
  return countMap.value[day] || 0
}
function label(day) {
  const date = new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', dateStyle: 'full' }).format(
    new Date(`${day}T12:00:00Z`),
  )
  return `${date}, ${count(day)} actividades. Ver actividades del día.`
}
</script>
<template>
  <div class="calendar" aria-label="Calendario mensual" :aria-busy="loading">
    <div class="weekday" v-for="day in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']" :key="day">
      {{ day }}
    </div>
    <button
      v-for="(day, index) in days"
      :key="day"
      :data-date="day"
      type="button"
      :disabled="loading"
      :aria-label="label(day)"
      :aria-current="day === today && 'date'"
      :aria-pressed="day === selected"
      :class="{
        selected: day === selected,
        today: day === today,
        outside: day.slice(0, 7) !== month.slice(0, 7),
        weekend: index % 7 > 4,
      }"
      @click="emit('select', day)"
    >
      <span class="day-heading"
        ><span class="day-number">{{ Number(day.slice(-2)) }}</span
        ><span v-if="day === today" class="today-label">Hoy</span></span
      >
      <span class="event-previews" aria-hidden="true">
        <span
          v-for="event in dayEvents.get(day).slice(0, 2)"
          :key="eventKey(event)"
          class="event-preview"
          :class="{ external: event.origin === 'GOOGLE' }"
          >{{ event.title }}</span
        >
      </span>
      <span v-if="count(day)" class="activity-count"
        ><span class="activity-dot" aria-hidden="true" /><span>{{ count(day) }}</span
        ><span class="count-label">actividades</span></span
      >
      <span v-else class="day-spacer" aria-hidden="true" />
    </button>
  </div>
</template>
<style scoped>
.calendar {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.25rem;
}
.weekday {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0.75rem 0;
}
button {
  min-height: 76px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  padding: 0.4rem 0.15rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  color: var(--color-text-body);
  background: var(--color-bg-card);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
button.weekend {
  background: var(--color-bg-subtle);
}
button:hover:not(:disabled) {
  background: var(--color-primary-subtle);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}
button:focus-visible {
  outline: 3px solid var(--color-border-focus);
  outline-offset: 2px;
  position: relative;
  z-index: 1;
}
button.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  box-shadow: inset 0 0 0 1px var(--color-primary);
}
button.outside {
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
}
button:disabled {
  cursor: wait;
}
.day-heading {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.day-number {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  font-weight: 600;
  font-size: 0.95rem;
  border-radius: var(--radius-full);
  font-variant-numeric: tabular-nums;
}
.today .day-number {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}
.today-label,
.event-previews,
.count-label {
  display: none;
}
.activity-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-body);
}
.activity-dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}
.day-spacer {
  height: 14px;
}
@media (min-width: 640px) {
  .calendar {
    gap: 0.45rem;
  }
  .weekday {
    font-size: 0.85rem;
  }
  button {
    min-height: 126px;
    align-items: stretch;
    padding: 0.55rem;
  }
  .day-number {
    font-size: 1rem;
    width: 32px;
    height: 32px;
  }
  .event-previews {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }
  .event-preview {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-left: 3px solid var(--color-primary);
    background: var(--color-primary-subtle);
    border-radius: var(--radius-xs);
    padding: 0.2rem 0.3rem;
    font-size: 0.8rem;
    color: var(--color-text-body);
    text-align: left;
  }
  .event-preview.external {
    border-color: var(--color-coral-decorative);
    background: var(--color-coral-decorative-soft);
  }
}
@media (min-width: 1000px) {
  button {
    min-height: 142px;
  }
  .today-label {
    display: inline;
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  .count-label {
    display: inline;
  }
}
@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}

/* Colores decorativos por día; los títulos y números mantienen alto contraste. */
.calendar > :nth-child(7n + 1) {
  --day-fill: color-mix(in srgb, var(--color-secondary) 24%, var(--color-bg-card));
  --day-accent: var(--color-primary);
}
.calendar > :nth-child(7n + 2) {
  --day-fill: var(--color-calendar-blue-bg);
  --day-accent: var(--color-calendar-blue-accent);
}
.calendar > :nth-child(7n + 3) {
  --day-fill: var(--color-calendar-violet-bg);
  --day-accent: var(--color-calendar-violet-accent);
}
.calendar > :nth-child(7n + 4) {
  --day-fill: color-mix(in srgb, var(--color-secondary) 24%, var(--color-bg-card));
  --day-accent: var(--color-primary);
}
.calendar > :nth-child(7n + 5) {
  --day-fill: var(--color-calendar-blue-bg);
  --day-accent: var(--color-calendar-blue-accent);
}
.calendar > :nth-child(7n + 6) {
  --day-fill: var(--color-calendar-amber-bg);
  --day-accent: var(--color-calendar-amber-accent);
}
.calendar > :nth-child(7n + 7) {
  --day-fill: var(--color-coral-decorative-pale);
  --day-accent: var(--color-coral-decorative-strong);
}

.calendar .weekday {
  border-radius: var(--radius-sm);
  background: var(--day-fill);
  border-bottom: 3px solid var(--day-accent);
  color: var(--color-text-title);
}
.calendar button {
  background: var(--day-fill);
  border-top: 3px solid var(--day-accent);
}
.calendar button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--day-accent) 15%, var(--day-fill));
  border-color: var(--day-accent);
}
.calendar button.selected {
  background: color-mix(in srgb, var(--color-secondary) 30%, var(--color-bg-card));
  border-color: var(--color-primary);
}
.calendar button.outside {
  background: var(--color-bg-subtle);
  border-top-color: var(--color-border-medium);
}
.calendar .activity-count {
  border-radius: var(--radius-full);
  background: var(--color-bg-card);
  padding: 0.2rem 0.3rem;
}
.calendar .activity-dot {
  background: var(--day-accent);
}
.calendar .event-preview {
  background: var(--color-bg-card);
  border-color: var(--day-accent);
}
.calendar .event-preview.external {
  border-color: var(--color-coral-decorative-strong);
  background: var(--color-coral-decorative-pale);
}
</style>
