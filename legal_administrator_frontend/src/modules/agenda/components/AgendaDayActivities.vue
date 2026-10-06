<!-- Resumen del día sobre el calendario. Se cierra antes de abrir detalle o formulario para evitar modales superpuestos. -->
<script setup>
import { computed } from 'vue'
import { TYPES, STATUS_LABELS, inputDate } from '../domain/agenda.js'
import { eventsForDay, eventKey } from '../domain/calendar.js'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
const props = defineProps({
  open: Boolean,
  day: String,
  events: { type: Array, default: () => [] },
  loading: Boolean,
})
const emit = defineEmits(['close', 'open', 'create'])
const activities = computed(() => eventsForDay(props.events, props.day))
const date = computed(() =>
  new Intl.DateTimeFormat('es-GT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${props.day}T12:00:00Z`)),
)
function time(event) {
  if (event.allDay) {
    return 'Todo el día'
  }
  // Las horas se presentan en la misma zona de la agenda; las fechas completas están en el detalle.
  return `${inputDate(event.startsAt).slice(11)} – ${inputDate(event.endsAt).slice(11)}`
}
function type(event) {
  if (event.origin === 'GOOGLE') {
    return 'Google Calendar'
  }
  return TYPES.find((item) => item.value === event.type)?.label || 'Actividad del despacho'
}
function tone(event) {
  if (event.status === 'COMPLETED') {
    return 'sage'
  }
  if (event.status === 'CANCELLED') {
    return 'neutral'
  }
  return 'teal'
}
</script>
<template>
  <BaseModal
    :open="open"
    title-id="agenda-day-title"
    description-id="agenda-day-description"
    @close="emit('close')"
  >
    <section class="day-detail">
      <header class="day-header">
        <div class="date-tile" aria-hidden="true">
          <span>{{
            new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', month: 'short' }).format(
              new Date(`${day}T12:00:00Z`),
            )
          }}</span
          ><strong>{{ Number(day.slice(-2)) }}</strong>
        </div>
        <div class="day-title">
          <p>Tu agenda del día</p>
          <h2 id="agenda-day-title">{{ date }}</h2>
        </div>
        <button
          class="close-button"
          type="button"
          aria-label="Cerrar actividades del día"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>
      <p id="agenda-day-description" class="day-description">
        Selecciona una actividad para consultar su detalle. Se aplican los filtros actuales de la agenda.
      </p>
      <LoadingCards v-if="loading" :count="2" label="Consultando actividades del día" />
      <template v-else>
        <p v-if="activities.length" class="day-count">
          {{ activities.length }} <span v-if="activities.length === 1">actividad</span
          ><span v-else>actividades</span>
        </p>
        <ul v-if="activities.length" class="day-list">
          <li v-for="event in activities" :key="eventKey(event)">
            <button class="day-event" type="button" @click="emit('open', event)">
              <span class="event-time">{{ time(event) }}</span>
              <span class="event-content"
                ><strong>{{ event.title }}</strong
                ><span class="event-meta"
                  ><span
                    class="source-dot"
                    :class="{ external: event.origin === 'GOOGLE' }"
                    aria-hidden="true"
                  />{{ type(event) }}</span
                ><span v-if="event.clientName" class="client">{{ event.clientName }}</span
                ><span v-if="event.externalChange || event.linkedConflict" class="conflict"
                  >Horario por conciliar</span
                ><BaseBadge :variant="tone(event)">{{
                  STATUS_LABELS[event.status] || event.status
                }}</BaseBadge></span
              >
              <span class="event-arrow" aria-hidden="true">↗</span>
            </button>
          </li>
        </ul>
        <div v-else class="day-empty">
          <span class="empty-icon" aria-hidden="true">✓</span>
          <h3>Un espacio libre en tu agenda</h3>
          <p>No hay actividades para esta fecha con los filtros actuales.</p>
        </div>
      </template>
      <footer class="day-footer">
        <BaseButton variant="outline" @click="emit('close')">Volver al calendario</BaseButton
        ><BaseButton @click="emit('create')">Agendar este día</BaseButton>
      </footer>
    </section>
  </BaseModal>
</template>
<style scoped>
.day-detail {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 1rem);
  box-sizing: border-box;
  gap: 1.2rem;
}
.day-header,
.day-description,
.day-count,
.day-footer,
.day-empty {
  flex-shrink: 0;
}
.day-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}
.date-tile {
  flex: 0 0 60px;
  display: grid;
  place-items: center;
  padding: 0.45rem;
  border-radius: var(--radius-md);
  background: var(--color-primary-subtle);
  color: var(--color-text-title);
}
.date-tile span {
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 600;
}
.date-tile strong {
  font-size: 1.8rem;
  font-variant-numeric: tabular-nums;
}
.day-title {
  flex: 1;
  min-width: 0;
}
.day-title p {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  margin: 0 0 0.35rem;
}
h2 {
  font-size: 1.1rem;
  line-height: 1.45;
  color: var(--color-text-title);
  text-transform: capitalize;
}
.close-button {
  flex: 0 0 44px;
  height: 44px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-full);
  background: var(--color-bg-card);
  color: var(--color-text-body);
  cursor: pointer;
}
.day-description,
.day-empty p {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.6;
}
.day-count {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
.day-list {
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
  padding: 2px;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}
.day-event {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
  width: 100%;
  gap: 0.65rem;
  text-align: left;
  padding: 1rem;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  color: var(--color-text-body);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.day-event:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}
.day-event:focus-visible,
.close-button:focus-visible {
  outline: 3px solid var(--color-border-focus);
  outline-offset: 2px;
}
.day-detail :deep(.badge-teal) {
  color: var(--color-text-title);
}
.event-time {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  grid-column: 1;
}
.event-content {
  display: grid;
  justify-items: start;
  gap: 0.45rem;
  grid-column: 1;
  min-width: 0;
}
.event-content strong {
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.event-meta,
.client {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.event-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.source-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}
.source-dot.external {
  background: var(--color-coral-decorative);
}
.conflict {
  color: var(--color-warning-strong);
  font-size: 0.85rem;
}
.event-arrow {
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: center;
  color: var(--color-text-muted);
  font-size: 1.3rem;
}
.day-empty {
  text-align: center;
  padding: 1.5rem 0.5rem;
  display: grid;
  justify-items: center;
  gap: 0.7rem;
}
.empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--color-primary-subtle);
  font-size: 1.5rem;
}
.day-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 1rem;
}
@media (min-width: 640px) {
  .day-detail {
    max-height: calc(100dvh - 3rem);
  }
  .day-detail {
    padding: 1.75rem;
  }
  h2 {
    font-size: 1.25rem;
  }
  .day-event {
    grid-template-columns: 122px minmax(0, 1fr) 24px;
  }
  .event-content {
    grid-column: 2;
    grid-row: 1;
    border-left: 2px solid var(--color-border-medium);
    padding-left: 1rem;
  }
  .event-arrow {
    grid-column: 3;
    grid-row: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .day-event {
    transition: none;
  }
}
</style>
