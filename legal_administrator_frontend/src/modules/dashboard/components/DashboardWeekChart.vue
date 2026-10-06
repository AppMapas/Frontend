<script setup>
import { computed } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
const props = defineProps({ days: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
const maximum = computed(() => Math.max(1, ...props.days.map((day) => day.count)))
function height(count) {
  return `${Math.max(3, (count * 100) / maximum.value)}%`
}
function label(date) {
  return new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', weekday: 'short' }).format(
    new Date(`${date}T12:00:00Z`),
  )
}
</script>
<template>
  <BaseCard class="week-card">
    <div class="chart-heading">
      <div>
        <p class="eyebrow">Una semana organizada</p>
        <h2>Tu ritmo de los próximos días</h2>
      </div>
      <span class="chart-icon" aria-hidden="true">▥</span>
    </div>
    <p class="chart-description">
      Actividades internas programadas por día. Pulsa una fecha para abrir su agenda.
    </p>
    <div class="week-chart" role="group" aria-label="Actividades internas de los próximos siete días">
      <button
        v-for="(day, index) in days"
        :key="day.date"
        type="button"
        class="chart-day"
        :class="`bar-tone-${index % 3}`"
        :aria-label="`${day.date}: ${day.count} actividades. Abrir agenda.`"
        @click="emit('select', day.date)"
      >
        <strong>{{ day.count }}</strong
        ><span class="bar-track" aria-hidden="true"
          ><span class="bar" :style="{ height: height(day.count) }" :class="{ empty: !day.count }" /></span
        ><span class="day-label">{{ label(day.date) }}</span
        ><span class="day-date">{{ Number(day.date.slice(-2)) }}</span>
      </button>
    </div>
    <p v-if="days.every((day) => day.count === 0)" class="chart-description">
      No hay actividades internas programadas en estos siete días.
    </p>
  </BaseCard>
</template>
<style scoped>
.chart-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
h2 {
  font-size: 1.15rem;
  color: var(--color-text-title);
  margin-top: 0.4rem;
}
.chart-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  background: var(--color-calendar-violet-bg);
  color: var(--color-text-title);
  font-size: 1.5rem;
}
.chart-description {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin-top: 0.7rem;
}
.week-chart {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
  margin-top: 1.25rem;
}
.chart-day {
  min-width: 0;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0.25rem 0.1rem;
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  color: var(--color-text-body);
  cursor: pointer;
  font: inherit;
}
.chart-day:hover {
  background: var(--color-bg-subtle);
}
.chart-day:focus-visible {
  outline: 3px solid var(--color-border-focus);
}
.chart-day strong {
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}
.bar-track {
  display: flex;
  align-items: flex-end;
  height: 140px;
  width: min(100%, 38px);
  border-radius: var(--radius-md);
  background: var(--color-bg-subtle);
  overflow: hidden;
}
.bar {
  display: block;
  width: 100%;
  border-radius: var(--radius-md);
  background: var(--bar-color);
}
.bar.empty {
  background: var(--color-border-medium);
}
.bar-tone-0 {
  --bar-color: var(--color-primary);
}
.bar-tone-1 {
  --bar-color: var(--color-calendar-blue-accent);
}
.bar-tone-2 {
  --bar-color: var(--color-coral-decorative);
}
.day-label {
  font-size: 0.8rem;
  text-transform: capitalize;
}
.day-date {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
