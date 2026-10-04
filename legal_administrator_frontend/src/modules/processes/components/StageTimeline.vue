<script setup>
import { computed } from 'vue'
import { formatTimestamp } from '../domain/caseRegistration.js'
import BaseBadge from '@/components/common/BaseBadge.vue'

const props = defineProps({
  timeline: { type: Object, required: true },
})
const stageById = computed(() => new Map((props.timeline.stages || []).map(stage => [stage.id, stage])))
const visited = computed(() => new Set((props.timeline.events || []).map(event => event.toStageId)))
function stageName(id) {
  return stageById.value.get(id)?.name || 'Etapa anterior'
}
function stageState(stage) {
  if (stage.id && props.timeline.currentStage?.id === stage.id) return 'Actual'
  if (stage.id && visited.value.has(stage.id)) return 'Visitada'
  return 'Pendiente'
}
function currentAttribute(stage) {
  if (stage.id && props.timeline.currentStage?.id === stage.id) return 'step'
  return undefined
}
</script>
<template>
  <div class="timeline-layout">
    <div class="overview">
      <h3>Etapas del expediente</h3>
      <ol class="stage-list" aria-label="Etapas configuradas">
        <li v-for="stage in timeline.stages" :key="stage.code" :class="{ current: timeline.currentStage?.id === stage.id && stage.id }"
          :aria-current="currentAttribute(stage)">
          <span class="marker" aria-hidden="true"></span>
          <div class="stage-content">
            <strong>{{ stage.name }}</strong>
            <span class="muted">{{ stageState(stage) }}</span>
          </div>
          <BaseBadge v-if="stage.terminal" variant="neutral" size="sm">Final</BaseBadge>
        </li>
      </ol>
    </div>
    <div class="history">
      <h3>Historial de cambios</h3>
      <p v-if="!timeline.events?.length" class="muted">Aún no se ha registrado una etapa para este expediente.</p>
      <ol v-else class="event-list">
        <li v-for="event in timeline.events" :key="event.id">
          <span class="event-marker" aria-hidden="true"></span>
          <div>
            <strong>{{ stageName(event.toStageId) }}</strong>
            <p class="muted">{{ formatTimestamp(event.occurredAt) }}</p>
            <p v-if="event.fromStageId" class="muted">Desde {{ stageName(event.fromStageId) }}</p>
            <p v-if="event.comment" class="event-comment">{{ event.comment }}</p>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>
<style scoped>
.timeline-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.timeline-layout > div { min-width: 0; }
.timeline-layout h3 { margin-bottom: .8rem; color: var(--color-text-title); }
.stage-list, .event-list { list-style: none; margin: 0; padding: 0; }
.stage-list li, .event-list li { display: grid; grid-template-columns: 1.25rem minmax(0, 1fr) auto; gap: .65rem; position: relative; min-height: 3.6rem; padding-bottom: 1rem; }
.stage-list li:not(:last-child)::before, .event-list li:not(:last-child)::before { content: ''; position: absolute; left: .53rem; top: 1.25rem; bottom: 0; width: 2px; background: var(--color-border-medium); }
.marker, .event-marker { width: 1.1rem; height: 1.1rem; margin-top: .2rem; border-radius: 50%; border: 2px solid var(--color-border-control); background: var(--color-bg-card); z-index: 1; }
.current .marker { border-color: var(--color-primary); background: var(--color-primary); box-shadow: 0 0 0 4px var(--color-primary-subtle); }
.event-marker { border-color: var(--color-teal-strong); background: var(--color-teal-strong); }
.stage-content { display: grid; gap: .15rem; }
.stage-content strong, .event-list strong { color: var(--color-text-title); overflow-wrap: anywhere; }
.event-list { display: grid; }
.event-list li { grid-template-columns: 1.25rem minmax(0, 1fr); }
.event-list p { margin-top: .15rem; overflow-wrap: anywhere; }
.event-comment { margin-top: .5rem !important; padding: .55rem .7rem; border-radius: var(--radius-sm); background: var(--color-bg-subtle); white-space: pre-line; }
@media (min-width: 860px) { .timeline-layout { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
