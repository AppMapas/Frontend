<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'

const searchQuery = ref('')
const selectedFilter = ref('all')

const records = ref([
  {
    id: 'EXP-2026-001',
    finca: 'Finca 1284, Folio 452',
    client: 'Carlos Eduardo Méndez',
    location: 'Quetzaltenango, Zona 3',
    areaM2: 1025.5,
    areaVaras: 1467.64,
    date: '2026-09-10',
    status: 'Completado',
    statusVariant: 'teal'
  },
  {
    id: 'EXP-2026-002',
    finca: 'Finca 3012, Folio 12',
    client: 'María Alejandra Robles',
    location: 'La Esperanza, Quetzaltenango',
    areaM2: 850.0,
    areaVaras: 1216.44,
    date: '2026-09-08',
    status: 'En Revisión',
    statusVariant: 'soft-coral'
  },
  {
    id: 'EXP-2026-003',
    finca: 'Finca 984, Folio 89',
    client: 'Inmobiliaria Los Altos S.A.',
    location: 'Salcajá, Quetzaltenango',
    areaM2: 4520.25,
    areaVaras: 6469.07,
    date: '2026-09-05',
    status: 'Completado',
    statusVariant: 'teal'
  },
  {
    id: 'EXP-2026-004',
    finca: 'Finca 550, Folio 101',
    client: 'Juan Francisco Pérez',
    location: 'Almolonga, Quetzaltenango',
    areaM2: 340.8,
    areaVaras: 487.73,
    date: '2026-09-01',
    status: 'Borrador',
    statusVariant: 'neutral'
  },
  {
    id: 'EXP-2026-005',
    finca: 'Finca 7721, Folio 22',
    client: 'Sucursal Agrícola Occidental',
    location: 'San Mateo, Quetzaltenango',
    areaM2: 12500.0,
    areaVaras: 17888.75,
    date: '2026-08-28',
    status: 'Completado',
    statusVariant: 'teal'
  }
])

const filteredRecords = computed(() => {
  return records.value.filter(rec => {
    const matchesSearch =
      rec.id.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      rec.client.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      rec.finca.toLowerCase().includes(searchQuery.value.toLowerCase())

    if (selectedFilter.value === 'all') return matchesSearch
    return matchesSearch && rec.status.toLowerCase() === selectedFilter.value.toLowerCase()
  })
})
</script>

<template>
  <div class="historial-page">
    <PageHeader
      title="Historial de Expedientes"
      eyebrow="Registro de Cálculos"
      subtitle="Consulta, búsqueda y seguimiento de levantamientos topográficos y cálculos de área almacenados."
    >
      <template #actions>
        <BaseButton variant="outline" size="md">
          Exportar CSV
        </BaseButton>
        <BaseButton variant="secondary" size="md">
          Nuevo Trámite
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Barra de Filtros y Búsqueda -->
    <div class="filters-bar">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por expediente, cliente o no. de finca..."
          class="search-input"
        />
      </div>
      <div class="filter-pills">
        <button
          type="button"
          :class="['filter-btn', { 'is-active': selectedFilter === 'all' }]"
          @click="selectedFilter = 'all'"
        >
          Todos ({{ records.length }})
        </button>
        <button
          type="button"
          :class="['filter-btn', { 'is-active': selectedFilter === 'completado' }]"
          @click="selectedFilter = 'completado'"
        >
          Completados
        </button>
        <button
          type="button"
          :class="['filter-btn', { 'is-active': selectedFilter === 'en revisión' }]"
          @click="selectedFilter = 'en revisión'"
        >
          En Revisión
        </button>
      </div>
    </div>

    <!-- Tabla de Registros -->
    <BaseCard padding="none">
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Finca / Folio</th>
              <th>Cliente / Propietario</th>
              <th>Ubicación</th>
              <th>Área (m²)</th>
              <th>Área (v²)</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rec in filteredRecords" :key="rec.id">
              <td class="font-mono font-bold">{{ rec.id }}</td>
              <td>{{ rec.finca }}</td>
              <td class="font-semibold">{{ rec.client }}</td>
              <td class="text-muted">{{ rec.location }}</td>
              <td class="font-mono text-coral font-bold">{{ rec.areaM2.toLocaleString() }} m²</td>
              <td class="font-mono text-muted">{{ rec.areaVaras.toLocaleString() }} v²</td>
              <td class="text-muted">{{ rec.date }}</td>
              <td>
                <BaseBadge :variant="rec.statusVariant">{{ rec.status }}</BaseBadge>
              </td>
              <td class="text-right">
                <BaseButton variant="ghost" size="sm">
                  Ver detalle
                </BaseButton>
              </td>
            </tr>

            <tr v-if="filteredRecords.length === 0">
              <td colspan="9" class="empty-state">
                No se encontraron expedientes con los criterios seleccionados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.historial-page {
  display: flex;
  flex-direction: column;
}

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 280px;
}

.search-input {
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  font-size: 0.875rem;
}

.filter-pills {
  display: flex;
  gap: 0.5rem;
}

.filter-btn {
  padding: 0.45rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-btn:hover {
  color: var(--color-text-title);
  background-color: var(--color-bg-subtle);
}

.filter-btn.is-active {
  background-color: var(--color-teal);
  color: var(--color-text-on-primary);
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th {
  text-align: left;
  padding: 0.9rem 1.2rem;
  background-color: var(--color-bg-subtle);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border-subtle);
}

.data-table td {
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-body);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover td {
  background-color: rgba(140, 170, 162, 0.05);
}

.font-mono { font-family: var(--font-mono); }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; color: var(--color-text-title); }
.text-muted { color: var(--color-text-muted); }
.text-coral { color: var(--color-coral); }
.text-right { text-align: right; }

.empty-state {
  text-align: center;
  padding: 3rem 1rem !important;
  color: var(--color-text-muted);
}
</style>
