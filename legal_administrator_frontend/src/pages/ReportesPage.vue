<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import { CONVERSION_FACTORS } from '@/utils/constants'

const kpis = [
  { title: 'Total Expedientes', value: '142', change: '+12% este mes', badgeVariant: 'teal' },
  { title: 'Área Total Calculada', value: '38,450 m²', change: '55,027 v²', badgeVariant: 'coral' },
  { title: 'Trámites Aprobados', value: '128', change: '90.1% efectividad', badgeVariant: 'sage' },
  { title: 'Pendientes de Revisión', value: '14', change: '3 urgentes', badgeVariant: 'soft-coral' }
]

const departmentStats = [
  { name: 'Quetzaltenango', cases: 86, percentage: 60.5, color: 'var(--color-coral)' },
  { name: 'San Marcos', cases: 28, percentage: 19.7, color: 'var(--color-deep-teal)' },
  { name: 'Totonicapán', cases: 18, percentage: 12.6, color: 'var(--color-teal)' },
  { name: 'Guatemala', cases: 10, percentage: 7.2, color: 'var(--color-sage)' }
]
</script>

<template>
  <div class="reportes-page">
    <PageHeader
      title="Reportes y Estadísticas"
      eyebrow="Analítica del Sistema"
      subtitle="Visualización del volumen de trámites legales, áreas acumuladas y distribución territorial."
    >
      <template #actions>
        <BaseButton variant="outline" size="md">Descargar Excel</BaseButton>
        <BaseButton variant="primary" size="md">Generar Informe PDF</BaseButton>
      </template>
    </PageHeader>

    <!-- Grid de Métricas Principales -->
    <div class="kpi-grid">
      <BaseCard v-for="(kpi, index) in kpis" :key="index" padding="md" hoverable>
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">{{ kpi.title }}</span>
            <BaseBadge :variant="kpi.badgeVariant" size="sm">{{ kpi.change }}</BaseBadge>
          </div>
          <p class="kpi-value">{{ kpi.value }}</p>
        </div>
      </BaseCard>
    </div>

    <!-- Sección de Gráficos y Distribución -->
    <div class="stats-grid">
      <BaseCard>
        <template #header>
          <div class="card-header-flex">
            <h3>Distribución por Departamento</h3>
            <BaseBadge variant="teal">Territorial</BaseBadge>
          </div>
        </template>

        <div class="progress-list">
          <div v-for="dept in departmentStats" :key="dept.name" class="progress-item">
            <div class="progress-labels">
              <span class="dept-name">{{ dept.name }}</span>
              <span class="dept-cases font-mono">{{ dept.cases }} trámites ({{ dept.percentage }}%)</span>
            </div>
            <div class="progress-bar-bg">
              <div
                class="progress-bar-fill"
                :style="{ width: `${dept.percentage}%`, backgroundColor: dept.color }"
              ></div>
            </div>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <template #header>
          <div class="card-header-flex">
            <h3>Resumen Metrológico Legal</h3>
            <BaseBadge variant="coral">Unidades Oficiales</BaseBadge>
          </div>
        </template>

        <div class="units-summary">
          <div class="unit-box">
            <span class="unit-title">Factor de conversión del sistema</span>
            <p class="unit-math font-mono">1 vara = {{ CONVERSION_FACTORS.VARA_TO_M }} m</p>
            <p class="unit-desc text-muted">
              Equivalencia utilizada para los cálculos de terrenos del sistema.
            </p>
          </div>

          <div class="unit-box">
            <span class="unit-title">Factor de Superficie Cuadrada</span>
            <p class="unit-math font-mono">1 v² = {{ CONVERSION_FACTORS.VARA2_TO_M2.toFixed(6) }} m²</p>
            <p class="unit-desc text-muted">
              1 vara cuadrada = {{ CONVERSION_FACTORS.VARA_TO_M }} × {{ CONVERSION_FACTORS.VARA_TO_M }} m². 1 cuerda = 441 varas cuadradas estándar.
            </p>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.reportes-page {
  display: flex;
  flex-direction: column;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kpi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kpi-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-value {
  font-size: 1.875rem;
  font-weight: 800;
  color: var(--color-text-title);
  margin: 0;
  letter-spacing: -0.02em;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.card-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.card-header-flex h3 {
  font-size: 1.0625rem;
  margin: 0;
}

.progress-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-bottom: 0.4rem;
}

.dept-name {
  font-weight: 600;
  color: var(--color-text-title);
}

.dept-cases {
  color: var(--color-text-muted);
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s ease;
}

.units-summary {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.unit-box {
  background-color: var(--color-bg-subtle);
  padding: 1.15rem;
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-teal);
}

.unit-title {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-title);
}

.unit-math {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-deep-teal);
  margin: 0.35rem 0;
}

.unit-desc {
  font-size: 0.8125rem;
  margin: 0;
  line-height: 1.45;
}

.font-mono { font-family: var(--font-mono); }
.text-muted { color: var(--color-text-muted); }

@media (max-width: 860px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
