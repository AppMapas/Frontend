<!-- Resumen de próximas actividades; descarta respuestas antiguas al cambiar filtros o desmontar el componente. -->
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { agendaApi } from '../services/agendaApi.js'
import { dateLabel, TYPES } from '../domain/agenda.js'
import { eventKey, mergeEvents } from '../domain/calendar.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
const props = defineProps({
  caseId: [String, Number],
  clientDpi: String,
  revision: { type: Number, default: 0 },
})
const items = ref([])
const loading = ref(false)
const failed = ref(false)
let sequence = 0
let controller = null
async function load() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  const current = ++sequence
  loading.value = true
  failed.value = false
  const local = []
  const external = []
  let localError = null
  let googleError = null
  async function internal() {
    try {
      const response = await agendaApi.upcoming(
        { caseId: props.caseId, clientDpi: props.clientDpi },
        { signal: request.signal },
      )
      local.push(...response.content)
    } catch (error) {
      localError = error
    }
  }

  async function google() {
    try {
      const status = await agendaApi.googleStatus({ signal: request.signal })
      if (status.state !== 'CONNECTED' || current !== sequence) {
        return
      }
      const from = new Date().toISOString()
      const to = new Date(Date.now() + 30 * 86400000).toISOString()
      let pageToken = null
      const pages = new Set()
      for (let page = 0; page < 40; page += 1) {
        const result = await agendaApi.googleEvents({ from, to, pageToken }, { signal: request.signal })
        if (current !== sequence) {
          return
        }
        for (const event of result.items) {
          if (props.caseId && String(event.caseId) !== String(props.caseId)) {
            continue
          }
          if (props.clientDpi && event.clientDpi !== props.clientDpi) {
            continue
          }
          external.push(event)
        }
        pageToken = result.nextPageToken
        if (!pageToken || external.length >= 10) {
          return
        }
        if (pages.has(pageToken)) {
          throw new Error('La consulta externa no pudo completarse.')
        }
        pages.add(pageToken)
      }
      throw new Error('Consulta un período más corto para las actividades externas.')
    } catch (error) {
      googleError = error
    }
  }
  await Promise.allSettled([internal(), google()])
  if (current !== sequence) {
    return
  }
  items.value = mergeEvents(local, external).slice(0, 10)
  loading.value = false
  failed.value = Boolean(localError || googleError)
  if (localError && !request.signal.aborted) {
    notifyRequestError(localError, 'No fue posible consultar las próximas actividades internas.')
  }
  if (googleError && !request.signal.aborted) {
    notifyRequestError(googleError, 'No fue posible consultar las próximas actividades de Google.')
  }
}

function typeLabel(value) {
  return TYPES.find((type) => type.value === value)?.label || value
}
watch(() => [props.caseId, props.clientDpi, props.revision], load, { immediate: true })
onBeforeUnmount(() => {
  sequence += 1
  controller?.abort()
})
</script>
<template>
  <BaseCard class="upcoming"
    ><div class="top">
      <h2>Próximas actividades</h2>
      <RouterLink :to="{ name: 'agenda', query: { caseId, clientDpi } }">Abrir agenda</RouterLink>
    </div>
    <LoadingCards v-if="loading" :count="1" label="Consultando próximas fechas" /><template v-else
      ><BaseButton v-if="failed" variant="outline" @click="load">Actualizar próximas actividades</BaseButton>
      <p v-if="!items.length">No hay actividades programadas para los próximos 30 días.</p>
      <ol v-else>
        <li v-for="item in items" :key="eventKey(item)">
          <span class="date">{{ dateLabel(item.startsAt) }}</span
          ><strong>{{ item.title }}</strong
          ><span v-if="item.origin === 'GOOGLE'">Google Calendar</span
          ><span v-else
            >{{ typeLabel(item.type) }}<span v-if="item.caseCode"> · {{ item.caseCode }}</span></span
          >
        </li>
      </ol></template
    ></BaseCard
  >
</template>
<style scoped>
.upcoming {
  display: grid;
  gap: 1rem;
}
h2 {
  font-size: 1.2rem;
}
.top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}
a {
  color: var(--color-teal-strong);
  text-decoration: underline;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
ol {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 0.8rem;
}
li {
  display: grid;
  gap: 0.2rem;
  padding-left: 0.9rem;
  border-left: 3px solid var(--color-primary);
}
span,
p {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
strong {
  overflow-wrap: anywhere;
}
.date {
  color: var(--color-teal-strong);
  font-weight: 600;
}
</style>
