<script setup>
import { toSquareVaras } from '../domain/units.js'
defineProps({ result: { type: Object, required: true }, record: { type: Object, default: null }, current: Boolean, converted: Boolean })
</script>

<template>
  <section class="result" aria-live="polite" aria-label="Resultado geométrico local">
    <p class="eyebrow">Área estimada del dibujo</p>
    <p class="area">{{ result.area.toFixed(2) }} <small>m²</small></p>
    <p>≈ {{ toSquareVaras(result.area).toFixed(2) }} varas²</p>
    <p class="closure">{{ converted ? 'Medidas convertidas por el servidor.' : 'Vista previa con las medidas del croquis.' }}</p>
    <template v-if="record">
      <p class="registered">Área registrada: <strong>{{ record.totalAreaSquareMeters.toFixed(2) }} m²</strong> · Cálculo {{ record.id }}</p>
      <p class="closure">{{ current ? 'Esta versión está guardada.' : 'Hay cambios posteriores al registro mostrado.' }}</p>
      <p v-if="Math.abs(record.totalAreaSquareMeters - result.area) > 0.01" class="closure">El cálculo registrado utiliza las longitudes y puede diferir de la superficie del dibujo.</p>
      <p v-if="record.legalNotice" class="closure">{{ record.legalNotice }}</p>
    </template>
  </section>
</template>

<style scoped>
.result { padding: 1.2rem; background: var(--color-accent-soft-bg); border: 1px solid var(--color-soft-coral); border-radius: var(--radius-sm); }
p { margin: 0 0 .5rem; }
.eyebrow { font-size: .75rem; color: var(--color-text-muted); }
.area { color: var(--color-deep-teal); font-size: 2rem; font-weight: 700; }
.area small { font-size: 1rem; }
.closure { font-size: .8rem; color: var(--color-text-muted); line-height: 1.5; }
.registered { padding-top: .6rem; border-top: 1px solid var(--color-border-medium); font-size: .85rem; }
</style>
