<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/common/PageHeader.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseBadge from '@/components/common/BaseBadge.vue'
import { CONVERSION_FACTORS } from '@/utils/constants'

const VARA_TO_M = CONVERSION_FACTORS.VARA_TO_M

// Datos del formulario
const folioNumber = ref('452-B')
const fincaNumber = ref('1284')
const libroNumber = ref('89')
const department = ref('Quetzaltenango')
const municipality = ref('Quetzaltenango')

// Medidas de colindancias
const measurements = ref([
  { id: 1, side: 'Norte', measure: 25.5, unit: 'm', borderWith: 'Callejón Principal' },
  { id: 2, side: 'Sur', measure: 26.0, unit: 'm', borderWith: 'Propiedad de Carlos Méndez' },
  { id: 3, side: 'Este', measure: 40.2, unit: 'm', borderWith: 'Lote 14 - Familia Morales' },
  { id: 4, side: 'Oeste', measure: 39.8, unit: 'm', borderWith: 'Lote 12 - Ana López' }
])

const isCalculating = ref(false)
const showSuccessAlert = ref(false)

// Cálculo aproximado de área
const calculatedAreaM2 = computed(() => {
  const n = measurements.value.find(m => m.side === 'Norte')?.measure || 0
  const s = measurements.value.find(m => m.side === 'Sur')?.measure || 0
  const e = measurements.value.find(m => m.side === 'Este')?.measure || 0
  const o = measurements.value.find(m => m.side === 'Oeste')?.measure || 0

  const avgWidth = (n + s) / 2
  const avgHeight = (e + o) / 2
  return (avgWidth * avgHeight).toFixed(2)
})

const calculatedAreaVaras = computed(() => {
  const m2 = parseFloat(calculatedAreaM2.value)
  const v2 = m2 / (VARA_TO_M * VARA_TO_M)
  return v2.toFixed(2)
})

const calculateArea = () => {
  isCalculating.value = true
  setTimeout(() => {
    isCalculating.value = false
    showSuccessAlert.value = true
  }, 400)
}
</script>

