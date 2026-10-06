<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '../services/dashboardApi.js'
import { REMINDER_LABELS, activityRoute, validateRemindersPage } from '../domain/dashboard.js'
import { dateLabel } from '../../agenda/domain/agenda.js'
import { notifyRequestError } from '@/shared/forms/requestFeedback.js'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import LoadingCards from '@/components/common/LoadingCards.vue'
import ListPagination from '@/components/common/ListPagination.vue'
const props = defineProps({ open: Boolean, kind: String, date: String })
const emit = defineEmits(['close'])
const router = useRouter()
const selectedKind = ref('')
const page = ref(0)
const result = ref(null)
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
  result.value = null
  try {
    const value = await dashboardApi.reminders(
      { kind: selectedKind.value, page: page.value, size: 10 },
      { signal: request.signal },
    )
    if (current !== sequence || request.signal.aborted) {
      return
    }
    result.value = validateRemindersPage(value)
  } catch (error) {
    if (current === sequence && !request.signal.aborted) {
      failed.value = true
      notifyRequestError(error, 'No fue posible consultar los recordatorios.')
    }
  } finally {
    if (current === sequence) {
      loading.value = false
    }
  }
}
function changeKind() {
  page.value = 0
  load()
}
function changePage(value) {
  page.value = value
  load()
}
function openActivity(activity) {
  emit('close')
  router.push(activityRoute(activity, props.date))
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      selectedKind.value = props.kind || ''
      page.value = 0
      load()
    } else {
      sequence += 1
      controller?.abort()
      result.value = null
      loading.value = false
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  sequence += 1
  controller?.abort()
})
</script>
<template>
  <BaseModal :open="open" title-id="dashboard-reminders-title" @close="emit('close')">
    <section class="reminders-dialog">
      <header>
        <h2 id="dashboard-reminders-title">Recordatorios de cobro</h2>
        <BaseButton variant="outline" @click="emit('close')">Cerrar</BaseButton>
      </header>
      <p class="reminder-explanation">
        Son actividades por atender. No indican que exista una deuda ni un pago vencido.
      </p>
      <label
        >Mostrar<select v-model="selectedKind" @change="changeKind">
          <option value="">Todos</option>
          <option value="TODAY">Para hoy</option>
          <option value="UPCOMING">Próximos seis días</option>
          <option value="UNATTENDED">Sin atender en los últimos 30 días</option>
        </select></label
      >
      <LoadingCards v-if="loading" :count="2" label="Consultando recordatorios" />
      <BaseButton v-else-if="failed" variant="outline" @click="load">Reintentar consulta</BaseButton>
      <template v-else-if="result"
        ><p v-if="!result.reminders.content.length" class="empty">No hay recordatorios en este grupo.</p>
        <ul v-else>
          <li
            v-for="item in result.reminders.content"
            :key="`${item.activity.id}:${item.activity.originalStartsAt || item.activity.startsAt}`"
          >
            <button type="button" @click="openActivity(item.activity)">
              <span class="kind">{{ REMINDER_LABELS[item.kind] }}</span
              ><strong>{{ item.activity.title }}</strong
              ><span>{{ dateLabel(item.activity.startsAt) }}</span
              ><span v-if="item.activity.caseCode">{{ item.activity.caseCode }}</span>
            </button>
          </li>
        </ul>
        <p class="reminder-explanation">
          Consulta del {{ result.unattendedFrom }} al {{ result.upcomingThrough }}.
        </p>
        <ListPagination
          :page="page"
          :total-pages="result.reminders.totalPages"
          :total-elements="result.reminders.totalElements"
          :loading="loading"
          @change="changePage"
        />
      </template>
    </section>
  </BaseModal>
</template>
<style scoped>
.reminders-dialog {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}
h2 {
  font-size: 1.2rem;
  color: var(--color-text-title);
}
.reminder-explanation,
.empty {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}
label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
}
select {
  min-height: 44px;
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-body);
  border: 1px solid var(--color-border-control);
  font: inherit;
  width: 100%;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.65rem;
}
li button {
  width: 100%;
  display: grid;
  gap: 0.4rem;
  text-align: left;
  padding: 1rem;
  font: inherit;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  color: var(--color-text-body);
  cursor: pointer;
}
li button:hover {
  background: var(--color-calendar-amber-bg);
}
li button:focus-visible {
  outline: 3px solid var(--color-border-focus);
}
li span {
  font-size: 0.85rem;
}
.kind {
  font-weight: 600;
  color: var(--color-text-title);
}
li strong {
  overflow-wrap: anywhere;
}
</style>