<template>
  <div class="formulario-page">
    <PageHeader
      title="Cálculo de Área de Terrenos"
      eyebrow="Trámites Legales & Topográficos"
      subtitle="Registro y cálculo geométrico de terrenos a partir de medidas de escrituras públicas."
    >
      <template #actions>
        <BaseButton variant="outline" size="md">
          Limpiar campos
        </BaseButton>
        <BaseButton
          variant="primary"
          size="md"
          :loading="isCalculating"
          @click="calculateArea"
        >
          Calcular Área
        </BaseButton>
      </template>
    </PageHeader>

    <!-- Alerta de cálculo exitoso -->
    <div v-if="showSuccessAlert" class="alert-banner">
      <span>Cálculo procesado exitosamente conforme a los datos de escritura.</span>
      <button class="alert-close" @click="showSuccessAlert = false">&times;</button>
    </div>

    <div class="form-grid">
      <!-- Columna Izquierda: Datos de la Finca y Medidas -->
      <div class="grid-main">
        <!-- Tarjeta 1: Datos Registrales -->
        <BaseCard class="mb-4">
          <template #header>
            <div class="card-title-group">
              <h3>1. Datos Registrales de la Escritura</h3>
              <BaseBadge variant="teal">Registro RGP</BaseBadge>
            </div>
          </template>

          <div class="inputs-grid">
            <div class="form-field">
              <label for="finca">No. de Finca</label>
              <input id="finca" v-model="fincaNumber" type="text" placeholder="Ej. 1284" />
            </div>
            <div class="form-field">
              <label for="folio">Folio</label>
              <input id="folio" v-model="folioNumber" type="text" placeholder="Ej. 452-B" />
            </div>
            <div class="form-field">
              <label for="libro">Libro</label>
              <input id="libro" v-model="libroNumber" type="text" placeholder="Ej. 89" />
            </div>
            <div class="form-field">
              <label for="dept">Departamento</label>
              <select id="dept" v-model="department">
                <option value="Quetzaltenango">Quetzaltenango</option>
                <option value="Guatemala">Guatemala</option>
                <option value="San Marcos">San Marcos</option>
                <option value="Totonicapán">Totonicapán</option>
              </select>
            </div>
          </div>
        </BaseCard>

        <!-- Tarjeta 2: Colindancias y Medidas -->
        <BaseCard>
          <template #header>
            <div class="card-title-group">
              <h3>2. Colindancias y Medidas de Lados</h3>
              <BaseBadge variant="sage">4 Puntos Cardinales</BaseBadge>
            </div>
          </template>

          <div class="table-responsive">
            <table class="measurements-table">
              <thead>
                <tr>
                  <th>Punto Cardinal</th>
                  <th>Medida</th>
                  <th>Unidad</th>
                  <th>Colinda con</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in measurements" :key="item.id">
                  <td>
                    <span class="side-tag">{{ item.side }}</span>
                  </td>
                  <td>
                    <input
                      v-model.number="item.measure"
                      type="number"
                      step="0.01"
                      class="table-input"
                    />
                  </td>
                  <td>
                    <select v-model="item.unit" class="table-select">
                      <option value="m">Metros (m)</option>
                      <option value="vara">Varas (v)</option>
                    </select>
                  </td>
                  <td>
                    <input
                      v-model="item.borderWith"
                      type="text"
                      class="table-input"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>

      <!-- Columna Derecha: Resumen de Cálculos y Resultados -->
      <div class="grid-sidebar">
        <BaseCard class="sticky-card">
          <template #header>
            <div class="card-title-group">
              <h3>Resultado del Cálculo</h3>
              <BaseBadge variant="coral">Estimación</BaseBadge>
            </div>
          </template>

          <div class="result-box">
            <div class="result-metric">
              <span class="metric-label">Área en Metros Cuadrados</span>
              <span class="metric-value">{{ calculatedAreaM2 }} <small>m²</small></span>
            </div>

            <div class="result-divider"></div>

            <div class="result-metric">
              <span class="metric-label">Equivalente en Varas Cuadradas</span>
              <span class="metric-value metric-secondary">{{ calculatedAreaVaras }} <small>v²</small></span>
            </div>
          </div>

          <div class="info-note">
            <p>
              <strong>Factor de conversión:</strong> 1 vara = {{ VARA_TO_M }} metros lineales, según el factor utilizado por el sistema.
            </p>
          </div>

          <template #footer>
            <BaseButton
              variant="primary"
              size="lg"
              block
              :loading="isCalculating"
              @click="calculateArea"
            >
              Guardar en Historial
            </BaseButton>
          </template>
        </BaseCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.formulario-page {
  display: flex;
  flex-direction: column;
}

.mb-4 {
  margin-bottom: 1.5rem;
}

.card-title-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.card-title-group h3 {
  font-size: 1.125rem;
  margin: 0;
  color: var(--color-text-title);
}

.alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-primary-subtle);
  border: 1px solid var(--color-coral);
  color: var(--color-text-title);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.alert-close {
  font-size: 1.25rem;
  line-height: 1;
  color: var(--color-coral);
  cursor: pointer;
}

.form-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

.inputs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-field label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.table-responsive {
  overflow-x: auto;
}

.measurements-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.measurements-table th {
  text-align: left;
  padding: 0.75rem 0.5rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border-subtle);
}

.measurements-table td {
  padding: 0.6rem 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.side-tag {
  display: inline-block;
  font-weight: 700;
  color: var(--color-text-title);
  font-family: var(--font-mono);
}

.table-input, .table-select {
  width: 100%;
  padding: 0.4rem 0.6rem;
}

.result-box {
  background-color: var(--color-bg-subtle);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  border: 1px dashed var(--color-sage);
}

.result-metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-coral);
  line-height: 1.1;
  font-family: var(--font-mono);
}

.metric-value small {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.metric-secondary {
  color: var(--color-deep-teal);
}

.result-divider {
  height: 1px;
  background-color: var(--color-border-subtle);
  margin: 1rem 0;
}

.info-note {
  margin-top: 1rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

@media (max-width: 960px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
